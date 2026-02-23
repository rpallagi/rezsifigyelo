"""Smart meter data processing service.

Shared logic for both TTN webhooks and MQTT messages.
Reuses the same consumption + cost calculation as manual readings.
"""
import json
import logging
from datetime import datetime, timedelta, date, timezone

from models import db, SmartMeterDevice, SmartMeterLog, MeterReading, Property

logger = logging.getLogger('smart_meter')


def get_last_reading(property_id, utility_type):
    """Get most recent reading for a property/utility combo."""
    return MeterReading.query.filter_by(
        property_id=property_id,
        utility_type=utility_type
    ).order_by(MeterReading.reading_date.desc(), MeterReading.id.desc()).first()


def get_active_tariff(tariff_group_id, utility_type):
    """Get currently active tariff."""
    from models import Tariff
    return Tariff.query.filter_by(
        tariff_group_id=tariff_group_id,
        utility_type=utility_type
    ).filter(Tariff.valid_from <= date.today()
    ).order_by(Tariff.valid_from.desc()).first()


def _to_float(val):
    """Best-effort numeric conversion for meter values."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        try:
            return float(val.strip().replace(',', '.'))
        except (ValueError, TypeError):
            return None
    return None


def _extract_by_path(data, path):
    """Extract value from nested dict using dotted paths (e.g. a.b.c)."""
    if not isinstance(data, dict) or not path:
        return None

    current = data
    for part in str(path).split('.'):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _normalize_timestamp(ts):
    """Normalize timestamp to naive UTC datetime."""
    if ts is None:
        return datetime.utcnow()

    if isinstance(ts, str):
        # Accept ISO-8601 strings, including trailing Z.
        try:
            ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        except Exception:
            return datetime.utcnow()

    if not isinstance(ts, datetime):
        return datetime.utcnow()

    if ts.tzinfo is not None:
        return ts.astimezone(timezone.utc).replace(tzinfo=None)

    return ts


def extract_value_from_payload(payload, value_field):
    """Extract a numeric value from payload.

    Supports:
      - direct numeric/string values
      - flat dict fields
      - nested telemetry/data/payload dicts
      - dotted value_field paths (e.g. telemetry.energy_kwh_total)
    """
    direct = _to_float(payload)
    if direct is not None:
        return direct

    if not isinstance(payload, dict):
        return None

    candidate_containers = [payload]
    for key in ('telemetry', 'data', 'payload', 'reading', 'decoded_payload', 'uplink_message'):
        nested = payload.get(key)
        if isinstance(nested, dict):
            candidate_containers.append(nested)

    # 1) Try configured field first (including dotted path)
    for container in candidate_containers:
        val = _extract_by_path(container, value_field) if value_field else None
        parsed = _to_float(val)
        if parsed is not None:
            return parsed

    # 2) Fallback common keys (canonical telemetry first)
    fallback_keys = [
        'energy_kwh_total', 'energy_m3_total', 'water_m3_total',
        'meter_value', 'value', 'energy', 'total_energy',
        'total_power_import_kwh', 'total',
        'volume', 'total_volume', 'index', 'meter_reading',
        'reading', 'counter',
    ]

    for container in candidate_containers:
        for key in fallback_keys:
            parsed = _to_float(container.get(key))
            if parsed is not None:
                return parsed

    return None


def process_smart_meter_reading(device_id, raw_value, source,
                                 raw_payload=None, timestamp=None):
    """Core processing pipeline for smart meter data.

    Args:
        device_id: External device identifier (TTN device_id or MQTT id)
        raw_value: Raw payload value (dict for TTN decoded_payload, or number)
        source: 'ttn' or 'mqtt'
        raw_payload: Full raw payload as string (for logging)
        timestamp: Message timestamp (defaults to now)

    Returns:
        dict with 'status' ('ok', 'rejected', 'error') and details
    """
    timestamp = _normalize_timestamp(timestamp)

    # 1. Look up device
    device = SmartMeterDevice.query.filter_by(device_id=device_id).first()
    if not device:
        _log_event(device_id, source, raw_payload, None, None,
                   'rejected', f'Unknown device_id: {device_id}')
        return {'status': 'rejected', 'error': f'Unknown device: {device_id}'}

    if not device.is_active:
        _log_event(device_id, source, raw_payload, None, None,
                   'rejected', 'Device is inactive')
        return {'status': 'rejected', 'error': 'Device inactive'}

    # 2. Extract numeric value from payload
    parsed_value = extract_value_from_payload(raw_value, device.value_field)
    if parsed_value is None:
        msg = f'Could not extract value from payload using field: {device.value_field}'
        device.last_error = msg
        db.session.commit()
        _log_event(device_id, source, raw_payload, None, None, 'error', msg)
        return {'status': 'error', 'error': msg}

    # 3. Apply multiplier + offset
    final_value = parsed_value * device.multiplier + device.offset

    # 4. Deduplication: check min_interval
    if device.last_seen_at:
        min_delta = timedelta(minutes=device.min_interval_minutes)
        if (timestamp - device.last_seen_at) < min_delta:
            _log_event(device_id, source, raw_payload, parsed_value, final_value,
                       'rejected', f'Too soon (min interval: {device.min_interval_minutes}min)')
            return {'status': 'rejected', 'error': 'Too soon since last reading'}

    # 5. Sanity check: value should generally be >= prev value for cumulative meters
    last = get_last_reading(device.property_id, device.utility_type)
    prev_value = last.value if last else None

    if prev_value is not None and final_value < prev_value:
        logger.warning(f"Smart meter {device_id}: value {final_value} < prev {prev_value} (meter reset?)")
        # Don't reject — meter resets do happen. Log but allow.

    # 6. Calculate consumption and cost
    consumption = None
    cost_huf = None
    tariff = None

    if prev_value is not None and final_value >= prev_value:
        consumption = round(final_value - prev_value, 3)

    prop = Property.query.get(device.property_id)
    if prop and prop.tariff_group_id:
        tariff = get_active_tariff(prop.tariff_group_id, device.utility_type)
        if tariff and consumption is not None:
            cost_huf = round(consumption * tariff.rate_huf, 2)

    # 7. Create MeterReading
    source_tag = f'smart_{source}'
    reading = MeterReading(
        property_id=device.property_id,
        utility_type=device.utility_type,
        value=final_value,
        prev_value=prev_value,
        consumption=consumption,
        tariff_id=tariff.id if tariff else None,
        cost_huf=cost_huf,
        reading_date=timestamp.date() if isinstance(timestamp, datetime) else date.today(),
        notes=f'Okos mero ({source.upper()}: {device.name or device.device_id})',
        source=source_tag,
    )
    db.session.add(reading)

    # 8. Auto-create csatorna reading for water (same as admin_reading_submit)
    if device.utility_type == 'viz' and consumption is not None:
        csatorna_tariff = None
        if prop and prop.tariff_group_id:
            csatorna_tariff = get_active_tariff(prop.tariff_group_id, 'csatorna')

        csatorna_cost = round(consumption * csatorna_tariff.rate_huf, 2) if csatorna_tariff else None
        csatorna_last = get_last_reading(device.property_id, 'csatorna')
        csatorna_prev = csatorna_last.value if csatorna_last else None

        csatorna_reading = MeterReading(
            property_id=device.property_id,
            utility_type='csatorna',
            value=(csatorna_prev or 0) + consumption,
            prev_value=csatorna_prev,
            consumption=consumption,
            tariff_id=csatorna_tariff.id if csatorna_tariff else None,
            cost_huf=csatorna_cost,
            reading_date=timestamp.date() if isinstance(timestamp, datetime) else date.today(),
            notes=f'Auto csatorna ({source.upper()} viz mero)',
            source=source_tag,
        )
        db.session.add(csatorna_reading)

    # 9. Update device metadata
    device.last_seen_at = timestamp
    device.last_raw_value = parsed_value
    device.last_error = None

    db.session.flush()

    # 10. Log success
    log_entry = _log_event(device_id, source, raw_payload, parsed_value, final_value,
                           'ok', None, reading.id)

    db.session.commit()

    logger.info(f"Smart meter {device_id}: value={final_value}, consumption={consumption}, "
                f"cost={cost_huf}, reading_id={reading.id}")

    return {
        'status': 'ok',
        'reading_id': reading.id,
        'value': final_value,
        'consumption': consumption,
        'cost_huf': cost_huf,
    }


def _log_event(device_id, source, raw_payload, parsed_value, final_value,
               status, error_message=None, reading_id=None):
    """Create an audit log entry."""
    log = SmartMeterLog(
        device_id=device_id,
        source=source,
        raw_payload=raw_payload[:10000] if raw_payload and len(raw_payload) > 10000 else raw_payload,
        parsed_value=parsed_value,
        final_value=final_value,
        status=status,
        error_message=error_message,
        reading_id=reading_id,
    )
    db.session.add(log)
    return log
