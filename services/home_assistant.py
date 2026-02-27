"""Home Assistant HTTP integration service.

Connects to a local HA instance using stored credentials (AppSetting).
Provides entity listing, smart meter import, and historical backfill.
"""
import json
import logging
import ssl
import urllib.request
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# HA entity_id prefix → utility_type heuristics
_UTILITY_HINTS = [
    ('energy', 'villany'),
    ('electricity', 'villany'),
    ('power', 'villany'),
    ('villany', 'villany'),
    ('water', 'viz'),
    ('viz', 'viz'),
    ('gas', 'gaz'),
    ('gaz', 'gaz'),
]


def _ha_request(path: str, base_url: str, token: str, method: str = 'GET', body=None):
    """Make an authenticated request to the HA API."""
    url = f"{base_url.rstrip('/')}{path}"
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
        return json.loads(resp.read())


def _guess_utility(entity_id: str, friendly_name: str = '') -> str | None:
    text = (entity_id + ' ' + friendly_name).lower()
    for keyword, utype in _UTILITY_HINTS:
        if keyword in text:
            return utype
    return None


def get_entities(base_url: str, token: str) -> list[dict]:
    """Return all HA states, enriched with utility_type guess."""
    states = _ha_request('/api/states', base_url, token)
    result = []
    for s in states:
        eid = s.get('entity_id', '')
        attrs = s.get('attributes', {})
        friendly = attrs.get('friendly_name', eid)
        unit = attrs.get('unit_of_measurement', '')
        state_val = s.get('state', '')
        result.append({
            'entity_id': eid,
            'friendly_name': friendly,
            'state': state_val,
            'unit': unit,
            'utility_type': _guess_utility(eid, friendly),
        })
    return result


def create_ha_smart_meter(db, SmartMeterDevice, property_id: int, entity_id: str,
                          utility_type: str, name: str | None = None) -> SmartMeterDevice:
    """Create or update a SmartMeterDevice for a HA entity."""
    device_id = f"ha_{property_id}_{entity_id}"
    existing = SmartMeterDevice.query.filter_by(device_id=device_id).first()
    if existing:
        existing.utility_type = utility_type
        existing.name = name or entity_id
        existing.is_active = True
        db.session.flush()
        return existing
    dev = SmartMeterDevice(
        property_id=property_id,
        utility_type=utility_type,
        device_id=device_id,
        source='ha',
        name=name or entity_id,
        ttn_app_id=entity_id,   # reuse field to store entity_id
        value_field='state',
        multiplier=1.0,
        offset=0.0,
        is_active=True,
        min_interval_minutes=60,
    )
    db.session.add(dev)
    db.session.flush()
    return dev


def backfill_monthly(db, MeterReading, SmartMeterDevice, Tariff,
                     base_url: str, token: str,
                     property_id: int, months_back: int = 12,
                     until_data_start: bool = False,
                     device_ids: list[int] | None = None) -> dict:
    """Fetch historical monthly readings from HA and insert as MeterReadings."""
    devices = SmartMeterDevice.query.filter_by(property_id=property_id, source='ha', is_active=True).all()
    if device_ids:
        devices = [d for d in devices if d.id in device_ids]
    if not devices:
        return {'created': 0, 'devices': [], 'no_targets': True}

    now_utc = datetime.now(timezone.utc)
    created_total = 0
    device_results = []

    for dev in devices:
        entity_id = dev.ttn_app_id
        if not entity_id:
            continue

        # Determine how far back to go
        go_back = months_back
        if until_data_start:
            earliest = MeterReading.query.filter_by(
                property_id=property_id, utility_type=dev.utility_type
            ).order_by(MeterReading.reading_date.asc()).first()
            if earliest:
                delta_days = (now_utc.date() - earliest.reading_date).days
                go_back = max(1, delta_days // 30 + 2)

        start_dt = now_utc - timedelta(days=go_back * 31)
        start_str = start_dt.strftime('%Y-%m-%dT%H:%M:%S+00:00')

        try:
            history = _ha_request(
                f'/api/history/period/{start_str}?filter_entity_id={entity_id}&minimal_response=true',
                base_url, token
            )
        except Exception as exc:
            logger.warning("HA history fetch failed for %s: %s", entity_id, exc)
            continue

        if not history or not history[0]:
            continue

        # Sample ~monthly: take last entry of each calendar month
        monthly_samples = {}
        for entry in history[0]:
            ts_str = entry.get('last_changed') or entry.get('last_updated', '')
            state_val = entry.get('state', '')
            try:
                ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                val = float(state_val)
                month_key = (ts.year, ts.month)
                monthly_samples[month_key] = (ts.date(), val)
            except (ValueError, TypeError):
                continue

        # Get active tariff
        tariff = Tariff.query.filter_by(
            utility_type=dev.utility_type, is_active=True
        ).order_by(Tariff.effective_from.desc()).first()
        tariff_id = tariff.id if tariff else None
        rate = tariff.rate_huf if tariff else 0

        prev_val = None
        created_for_device = 0
        for month_key in sorted(monthly_samples.keys()):
            reading_date, val = monthly_samples[month_key]
            # Skip if reading already exists for this date+utility
            exists = MeterReading.query.filter_by(
                property_id=property_id, utility_type=dev.utility_type,
                reading_date=reading_date
            ).first()
            if exists:
                prev_val = val
                continue

            consumption = round(val - prev_val, 4) if prev_val is not None else None
            cost = round(consumption * rate, 2) if consumption is not None and consumption > 0 else None

            reading = MeterReading(
                property_id=property_id,
                utility_type=dev.utility_type,
                value=val,
                prev_value=prev_val,
                consumption=consumption if (consumption is not None and consumption > 0) else None,
                tariff_id=tariff_id,
                cost_huf=cost,
                reading_date=reading_date,
                source='smart_mqtt',
                notes='HA backfill',
            )
            db.session.add(reading)
            prev_val = val
            created_for_device += 1

        created_total += created_for_device
        device_results.append(dev.id)

    db.session.commit()
    return {'created': created_total, 'devices': device_results}
