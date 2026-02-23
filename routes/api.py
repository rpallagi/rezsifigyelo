"""REST API endpoints for the React frontend.

All endpoints return JSON and are prefixed with /api.
Tenant auth uses session (property_id).
Admin auth uses Flask-Login (current_user).
"""
import os
import subprocess
import bcrypt
import base64
from datetime import date, datetime, timezone, timedelta
from flask import (
    Blueprint, request, jsonify, session, current_app, send_from_directory
)
from flask_login import login_user, logout_user, login_required, current_user
from models import (
    db, AdminUser, TenantUser, Property, TariffGroup, Tariff,
    MeterReading, Payment, MaintenanceLog, Todo, Document, MarketingContent,
    PropertyTax, CommonFee, CommonFeePayment, RentalTaxConfig,
    TenantHistory, HandoverChecklist, ChatMessage, MeterInfo,
    SmartMeterDevice, SmartMeterLog, WifiNetwork, AppSetting
)
import json
import uuid
from urllib import request as urlrequest, error as urlerror
from urllib.parse import urlparse
from werkzeug.utils import secure_filename
from PIL import Image, ImageOps

api_bp = Blueprint('api', __name__, url_prefix='/api')


# ============================================================
# Helpers
# ============================================================

def get_active_tariff(tariff_group_id, utility_type):
    return Tariff.query.filter_by(
        tariff_group_id=tariff_group_id,
        utility_type=utility_type
    ).filter(Tariff.valid_from <= date.today()
    ).order_by(Tariff.valid_from.desc()).first()


def get_last_reading(property_id, utility_type):
    return MeterReading.query.filter_by(
        property_id=property_id,
        utility_type=utility_type
    ).order_by(MeterReading.reading_date.desc(), MeterReading.id.desc()).first()


def property_to_dict(p, include_readings=False):
    d = {
        'id': p.id,
        'name': p.name,
        'property_type': p.property_type,
        'contact_name': p.contact_name,
        'contact_phone': p.contact_phone,
        'contact_email': p.contact_email,
        'address': p.address,
        'notes': p.notes,
        'purchase_price': p.purchase_price,
        'monthly_rent': p.monthly_rent,
        'tariff_group_id': p.tariff_group_id,
        'tariff_group_name': p.tariff_group.name if p.tariff_group else None,
        'avatar_filename': p.avatar_filename,
    }
    if include_readings:
        lv = get_last_reading(p.id, 'villany')
        lw = get_last_reading(p.id, 'viz')
        d['last_villany'] = reading_summary(lv) if lv else None
        d['last_viz'] = reading_summary(lw) if lw else None
    return d


def reading_summary(r):
    if not r:
        return None
    return {
        'value': r.value,
        'consumption': r.consumption,
        'cost_huf': r.cost_huf,
        'reading_date': r.reading_date.isoformat() if r.reading_date else None,
    }


def reading_to_dict(r):
    return {
        'id': r.id,
        'property_id': r.property_id,
        'property_name': r.property.name if r.property else None,
        'utility_type': r.utility_type,
        'value': r.value,
        'prev_value': r.prev_value,
        'consumption': r.consumption,
        'cost_huf': r.cost_huf,
        'photo_filename': r.photo_filename,
        'reading_date': r.reading_date.isoformat() if r.reading_date else None,
        'notes': r.notes,
        'source': getattr(r, 'source', 'manual'),
    }


def allowed_file(filename):
    allowed = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed


def allowed_document(filename):
    allowed = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed


def resize_photo(filepath, max_size=1920):
    try:
        with Image.open(filepath) as img:
            img = ImageOps.exif_transpose(img)
            if max(img.size) > max_size:
                img.thumbnail((max_size, max_size), Image.LANCZOS)
                img.save(filepath, quality=85, optimize=True)
    except Exception as e:
        print(f"[WARN] Photo resize failed: {e}")


def _git_run(cmd):
    """Run a git command and return output."""
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30,
            cwd=current_app.config.get('BASE_DIR', '/app')
        )
        return result.stdout.strip()
    except Exception as e:
        return str(e)


