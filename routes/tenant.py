"""Tenant (berloi) routes - meroallas rogzites, elozmeny, foto feltoltes."""
import os
import bcrypt
from datetime import date, datetime
from flask import (
    Blueprint, render_template, request, redirect, url_for,
    flash, session, current_app, jsonify, send_from_directory
)
from werkzeug.utils import secure_filename
from PIL import Image

from models import db, Property, MeterReading, Tariff, Payment

tenant_bp = Blueprint('tenant', __name__)


# ============================================================
# Helpers
# ============================================================

def get_current_property():
    """Get the currently logged in property from session."""
    property_id = session.get('property_id')
    if property_id:
        return Property.query.get(property_id)
    return None


def get_active_tariff(tariff_group_id, utility_type):
    """Get the currently active tariff for a utility type."""
    return Tariff.query.filter_by(
        tariff_group_id=tariff_group_id,
        utility_type=utility_type
    ).filter(
        Tariff.valid_from <= date.today()
    ).order_by(Tariff.valid_from.desc()).first()


def get_last_reading(property_id, utility_type):
    """Get the last meter reading for a property and utility type."""
    return MeterReading.query.filter_by(
        property_id=property_id,
        utility_type=utility_type
    ).order_by(MeterReading.reading_date.desc(), MeterReading.id.desc()).first()


def allowed_file(filename):
    """Check if a file extension is allowed."""
    allowed = current_app.config.get('ALLOWED_EXTENSIONS', {'png', 'jpg', 'jpeg', 'gif', 'webp'})
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed


def resize_photo(filepath, max_size=1920):
    """Resize uploaded photo to max dimension while keeping aspect ratio."""
    try:
        with Image.open(filepath) as img:
            # Auto-rotate based on EXIF
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)

            if max(img.size) > max_size:
                img.thumbnail((max_size, max_size), Image.LANCZOS)
                img.save(filepath, quality=85, optimize=True)
    except Exception as e:
        print(f"[WARN] Photo resize failed: {e}")


# ============================================================
# Login / Logout
# ============================================================

@tenant_bp.route('/', methods=['GET'])
def index():
    """Landing page - property selection and PIN login."""
    prop = get_current_property()
    if prop:
        return redirect(url_for('tenant.dashboard'))
    properties = Property.query.order_by(Property.name).all()
    return render_template('tenant/login.html', properties=properties)


@tenant_bp.route('/login', methods=['POST'])
def login():
    """Authenticate tenant with property selection + PIN."""
    property_id = request.form.get('property_id')
    pin = request.form.get('pin', '')

    if not property_id or not pin:
        flash('Valassz ingatlant es add meg a PIN kodot!', 'error')
        return redirect(url_for('tenant.index'))

    prop = Property.query.get(int(property_id))
    if not prop:
        flash('Az ingatlan nem talalhato!', 'error')
        return redirect(url_for('tenant.index'))

    # Verify PIN
    if bcrypt.checkpw(pin.encode('utf-8'), prop.pin_hash.encode('utf-8')):
        session['property_id'] = prop.id
        session['property_name'] = prop.name
        flash(f'Udv, {prop.name}!', 'success')
        return redirect(url_for('tenant.dashboard'))
    else:
        flash('Hibas PIN kod!', 'error')
        return redirect(url_for('tenant.index'))


@tenant_bp.route('/logout')
def logout():
    """Clear tenant session."""
    session.pop('property_id', None)
    session.pop('property_name', None)
    flash('Sikeresen kijelentkeztel!', 'success')
    return redirect(url_for('tenant.index'))


# ============================================================
# Tenant Dashboard
# ============================================================

@tenant_bp.route('/dashboard')
def dashboard():
    """Tenant dashboard - current readings and quick actions."""
    prop = get_current_property()
    if not prop:
        return redirect(url_for('tenant.index'))

    # Last readings per utility type
    last_villany = get_last_reading(prop.id, 'villany')
    last_viz = get_last_reading(prop.id, 'viz')

    # Current tariffs
    tariff_villany = get_active_tariff(prop.tariff_group_id, 'villany')
    tariff_viz = get_active_tariff(prop.tariff_group_id, 'viz')
    tariff_csatorna = get_active_tariff(prop.tariff_group_id, 'csatorna')

    return render_template('tenant/dashboard.html',
                           property=prop,
                           last_villany=last_villany,
                           last_viz=last_viz,
                           tariff_villany=tariff_villany,
                           tariff_viz=tariff_viz,
                           tariff_csatorna=tariff_csatorna)


# ============================================================
# Meter Reading
# ============================================================

