"""REST API endpoints for the React frontend.

All endpoints return JSON and are prefixed with /api.
Tenant auth uses session (property_id).
Admin auth uses Flask-Login (current_user).
"""
import os
import subprocess
import bcrypt
from datetime import date, datetime
from flask import (
    Blueprint, request, jsonify, session, current_app, send_from_directory
)
from flask_login import login_user, logout_user, login_required, current_user
from models import (
    db, AdminUser, TenantUser, Property, TariffGroup, Tariff,
    MeterReading, Payment, MaintenanceLog, Todo, Document, MarketingContent
)
import uuid
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

    tv = get_active_tariff(prop.tariff_group_id, 'villany')
    tw = get_active_tariff(prop.tariff_group_id, 'viz')
    tc = get_active_tariff(prop.tariff_group_id, 'csatorna')

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

    return jsonify({
        'property': property_to_dict(prop),
        'last_villany': reading_summary(lv),
        'last_viz': reading_summary(lw),
        'tariffs': {
            'villany': {'rate_huf': tv.rate_huf, 'unit': tv.unit} if tv else None,
            'viz': {'rate_huf': tw.rate_huf, 'unit': tw.unit} if tw else None,
            'csatorna': {'rate_huf': tc.rate_huf, 'unit': tc.unit} if tc else None,
        },
        'monthly_total': monthly_total,
        'sparklines': {
            'villany': get_sparkline('villany'),
            'viz': get_sparkline('viz'),
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

    if not utility_type or utility_type not in ('villany', 'viz'):
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

    new_pin = data.get('pin', '').strip()
    if new_pin:
        prop.pin_hash = bcrypt.hashpw(new_pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

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
    resize_photo(filepath, max_size=512)

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
        },
        'sparklines': {
            'villany': get_sparkline('villany'),
            'viz': get_sparkline('viz'),
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

    if not utility_type or utility_type not in ('villany', 'viz'):
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