def _to_float(value):
    """Best-effort float conversion."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip().replace(',', '.'))
        except Exception:
            return None
    return None


def _slugify(value):
    safe = ''.join(ch.lower() if ch.isalnum() or ch in '-_.' else '-' for ch in str(value or ''))
    while '--' in safe:
        safe = safe.replace('--', '-')
    safe = safe.strip('-')
    return safe or 'meter'


def _guess_utility(entity_id, unit='', device_class=''):
    text = f"{entity_id} {unit} {device_class}".lower()

    if 'gas' in text or 'gaz' in text:
        return 'gaz'
    if 'water' in text or 'viz' in text:
        return 'viz'
    if any(k in text for k in ('kwh', 'wh', 'w ', ' kw', 'power', 'energy', 'electric', 'villany', 'p1')):
        return 'villany'

    unit_lower = str(unit or '').lower()
    if unit_lower in ('m3', 'm³'):
        return 'gaz'

    return 'villany'


def _default_value_field(utility_type):
    if utility_type == 'gaz':
        return 'energy_m3_total'
    if utility_type == 'viz':
        return 'water_m3_total'
    return 'energy_kwh_total'


def _http_json(method, url, headers=None, payload=None, timeout=12):
    req_headers = {'Accept': 'application/json'}
    if headers:
        req_headers.update(headers)

    data = None
    if payload is not None:
        req_headers['Content-Type'] = 'application/json'
        data = json.dumps(payload).encode('utf-8')

    req = urlrequest.Request(url, data=data, headers=req_headers, method=method.upper())
    try:
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode('utf-8', errors='ignore')
            parsed = json.loads(body) if body else {}
            return resp.getcode(), parsed, None
    except urlerror.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        try:
            parsed = json.loads(body) if body else {}
        except Exception:
            parsed = {'raw': body}
        return e.code, parsed, parsed.get('message') if isinstance(parsed, dict) else str(parsed)
    except Exception as e:
        return 0, None, str(e)


def _parse_property_id(value):
    if value in (None, ''):
        return None
    try:
        prop_id = int(value)
    except (TypeError, ValueError):
        return None
    return prop_id if prop_id > 0 else None


def _ha_setting_key(base_key, property_id=None):
    if property_id is None:
        return base_key
    return f'{base_key}_p{property_id}'


def _get_ha_setting_value(base_key, property_id=None, fallback_global=False):
    value = AppSetting.get(_ha_setting_key(base_key, property_id), '').strip()
    if not value and fallback_global and property_id is not None:
        value = AppSetting.get(base_key, '').strip()
    return value


def _set_ha_setting_value(base_key, value, property_id=None):
    AppSetting.set(_ha_setting_key(base_key, property_id), str(value or '').strip())


def _get_ha_settings(property_id=None, fallback_global=False):
    return {
        'ha_name': _get_ha_setting_value('ha_name', property_id, fallback_global),
        'ha_location': _get_ha_setting_value('ha_location', property_id, fallback_global),
        'ha_local_username': _get_ha_setting_value('ha_local_username', property_id, fallback_global),
        'ha_local_password': _get_ha_setting_value('ha_local_password', property_id, fallback_global),
        'ha_base_url': _get_ha_setting_value('ha_base_url', property_id, fallback_global).rstrip('/'),
        'ha_token': _get_ha_setting_value('ha_token', property_id, fallback_global),
        # Tailscale remains global app-level configuration
        'tailscale_api_token': AppSetting.get('tailscale_api_token', '').strip(),
        'tailscale_tailnet': AppSetting.get('tailscale_tailnet', '').strip(),
        'scope': 'property' if property_id is not None else 'global',
        'property_id': property_id,
    }


def _normalize_ha_base_url(value):
    raw = str(value or '').strip().rstrip('/')
    if not raw:
        return '', None

    parsed = urlparse(raw)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        return '', 'Home Assistant URL formátum hibás. Pl.: http://192.168.8.235:8123'

    return raw, None


def _normalize_ha_token(value):
    token = str(value or '').strip()
    if token.lower().startswith('bearer '):
        token = token[7:].strip()

    if not token:
        return '', None

    if 'react router future flag warning' in token.lower():
        return token, 'A Home Assistant token mezőbe konzol figyelmeztetés került. Másold be a valódi Long-Lived Access Tokent.'

    if any(ch.isspace() for ch in token):
        return token, 'Home Assistant token formátum hibás: szóköz/sortörés nem megengedett.'

    try:
        token.encode('ascii')
    except UnicodeEncodeError:
        return token, 'Home Assistant token formátum hibás: csak ASCII karakterek megengedettek.'

    if len(token) < 20:
        return token, 'Home Assistant token túl rövid.'

    return token, None


def _validated_ha_connection_settings(property_id=None, fallback_global=False):
    settings = _get_ha_settings(property_id=property_id, fallback_global=fallback_global)
    raw_url = settings['ha_base_url']
    raw_token = settings['ha_token']

    if not str(raw_url or '').strip():
        return None, None, 'Home Assistant URL hiányzik.', 400
    if not str(raw_token or '').strip():
        return None, None, 'Home Assistant token hiányzik.', 400

    base_url, url_err = _normalize_ha_base_url(raw_url)
    if url_err:
        return None, None, url_err, 400

    token, token_err = _normalize_ha_token(raw_token)
    if token_err:
        return None, None, token_err, 400

    return base_url, token, None, None


def _ha_api_error_response(code, err, fallback_message):
    err_text = str(err or '').strip()
    err_lower = err_text.lower()

    if code in (401, 403):
        return jsonify({'error': 'Home Assistant token érvénytelen vagy lejárt.'}), 401

    if code == 404:
        return jsonify({'error': 'Home Assistant URL hibás. Ellenőrizd a címet (pl. http://IP:8123).'}), 400

    if code == 0 and err_lower:
        if 'timed out' in err_lower:
            return jsonify({'error': 'Home Assistant nem érhető el (timeout).'}), 504
        if 'latin-1' in err_lower or 'ascii' in err_lower:
            return jsonify({'error': 'Home Assistant token formátum hibás. Csak a valódi token értéket másold be.'}), 400
        if any(k in err_lower for k in ('connection refused', 'nodename nor servname', 'name or service not known')):
            return jsonify({'error': 'Home Assistant URL nem érhető el. Ellenőrizd a címet és hálózati elérést.'}), 502

    return jsonify({'error': err_text or fallback_message}), 502


def _ha_auth_header(token):
    return {'Authorization': f'Bearer {token}'} if token else {}


def _extract_ha_entities(states):
    entities = []
    keywords = ('energy', 'power', 'gas', 'water', 'meter', 'consumption', 'import', 'kwh', 'm3', 'm³', 'villany', 'viz', 'gaz')

    for item in states:
        entity_id = str(item.get('entity_id') or '').strip()
        if not entity_id.startswith('sensor.'):
            continue

        attrs = item.get('attributes') or {}
        state_str = str(item.get('state', '')).strip()
        unit = str(attrs.get('unit_of_measurement') or '').strip()
        device_class = str(attrs.get('device_class') or '').strip()
        friendly_name = str(attrs.get('friendly_name') or entity_id)
        numeric = _to_float(state_str) is not None

        text = f"{entity_id} {friendly_name} {unit} {device_class}".lower()
        if not numeric and not any(k in text for k in keywords):
            continue

        utility = _guess_utility(entity_id, unit, device_class)
        entities.append({
            'entity_id': entity_id,
            'friendly_name': friendly_name,
            'unit': unit,
            'state': state_str,
            'utility_type': utility,
            'numeric': numeric,
        })

    entities.sort(key=lambda e: (e['utility_type'], e['friendly_name'].lower(), e['entity_id']))
    return entities


def _unique_device_id(base_device_id):
    candidate = base_device_id
    i = 2
    while SmartMeterDevice.query.filter_by(device_id=candidate).first():
        candidate = f'{base_device_id}-{i}'
        i += 1
    return candidate


# ============================================================
# Health
# ============================================================

@api_bp.route('/health')
def health():
    try:
        db.session.execute(db.text('SELECT 1'))
        db_status = 'ok'
    except Exception:
        db_status = 'error'
    return jsonify({
        'status': 'ok' if db_status == 'ok' else 'degraded',
        'database': db_status,
        'version': current_app.config.get('APP_VERSION', '1.0.0'),
    })


# ============================================================
# Tenant Auth (email + jelszó)
# ============================================================

def tenant_user_to_dict(t):
    return {
        'id': t.id,
        'email': t.email,
        'name': t.name,
        'phone': t.phone,
    }


@api_bp.route('/tenant/login', methods=['POST'])
def tenant_login():
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Add meg az e-mail címedet és a jelszavad!'}), 400

    tenant = TenantUser.query.filter_by(email=email).first()
    if not tenant or not tenant.password_hash:
        return jsonify({'error': 'Hibás e-mail cím vagy jelszó!'}), 401

    if bcrypt.checkpw(password.encode('utf-8'), tenant.password_hash.encode('utf-8')):
        session['tenant_user_id'] = tenant.id

        # If tenant has exactly one property, auto-select it
        props = tenant.properties
        if len(props) == 1:
            session['property_id'] = props[0].id
            session['property_name'] = props[0].name
            return jsonify({
                'success': True,
                'tenant': tenant_user_to_dict(tenant),
                'property': property_to_dict(props[0]),
                'needs_property_select': False,
            })
        elif len(props) > 1:
            return jsonify({
                'success': True,
                'tenant': tenant_user_to_dict(tenant),
                'properties': [{'id': p.id, 'name': p.name, 'property_type': p.property_type} for p in props],
                'needs_property_select': True,
            })
        else:
            return jsonify({'error': 'Nincs ingatlan hozzárendelve a fiókodhoz. Kérlek, fordulj a bérbeadóhoz!'}), 403
    else:
        return jsonify({'error': 'Hibás e-mail cím vagy jelszó!'}), 401


@api_bp.route('/tenant/select-property', methods=['POST'])
def tenant_select_property():
    """After login, if tenant has multiple properties, they select one."""
    tenant_id = session.get('tenant_user_id')
    if not tenant_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    data = request.get_json()
    property_id = data.get('property_id')
    if not property_id:
        return jsonify({'error': 'Válassz ingatlant!'}), 400

    tenant = db.session.get(TenantUser, tenant_id)
    if not tenant:
        return jsonify({'error': 'Felhasználó nem található!'}), 404

    # Check tenant has access to this property
    prop = db.session.get(Property, int(property_id))
    if not prop or prop not in tenant.properties:
        return jsonify({'error': 'Nincs hozzáférésed ehhez az ingatlanhoz!'}), 403

    session['property_id'] = prop.id
    session['property_name'] = prop.name
    return jsonify({
        'success': True,
        'property': property_to_dict(prop),
    })


@api_bp.route('/tenant/register', methods=['POST'])
def tenant_register():
    """Tenant self-registration - admin still needs to assign property."""
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    name = (data.get('name') or '').strip()

    if not email or not password:
        return jsonify({'error': 'E-mail és jelszó kötelező!'}), 400
    if len(password) < 6:
        return jsonify({'error': 'A jelszónak legalább 6 karakter hosszúnak kell lennie!'}), 400

    existing = TenantUser.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': 'Ez az e-mail cím már regisztrálva van!'}), 409

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    tenant = TenantUser(
        email=email,
        password_hash=password_hash,
        name=name or None,
    )
    db.session.add(tenant)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Sikeres regisztráció! A bérbeadó fogja hozzárendelni az ingatlanodat.',
    })


@api_bp.route('/tenant/logout', methods=['POST'])
def tenant_logout():
    session.pop('tenant_user_id', None)
    session.pop('property_id', None)
    session.pop('property_name', None)
    return jsonify({'success': True})


@api_bp.route('/tenant/session')
def tenant_session():
    tenant_id = session.get('tenant_user_id')
    property_id = session.get('property_id')
    if tenant_id:
        tenant = db.session.get(TenantUser, tenant_id)
        if tenant:
            result = {'logged_in': True, 'tenant': tenant_user_to_dict(tenant)}
            if property_id:
                prop = db.session.get(Property, property_id)
                if prop:
                    result['property'] = property_to_dict(prop)
            else:
                # Tenant logged in but no property selected
                props = tenant.properties
                if len(props) == 1:
                    session['property_id'] = props[0].id
                    session['property_name'] = props[0].name
                    result['property'] = property_to_dict(props[0])
                elif len(props) > 1:
                    result['needs_property_select'] = True
                    result['properties'] = [
                        {'id': p.id, 'name': p.name, 'property_type': p.property_type} for p in props
                    ]
            return jsonify(result)
    return jsonify({'logged_in': False})


# ============================================================
# Tenant Dashboard
# ============================================================

@api_bp.route('/tenant/dashboard')
def tenant_dashboard():
    property_id = session.get('property_id')
    if not property_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    prop = Property.query.get(property_id)
    if not prop:
        return jsonify({'error': 'Ingatlan nem található!'}), 404

    lv = get_last_reading(prop.id, 'villany')
    lw = get_last_reading(prop.id, 'viz')
    lg = get_last_reading(prop.id, 'gaz')

    tv = get_active_tariff(prop.tariff_group_id, 'villany')
    tw = get_active_tariff(prop.tariff_group_id, 'viz')
    tc = get_active_tariff(prop.tariff_group_id, 'csatorna')
    tg = get_active_tariff(prop.tariff_group_id, 'gaz')

    # Determine if property has gas meter
    has_gas = MeterInfo.query.filter_by(property_id=prop.id, utility_type='gaz').first() is not None or tg is not None

    # Common fees for tenant
    active_common_fees = CommonFee.query.filter_by(property_id=prop.id, is_active=True).all()
    common_fees_data = [{
        'id': f.id,
        'monthly_amount': f.monthly_amount,
        'bank_account': f.bank_account,
        'recipient': f.recipient,
        'payment_memo': f.payment_memo,
        'frequency': f.frequency,
        'payment_day': f.payment_day,
        'notes': f.notes,
    } for f in active_common_fees]

    # Sparklines: last 12 consumption values
    def get_sparkline(utility_type):
        readings = MeterReading.query.filter_by(
            property_id=prop.id, utility_type=utility_type
        ).order_by(MeterReading.reading_date.asc()).limit(12).all()
        return [r.consumption or 0 for r in readings]

    monthly_total = 0
    if lv and lv.cost_huf:
        monthly_total += lv.cost_huf
    if lw and lw.cost_huf:
        monthly_total += lw.cost_huf
    # Add csatorna
    if lw and lw.consumption and tc:
        monthly_total += lw.consumption * tc.rate_huf
    # Add gas
    if lg and lg.cost_huf:
        monthly_total += lg.cost_huf

    return jsonify({
        'property': property_to_dict(prop),
        'last_villany': reading_summary(lv),
        'last_viz': reading_summary(lw),
        'last_gaz': reading_summary(lg),
        'has_gas': has_gas,
        'common_fees': common_fees_data,
        'tariffs': {
            'villany': {'rate_huf': tv.rate_huf, 'unit': tv.unit} if tv else None,
            'viz': {'rate_huf': tw.rate_huf, 'unit': tw.unit} if tw else None,
            'csatorna': {'rate_huf': tc.rate_huf, 'unit': tc.unit} if tc else None,
            'gaz': {'rate_huf': tg.rate_huf, 'unit': tg.unit} if tg else None,
        },
        'monthly_total': monthly_total,
        'sparklines': {
            'villany': get_sparkline('villany'),
            'viz': get_sparkline('viz'),
            'gaz': get_sparkline('gaz'),
        },
    })


# ============================================================
# Tenant Profile
# ============================================================

@api_bp.route('/tenant/profile')
def tenant_profile():
    property_id = session.get('property_id')
    if not property_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401
    prop = Property.query.get(property_id)
    if not prop:
        return jsonify({'error': 'Ingatlan nem található!'}), 404
    return jsonify(property_to_dict(prop))


# ============================================================
# Tenant Common Fees (read-only)
# ============================================================

@api_bp.route('/tenant/common-fees')
def tenant_common_fees():
    """Tenant-facing: read-only common fee info for their property."""
    property_id = session.get('property_id')
    if not property_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    prop = Property.query.get(property_id)
    if not prop:
        return jsonify({'error': 'Ingatlan nem található!'}), 404

    fees = CommonFee.query.filter_by(property_id=prop.id, is_active=True).all()
    result = [{
        'id': f.id,
        'monthly_amount': f.monthly_amount,
        'bank_account': f.bank_account,
        'recipient': f.recipient,
        'payment_memo': f.payment_memo,
        'frequency': f.frequency,
        'payment_day': f.payment_day,
        'notes': f.notes,
    } for f in fees]
    return jsonify({'fees': result})


# ============================================================
# Tenant Reading
# ============================================================

@api_bp.route('/tenant/reading', methods=['POST'])
def tenant_reading():
    property_id = session.get('property_id')
    if not property_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    prop = Property.query.get(property_id)
    if not prop:
        return jsonify({'error': 'Ingatlan nem található!'}), 404

    # Accept both JSON and multipart (for photo)
    if request.content_type and 'multipart' in request.content_type:
        utility_type = request.form.get('utility_type')
        value_str = request.form.get('value', '').replace(',', '.')
        reading_date_str = request.form.get('reading_date', '')
        notes = request.form.get('notes', '').strip()
    else:
        data = request.get_json()
        utility_type = data.get('utility_type')
        value_str = str(data.get('value', '')).replace(',', '.')
        reading_date_str = data.get('reading_date', '')
        notes = data.get('notes', '').strip()

    if not utility_type or utility_type not in ('villany', 'viz', 'gaz'):
        return jsonify({'error': 'Válassz közüzemi típust!'}), 400

    try:
        value = float(value_str)
    except (ValueError, TypeError):
        return jsonify({'error': 'Érvénytelen mérőállás érték!'}), 400

    try:
        reading_date = date.fromisoformat(reading_date_str) if reading_date_str else date.today()
    except ValueError:
        reading_date = date.today()

    last = get_last_reading(prop.id, utility_type)
    prev_value = last.value if last else None
    consumption = (value - prev_value) if prev_value is not None else None

    tariff = get_active_tariff(prop.tariff_group_id, utility_type)
    cost_huf = None
    if tariff and consumption is not None and consumption >= 0:
        cost_huf = consumption * tariff.rate_huf

    # Photo
    photo_filename = None
    if 'photo' in request.files:
        file = request.files['photo']
        if file and file.filename and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            photo_filename = f"{prop.id}_{utility_type}_{timestamp}.{ext}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], photo_filename)
            file.save(filepath)
            resize_photo(filepath)

    reading_obj = MeterReading(
        property_id=prop.id,
        utility_type=utility_type,
        value=value,
        prev_value=prev_value,
        consumption=consumption,
        tariff_id=tariff.id if tariff else None,
        cost_huf=cost_huf,
        photo_filename=photo_filename,
        reading_date=reading_date,
        notes=notes,
    )
    db.session.add(reading_obj)

    # Auto csatorna
    if utility_type == 'viz' and consumption is not None and consumption >= 0:
        csatorna_tariff = get_active_tariff(prop.tariff_group_id, 'csatorna')
        if csatorna_tariff:
            csatorna_reading = MeterReading(
                property_id=prop.id,
                utility_type='csatorna',
                value=value,
                prev_value=prev_value,
                consumption=consumption,
                tariff_id=csatorna_tariff.id,
                cost_huf=consumption * csatorna_tariff.rate_huf,
                reading_date=reading_date,
                notes='Automatikusan számolva víz alapján',
            )
            db.session.add(csatorna_reading)

    db.session.commit()

    return jsonify({
        'success': True,
        'reading': reading_to_dict(reading_obj),
    })


# ============================================================
# Tenant History + Chart Data
# ============================================================

@api_bp.route('/tenant/history')
def tenant_history():
    property_id = session.get('property_id')
    if not property_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    utility_type = request.args.get('type', 'all')
    query = MeterReading.query.filter_by(property_id=property_id)
    if utility_type != 'all':
        query = query.filter_by(utility_type=utility_type)
    readings = query.order_by(MeterReading.reading_date.desc()).limit(100).all()

    return jsonify({
        'readings': [reading_to_dict(r) for r in readings]
    })


@api_bp.route('/tenant/chart-data')
def tenant_chart_data():
    property_id = session.get('property_id')
    if not property_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    utility_type = request.args.get('type', 'villany')
    limit = min(int(request.args.get('limit', 24)), 100)

    readings = MeterReading.query.filter_by(
        property_id=property_id,
        utility_type=utility_type
    ).order_by(MeterReading.reading_date.asc()).limit(limit).all()

    return jsonify({
        'labels': [r.reading_date.strftime('%Y.%m') for r in readings],
        'values': [r.value for r in readings],
        'consumption': [r.consumption or 0 for r in readings],
        'costs': [r.cost_huf or 0 for r in readings],
    })


# ============================================================
# Uploads (photo serving)
# ============================================================

@api_bp.route('/uploads/<filename>')
def uploaded_photo(filename):
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)


# ============================================================
# Admin Auth
# ============================================================

@api_bp.route('/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    username = data.get('username', '')
    password = data.get('password', '')

    admin = AdminUser.query.filter_by(username=username).first()
    if admin and bcrypt.checkpw(password.encode('utf-8'), admin.password_hash.encode('utf-8')):
        login_user(admin)
        return jsonify({'success': True})
    return jsonify({'error': 'Hibás felhasználónév vagy jelszó!'}), 401


@api_bp.route('/admin/logout', methods=['POST'])
@login_required
def admin_logout():
    logout_user()
    return jsonify({'success': True})


@api_bp.route('/admin/session')
def admin_session_check():
    if current_user.is_authenticated:
        return jsonify({'logged_in': True, 'username': current_user.username})
    return jsonify({'logged_in': False})


# ============================================================
# Admin Dashboard
# ============================================================

@api_bp.route('/admin/dashboard')
@login_required
def admin_dashboard():
    properties = Property.query.order_by(Property.name).all()
    total_payments = db.session.query(db.func.sum(Payment.amount_huf)).scalar() or 0
    pending_todos = Todo.query.filter(Todo.status != 'done').count()
    recent_readings = MeterReading.query.order_by(
        MeterReading.created_at.desc()
    ).limit(10).all()

    return jsonify({
        'total_properties': len(properties),
        'total_readings': MeterReading.query.count(),
        'total_payments': total_payments,
        'pending_todos': pending_todos,
        'properties': [property_to_dict(p) for p in properties],
        'recent_readings': [reading_to_dict(r) for r in recent_readings],
    })


# ============================================================
# Admin Properties CRUD
# ============================================================

@api_bp.route('/admin/properties', methods=['GET'])
@login_required
def admin_properties_list():
    props = Property.query.order_by(Property.name).all()
    tariff_groups = TariffGroup.query.all()
    return jsonify({
        'properties': [property_to_dict(p, include_readings=True) for p in props],
        'tariff_groups': [{'id': tg.id, 'name': tg.name, 'description': tg.description} for tg in tariff_groups],
    })


@api_bp.route('/admin/properties', methods=['POST'])
@login_required
def admin_property_add():
    data = request.get_json()
    name = data.get('name', '').strip()
    tariff_group_id = data.get('tariff_group_id')

    if not name or not tariff_group_id:
        return jsonify({'error': 'Név és tarifa csoport kötelező!'}), 400

    # PIN is optional now (legacy)
    pin = data.get('pin', '')
    pin_hash = bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8') if pin else None

    prop = Property(
        name=name,
        property_type=data.get('property_type', 'lakas'),
        pin_hash=pin_hash,
        tariff_group_id=int(tariff_group_id),
        contact_name=data.get('contact_name') or None,
        contact_phone=data.get('contact_phone') or None,
        contact_email=data.get('contact_email') or None,
        address=data.get('address') or None,
        notes=data.get('notes') or None,
        purchase_price=float(data['purchase_price']) if data.get('purchase_price') else None,
        monthly_rent=float(data['monthly_rent']) if data.get('monthly_rent') else None,
    )
    db.session.add(prop)
    db.session.commit()

    return jsonify({'success': True, 'id': prop.id})


@api_bp.route('/admin/properties/<int:prop_id>', methods=['PUT'])
@login_required
def admin_property_edit(prop_id):
    prop = Property.query.get_or_404(prop_id)
    data = request.get_json()

    prop.name = data.get('name', prop.name).strip()
    prop.property_type = data.get('property_type', prop.property_type)
    prop.tariff_group_id = int(data.get('tariff_group_id', prop.tariff_group_id))
    prop.contact_name = data.get('contact_name') or None
    prop.contact_phone = data.get('contact_phone') or None
    prop.contact_email = data.get('contact_email') or None
    prop.address = data.get('address') or None
    prop.notes = data.get('notes') or None

    if data.get('purchase_price') is not None:
        prop.purchase_price = float(data['purchase_price']) if data['purchase_price'] else None
    if data.get('monthly_rent') is not None:
        prop.monthly_rent = float(data['monthly_rent']) if data['monthly_rent'] else None

    # PIN is optional now (legacy) - only update if provided
    if 'pin' in data:
        new_pin = data.get('pin', '').strip()
        if new_pin:
            prop.pin_hash = bcrypt.hashpw(new_pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        else:
            prop.pin_hash = None

    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>', methods=['DELETE'])
@login_required
def admin_property_delete(prop_id):
    prop = Property.query.get_or_404(prop_id)
    MeterReading.query.filter_by(property_id=prop_id).delete()
    Payment.query.filter_by(property_id=prop_id).delete()
    MaintenanceLog.query.filter_by(property_id=prop_id).delete()
    Todo.query.filter_by(property_id=prop_id).delete()
    db.session.delete(prop)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin Readings
# ============================================================

@api_bp.route('/admin/readings')
@login_required
def admin_readings():
    query = MeterReading.query
    property_id = request.args.get('property_id', type=int)
    utility_type = request.args.get('utility_type')
    if property_id:
        query = query.filter_by(property_id=property_id)
    if utility_type:
        query = query.filter_by(utility_type=utility_type)
    readings = query.order_by(MeterReading.reading_date.desc()).limit(200).all()
    return jsonify({'readings': [reading_to_dict(r) for r in readings]})


# ============================================================
# Admin Payments
# ============================================================

@api_bp.route('/admin/payments', methods=['GET'])
@login_required
def admin_payments_list():
    query = Payment.query
    property_id = request.args.get('property_id', type=int)
    if property_id:
        query = query.filter_by(property_id=property_id)
    payments = query.order_by(Payment.payment_date.desc()).all()
    return jsonify({
        'payments': [{
            'id': p.id,
            'property_id': p.property_id,
            'property_name': p.property.name if p.property else None,
            'amount_huf': p.amount_huf,
            'payment_date': p.payment_date.isoformat() if p.payment_date else None,
            'payment_method': p.payment_method,
            'period_from': p.period_from.isoformat() if p.period_from else None,
            'period_to': p.period_to.isoformat() if p.period_to else None,
            'notes': p.notes,
        } for p in payments]
    })


@api_bp.route('/admin/payments', methods=['POST'])
@login_required
def admin_payment_add():
    data = request.get_json()
    p = Payment(
        property_id=int(data['property_id']),
        amount_huf=float(data['amount_huf']),
        payment_date=date.fromisoformat(data['payment_date']) if data.get('payment_date') else date.today(),
        payment_method=data.get('payment_method') or None,
        period_from=date.fromisoformat(data['period_from']) if data.get('period_from') else None,
        period_to=date.fromisoformat(data['period_to']) if data.get('period_to') else None,
        notes=data.get('notes') or None,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/payments/<int:payment_id>', methods=['PUT'])
@login_required
def admin_payment_edit(payment_id):
    p = Payment.query.get_or_404(payment_id)
    data = request.get_json()
    if data.get('property_id'):
        p.property_id = int(data['property_id'])
    if data.get('amount_huf') is not None:
        p.amount_huf = float(data['amount_huf'])
    if data.get('payment_date'):
        p.payment_date = date.fromisoformat(data['payment_date'])
    p.payment_method = data.get('payment_method', p.payment_method)
    p.period_from = date.fromisoformat(data['period_from']) if data.get('period_from') else p.period_from
    p.period_to = date.fromisoformat(data['period_to']) if data.get('period_to') else p.period_to
    p.notes = data.get('notes', p.notes)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/payments/<int:payment_id>', methods=['DELETE'])
@login_required
def admin_payment_delete(payment_id):
    p = Payment.query.get_or_404(payment_id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin Maintenance
# ============================================================

@api_bp.route('/admin/maintenance', methods=['GET'])
@login_required
def admin_maintenance_list():
    logs = MaintenanceLog.query.order_by(MaintenanceLog.created_at.desc()).all()
    return jsonify({
        'logs': [{
            'id': l.id,
            'property_id': l.property_id,
            'property_name': l.property.name if l.property else None,
            'description': l.description,
            'category': l.category,
            'cost_huf': l.cost_huf,
            'performed_by': l.performed_by,
            'performed_date': l.performed_date.isoformat() if l.performed_date else None,
        } for l in logs]
    })


@api_bp.route('/admin/maintenance', methods=['POST'])
@login_required
def admin_maintenance_add():
    data = request.get_json()
    m = MaintenanceLog(
        property_id=int(data['property_id']) if data.get('property_id') else None,
        description=data['description'],
        category=data.get('category') or None,
        cost_huf=float(data['cost_huf']) if data.get('cost_huf') else 0,
        performed_by=data.get('performed_by') or None,
        performed_date=date.fromisoformat(data['performed_date']) if data.get('performed_date') else None,
    )
    db.session.add(m)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/maintenance/<int:maint_id>', methods=['PUT'])
@login_required
def admin_maintenance_edit(maint_id):
    m = MaintenanceLog.query.get_or_404(maint_id)
    data = request.get_json()
    if data.get('property_id') is not None:
        m.property_id = int(data['property_id']) if data['property_id'] else None
    m.description = data.get('description', m.description)
    m.category = data.get('category', m.category)
    if data.get('cost_huf') is not None:
        m.cost_huf = float(data['cost_huf']) if data['cost_huf'] else 0
    m.performed_by = data.get('performed_by', m.performed_by)
    if data.get('performed_date'):
        m.performed_date = date.fromisoformat(data['performed_date'])
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/maintenance/<int:maint_id>', methods=['DELETE'])
@login_required
def admin_maintenance_delete(maint_id):
    m = MaintenanceLog.query.get_or_404(maint_id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin Todos
# ============================================================

@api_bp.route('/admin/todos', methods=['GET'])
@login_required
def admin_todos_list():
    todos = Todo.query.order_by(
        db.case(
            (Todo.status == 'in_progress', 0),
            (Todo.status == 'pending', 1),
            (Todo.status == 'done', 2),
        ),
        Todo.due_date.asc().nullslast(),
    ).all()
    return jsonify({
        'todos': [{
            'id': t.id,
            'property_id': t.property_id,
            'property_name': t.property.name if t.property else None,
            'title': t.title,
            'description': t.description,
            'priority': t.priority,
            'status': t.status,
            'due_date': t.due_date.isoformat() if t.due_date else None,
        } for t in todos]
    })


@api_bp.route('/admin/todos', methods=['POST'])
@login_required
def admin_todo_add():
    data = request.get_json()
    t = Todo(
        property_id=int(data['property_id']) if data.get('property_id') else None,
        title=data['title'],
        description=data.get('description') or None,
        priority=data.get('priority', 'medium'),
        status='pending',
        due_date=date.fromisoformat(data['due_date']) if data.get('due_date') else None,
    )
    db.session.add(t)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/todos/<int:todo_id>', methods=['PUT'])
@login_required
def admin_todo_edit(todo_id):
    t = Todo.query.get_or_404(todo_id)
    data = request.get_json()
    t.title = data.get('title', t.title)
    t.description = data.get('description', t.description)
    t.priority = data.get('priority', t.priority)
    if data.get('property_id') is not None:
        t.property_id = int(data['property_id']) if data['property_id'] else None
    if data.get('due_date') is not None:
        t.due_date = date.fromisoformat(data['due_date']) if data['due_date'] else None
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/todos/<int:todo_id>/toggle', methods=['POST'])
@login_required
def admin_todo_toggle(todo_id):
    t = Todo.query.get_or_404(todo_id)
    cycle = {'pending': 'in_progress', 'in_progress': 'done', 'done': 'pending'}
    t.status = cycle.get(t.status, 'pending')
    if t.status == 'done':
        t.completed_at = datetime.utcnow()
    else:
        t.completed_at = None
    db.session.commit()
    return jsonify({'success': True, 'new_status': t.status})


@api_bp.route('/admin/todos/<int:todo_id>', methods=['DELETE'])
@login_required
def admin_todo_delete(todo_id):
    t = Todo.query.get_or_404(todo_id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin Tariffs
# ============================================================

@api_bp.route('/admin/tariffs', methods=['GET'])
@login_required
def admin_tariffs_list():
    groups = TariffGroup.query.all()
    return jsonify({
        'tariff_groups': [{
            'id': g.id,
            'name': g.name,
            'description': g.description,
            'tariffs': [{
                'id': t.id,
                'utility_type': t.utility_type,
                'rate_huf': t.rate_huf,
                'unit': t.unit,
                'valid_from': t.valid_from.isoformat() if t.valid_from else None,
            } for t in g.tariffs.order_by(Tariff.utility_type, Tariff.valid_from.desc()).all()]
        } for g in groups]
    })


@api_bp.route('/admin/tariffs', methods=['POST'])
@login_required
def admin_tariff_add():
    data = request.get_json()
    t = Tariff(
        tariff_group_id=int(data['tariff_group_id']),
        utility_type=data['utility_type'],
        rate_huf=float(data['rate_huf']),
        unit=data.get('unit', 'kWh'),
        valid_from=date.fromisoformat(data['valid_from']) if data.get('valid_from') else date.today(),
    )
    db.session.add(t)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/tariffs/<int:tariff_id>', methods=['PUT'])
@login_required
def admin_tariff_edit(tariff_id):
    t = Tariff.query.get_or_404(tariff_id)
    data = request.get_json()
    t.utility_type = data.get('utility_type', t.utility_type)
    t.rate_huf = float(data.get('rate_huf', t.rate_huf))
    t.unit = data.get('unit', t.unit)
    if data.get('valid_from'):
        t.valid_from = date.fromisoformat(data['valid_from'])
    if data.get('tariff_group_id'):
        t.tariff_group_id = int(data['tariff_group_id'])
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/tariffs/<int:tariff_id>', methods=['DELETE'])
@login_required
def admin_tariff_delete(tariff_id):
    t = Tariff.query.get_or_404(tariff_id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin ROI
# ============================================================

@api_bp.route('/admin/roi')
@login_required
def admin_roi():
    props = Property.query.filter(
        Property.purchase_price.isnot(None),
        Property.monthly_rent.isnot(None),
        Property.purchase_price > 0,
        Property.monthly_rent > 0,
    ).all()

    result = []
    for p in props:
        total_maint = db.session.query(db.func.sum(MaintenanceLog.cost_huf)).filter_by(
            property_id=p.id
        ).scalar() or 0

        total_rent_collected = db.session.query(db.func.sum(Payment.amount_huf)).filter_by(
            property_id=p.id
        ).scalar() or 0

        annual_rent = p.monthly_rent * 12
        annual_yield = ((annual_rent - total_maint) / p.purchase_price * 100) if p.purchase_price else 0
        breakeven_months = int(p.purchase_price / p.monthly_rent) if p.monthly_rent else 0

        from dateutil.relativedelta import relativedelta
        breakeven_date = (datetime.now() + relativedelta(months=breakeven_months)).strftime('%Y-%m-%d')

        # Monthly payment data for sparkline (last 12 months)
        from sqlalchemy import extract
        monthly_payments = []
        for m_offset in range(11, -1, -1):
            target = datetime.now() - relativedelta(months=m_offset)
            month_total = db.session.query(db.func.sum(Payment.amount_huf)).filter(
                Payment.property_id == p.id,
                extract('year', Payment.payment_date) == target.year,
                extract('month', Payment.payment_date) == target.month,
            ).scalar() or 0
            monthly_payments.append(month_total)

        # Progress toward break-even (percentage of purchase price recovered)
        progress_pct = round((total_rent_collected / p.purchase_price * 100), 1) if p.purchase_price else 0

        result.append({
            'id': p.id,
            'name': p.name,
            'property_type': p.property_type,
            'purchase_price': p.purchase_price,
            'monthly_rent': p.monthly_rent,
            'total_maintenance': total_maint,
            'total_rent_collected': total_rent_collected,
            'annual_yield': round(annual_yield, 1),
            'breakeven_months': breakeven_months,
            'breakeven_date': breakeven_date,
            'monthly_payments': monthly_payments,
            'progress_pct': min(progress_pct, 100),
        })

    return jsonify({'properties': result})


# ============================================================
# Admin Property Detail
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/detail')
@login_required
def admin_property_detail(prop_id):
    prop = Property.query.get_or_404(prop_id)
    total_readings = MeterReading.query.filter_by(property_id=prop_id).count()
    total_payments = db.session.query(db.func.sum(Payment.amount_huf)).filter_by(
        property_id=prop_id
    ).scalar() or 0
    total_maintenance = db.session.query(db.func.sum(MaintenanceLog.cost_huf)).filter_by(
        property_id=prop_id
    ).scalar() or 0
    total_documents = Document.query.filter_by(property_id=prop_id).count()

    # Current tenant
    current_tenant = None
    tenants = prop.tenants.all() if prop.tenants else []
    if tenants:
        t = tenants[0]
        current_tenant = {'name': t.name, 'email': t.email}

    return jsonify({
        'property': property_to_dict(prop, include_readings=True),
        'stats': {
            'total_readings': total_readings,
            'total_payments': total_payments,
            'total_maintenance': total_maintenance,
            'total_documents': total_documents,
            'current_tenant': current_tenant,
        },
    })


@api_bp.route('/admin/properties/<int:prop_id>/avatar', methods=['PUT', 'POST'])
@login_required
def admin_property_avatar(prop_id):
    prop = Property.query.get_or_404(prop_id)
    if 'avatar' not in request.files:
        return jsonify({'error': 'Nincs fájl!'}), 400
    file = request.files['avatar']
    if not file or not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Nem támogatott fájlformátum!'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    avatar_filename = f"avatar_{prop_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], avatar_filename)
    file.save(filepath)

    # Validate image before proceeding
    try:
        with Image.open(filepath) as img:
            img.verify()
        # Re-open after verify (verify() invalidates the file handle)
        resize_photo(filepath, max_size=512)
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({'error': f'Hibás képfájl: {str(e)}'}), 400

    # Delete old avatar file if exists
    if prop.avatar_filename:
        old_path = os.path.join(current_app.config['UPLOAD_FOLDER'], prop.avatar_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    prop.avatar_filename = avatar_filename
    db.session.commit()
    return jsonify({'success': True, 'avatar_filename': avatar_filename})


# ============================================================
# Admin Property Readings (property-specific with trends)
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/readings')
@login_required
def admin_property_readings(prop_id):
    readings = MeterReading.query.filter_by(property_id=prop_id).order_by(
        MeterReading.reading_date.desc()
    ).limit(100).all()

    # Trends: compare latest 2 readings per utility type
    def get_trend(utility_type):
        last_two = MeterReading.query.filter_by(
            property_id=prop_id, utility_type=utility_type
        ).filter(MeterReading.consumption.isnot(None)).order_by(
            MeterReading.reading_date.desc()
        ).limit(2).all()
        if len(last_two) < 2:
            return None
        current = last_two[0].consumption or 0
        previous = last_two[1].consumption or 0
        change_pct = ((current - previous) / previous * 100) if previous != 0 else 0
        return {
            'current': current,
            'previous': previous,
            'change_pct': round(change_pct, 1),
        }

    # Sparklines: last 12 consumption values (ascending for chart)
    def get_sparkline(utility_type):
        spark_readings = MeterReading.query.filter_by(
            property_id=prop_id, utility_type=utility_type
        ).filter(MeterReading.consumption.isnot(None)).order_by(
            MeterReading.reading_date.asc()
        ).limit(12).all()
        return [r.consumption or 0 for r in spark_readings]

    return jsonify({
        'readings': [reading_to_dict(r) for r in readings],
        'trends': {
            'villany': get_trend('villany'),
            'viz': get_trend('viz'),
            'gaz': get_trend('gaz'),
        },
        'sparklines': {
            'villany': get_sparkline('villany'),
            'viz': get_sparkline('viz'),
            'gaz': get_sparkline('gaz'),
        },
    })


@api_bp.route('/admin/readings', methods=['POST'])
@login_required
def admin_reading_submit():
    """Admin submits a meter reading (same logic as tenant)."""
    if request.content_type and 'multipart' in request.content_type:
        property_id = request.form.get('property_id', type=int)
        utility_type = request.form.get('utility_type')
        value_str = request.form.get('value', '').replace(',', '.')
        reading_date_str = request.form.get('reading_date', '')
        notes = request.form.get('notes', '').strip()
    else:
        data = request.get_json()
        property_id = data.get('property_id')
        utility_type = data.get('utility_type')
        value_str = str(data.get('value', '')).replace(',', '.')
        reading_date_str = data.get('reading_date', '')
        notes = data.get('notes', '').strip()

    if not property_id:
        return jsonify({'error': 'Válassz ingatlant!'}), 400
    prop = Property.query.get_or_404(property_id)

    if not utility_type or utility_type not in ('villany', 'viz', 'gaz'):
        return jsonify({'error': 'Válassz közüzemi típust!'}), 400

    try:
        value = float(value_str)
    except (ValueError, TypeError):
        return jsonify({'error': 'Érvénytelen mérőállás érték!'}), 400

    try:
        reading_date = date.fromisoformat(reading_date_str) if reading_date_str else date.today()
    except ValueError:
        reading_date = date.today()

    last = get_last_reading(prop.id, utility_type)
    prev_value = last.value if last else None
    consumption = (value - prev_value) if prev_value is not None else None

    tariff = get_active_tariff(prop.tariff_group_id, utility_type)
    cost_huf = None
    if tariff and consumption is not None and consumption >= 0:
        cost_huf = consumption * tariff.rate_huf

    # Photo
    photo_filename = None
    if 'photo' in request.files:
        file = request.files['photo']
        if file and file.filename and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            photo_filename = f"{prop.id}_{utility_type}_{timestamp}.{ext}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], photo_filename)
            file.save(filepath)
            resize_photo(filepath)

    reading_obj = MeterReading(
        property_id=prop.id,
        utility_type=utility_type,
        value=value,
        prev_value=prev_value,
        consumption=consumption,
        tariff_id=tariff.id if tariff else None,
        cost_huf=cost_huf,
        photo_filename=photo_filename,
        reading_date=reading_date,
        notes=notes or 'Admin rögzítette',
    )
    db.session.add(reading_obj)

    # Auto csatorna
    if utility_type == 'viz' and consumption is not None and consumption >= 0:
        csatorna_tariff = get_active_tariff(prop.tariff_group_id, 'csatorna')
        if csatorna_tariff:
            csatorna_reading = MeterReading(
                property_id=prop.id,
                utility_type='csatorna',
                value=value,
                prev_value=prev_value,
                consumption=consumption,
                tariff_id=csatorna_tariff.id,
                cost_huf=consumption * csatorna_tariff.rate_huf,
                reading_date=reading_date,
                notes='Automatikusan számolva víz alapján',
            )
            db.session.add(csatorna_reading)

    db.session.commit()
    return jsonify({
        'success': True,
        'reading_id': reading_obj.id,
        'consumption': consumption,
        'cost_huf': cost_huf,
    })


# ============================================================
# Admin Property Payments (property-specific)
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/payments')
@login_required
def admin_property_payments(prop_id):
    payments = Payment.query.filter_by(property_id=prop_id).order_by(
        Payment.payment_date.desc()
    ).all()
    return jsonify({
        'payments': [{
            'id': p.id,
            'property_id': p.property_id,
            'property_name': p.property.name if p.property else None,
            'amount_huf': p.amount_huf,
            'payment_date': p.payment_date.isoformat() if p.payment_date else None,
            'payment_method': p.payment_method,
            'period_from': p.period_from.isoformat() if p.period_from else None,
            'period_to': p.period_to.isoformat() if p.period_to else None,
            'notes': p.notes,
        } for p in payments]
    })


# ============================================================
# Admin Property Maintenance (property-specific)
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/maintenance')
@login_required
def admin_property_maintenance(prop_id):
    logs = MaintenanceLog.query.filter_by(property_id=prop_id).order_by(
        MaintenanceLog.created_at.desc()
    ).all()
    return jsonify({
        'maintenance': [{
            'id': l.id,
            'property_id': l.property_id,
            'property_name': l.property.name if l.property else None,
            'description': l.description,
            'category': l.category,
            'cost_huf': l.cost_huf,
            'performed_by': l.performed_by,
            'performed_date': l.performed_date.isoformat() if l.performed_date else None,
        } for l in logs]
    })


# ============================================================
# Admin Documents (property-specific)
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/documents', methods=['GET'])
@login_required
def admin_property_documents(prop_id):
    docs = Document.query.filter_by(property_id=prop_id).order_by(
        Document.uploaded_at.desc()
    ).all()
    return jsonify({
        'documents': [{
            'id': d.id,
            'property_id': d.property_id,
            'filename': d.filename,
            'stored_filename': d.stored_filename,
            'category': d.category,
            'notes': d.notes,
            'file_size': d.file_size,
            'mime_type': d.mime_type,
            'uploaded_at': d.uploaded_at.isoformat() if d.uploaded_at else None,
        } for d in docs]
    })


@api_bp.route('/admin/properties/<int:prop_id>/documents', methods=['POST'])
@login_required
def admin_property_document_upload(prop_id):
    Property.query.get_or_404(prop_id)
    if 'file' not in request.files:
        return jsonify({'error': 'Nincs fájl!'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Nincs fájl!'}), 400
    if not allowed_document(file.filename):
        return jsonify({'error': 'Nem támogatott fájlformátum!'}), 400

    category = request.form.get('category', 'egyeb')
    notes = request.form.get('notes', '').strip() or None

    original_filename = secure_filename(file.filename)
    ext = file.filename.rsplit('.', 1)[1].lower()
    stored_filename = f"{prop_id}_{uuid.uuid4().hex[:12]}.{ext}"

    # Save to uploads/docs/
    docs_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    filepath = os.path.join(docs_dir, stored_filename)
    file.save(filepath)

    # Get file size
    file_size = os.path.getsize(filepath)

    doc = Document(
        property_id=prop_id,
        filename=original_filename,
        stored_filename=stored_filename,
        category=category,
        notes=notes,
        file_size=file_size,
        mime_type=file.content_type,
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify({
        'success': True,
        'document': {
            'id': doc.id,
            'property_id': doc.property_id,
            'filename': doc.filename,
            'stored_filename': doc.stored_filename,
            'category': doc.category,
            'notes': doc.notes,
            'file_size': doc.file_size,
            'mime_type': doc.mime_type,
            'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        }
    })


@api_bp.route('/admin/documents/<int:doc_id>', methods=['DELETE'])
@login_required
def admin_document_delete(doc_id):
    doc = Document.query.get_or_404(doc_id)
    # Delete file from disk
    docs_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'docs')
    filepath = os.path.join(docs_dir, doc.stored_filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin Marketing (property-specific)
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/marketing', methods=['GET'])
@login_required
def admin_property_marketing_get(prop_id):
    Property.query.get_or_404(prop_id)
    mc = MarketingContent.query.filter_by(property_id=prop_id).first()
    photos = Document.query.filter_by(
        property_id=prop_id, category='marketing'
    ).order_by(Document.uploaded_at.desc()).all()

    return jsonify({
        'marketing': {
            'id': mc.id if mc else None,
            'listing_title': mc.listing_title if mc else None,
            'listing_description': mc.listing_description if mc else None,
            'listing_url': mc.listing_url if mc else None,
        },
        'photos': [{
            'id': d.id,
            'property_id': d.property_id,
            'filename': d.filename,
            'stored_filename': d.stored_filename,
            'category': d.category,
            'notes': d.notes,
            'file_size': d.file_size,
            'mime_type': d.mime_type,
            'uploaded_at': d.uploaded_at.isoformat() if d.uploaded_at else None,
        } for d in photos],
    })


@api_bp.route('/admin/properties/<int:prop_id>/marketing', methods=['PUT'])
@login_required
def admin_property_marketing_save(prop_id):
    Property.query.get_or_404(prop_id)
    data = request.get_json()
    mc = MarketingContent.query.filter_by(property_id=prop_id).first()
    if not mc:
        mc = MarketingContent(property_id=prop_id)
        db.session.add(mc)
    mc.listing_title = data.get('listing_title') or None
    mc.listing_description = data.get('listing_description') or None
    mc.listing_url = data.get('listing_url') or None
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/marketing/photos', methods=['POST'])
@login_required
def admin_property_marketing_photo_upload(prop_id):
    Property.query.get_or_404(prop_id)
    if 'file' not in request.files:
        return jsonify({'error': 'Nincs fájl!'}), 400
    file = request.files['file']
    if not file or not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Nem támogatott fájlformátum!'}), 400

    original_filename = secure_filename(file.filename)
    ext = file.filename.rsplit('.', 1)[1].lower()
    stored_filename = f"mkt_{prop_id}_{uuid.uuid4().hex[:8]}.{ext}"

    docs_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'docs')
    os.makedirs(docs_dir, exist_ok=True)
    filepath = os.path.join(docs_dir, stored_filename)
    file.save(filepath)
    resize_photo(filepath, max_size=1920)

    file_size = os.path.getsize(filepath)

    doc = Document(
        property_id=prop_id,
        filename=original_filename,
        stored_filename=stored_filename,
        category='marketing',
        file_size=file_size,
        mime_type=file.content_type,
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify({
        'success': True,
        'document': {
            'id': doc.id,
            'property_id': doc.property_id,
            'filename': doc.filename,
            'stored_filename': doc.stored_filename,
            'category': doc.category,
            'notes': doc.notes,
            'file_size': doc.file_size,
            'mime_type': doc.mime_type,
            'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        }
    })


# ============================================================
# Serve uploaded documents
# ============================================================

@api_bp.route('/uploads/docs/<filename>')
def uploaded_document(filename):
    docs_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'docs')
    return send_from_directory(docs_dir, filename)


# ============================================================
# Admin System
# ============================================================

@api_bp.route('/admin/system')
@login_required
def admin_system_info():
    branch = _git_run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
    commit_hash = _git_run(['git', 'rev-parse', '--short', 'HEAD'])
    commit_message = _git_run(['git', 'log', '-1', '--pretty=%s'])
    commit_date = _git_run(['git', 'log', '-1', '--pretty=%ci'])

    # Check for updates
    _git_run(['git', 'fetch', 'origin'])
    behind = _git_run(['git', 'rev-list', '--count', f'HEAD..origin/{branch}'])
    try:
        behind_count = int(behind)
    except (ValueError, TypeError):
        behind_count = 0

    new_commits = []
    if behind_count > 0:
        log = _git_run(['git', 'log', '--oneline', f'HEAD..origin/{branch}'])
        new_commits = [l for l in log.split('\n') if l.strip()]

    return jsonify({
        'version': current_app.config.get('APP_VERSION', '1.0.0'),
        'branch': branch,
        'commit_hash': commit_hash,
        'commit_message': commit_message,
        'commit_date': commit_date,
        'has_update': behind_count > 0,
        'behind': behind_count,
        'new_commits': new_commits,
    })


@api_bp.route('/admin/system/pull', methods=['POST'])
@login_required
def admin_system_pull():
    output = _git_run(['git', 'pull', 'origin'])
    return jsonify({'success': True, 'output': output})


@api_bp.route('/admin/system/rebuild', methods=['POST'])
@login_required
def admin_system_rebuild():
    import subprocess
    _git_run(['git', 'pull', 'origin'])
    subprocess.Popen(
        ['docker', 'compose', 'up', '-d', '--build'],
        cwd=current_app.config.get('BASE_DIR', '/app'),
    )
    return jsonify({'success': True})


# ============================================================
# Admin Settings
# ============================================================

@api_bp.route('/admin/settings/password', methods=['POST'])
@login_required
def admin_change_password():
    data = request.get_json()
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': 'Mindkét mező kötelező!'}), 400

    if not bcrypt.checkpw(current_password.encode('utf-8'), current_user.password_hash.encode('utf-8')):
        return jsonify({'error': 'Hibás jelenlegi jelszó!'}), 401

    current_user.password_hash = bcrypt.hashpw(
        new_password.encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Admin Tenant Users Management
# ============================================================

@api_bp.route('/admin/tenants', methods=['GET'])
@login_required
def admin_tenants_list():
    tenants = TenantUser.query.order_by(TenantUser.created_at.desc()).all()
    return jsonify({
        'tenants': [{
            'id': t.id,
            'email': t.email,
            'name': t.name,
            'phone': t.phone,
            'has_google': bool(t.google_id),
            'has_facebook': bool(t.facebook_id),
            'has_apple': bool(t.apple_id),
            'properties': [{'id': p.id, 'name': p.name} for p in t.properties],
            'created_at': t.created_at.isoformat() if t.created_at else None,
        } for t in tenants]
    })


@api_bp.route('/admin/tenants', methods=['POST'])
@login_required
def admin_tenant_add():
    """Admin creates a tenant user and assigns property."""
    data = request.get_json()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password', '')
    name = (data.get('name') or '').strip()
    property_ids = data.get('property_ids', [])

    if not email:
        return jsonify({'error': 'E-mail kötelező!'}), 400

    existing = TenantUser.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': 'Ez az e-mail cím már regisztrálva van!'}), 409

    password_hash = None
    if password:
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    tenant = TenantUser(email=email, password_hash=password_hash, name=name or None)

    # Assign properties
    for pid in property_ids:
        prop = db.session.get(Property, int(pid))
        if prop:
            tenant.properties.append(prop)

    db.session.add(tenant)
    db.session.commit()
    return jsonify({'success': True, 'id': tenant.id})


@api_bp.route('/admin/tenants/<int:tenant_id>', methods=['PUT'])
@login_required
def admin_tenant_edit(tenant_id):
    tenant = db.session.get(TenantUser, tenant_id)
    if not tenant:
        return jsonify({'error': 'Bérlő nem található!'}), 404

    data = request.get_json()
    tenant.name = data.get('name', tenant.name)
    tenant.phone = data.get('phone', tenant.phone)

    new_password = data.get('password', '').strip()
    if new_password:
        tenant.password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Update property assignments
    if 'property_ids' in data:
        tenant.properties = []
        for pid in data['property_ids']:
            prop = db.session.get(Property, int(pid))
            if prop:
                tenant.properties.append(prop)

    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/tenants/<int:tenant_id>', methods=['DELETE'])
@login_required
def admin_tenant_delete(tenant_id):
    tenant = db.session.get(TenantUser, tenant_id)
    if not tenant:
        return jsonify({'error': 'Bérlő nem található!'}), 404
    tenant.properties = []
    db.session.delete(tenant)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# AI / Claude API Endpoints
# ============================================================

@api_bp.route('/ai/chat', methods=['POST'])
def ai_chat():
    """Topic-controlled AI chat using Claude Haiku."""
    tenant_id = session.get('tenant_user_id')
    admin_auth = current_user.is_authenticated if hasattr(current_user, 'is_authenticated') else False
    if not tenant_id and not admin_auth:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    data = request.get_json()
    message = (data.get('message') or '').strip()
    topic = (data.get('topic') or 'general').strip()
    history = data.get('history') or []

    if not message:
        return jsonify({'error': 'Üzenet szükséges!'}), 400

    TOPIC_PROMPTS = {
        'smart-meter': """Te egy okos mérő integrációs szakértő vagy a Rezsi Figyelő alkalmazásban.