@tenant_bp.route('/reading', methods=['GET', 'POST'])
def reading():
    """Submit a new meter reading."""
    prop = get_current_property()
    if not prop:
        return redirect(url_for('tenant.index'))

    if request.method == 'POST':
        utility_type = request.form.get('utility_type')
        value_str = request.form.get('value', '').replace(',', '.')
        reading_date_str = request.form.get('reading_date', '')
        notes = request.form.get('notes', '').strip()

        # Validate
        if not utility_type or utility_type not in ('villany', 'viz'):
            flash('Valassz kozuzemi tipust!', 'error')
            return redirect(url_for('tenant.reading'))

        try:
            value = float(value_str)
        except (ValueError, TypeError):
            flash('Ervenytelen meroallas ertek!', 'error')
            return redirect(url_for('tenant.reading'))

        try:
            reading_date = date.fromisoformat(reading_date_str) if reading_date_str else date.today()
        except ValueError:
            reading_date = date.today()

        # Get previous reading
        last = get_last_reading(prop.id, utility_type)
        prev_value = last.value if last else None
        consumption = (value - prev_value) if prev_value is not None else None

        # Get active tariff and calculate cost
        tariff = get_active_tariff(prop.tariff_group_id, utility_type)
        cost_huf = None
        if tariff and consumption is not None and consumption >= 0:
            cost_huf = consumption * tariff.rate_huf

        # Handle photo upload
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

        # Create reading
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

        # If water reading, also create sewer reading automatically
        if utility_type == 'viz' and consumption is not None and consumption >= 0:
            csatorna_tariff = get_active_tariff(prop.tariff_group_id, 'csatorna')
            if csatorna_tariff:
                csatorna_cost = consumption * csatorna_tariff.rate_huf
                csatorna_reading = MeterReading(
                    property_id=prop.id,
                    utility_type='csatorna',
                    value=value,  # same as water
                    prev_value=prev_value,
                    consumption=consumption,
                    tariff_id=csatorna_tariff.id,
                    cost_huf=csatorna_cost,
                    reading_date=reading_date,
                    notes='Automatikusan szamolva viz alapjan',
                )
                db.session.add(csatorna_reading)

        db.session.commit()

        # Summary message
        cost_msg = f" - Koltseg: {cost_huf:,.0f} Ft" if cost_huf is not None else ""
        consumption_msg = f" - Fogyasztas: {consumption:,.1f}" if consumption is not None else ""
        flash(f'Meroallas rogzitve! {utility_type.capitalize()}: {value}{consumption_msg}{cost_msg}', 'success')
        return redirect(url_for('tenant.dashboard'))

    # GET - show form
    last_villany = get_last_reading(prop.id, 'villany')
    last_viz = get_last_reading(prop.id, 'viz')

    return render_template('tenant/reading.html',
                           property=prop,
                           last_villany=last_villany,
                           last_viz=last_viz,
                           today=date.today().isoformat())


# ============================================================
# History
# ============================================================

@tenant_bp.route('/history')
def history():
    """View meter reading history with charts."""
    prop = get_current_property()
    if not prop:
        return redirect(url_for('tenant.index'))

    utility_type = request.args.get('type', 'all')

    query = MeterReading.query.filter_by(property_id=prop.id)
    if utility_type != 'all':
        query = query.filter_by(utility_type=utility_type)

    readings = query.order_by(MeterReading.reading_date.desc()).limit(100).all()

    return render_template('tenant/history.html',
                           property=prop,
                           readings=readings,
                           utility_type=utility_type)


# ============================================================
# API - Chart data
# ============================================================

@tenant_bp.route('/api/chart-data')
def chart_data():
    """Return JSON chart data for the tenant's readings."""
    prop = get_current_property()
    if not prop:
        return jsonify({'error': 'Nem vagy bejelentkezve'}), 401

    utility_type = request.args.get('type', 'villany')
    limit = min(int(request.args.get('limit', 24)), 100)

    readings = MeterReading.query.filter_by(
        property_id=prop.id,
        utility_type=utility_type
    ).order_by(MeterReading.reading_date.asc()).limit(limit).all()

    data = {
        'labels': [r.reading_date.strftime('%Y.%m') for r in readings],
        'values': [r.value for r in readings],
        'consumption': [r.consumption for r in readings if r.consumption is not None],
        'costs': [r.cost_huf for r in readings if r.cost_huf is not None],
    }

    return jsonify(data)


# ============================================================
# Photo serving
# ============================================================

@tenant_bp.route('/uploads/<filename>')
def uploaded_photo(filename):
    """Serve uploaded meter photos."""
    return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)