Segítesz az alábbi eszközök beállításában:
- ESP32 alapú mérők (HTTP POST webhook)
- Home Assistant integráció (REST command automation)
- Shelly 3EM Pro / Shelly mérők (HTTP action vagy MQTT)
- HomeWizard P1 Meter (lokális API polling vagy HA integráció)
- TTN/LoRaWAN eszközök (TTN webhook)
- MQTT alapú eszközök

A Rezsi Figyelő generikus webhook URL: POST /api/webhooks/generic
Body: {"device_id": "...", "value": 12345.67}
Auth: Bearer token a headerben.

Home Assistant integráció lépései:
1. HA automation trigger: sensor state change (pl. sensor.gas_meter)
2. HA REST command service call a Rezsi webhook URL-re
3. Template: {{ states('sensor.gas_meter') | float }}
4. Automation YAML példa is adj ha kérik.

Shelly integráció: HTTP action → URL beállítás az eszköz webUI-ján.
HomeWizard: Lokális API (http://<ip>/api/v1/data) polling script vagy HA integráción keresztül.

Legyél tömör, gyakorlatias, lépésről lépésre segíts. Magyarul válaszolj (de technikai kifejezéseket hagyd angolul).""",
        'tenant-help': """Te a Rezsi Figyelő alkalmazás segédja vagy bérlők számára.
Segítesz: mérőállás rögzítés, fogyasztás/költség értelmezés, közös költség, profil, chat a bérbeadóval.
Legyél kedves, egyszerű nyelven válaszolj magyarul.""",
        'admin-help': """Te a Rezsi Figyelő alkalmazás segédja vagy adminisztrátorok (bérbeadók) számára.
Segítesz: ingatlankezelés, bérlők, tarifák, okos mérők, közös költség, ingatlanadó, dokumentumok, ROI.
Legyél profi, tömör, magyarul válaszolj.""",
        'general': """Te a Rezsi Figyelő alkalmazás AI segédja vagy.
Röviden, magyarul válaszolj.""",
    }

    system_prompt = TOPIC_PROMPTS.get(topic, TOPIC_PROMPTS['general'])

    try:
        from services.claude_service import get_claude_client
        client = get_claude_client()

        msgs = []
        for h in history[-10:]:
            msgs.append({'role': h.get('role', 'user'), 'content': h.get('content', '')})
        msgs.append({'role': 'user', 'content': message})

        response = client.messages.create(
            model='claude-3-5-haiku-latest',
            max_tokens=1024,
            system=system_prompt,
            messages=msgs,
        )

        reply = response.content[0].text if response.content else 'Nem sikerült válaszolni.'

        return jsonify({
            'success': True,
            'reply': reply,
            'model': 'claude-3-5-haiku',
            'usage': {
                'input_tokens': response.usage.input_tokens,
                'output_tokens': response.usage.output_tokens,
            }
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI hiba: {str(e)}'}), 500


@api_bp.route('/admin/ai/extract-tax-pdf', methods=['POST'])
@login_required
def ai_extract_tax_pdf():
    """Upload property tax PDF and extract data via Claude."""
    if 'file' not in request.files:
        return jsonify({'error': 'Nincs fájl!'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Nincs fájl!'}), 400

    upload_folder = current_app.config['UPLOAD_FOLDER']
    temp_path = os.path.join(upload_folder, f'temp_tax_{uuid.uuid4().hex[:8]}.pdf')
    file.save(temp_path)

    try:
        from services.claude_service import extract_property_tax_from_pdf
        result = extract_property_tax_from_pdf(temp_path)
        return jsonify({'success': True, 'extracted': result})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI feldolgozási hiba: {str(e)}'}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@api_bp.route('/admin/ai/extract-fee-pdf', methods=['POST'])
@login_required
def ai_extract_fee_pdf():
    """Upload common fee PDF and extract data via Claude."""
    if 'file' not in request.files:
        return jsonify({'error': 'Nincs fájl!'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'Nincs fájl!'}), 400

    upload_folder = current_app.config['UPLOAD_FOLDER']
    temp_path = os.path.join(upload_folder, f'temp_fee_{uuid.uuid4().hex[:8]}.pdf')
    file.save(temp_path)

    try:
        from services.claude_service import extract_common_fee_from_pdf
        result = extract_common_fee_from_pdf(temp_path)
        return jsonify({'success': True, 'extracted': result})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'AI feldolgozási hiba: {str(e)}'}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@api_bp.route('/ai/ocr-reading', methods=['POST'])
def ai_ocr_reading():
    """OCR meter reading from photo via Claude Vision."""
    tenant_id = session.get('tenant_user_id')
    if not tenant_id and not current_user.is_authenticated:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401

    if 'photo' not in request.files:
        return jsonify({'error': 'Nincs fotó!'}), 400
    file = request.files['photo']
    if not file or not file.filename:
        return jsonify({'error': 'Nincs fotó!'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
    upload_folder = current_app.config['UPLOAD_FOLDER']
    temp_path = os.path.join(upload_folder, f'temp_ocr_{uuid.uuid4().hex[:8]}.{ext}')
    file.save(temp_path)

    try:
        from services.claude_service import ocr_meter_reading
        result = ocr_meter_reading(temp_path)
        return jsonify({'success': True, **result})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'OCR hiba: {str(e)}'}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# Ingatlanadó (Property Tax) Endpoints
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/taxes')
@login_required
def admin_property_taxes(prop_id):
    taxes = PropertyTax.query.filter_by(property_id=prop_id).order_by(PropertyTax.year.desc()).all()
    return jsonify({'taxes': [{
        'id': t.id, 'property_id': t.property_id, 'year': t.year,
        'bank_account': t.bank_account, 'recipient': t.recipient,
        'annual_amount': t.annual_amount, 'installment_amount': t.installment_amount,
        'payment_memo': t.payment_memo,
        'deadline_autumn': t.deadline_autumn.isoformat() if t.deadline_autumn else None,
        'deadline_spring': t.deadline_spring.isoformat() if t.deadline_spring else None,
        'autumn_paid': t.autumn_paid, 'autumn_paid_date': t.autumn_paid_date.isoformat() if t.autumn_paid_date else None,
        'spring_paid': t.spring_paid, 'spring_paid_date': t.spring_paid_date.isoformat() if t.spring_paid_date else None,
        'document_id': t.document_id, 'include_in_roi': t.include_in_roi,
        'notes': t.notes,
    } for t in taxes]})


@api_bp.route('/admin/properties/<int:prop_id>/taxes', methods=['POST'])
@login_required
def admin_add_property_tax(prop_id):
    data = request.get_json()
    year = data.get('year', date.today().year)
    tax = PropertyTax(
        property_id=prop_id,
        year=year,
        bank_account=data.get('bank_account'),
        recipient=data.get('recipient'),
        annual_amount=data.get('annual_amount', 0),
        installment_amount=data.get('installment_amount'),
        payment_memo=data.get('payment_memo'),
        deadline_autumn=date(year, 9, 15),
        deadline_spring=date(year + 1, 3, 15),
        include_in_roi=data.get('include_in_roi', True),
        notes=data.get('notes'),
    )
    db.session.add(tax)
    db.session.commit()
    return jsonify({'success': True, 'id': tax.id})


@api_bp.route('/admin/taxes/<int:tax_id>', methods=['PUT'])
@login_required
def admin_edit_tax(tax_id):
    tax = db.session.get(PropertyTax, tax_id)
    if not tax:
        return jsonify({'error': 'Nem található!'}), 404
    data = request.get_json()
    for key in ['bank_account', 'recipient', 'annual_amount', 'installment_amount',
                'payment_memo', 'include_in_roi', 'notes']:
        if key in data:
            setattr(tax, key, data[key])
    if 'year' in data:
        tax.year = data['year']
        tax.deadline_autumn = date(data['year'], 9, 15)
        tax.deadline_spring = date(data['year'] + 1, 3, 15)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/taxes/<int:tax_id>', methods=['DELETE'])
@login_required
def admin_delete_tax(tax_id):
    tax = db.session.get(PropertyTax, tax_id)
    if not tax:
        return jsonify({'error': 'Nem található!'}), 404
    db.session.delete(tax)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/taxes/<int:tax_id>/mark-paid', methods=['POST'])
@login_required
def admin_tax_mark_paid(tax_id):
    tax = db.session.get(PropertyTax, tax_id)
    if not tax:
        return jsonify({'error': 'Nem található!'}), 404
    data = request.get_json()
    installment = data.get('installment')  # 'autumn' or 'spring'
    if installment == 'autumn':
        tax.autumn_paid = not tax.autumn_paid
        tax.autumn_paid_date = date.today() if tax.autumn_paid else None
    elif installment == 'spring':
        tax.spring_paid = not tax.spring_paid
        tax.spring_paid_date = date.today() if tax.spring_paid else None
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/tax-reminders')
@login_required
def admin_tax_reminders():
    """Get upcoming tax deadlines within 2 weeks."""
    from datetime import timedelta
    today = date.today()
    two_weeks = today + timedelta(days=14)
    reminders = []

    taxes = PropertyTax.query.all()
    for t in taxes:
        prop = db.session.get(Property, t.property_id)
        prop_name = prop.name if prop else '?'
        if t.deadline_autumn and not t.autumn_paid and today <= t.deadline_autumn <= two_weeks:
            reminders.append({
                'property_name': prop_name, 'type': 'tax',
                'deadline': t.deadline_autumn.isoformat(),
                'amount': t.installment_amount or (t.annual_amount / 2),
                'bank_account': t.bank_account, 'payment_memo': t.payment_memo,
            })
        if t.deadline_spring and not t.spring_paid and today <= t.deadline_spring <= two_weeks:
            reminders.append({
                'property_name': prop_name, 'type': 'tax',
                'deadline': t.deadline_spring.isoformat(),
                'amount': t.installment_amount or (t.annual_amount / 2),
                'bank_account': t.bank_account, 'payment_memo': t.payment_memo,
            })
    return jsonify({'reminders': reminders})


# ============================================================
# Közös Költség (Common Fees) Endpoints
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/common-fees')
@login_required
def admin_property_common_fees(prop_id):
    fees = CommonFee.query.filter_by(property_id=prop_id).order_by(CommonFee.created_at.desc()).all()
    result = []
    for f in fees:
        payments = [{
            'id': p.id, 'period_date': p.period_date.isoformat(),
            'paid': p.paid, 'paid_date': p.paid_date.isoformat() if p.paid_date else None,
            'amount': p.amount,
        } for p in f.payments_tracking.order_by(CommonFeePayment.period_date.desc()).limit(12).all()]
        result.append({
            'id': f.id, 'property_id': f.property_id,
            'bank_account': f.bank_account, 'recipient': f.recipient,
            'monthly_amount': f.monthly_amount, 'payment_memo': f.payment_memo,
            'frequency': f.frequency, 'payment_day': f.payment_day,
            'include_in_roi': f.include_in_roi, 'is_active': f.is_active,
            'valid_from': f.valid_from.isoformat() if f.valid_from else None,
            'valid_to': f.valid_to.isoformat() if f.valid_to else None,
            'notes': f.notes, 'payments': payments,
        })
    return jsonify({'fees': result})


@api_bp.route('/admin/properties/<int:prop_id>/common-fees', methods=['POST'])
@login_required
def admin_add_common_fee(prop_id):
    data = request.get_json()
    fee = CommonFee(
        property_id=prop_id,
        bank_account=data.get('bank_account'),
        recipient=data.get('recipient'),
        monthly_amount=data.get('monthly_amount', 0),
        payment_memo=data.get('payment_memo'),
        frequency=data.get('frequency', 'monthly'),
        payment_day=data.get('payment_day'),
        include_in_roi=data.get('include_in_roi', True),
        notes=data.get('notes'),
    )
    db.session.add(fee)
    db.session.commit()
    return jsonify({'success': True, 'id': fee.id})


@api_bp.route('/admin/common-fees/<int:fee_id>', methods=['PUT'])
@login_required
def admin_edit_common_fee(fee_id):
    fee = db.session.get(CommonFee, fee_id)
    if not fee:
        return jsonify({'error': 'Nem található!'}), 404
    data = request.get_json()
    for key in ['bank_account', 'recipient', 'monthly_amount', 'payment_memo',
                'frequency', 'payment_day', 'include_in_roi', 'is_active', 'notes']:
        if key in data:
            setattr(fee, key, data[key])
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/common-fees/<int:fee_id>', methods=['DELETE'])
@login_required
def admin_delete_common_fee(fee_id):
    fee = db.session.get(CommonFee, fee_id)
    if not fee:
        return jsonify({'error': 'Nem található!'}), 404
    CommonFeePayment.query.filter_by(common_fee_id=fee_id).delete()
    db.session.delete(fee)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/common-fees/<int:fee_id>/mark-paid', methods=['POST'])
@login_required
def admin_common_fee_mark_paid(fee_id):
    fee = db.session.get(CommonFee, fee_id)
    if not fee:
        return jsonify({'error': 'Nem található!'}), 404
    data = request.get_json()
    period_str = data.get('period_date')
    if not period_str:
        return jsonify({'error': 'period_date szükséges!'}), 400

    period_date = date.fromisoformat(period_str)
    payment = CommonFeePayment.query.filter_by(
        common_fee_id=fee_id, period_date=period_date
    ).first()

    if payment:
        payment.paid = not payment.paid
        payment.paid_date = date.today() if payment.paid else None
    else:
        payment = CommonFeePayment(
            common_fee_id=fee_id,
            period_date=period_date,
            paid=True,
            paid_date=date.today(),
            amount=fee.monthly_amount,
        )
        db.session.add(payment)

    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/common-fee-reminders')
@login_required
def admin_common_fee_reminders():
    """Get upcoming common fee deadlines within 1 week."""
    from datetime import timedelta
    today = date.today()
    one_week = today + timedelta(days=7)
    reminders = []

    active_fees = CommonFee.query.filter_by(is_active=True).all()
    for f in active_fees:
        prop = db.session.get(Property, f.property_id)
        prop_name = prop.name if prop else '?'
        # Calculate next payment date
        payment_day = f.payment_day or 15
        # Check current month
        try:
            next_date = date(today.year, today.month, min(payment_day, 28))
        except ValueError:
            next_date = date(today.year, today.month, 28)
        if next_date < today:
            # Next month
            if today.month == 12:
                next_date = date(today.year + 1, 1, min(payment_day, 28))
            else:
                try:
                    next_date = date(today.year, today.month + 1, min(payment_day, 28))
                except ValueError:
                    next_date = date(today.year, today.month + 1, 28)

        if today <= next_date <= one_week:
            # Check if already paid this period
            period_start = date(next_date.year, next_date.month, 1)
            existing = CommonFeePayment.query.filter_by(
                common_fee_id=f.id, period_date=period_start, paid=True
            ).first()
            if not existing:
                reminders.append({
                    'property_name': prop_name, 'type': 'common_fee',
                    'deadline': next_date.isoformat(),
                    'amount': f.monthly_amount,
                    'bank_account': f.bank_account, 'payment_memo': f.payment_memo,
                })
    return jsonify({'reminders': reminders})


# ============================================================
# Bérleti Jövedelem Adózás (Rental Tax Config) Endpoints
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/rental-tax')
@login_required
def admin_get_rental_tax(prop_id):
    config = RentalTaxConfig.query.filter_by(property_id=prop_id).first()
    if not config:
        return jsonify({'config': None})
    return jsonify({'config': {
        'id': config.id, 'property_id': config.property_id,
        'tax_mode': config.tax_mode,
        'is_vat_registered': config.is_vat_registered,
        'vat_rate': config.vat_rate, 'notes': config.notes,
    }})


@api_bp.route('/admin/properties/<int:prop_id>/rental-tax', methods=['PUT'])
@login_required
def admin_save_rental_tax(prop_id):
    data = request.get_json()
    config = RentalTaxConfig.query.filter_by(property_id=prop_id).first()
    if not config:
        config = RentalTaxConfig(property_id=prop_id)
        db.session.add(config)
    config.tax_mode = data.get('tax_mode', 'maganszemely_10pct')
    config.is_vat_registered = data.get('is_vat_registered', False)
    config.vat_rate = data.get('vat_rate')
    config.notes = data.get('notes')
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Mérőóra Nyilvántartás (Meter Info) Endpoints
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/meters')
@login_required
def admin_property_meters(prop_id):
    meters = MeterInfo.query.filter_by(property_id=prop_id).all()
    return jsonify({'meters': [{
        'id': m.id, 'property_id': m.property_id,
        'utility_type': m.utility_type, 'serial_number': m.serial_number,
        'location': m.location, 'notes': m.notes,
    } for m in meters]})


@api_bp.route('/admin/properties/<int:prop_id>/meters', methods=['POST'])
@login_required
def admin_add_meter(prop_id):
    data = request.get_json()
    meter = MeterInfo(
        property_id=prop_id,
        utility_type=data.get('utility_type', 'villany'),
        serial_number=data.get('serial_number'),
        location=data.get('location'),
        notes=data.get('notes'),
    )
    db.session.add(meter)
    db.session.commit()
    return jsonify({'success': True, 'id': meter.id})


@api_bp.route('/admin/meters/<int:meter_id>', methods=['PUT'])
@login_required
def admin_edit_meter(meter_id):
    meter = db.session.get(MeterInfo, meter_id)
    if not meter:
        return jsonify({'error': 'Nem található!'}), 404
    data = request.get_json()
    for key in ['utility_type', 'serial_number', 'location', 'notes']:
        if key in data:
            setattr(meter, key, data[key])
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/meters/<int:meter_id>', methods=['DELETE'])
@login_required
def admin_delete_meter(meter_id):
    meter = db.session.get(MeterInfo, meter_id)
    if not meter:
        return jsonify({'error': 'Nem található!'}), 404
    db.session.delete(meter)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# Chat Endpoints
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/chat')
@login_required
def admin_get_chat(prop_id):
    page = request.args.get('page', 1, type=int)
    per_page = 50
    messages = ChatMessage.query.filter_by(property_id=prop_id) \
        .order_by(ChatMessage.created_at.asc()) \
        .paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({'messages': [{
        'id': m.id, 'sender_type': m.sender_type, 'sender_id': m.sender_id,
        'message': m.message, 'is_read': m.is_read,
        'created_at': m.created_at.isoformat() if m.created_at else None,
    } for m in messages.items],
        'has_more': messages.has_next,
    })


@api_bp.route('/admin/properties/<int:prop_id>/chat', methods=['POST'])
@login_required
def admin_send_chat(prop_id):
    data = request.get_json()
    msg_text = data.get('message', '')
    msg = ChatMessage(
        property_id=prop_id,
        sender_type='admin',
        sender_id=current_user.id,
        message=msg_text,
    )
    db.session.add(msg)
    db.session.commit()

    # Email notification to tenant(s)
    try:
        from services.email_service import notify_tenant_of_admin_message
        base_url = request.host_url.rstrip('/')
        notify_tenant_of_admin_message(prop_id, 'Bérbeadó', msg_text, base_url)
    except Exception:
        pass  # Never block chat on email failure

    return jsonify({'success': True, 'id': msg.id})


@api_bp.route('/admin/chat/unread')
@login_required
def admin_chat_unread():
    from sqlalchemy import func
    counts = db.session.query(
        ChatMessage.property_id,
        func.count(ChatMessage.id)
    ).filter(
        ChatMessage.sender_type == 'tenant',
        ChatMessage.is_read == False
    ).group_by(ChatMessage.property_id).all()
    return jsonify({'unread': {str(pid): cnt for pid, cnt in counts}})


@api_bp.route('/admin/chat/mark-read/<int:prop_id>', methods=['POST'])
@login_required
def admin_mark_chat_read(prop_id):
    ChatMessage.query.filter_by(
        property_id=prop_id, sender_type='tenant', is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/tenant/chat')
def tenant_get_chat():
    prop_id = session.get('property_id')
    if not prop_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401
    messages = ChatMessage.query.filter_by(property_id=prop_id) \
        .order_by(ChatMessage.created_at.asc()).all()
    return jsonify({'messages': [{
        'id': m.id, 'sender_type': m.sender_type,
        'message': m.message, 'is_read': m.is_read,
        'created_at': m.created_at.isoformat() if m.created_at else None,
    } for m in messages]})


@api_bp.route('/tenant/chat', methods=['POST'])
def tenant_send_chat():
    prop_id = session.get('property_id')
    tenant_id = session.get('tenant_user_id')
    if not prop_id or not tenant_id:
        return jsonify({'error': 'Nem vagy bejelentkezve!'}), 401
    data = request.get_json()
    msg_text = data.get('message', '')
    msg = ChatMessage(
        property_id=prop_id,
        sender_type='tenant',
        sender_id=tenant_id,
        message=msg_text,
    )
    db.session.add(msg)
    # Mark admin messages as read
    ChatMessage.query.filter_by(
        property_id=prop_id, sender_type='admin', is_read=False
    ).update({'is_read': True})
    db.session.commit()

    # Email notification to admin
    try:
        from services.email_service import notify_admin_of_tenant_message
        tenant = TenantUser.query.get(tenant_id)
        sender_name = tenant.name if tenant and tenant.name else (tenant.email if tenant else 'Bérlő')
        base_url = request.host_url.rstrip('/')
        notify_admin_of_tenant_message(prop_id, sender_name, msg_text, base_url)
    except Exception:
        pass  # Never block chat on email failure

    return jsonify({'success': True, 'id': msg.id})


@api_bp.route('/tenant/chat/unread')
def tenant_chat_unread():
    prop_id = session.get('property_id')
    if not prop_id:
        return jsonify({'count': 0})
    count = ChatMessage.query.filter_by(
        property_id=prop_id, sender_type='admin', is_read=False
    ).count()
    return jsonify({'count': count})


# ============================================================
# Broadcast Chat
# ============================================================

@api_bp.route('/admin/chat/broadcast', methods=['POST'])
@login_required
def admin_broadcast_chat():
    """Send a message to multiple properties at once."""
    data = request.get_json()
    property_ids = data.get('property_ids', [])
    message = data.get('message', '').strip()
    if not property_ids or not message:
        return jsonify({'error': 'Hiányzó adat'}), 400

    count = 0
    for pid in property_ids:
        msg = ChatMessage(
            property_id=pid,
            sender_type='admin',
            sender_id=current_user.id,
            message=message,
        )
        db.session.add(msg)
        count += 1
    db.session.commit()

    # Email notification to tenants of each property
    try:
        from services.email_service import notify_tenant_of_admin_message
        base_url = request.host_url.rstrip('/')
        for pid in property_ids:
            try:
                notify_tenant_of_admin_message(pid, 'Bérbeadó', message, base_url)
            except Exception:
                pass
    except Exception:
        pass

    return jsonify({'success': True, 'count': count})


# ============================================================
# Email Settings (Admin)
# ============================================================

@api_bp.route('/admin/settings/email')
@login_required
def admin_get_email_settings():
    """Get email notification settings."""
    from flask import current_app
    enabled = AppSetting.get('email_enabled', 'false') == 'true'
    admin_email = AppSetting.get('admin_email', current_app.config.get('ADMIN_EMAIL', ''))
    smtp_configured = bool(
        current_app.config.get('SMTP_USER') and
        current_app.config.get('SMTP_PASSWORD')
    )
    return jsonify({
        'enabled': enabled,
        'admin_email': admin_email,
        'smtp_configured': smtp_configured,
    })


@api_bp.route('/admin/settings/email', methods=['POST'])
@login_required
def admin_save_email_settings():
    """Save email notification settings."""
    data = request.get_json()
    if 'enabled' in data:
        AppSetting.set('email_enabled', 'true' if data['enabled'] else 'false')
    if 'admin_email' in data:
        AppSetting.set('admin_email', data['admin_email'] or '')
    return jsonify({'success': True})


@api_bp.route('/admin/settings/email/test', methods=['POST'])
@login_required
def admin_test_email():
    """Send a test email to verify SMTP configuration."""
    from flask import current_app
    admin_email = AppSetting.get('admin_email', current_app.config.get('ADMIN_EMAIL', ''))
    if not admin_email:
        return jsonify({'error': 'Nincs admin email cím megadva!'}), 400

    smtp_user = current_app.config.get('SMTP_USER', '')
    smtp_password = current_app.config.get('SMTP_PASSWORD', '')
    if not smtp_user or not smtp_password:
        return jsonify({'error': 'SMTP nincs konfigurálva (env vars)!'}), 400

    try:
        from services.email_service import _send_email, _build_html
        html = _build_html('Rezsi Figyelő', 'Ez egy teszt email az email értesítések ellenőrzéséhez.', request.host_url.rstrip('/') + '/admin/settings')
        _send_email(admin_email, 'Teszt email — Rezsi Figyelő', html)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# Home Assistant / Tailscale Settings (Admin)
# ============================================================

@api_bp.route('/admin/settings/home-assistant', methods=['GET'])
@login_required
def admin_get_home_assistant_settings():
    """Get Home Assistant and Tailscale integration settings (global or property scope)."""
    prop_id_raw = request.args.get('property_id')
    property_id = _parse_property_id(prop_id_raw)
    if prop_id_raw not in (None, '') and property_id is None:
        return jsonify({'error': 'Érvénytelen property_id.'}), 400

    if property_id is not None:
        Property.query.get_or_404(property_id)
        return jsonify(_get_ha_settings(property_id=property_id, fallback_global=True))

    return jsonify(_get_ha_settings())


@api_bp.route('/admin/settings/home-assistant', methods=['POST'])
@login_required
def admin_save_home_assistant_settings():
    """Save Home Assistant and Tailscale integration settings (global or property scope)."""
    data = request.get_json() or {}
    prop_id_raw = request.args.get('property_id')
    property_id = _parse_property_id(prop_id_raw)
    if prop_id_raw not in (None, '') and property_id is None:
        return jsonify({'error': 'Érvénytelen property_id.'}), 400

    if property_id is not None:
        Property.query.get_or_404(property_id)

    setting_scope_id = property_id

    if 'ha_name' in data:
        _set_ha_setting_value('ha_name', data.get('ha_name'), setting_scope_id)

    if 'ha_location' in data:
        _set_ha_setting_value('ha_location', data.get('ha_location'), setting_scope_id)

    if 'ha_local_username' in data:
        _set_ha_setting_value('ha_local_username', data.get('ha_local_username'), setting_scope_id)

    if 'ha_local_password' in data:
        _set_ha_setting_value('ha_local_password', data.get('ha_local_password'), setting_scope_id)

    if 'ha_base_url' in data:
        ha_base_url, url_err = _normalize_ha_base_url(data.get('ha_base_url'))
        if url_err:
            return jsonify({'error': url_err}), 400
        _set_ha_setting_value('ha_base_url', ha_base_url, setting_scope_id)

    if 'ha_token' in data:
        ha_token, token_err = _normalize_ha_token(data.get('ha_token'))
        if token_err:
            return jsonify({'error': token_err}), 400
        _set_ha_setting_value('ha_token', ha_token, setting_scope_id)

    # Tailscale config remains global.
    if 'tailscale_api_token' in data:
        AppSetting.set('tailscale_api_token', str(data.get('tailscale_api_token') or '').strip())
    if 'tailscale_tailnet' in data:
        AppSetting.set('tailscale_tailnet', str(data.get('tailscale_tailnet') or '').strip())

    return jsonify({'success': True})


@api_bp.route('/admin/settings/home-assistant/test', methods=['POST'])
@login_required
def admin_test_home_assistant_connection():
    """Test Home Assistant API connectivity using saved settings."""
    prop_id_raw = request.args.get('property_id')
    property_id = _parse_property_id(prop_id_raw)
    if prop_id_raw not in (None, '') and property_id is None:
        return jsonify({'error': 'Érvénytelen property_id.'}), 400

    if property_id is not None:
        Property.query.get_or_404(property_id)

    base_url, token, settings_err, status_code = _validated_ha_connection_settings(
        property_id=property_id,
        fallback_global=True,
    )
    if settings_err:
        return jsonify({'error': settings_err}), status_code

    code, payload, err = _http_json('GET', f'{base_url}/api/states', headers=_ha_auth_header(token))
    if code != 200 or not isinstance(payload, list):
        return _ha_api_error_response(code, err, f'Home Assistant kapcsolat hiba ({code})')

    sensor_count = len([s for s in payload if str(s.get('entity_id') or '').startswith('sensor.')])
    return jsonify({'success': True, 'sensor_count': sensor_count, 'total_entities': len(payload)})


@api_bp.route('/admin/settings/home-assistant/entities', methods=['GET'])
@login_required
def admin_get_home_assistant_entities():
    """List relevant Home Assistant sensor entities for meter onboarding."""
    prop_id_raw = request.args.get('property_id')
    property_id = _parse_property_id(prop_id_raw)
    if prop_id_raw not in (None, '') and property_id is None:
        return jsonify({'error': 'Érvénytelen property_id.'}), 400

    if property_id is not None:
        Property.query.get_or_404(property_id)

    base_url, token, settings_err, status_code = _validated_ha_connection_settings(
        property_id=property_id,
        fallback_global=True,
    )
    if settings_err:
        return jsonify({'error': settings_err}), status_code

    code, payload, err = _http_json('GET', f'{base_url}/api/states', headers=_ha_auth_header(token))
    if code != 200 or not isinstance(payload, list):
        return _ha_api_error_response(code, err, f'Home Assistant lekérés hiba ({code})')

    entities = _extract_ha_entities(payload)
    query = (request.args.get('q') or '').strip().lower()
    if query:
        entities = [
            e for e in entities
            if query in e['entity_id'].lower() or query in e['friendly_name'].lower()
        ]

    return jsonify({'entities': entities, 'count': len(entities)})


@api_bp.route('/admin/settings/home-assistant/tailscale/devices', methods=['GET'])
@login_required
def admin_get_tailscale_devices():
    """Discover online devices via Tailscale API and suggest HA URLs."""
    settings = _get_ha_settings()
    api_token = settings['tailscale_api_token']
    tailnet = settings['tailscale_tailnet']

    if not api_token or not tailnet:
        return jsonify({'error': 'Tailscale API token és tailnet szükséges.'}), 400

    basic = base64.b64encode(f'{api_token}:'.encode('utf-8')).decode('ascii')
    code, payload, err = _http_json(
        'GET',
        f'https://api.tailscale.com/api/v2/tailnet/{tailnet}/devices',
        headers={'Authorization': f'Basic {basic}'},
    )

    if code != 200 or not isinstance(payload, dict):
        return jsonify({'error': err or f'Tailscale API hiba ({code})'}), 502

    now_utc = datetime.now(timezone.utc)

    def _parse_ts(value):
        raw = str(value or '').strip()
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    devices = payload.get('devices') or []
    result = []
    for d in devices:
        addresses = d.get('addresses') or []
        ip = ''
        for addr in addresses:
            if isinstance(addr, str) and ':' not in addr:
                ip = addr
                break
        if not ip and addresses:
            ip = str(addresses[0])

        hostname = str(d.get('hostname') or '')
        name = str(d.get('name') or hostname or d.get('id') or '')
        text = f'{name} {hostname}'.lower()
        likely_ha = any(tag in text for tag in ('homeassistant', 'home-assistant', 'hass', ' ha '))
        ha_url = f'http://{ip}:8123' if ip else ''

        last_seen_raw = d.get('lastSeen') or d.get('last_seen') or ''
        last_seen_dt = _parse_ts(last_seen_raw)
        online = bool(d.get('online', False))
        status_reason = 'online_flag' if online else 'offline_flag'

        if not online and last_seen_dt is not None:
            if now_utc - last_seen_dt <= timedelta(minutes=5):
                online = True
                status_reason = 'recent_activity'
            else:
                status_reason = 'inactive'

        result.append({
            'id': str(d.get('id') or name or ip),
            'name': name,
            'hostname': hostname,
            'online': online,
            'status_reason': status_reason,
            'last_seen': last_seen_dt.isoformat() if last_seen_dt else '',
            'ip': ip,
            'ha_url': ha_url,
            'likely_home_assistant': likely_ha,
        })

    result.sort(key=lambda item: (not item['likely_home_assistant'], not item['online'], item['name'].lower()))
    return jsonify({'devices': result, 'count': len(result)})


# ============================================================
# Move-In / Move-Out Workflow Endpoints
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/move-in/start', methods=['POST'])
@login_required
def admin_move_in_start(prop_id):
    """Initialize move-in workflow — create checklist entries."""
    data = request.get_json()
    tenant_id = data.get('tenant_id')

    steps = ['meter_readings', 'handover_protocol', 'key_handover', 'contract_upload']
    for step in steps:
        existing = HandoverChecklist.query.filter_by(
            property_id=prop_id, checklist_type='move_in', step=step
        ).first()
        if not existing:
            item = HandoverChecklist(
                property_id=prop_id,
                tenant_user_id=tenant_id,
                checklist_type='move_in',
                step=step,
            )
            db.session.add(item)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/move-in/status')
@login_required
def admin_move_in_status(prop_id):
    items = HandoverChecklist.query.filter_by(
        property_id=prop_id, checklist_type='move_in'
    ).all()
    return jsonify({'steps': [{
        'id': i.id, 'step': i.step, 'status': i.status,
        'data': i.data_json,
        'completed_at': i.completed_at.isoformat() if i.completed_at else None,
    } for i in items]})


@api_bp.route('/admin/properties/<int:prop_id>/move-in/<step>', methods=['POST'])
@login_required
def admin_move_in_step(prop_id, step):
    """Save data for a move-in step."""
    import json as json_mod
    data = request.get_json()
    item = HandoverChecklist.query.filter_by(
        property_id=prop_id, checklist_type='move_in', step=step
    ).first()
    if not item:
        item = HandoverChecklist(
            property_id=prop_id, checklist_type='move_in', step=step
        )
        db.session.add(item)
    item.data_json = json_mod.dumps(data.get('data', {}), ensure_ascii=False)
    item.status = 'completed'
    item.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/move-in/complete', methods=['POST'])
@login_required
def admin_move_in_complete(prop_id):
    """Finalize move-in: activate tenant, set date."""
    data = request.get_json()
    tenant_id = data.get('tenant_id')
    move_in_date_str = data.get('move_in_date', date.today().isoformat())
    deposit = data.get('deposit_amount')

    if tenant_id:
        tenant = db.session.get(TenantUser, tenant_id)
        if tenant:
            tenant.is_active = True
            tenant.move_in_date = date.fromisoformat(move_in_date_str)
            tenant.move_out_date = None
            if deposit:
                tenant.deposit_amount = deposit
            # Ensure property access
            prop = db.session.get(Property, prop_id)
            if prop and prop not in tenant.properties:
                tenant.properties.append(prop)

    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/move-out/start', methods=['POST'])
@login_required
def admin_move_out_start(prop_id):
    """Initialize move-out workflow."""
    steps = ['final_readings', 'condition_assessment', 'deposit_settlement', 'key_return']
    for step in steps:
        existing = HandoverChecklist.query.filter_by(
            property_id=prop_id, checklist_type='move_out', step=step
        ).first()
        if not existing:
            item = HandoverChecklist(
                property_id=prop_id, checklist_type='move_out', step=step
            )
            db.session.add(item)
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/move-out/status')
@login_required
def admin_move_out_status(prop_id):
    items = HandoverChecklist.query.filter_by(
        property_id=prop_id, checklist_type='move_out'
    ).all()
    return jsonify({'steps': [{
        'id': i.id, 'step': i.step, 'status': i.status,
        'data': i.data_json,
        'completed_at': i.completed_at.isoformat() if i.completed_at else None,
    } for i in items]})


@api_bp.route('/admin/properties/<int:prop_id>/move-out/<step>', methods=['POST'])
@login_required
def admin_move_out_step(prop_id, step):
    """Save data for a move-out step."""
    import json as json_mod
    data = request.get_json()
    item = HandoverChecklist.query.filter_by(
        property_id=prop_id, checklist_type='move_out', step=step
    ).first()
    if not item:
        item = HandoverChecklist(
            property_id=prop_id, checklist_type='move_out', step=step
        )
        db.session.add(item)
    item.data_json = json_mod.dumps(data.get('data', {}), ensure_ascii=False)
    item.status = 'completed'
    item.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/move-out/complete', methods=['POST'])
@login_required
def admin_move_out_complete(prop_id):
    """Finalize move-out: deactivate tenant, archive, remove access."""
    data = request.get_json()
    deposit_returned = data.get('deposit_returned', 0)
    deposit_deductions = data.get('deposit_deductions', 0)
    deposit_notes = data.get('deposit_notes', '')

    prop = db.session.get(Property, prop_id)
    if not prop:
        return jsonify({'error': 'Ingatlan nem található!'}), 404

    # Find active tenant for this property
    tenant = TenantUser.query.filter(
        TenantUser.is_active == True,
        TenantUser.properties.any(Property.id == prop_id)
    ).first()

    if tenant:
        # Calculate total payments during tenancy
        total_pay = db.session.query(db.func.sum(Payment.amount_huf)).filter(
            Payment.property_id == prop_id
        ).scalar() or 0

        # Archive tenant
        history = TenantHistory(
            property_id=prop_id,
            tenant_user_id=tenant.id,
            tenant_name=tenant.name,
            tenant_email=tenant.email,
            move_in_date=tenant.move_in_date,
            move_out_date=date.today(),
            deposit_amount=tenant.deposit_amount,
            deposit_returned=deposit_returned,
            deposit_deductions=deposit_deductions,
            deposit_notes=deposit_notes,
            total_payments=total_pay,
        )
        db.session.add(history)

        # Deactivate
        tenant.is_active = False
        tenant.move_out_date = date.today()
        # Remove property access
        if prop in tenant.properties:
            tenant.properties.remove(prop)

    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/properties/<int:prop_id>/tenant-history')
@login_required
def admin_tenant_history(prop_id):
    history = TenantHistory.query.filter_by(property_id=prop_id) \
        .order_by(TenantHistory.move_out_date.desc()).all()
    return jsonify({'history': [{
        'id': h.id, 'tenant_name': h.tenant_name, 'tenant_email': h.tenant_email,
        'move_in_date': h.move_in_date.isoformat() if h.move_in_date else None,
        'move_out_date': h.move_out_date.isoformat() if h.move_out_date else None,
        'deposit_amount': h.deposit_amount, 'deposit_returned': h.deposit_returned,
        'deposit_deductions': h.deposit_deductions, 'deposit_notes': h.deposit_notes,
        'total_payments': h.total_payments,
    } for h in history]})


# ============================================================
# Enhanced ROI Endpoint (replaces original)
# ============================================================

@api_bp.route('/admin/roi-enhanced')
@login_required
def admin_roi_enhanced():
    """Enhanced ROI with property tax, common fees, and rental income tax."""
    from dateutil.relativedelta import relativedelta

    props = Property.query.filter(
        Property.purchase_price.isnot(None),
        Property.monthly_rent.isnot(None),
        Property.purchase_price > 0,
        Property.monthly_rent > 0,
    ).all()

    result = []
    for p in props:
        annual_rent = p.monthly_rent * 12

        # Maintenance costs
        total_maint = db.session.query(db.func.sum(MaintenanceLog.cost_huf)).filter_by(
            property_id=p.id
        ).scalar() or 0

        # Property tax (latest year, if include_in_roi)
        latest_tax = PropertyTax.query.filter_by(
            property_id=p.id, include_in_roi=True
        ).order_by(PropertyTax.year.desc()).first()
        annual_tax = latest_tax.annual_amount if latest_tax else 0

        # Common fees (active, if include_in_roi)
        active_fee = CommonFee.query.filter_by(
            property_id=p.id, include_in_roi=True, is_active=True
        ).first()
        annual_common_fee = 0
        if active_fee:
            if active_fee.frequency == 'monthly':
                annual_common_fee = active_fee.monthly_amount * 12
            elif active_fee.frequency == 'quarterly':
                annual_common_fee = active_fee.monthly_amount * 4

        # Rental income tax estimation
        rental_income_tax = 0
        tax_config = RentalTaxConfig.query.filter_by(property_id=p.id).first()
        if tax_config:
            if tax_config.tax_mode == 'maganszemely_10pct':
                # Jövedelem = bevétel × 90%, SZJA = jövedelem × 15%
                rental_income_tax = annual_rent * 0.90 * 0.15
            elif tax_config.tax_mode == 'maganszemely_teteles':
                # Tételes: jövedelem = bevétel - költségek, SZJA = jöv × 15%
                costs = total_maint + annual_tax + annual_common_fee
                taxable = max(0, annual_rent - costs)
                rental_income_tax = taxable * 0.15
            elif tax_config.tax_mode == 'egyeni_vallalkozo_atalany':
                # Átalányadó: 80% költséghányad, 15% SZJA + ~13% TB (nettó ~18.5%)
                rental_income_tax = annual_rent * 0.20 * 0.15
            elif tax_config.tax_mode == 'egyeni_vallalkozo_vszja':
                # Vállalkozói SZJA: egyszerűsített becslés 9% TAO + 15% osztalékadó
                rental_income_tax = annual_rent * 0.22  # ~ 9% + ~13% osztalék

        total_costs = total_maint + annual_tax + annual_common_fee + rental_income_tax
        annual_yield = ((annual_rent - total_costs) / p.purchase_price * 100)

        total_rent = db.session.query(db.func.sum(Payment.amount_huf)).filter_by(
            property_id=p.id
        ).scalar() or 0
        progress_pct = min(100, (total_rent / p.purchase_price * 100))
        breakeven_months = int(p.purchase_price / max(p.monthly_rent, 1))

        # Sparkline: last 12 months
        from sqlalchemy import extract, func
        monthly = db.session.query(
            extract('month', Payment.payment_date).label('m'),
            func.sum(Payment.amount_huf).label('total'),
        ).filter(Payment.property_id == p.id) \
            .group_by('m').order_by('m').limit(12).all()
        sparkline = [{'month': int(m.m), 'amount': float(m.total)} for m in monthly]

        result.append({
            'id': p.id, 'name': p.name, 'property_type': p.property_type,
            'purchase_price': p.purchase_price, 'monthly_rent': p.monthly_rent,
            'annual_yield': round(annual_yield, 2),
            'total_rent_collected': total_rent,
            'progress_pct': round(progress_pct, 1),
            'breakeven_months': breakeven_months,
            'breakeven_date': (date.today() + relativedelta(
                months=max(0, breakeven_months - int(total_rent / max(p.monthly_rent, 1)))
            )).isoformat(),
            'cost_breakdown': {
                'maintenance': round(total_maint, 0),
                'property_tax': round(annual_tax, 0),
                'common_fees': round(annual_common_fee, 0),
                'rental_income_tax': round(rental_income_tax, 0),
            },
            'total_costs': round(total_costs, 0),
            'tax_mode': tax_config.tax_mode if tax_config else None,
            'monthly_payments': sparkline,
        })

    return jsonify({'properties': result})


# ============================================================
# Generic HTTP Webhook (universal — ESP32, HA, Shelly, etc.)
# ============================================================

@api_bp.route('/webhooks/generic', methods=['POST'])
def generic_webhook():
    """Receive smart meter data via simple HTTP POST.

    Universal webhook for any device: ESP32, Home Assistant, Shelly, HomeWizard, Node-RED, etc.

    Expected JSON body:
    {
        "device_id": "my-device-123",
        "value": 12345.67,
        "timestamp": "2024-01-15T10:30:00Z"  // optional
    }

    Auth: Bearer token (device-specific via ttn_app_id field, or global TTN_WEBHOOK_TOKEN).
    """
    auth_header = request.headers.get('Authorization', '')
    token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else ''
    global_token = current_app.config.get('TTN_WEBHOOK_TOKEN', '')

    data = request.get_json(silent=True) or {}
    device_id = data.get('device_id')

    if not device_id:
        return jsonify({'error': 'device_id required'}), 400

    device = SmartMeterDevice.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({'error': f'Unknown device: {device_id}'}), 404

    # Token validation: device-specific OR global
    device_token = device.ttn_app_id
    valid = False
    if token and device_token and token == device_token:
        valid = True
    elif token and global_token and token == global_token:
        valid = True
    elif not global_token and not device_token:
        valid = True  # No auth configured — dev mode
    if not valid:
        return jsonify({'error': 'Invalid token'}), 401

    # Canonical payload mode: if "value" is missing, try extracting from full JSON payload
    # (e.g. energy_kwh_total / energy_m3_total / nested telemetry.* fields).
    raw_value = data.get('value', data)
    timestamp = data.get('timestamp')

    from services.smart_meter import process_smart_meter_reading
    result = process_smart_meter_reading(
        device_id=device_id,
        raw_value=raw_value,
        source='http',
        raw_payload=json.dumps(data),
        timestamp=timestamp,
    )

    status_code = 200 if result['status'] == 'ok' else (
        409 if result['status'] == 'rejected' else 500
    )
    return jsonify(result), status_code


# ============================================================
# Smart Meter — TTN Webhook
# ============================================================

@api_bp.route('/webhooks/ttn', methods=['POST'])
def ttn_webhook():
    """Receive uplink messages from The Things Network (TTN v3)."""
    if not current_app.config.get('TTN_WEBHOOK_ENABLED', True):
        return jsonify({'error': 'TTN webhook disabled'}), 503

    # Verify Bearer token
    expected_token = current_app.config.get('TTN_WEBHOOK_TOKEN', '')
    if expected_token:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer ') or auth_header[7:] != expected_token:
            return jsonify({'error': 'Unauthorized'}), 401

    try:
        payload = request.get_json(force=True)
    except Exception:
        return jsonify({'error': 'Invalid JSON'}), 400

    # Extract device ID from TTN payload
    device_id = None
    try:
        device_id = payload.get('end_device_ids', {}).get('device_id')
    except Exception:
        pass

    if not device_id:
        return jsonify({'error': 'Missing device_id in TTN payload'}), 400

    # Extract decoded payload fields
    decoded_payload = {}
    try:
        decoded_payload = payload.get('uplink_message', {}).get('decoded_payload', {})
    except Exception:
        pass

    if not decoded_payload:
        current_app.logger.warning(f"TTN webhook: no decoded_payload for device {device_id}")
        return jsonify({'warning': 'No decoded_payload'}), 200

    # Process through smart meter service
    from services.smart_meter import process_smart_meter_reading, extract_value_from_payload

    device = SmartMeterDevice.query.filter_by(device_id=device_id, is_active=True).first()
    if not device:
        current_app.logger.info(f"TTN webhook: unknown or inactive device {device_id}")
        return jsonify({'warning': f'Unknown device: {device_id}'}), 200

    raw_value = extract_value_from_payload(decoded_payload, device.value_field)
    if raw_value is None:
        current_app.logger.warning(f"TTN webhook: could not extract value from payload for {device_id}")
        return jsonify({'warning': 'Could not extract value'}), 200

    result = process_smart_meter_reading(
        device_id=device_id,
        raw_value=raw_value,
        source='smart_ttn',
        raw_payload=json.dumps(payload),
        timestamp=datetime.utcnow()
    )

    return jsonify(result), 200


# ============================================================
# Smart Meter — Admin CRUD
# ============================================================

def smart_meter_to_dict(d):
    """Convert SmartMeterDevice to dict."""
    return {
        'id': d.id,
        'property_id': d.property_id,
        'utility_type': d.utility_type,
        'device_id': d.device_id,
        'source': d.source,
        'name': d.name,
        'ttn_app_id': d.ttn_app_id,
        'mqtt_topic': d.mqtt_topic,
        'value_field': d.value_field or 'meter_value',
        'multiplier': d.multiplier or 1.0,
        'offset': d.offset or 0.0,
        'device_unit': d.device_unit,
        'is_active': d.is_active,
        'min_interval_minutes': d.min_interval_minutes or 60,
        'last_seen_at': d.last_seen_at.isoformat() if d.last_seen_at else None,
        'last_raw_value': d.last_raw_value,
        'last_error': d.last_error,
        'meter_info_id': d.meter_info_id,
        'created_at': d.created_at.isoformat() if d.created_at else None,
    }


def smart_meter_log_to_dict(log):
    """Convert SmartMeterLog to dict."""
    return {
        'id': log.id,
        'device_id': log.device_id,
        'source': log.source,
        'parsed_value': log.parsed_value,
        'final_value': log.final_value,
        'status': log.status,
        'error_message': log.error_message,
        'reading_id': log.reading_id,
        'received_at': log.received_at.isoformat() if log.received_at else None,
    }


@api_bp.route('/admin/properties/<int:prop_id>/smart-meters', methods=['GET'])
@login_required
def get_property_smart_meters(prop_id):
    """List smart meter devices for a property."""
    devices = SmartMeterDevice.query.filter_by(property_id=prop_id)\
        .order_by(SmartMeterDevice.created_at.desc()).all()
    return jsonify({'devices': [smart_meter_to_dict(d) for d in devices]})


def _default_mqtt_topic(property_id, device_id):
    """Generate a predictable topic for lightweight onboarding."""
    safe_device = ''.join(ch if ch.isalnum() or ch in '-_.' else '-' for ch in str(device_id or 'meter-01')).strip('-')
    safe_device = safe_device or 'meter-01'
    return f'rpallagi/property-{property_id}/unit-main/{safe_device}/telemetry'


@api_bp.route('/admin/properties/<int:prop_id>/smart-meters', methods=['POST'])
@login_required
def add_smart_meter(prop_id):
    """Add a new smart meter device to a property."""
    data = request.get_json()
    if not data or not data.get('device_id'):
        return jsonify({'error': 'device_id is required'}), 400

    # Check for duplicate device_id
    existing = SmartMeterDevice.query.filter_by(device_id=data['device_id']).first()
    if existing:
        return jsonify({'error': f'Device ID {data["device_id"]} already registered'}), 409

    source = data.get('source', 'ttn')
    mqtt_topic = data.get('mqtt_topic')
    if source == 'mqtt' and (not mqtt_topic or not str(mqtt_topic).strip()):
        mqtt_topic = _default_mqtt_topic(prop_id, data['device_id'])

    device = SmartMeterDevice(
        property_id=prop_id,
        device_id=data['device_id'],
        source=source,
        utility_type=data.get('utility_type', 'villany'),
        name=data.get('name'),
        ttn_app_id=data.get('ttn_app_id'),
        mqtt_topic=mqtt_topic,
        value_field=data.get('value_field', 'meter_value'),
        multiplier=float(data.get('multiplier', 1.0)),
        offset=float(data.get('offset', 0.0)),
        min_interval_minutes=int(data.get('min_interval_minutes', 60)),
        is_active=data.get('is_active', True),
    )
    db.session.add(device)
    db.session.commit()

    # Refresh MQTT subscriptions if enabled
    _refresh_mqtt_subscriptions()

    return jsonify({'success': True, 'id': device.id}), 201


@api_bp.route('/admin/properties/<int:prop_id>/smart-meters/import-home-assistant', methods=['POST'])
@login_required
def import_home_assistant_smart_meters(prop_id):
    """Import selected Home Assistant entities as smart meters and run quick verification."""
    data = request.get_json() or {}
    entities = data.get('entities') or []
    if not isinstance(entities, list) or not entities:
        return jsonify({'error': 'entities list required'}), 400

    # Ensure property exists
    Property.query.get_or_404(prop_id)

    base_url, token, settings_err, status_code = _validated_ha_connection_settings(property_id=prop_id, fallback_global=True)
    if settings_err:
        return jsonify({'error': settings_err}), status_code

    # Fetch current HA states once for both import metadata and verification
    code, states_payload, err = _http_json('GET', f'{base_url}/api/states', headers=_ha_auth_header(token))
    if code != 200 or not isinstance(states_payload, list):
        return _ha_api_error_response(code, err, f'Home Assistant lekérés hiba ({code})')

    state_map = {}
    for item in states_payload:
        entity_id = str(item.get('entity_id') or '').strip()
        if entity_id:
            state_map[entity_id] = item

    webhook_token = AppSetting.get('ha_webhook_token', '').strip()
    if not webhook_token:
        webhook_token = f'ha-{uuid.uuid4().hex[:24]}'
        AppSetting.set('ha_webhook_token', webhook_token)

    created = []
    verify = []

    from services.smart_meter import process_smart_meter_reading

    for item in entities:
        entity_id = str((item or {}).get('entity_id') or '').strip().lower()
        if not entity_id:
            continue
        if not entity_id.startswith('sensor.'):
            entity_id = f'sensor.{entity_id}'

        state_item = state_map.get(entity_id)
        attrs = state_item.get('attributes', {}) if isinstance(state_item, dict) else {}
        unit = str(attrs.get('unit_of_measurement') or '')
        device_class = str(attrs.get('device_class') or '')

        utility_type = (item or {}).get('utility_type') or _guess_utility(entity_id, unit, device_class)
        if utility_type not in ('villany', 'viz', 'gaz'):
            utility_type = 'villany'

        base_device_id = (item or {}).get('device_id')
        if not base_device_id:
            suffix = _slugify(entity_id.replace('sensor.', ''))[:48]
            base_device_id = f'ha-p{prop_id}-{utility_type}-{suffix}'
        device_id = _unique_device_id(base_device_id[:180])

        name = str((item or {}).get('name') or attrs.get('friendly_name') or entity_id)[:200]

        device = SmartMeterDevice(
            property_id=prop_id,
            device_id=device_id,
            source='http',
            utility_type=utility_type,
            name=name,
            ttn_app_id=webhook_token,
            mqtt_topic=None,
            value_field=_default_value_field(utility_type),
            multiplier=1.0,
            offset=0.0,
            min_interval_minutes=1 if utility_type == 'villany' else 5,
            is_active=True,
        )
        db.session.add(device)
        db.session.flush()

        created.append({
            'id': device.id,
            'device_id': device.device_id,
            'entity_id': entity_id,
            'utility_type': utility_type,
        })

        if not state_item:
            verify.append({
                'entity_id': entity_id,
                'device_id': device.device_id,
                'ok': False,
                'reason': 'entity_not_found',
            })
            continue

        state_value = state_item.get('state')
        numeric = _to_float(state_value)
        if numeric is None:
            verify.append({
                'entity_id': entity_id,
                'device_id': device.device_id,
                'ok': False,
                'reason': 'non_numeric_state',
            })
            continue

        result = process_smart_meter_reading(
            device_id=device.device_id,
            raw_value=numeric,
            source='http',
            raw_payload=json.dumps({'entity_id': entity_id, 'state': state_value}),
            timestamp=datetime.utcnow(),
        )
        verify.append({
            'entity_id': entity_id,
            'device_id': device.device_id,
            'ok': result.get('status') == 'ok',
            'reason': None if result.get('status') == 'ok' else result.get('error', result.get('status')),
            'reading_id': result.get('reading_id'),
        })

    db.session.commit()
    _refresh_mqtt_subscriptions()

    return jsonify({
        'success': True,
        'created': created,
        'verify': verify,
    }), 201


@api_bp.route('/admin/smart-meters/<int:device_db_id>', methods=['PUT'])
@login_required
def edit_smart_meter(device_db_id):
    """Update an existing smart meter device."""
    device = SmartMeterDevice.query.get_or_404(device_db_id)
    data = request.get_json()

    if 'device_id' in data:
        existing = SmartMeterDevice.query.filter(
            SmartMeterDevice.device_id == data['device_id'],
            SmartMeterDevice.id != device_db_id
        ).first()
        if existing:
            return jsonify({'error': f'Device ID {data["device_id"]} already registered'}), 409
        device.device_id = data['device_id']

    new_source = data.get('source', device.source)
    if 'source' in data:
        device.source = data['source']
    if 'utility_type' in data:
        device.utility_type = data['utility_type']
    if 'name' in data:
        device.name = data['name']
    if 'ttn_app_id' in data:
        device.ttn_app_id = data['ttn_app_id']
    if 'mqtt_topic' in data:
        incoming_topic = data['mqtt_topic']
        device.mqtt_topic = incoming_topic.strip() if isinstance(incoming_topic, str) else incoming_topic
    if new_source == 'mqtt' and (not device.mqtt_topic or not str(device.mqtt_topic).strip()):
        device.mqtt_topic = _default_mqtt_topic(device.property_id, data.get('device_id', device.device_id))
    if 'value_field' in data:
        device.value_field = data['value_field']
    if 'multiplier' in data:
        device.multiplier = float(data['multiplier'])
    if 'offset' in data:
        device.offset = float(data['offset'])
    if 'min_interval_minutes' in data:
        device.min_interval_minutes = int(data['min_interval_minutes'])
    if 'is_active' in data:
        device.is_active = data['is_active']

    device.updated_at = datetime.utcnow()
    db.session.commit()

    _refresh_mqtt_subscriptions()

    return jsonify({'success': True})


@api_bp.route('/admin/smart-meters/<int:device_db_id>', methods=['DELETE'])
@login_required
def delete_smart_meter(device_db_id):
    """Delete a smart meter device and its logs."""
    device = SmartMeterDevice.query.get_or_404(device_db_id)
    SmartMeterLog.query.filter_by(device_id=device.device_id).delete()
    db.session.delete(device)
    db.session.commit()

    _refresh_mqtt_subscriptions()

    return jsonify({'success': True})


# ============================================================
# Smart Meter — Status / Logs / Test
# ============================================================

@api_bp.route('/admin/smart-meters/status', methods=['GET'])
@login_required
def smart_meter_status():
    """Get overall smart meter status."""
    devices = SmartMeterDevice.query.order_by(SmartMeterDevice.created_at.desc()).all()

    mqtt_connected = False
    mqtt_enabled = current_app.config.get('MQTT_ENABLED', False)
    if mqtt_enabled and hasattr(current_app, 'mqtt_client'):
        connected_attr = getattr(current_app.mqtt_client, 'is_connected', False)
        mqtt_connected = connected_attr() if callable(connected_attr) else bool(connected_attr)

    ttn_enabled = current_app.config.get('TTN_WEBHOOK_ENABLED', True)

    return jsonify({
        'devices': [smart_meter_to_dict(d) for d in devices],
        'mqtt_connected': mqtt_connected,
        'mqtt_enabled': mqtt_enabled,
        'ttn_enabled': ttn_enabled,
        'mqtt_broker_host': current_app.config.get('MQTT_BROKER_HOST', 'mosquitto'),
        'mqtt_broker_port': current_app.config.get('MQTT_BROKER_PORT', 1883),
        'mqtt_topic_prefix': current_app.config.get('MQTT_TOPIC_PREFIX', 'rezsi/#'),
    })


@api_bp.route('/admin/smart-meters/<int:device_db_id>/logs', methods=['GET'])
@login_required
def get_smart_meter_logs(device_db_id):
    """Get recent logs for a smart meter device."""
    device = SmartMeterDevice.query.get_or_404(device_db_id)
    logs = SmartMeterLog.query.filter_by(device_id=device.device_id)\
        .order_by(SmartMeterLog.received_at.desc()).limit(50).all()
    return jsonify({'logs': [smart_meter_log_to_dict(l) for l in logs]})


@api_bp.route('/admin/smart-meters/<int:device_db_id>/test', methods=['POST'])
@login_required
def test_smart_meter(device_db_id):
    """Test smart meter data processing (dry-run)."""
    device = SmartMeterDevice.query.get_or_404(device_db_id)
    data = request.get_json()
    test_payload = data.get('payload', {})

    from services.smart_meter import extract_value_from_payload

    raw_value = extract_value_from_payload(test_payload, device.value_field)
    if raw_value is None:
        return jsonify({
            'success': False,
            'error': f'Could not extract value using field "{device.value_field}"',
        })

    final_value = raw_value * (device.multiplier or 1.0) + (device.offset or 0.0)

    return jsonify({
        'success': True,
        'parsed_value': raw_value,
        'final_value': round(final_value, 4),
        'multiplier': device.multiplier,
        'offset': device.offset,
    })


def _refresh_mqtt_subscriptions():
    """Refresh MQTT client subscriptions after device CRUD."""
    try:
        if current_app.config.get('MQTT_ENABLED') and hasattr(current_app, 'mqtt_client'):
            current_app.mqtt_client.refresh_subscriptions()
    except Exception as e:
        current_app.logger.warning(f"Failed to refresh MQTT subscriptions: {e}")


# ============================================================
# WiFi Networks CRUD
# ============================================================

@api_bp.route('/admin/properties/<int:prop_id>/wifi', methods=['GET'])
@login_required
def admin_get_wifi(prop_id):
    networks = WifiNetwork.query.filter_by(property_id=prop_id).order_by(
        WifiNetwork.is_primary.desc(), WifiNetwork.ssid
    ).all()
    return jsonify({'networks': [{
        'id': n.id,
        'property_id': n.property_id,
        'ssid': n.ssid,
        'password': n.password,
        'security_type': n.security_type,
        'location': n.location,
        'is_primary': n.is_primary,
        'notes': n.notes,
    } for n in networks]})


@api_bp.route('/admin/properties/<int:prop_id>/wifi', methods=['POST'])
@login_required
def admin_add_wifi(prop_id):
    Property.query.get_or_404(prop_id)
    data = request.get_json()
    ssid = (data.get('ssid') or '').strip()
    if not ssid:
        return jsonify({'error': 'SSID szükséges!'}), 400
    n = WifiNetwork(
        property_id=prop_id,
        ssid=ssid,
        password=data.get('password'),
        security_type=data.get('security_type', 'WPA2'),
        location=data.get('location'),
        is_primary=data.get('is_primary', False),
        notes=data.get('notes'),
    )
    db.session.add(n)
    db.session.commit()
    return jsonify({'success': True, 'id': n.id})


@api_bp.route('/admin/wifi/<int:wifi_id>', methods=['PUT'])
@login_required
def admin_edit_wifi(wifi_id):
    n = db.session.get(WifiNetwork, wifi_id)
    if not n:
        return jsonify({'error': 'Nem található!'}), 404
    data = request.get_json()
    for key in ['ssid', 'password', 'security_type', 'location', 'is_primary', 'notes']:
        if key in data:
            setattr(n, key, data[key])
    db.session.commit()
    return jsonify({'success': True})


@api_bp.route('/admin/wifi/<int:wifi_id>', methods=['DELETE'])
@login_required
def admin_delete_wifi(wifi_id):
    n = db.session.get(WifiNetwork, wifi_id)
    if not n:
        return jsonify({'error': 'Nem található!'}), 404
    db.session.delete(n)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================
# OCR — Meter Reading from Photo
# ============================================================

@api_bp.route('/admin/ocr/meter', methods=['POST'])
@login_required
def ocr_meter_reading():
    """Extract meter reading from an uploaded photo using AI OCR."""
    if 'photo' not in request.files:
        return jsonify({'error': 'Nincs fotó feltöltve!'}), 400

    photo = request.files['photo']
    if not photo.filename:
        return jsonify({'error': 'Üres fájl!'}), 400

    image_data = photo.read()
    if len(image_data) > 10 * 1024 * 1024:  # 10MB limit
        return jsonify({'error': 'Túl nagy fájl (max 10MB)!'}), 400

    provider = current_app.config.get('OCR_PROVIDER', 'claude')

    try:
        from services.ocr import ocr_meter_reading as do_ocr
        result = do_ocr(image_data, provider=provider)
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"OCR error: {e}", exc_info=True)
        return jsonify({'error': str(e), 'value': None}), 500


@api_bp.route('/tenant/ocr/meter', methods=['POST'])
def tenant_ocr_meter_reading():
    """OCR for tenant meter reading photos."""
    if 'property_id' not in session:
        return jsonify({'error': 'Nincs bejelentkezve!'}), 401

    if 'photo' not in request.files:
        return jsonify({'error': 'Nincs fotó feltöltve!'}), 400

    photo = request.files['photo']
    image_data = photo.read()
    if len(image_data) > 10 * 1024 * 1024:
        return jsonify({'error': 'Túl nagy fájl (max 10MB)!'}), 400

    provider = current_app.config.get('OCR_PROVIDER', 'claude')

    try:
        from services.ocr import ocr_meter_reading as do_ocr
        result = do_ocr(image_data, provider=provider)
        return jsonify(result)
    except Exception as e:
        current_app.logger.error(f"OCR error: {e}", exc_info=True)
        return jsonify({'error': str(e), 'value': None}), 500
