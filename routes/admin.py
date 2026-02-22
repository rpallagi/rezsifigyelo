"""Admin routes - dashboard, CRUD, payments, maintenance, ROI."""
import bcrypt
from datetime import date, datetime
from flask import (
    Blueprint, render_template, request, redirect, url_for,
    flash, jsonify
)
from flask_login import login_user, logout_user, login_required, current_user

from models import (
    db, AdminUser, Property, TariffGroup, Tariff,
    MeterReading, Payment, MaintenanceLog, Todo
)

admin_bp = Blueprint('admin', __name__)


# ============================================================
# Admin Login / Logout
# ============================================================

@admin_bp.route('/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login page."""
    if current_user.is_authenticated:
        return redirect(url_for('admin.dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '')
        password = request.form.get('password', '')

        admin = AdminUser.query.filter_by(username=username).first()
        if admin and bcrypt.checkpw(password.encode('utf-8'), admin.password_hash.encode('utf-8')):
            login_user(admin)
            flash('Sikeres bejelentkezes!', 'success')
            return redirect(url_for('admin.dashboard'))
        else:
            flash('Hibas felhasznalonev vagy jelszo!', 'error')

    return render_template('admin/login.html')


@admin_bp.route('/logout')
@login_required
def admin_logout():
    """Admin logout."""
    logout_user()
    flash('Sikeresen kijelentkeztel!', 'success')
    return redirect(url_for('admin.admin_login'))


# ============================================================
# Dashboard
# ============================================================

@admin_bp.route('/')
@login_required
def dashboard():
    """Admin dashboard - overview of all properties."""
    properties = Property.query.order_by(Property.name).all()
    tariff_groups = TariffGroup.query.all()

    # Summary stats
    total_properties = len(properties)
    total_readings = MeterReading.query.count()
    total_payments = db.session.query(db.func.sum(Payment.amount_huf)).scalar() or 0
    pending_todos = Todo.query.filter(Todo.status != 'done').count()

    # Recent readings
    recent_readings = MeterReading.query.order_by(
        MeterReading.created_at.desc()
    ).limit(10).all()

    return render_template('admin/dashboard.html',
                           properties=properties,
                           tariff_groups=tariff_groups,
                           total_properties=total_properties,
                           total_readings=total_readings,
                           total_payments=total_payments,
                           pending_todos=pending_todos,
                           recent_readings=recent_readings)


# ============================================================
# Properties CRUD
# ============================================================

@admin_bp.route('/properties')
@login_required
def properties():
    """List all properties."""
    props = Property.query.order_by(Property.name).all()
    tariff_groups = TariffGroup.query.all()
    return render_template('admin/properties.html',
                           properties=props,
                           tariff_groups=tariff_groups)


@admin_bp.route('/properties/add', methods=['POST'])
@login_required
def add_property():
    """Add a new property."""
    name = request.form.get('name', '').strip()
    property_type = request.form.get('property_type', 'lakas')
    pin = request.form.get('pin', '')
    tariff_group_id = request.form.get('tariff_group_id')
    contact_name = request.form.get('contact_name', '').strip()
    contact_phone = request.form.get('contact_phone', '').strip()
    contact_email = request.form.get('contact_email', '').strip()
    address = request.form.get('address', '').strip()
    notes = request.form.get('notes', '').strip()
    purchase_price = request.form.get('purchase_price', '').strip()
    monthly_rent = request.form.get('monthly_rent', '').strip()

    if not name or not pin or not tariff_group_id:
        flash('Nev, PIN es tarifa csoport kotelezo!', 'error')
        return redirect(url_for('admin.properties'))

    pin_hash = bcrypt.hashpw(pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    prop = Property(
        name=name,
        property_type=property_type,
        pin_hash=pin_hash,
        tariff_group_id=int(tariff_group_id),
        contact_name=contact_name or None,
        contact_phone=contact_phone or None,
        contact_email=contact_email or None,
        address=address or None,
        notes=notes or None,
        purchase_price=float(purchase_price) if purchase_price else None,
        monthly_rent=float(monthly_rent) if monthly_rent else None,
    )
    db.session.add(prop)
    db.session.commit()

    flash(f'Ingatlan letrehozva: {name}', 'success')
    return redirect(url_for('admin.properties'))


@admin_bp.route('/properties/<int:prop_id>/edit', methods=['POST'])
@login_required
def edit_property(prop_id):
    """Edit a property."""
    prop = Property.query.get_or_404(prop_id)

    prop.name = request.form.get('name', prop.name).strip()
    prop.property_type = request.form.get('property_type', prop.property_type)
    prop.tariff_group_id = int(request.form.get('tariff_group_id', prop.tariff_group_id))
    prop.contact_name = request.form.get('contact_name', '').strip() or None
    prop.contact_phone = request.form.get('contact_phone', '').strip() or None
    prop.contact_email = request.form.get('contact_email', '').strip() or None
    prop.address = request.form.get('address', '').strip() or None
    prop.notes = request.form.get('notes', '').strip() or None

    purchase_price = request.form.get('purchase_price', '').strip()
    monthly_rent = request.form.get('monthly_rent', '').strip()
    prop.purchase_price = float(purchase_price) if purchase_price else None
    prop.monthly_rent = float(monthly_rent) if monthly_rent else None

    # Update PIN only if provided
    new_pin = request.form.get('pin', '').strip()
    if new_pin:
        prop.pin_hash = bcrypt.hashpw(new_pin.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    db.session.commit()
    flash(f'Ingatlan frissitve: {prop.name}', 'success')
    return redirect(url_for('admin.properties'))


@admin_bp.route('/properties/<int:prop_id>/delete', methods=['POST'])
@login_required
def delete_property(prop_id):
    """Delete a property and all its data."""
    prop = Property.query.get_or_404(prop_id)
    name = prop.name

    # Delete related records
    MeterReading.query.filter_by(property_id=prop_id).delete()
    Payment.query.filter_by(property_id=prop_id).delete()
    MaintenanceLog.query.filter_by(property_id=prop_id).delete()
    Todo.query.filter_by(property_id=prop_id).delete()
    db.session.delete(prop)
    db.session.commit()

    flash(f'Ingatlan torolve: {name}', 'success')
    return redirect(url_for('admin.properties'))


# ============================================================
# Readings (admin view)
# ============================================================

@admin_bp.route('/readings')
@login_required
def readings():
    """View all meter readings across properties."""
    property_id = request.args.get('property_id', type=int)
    utility_type = request.args.get('utility_type', '')

    query = MeterReading.query
    if property_id:
        query = query.filter_by(property_id=property_id)
    if utility_type:
        query = query.filter_by(utility_type=utility_type)

    all_readings = query.order_by(MeterReading.reading_date.desc()).limit(200).all()
    properties = Property.query.order_by(Property.name).all()

    return render_template('admin/readings.html',
                           readings=all_readings,
                           properties=properties,
                           selected_property_id=property_id,
                           selected_utility_type=utility_type)


# ============================================================
# Payments
# ============================================================

@admin_bp.route('/payments')
@login_required
def payments():
    """View and manage payments."""
    property_id = request.args.get('property_id', type=int)

    query = Payment.query
    if property_id:
        query = query.filter_by(property_id=property_id)

    all_payments = query.order_by(Payment.payment_date.desc()).limit(200).all()
    properties = Property.query.order_by(Property.name).all()

    return render_template('admin/payments.html',
                           payments=all_payments,
                           properties=properties,
                           selected_property_id=property_id)


@admin_bp.route('/payments/add', methods=['POST'])
@login_required
def add_payment():
    """Add a new payment."""
    property_id = request.form.get('property_id', type=int)
    amount = request.form.get('amount_huf', '').replace(',', '.').strip()
    payment_date_str = request.form.get('payment_date', '')
    payment_method = request.form.get('payment_method', '').strip()
    notes = request.form.get('notes', '').strip()

    if not property_id or not amount:
        flash('Ingatlan es osszeg kotelezo!', 'error')
        return redirect(url_for('admin.payments'))

    try:
        payment_date = date.fromisoformat(payment_date_str) if payment_date_str else date.today()
    except ValueError:
        payment_date = date.today()

    payment = Payment(
        property_id=property_id,
        amount_huf=float(amount),
        payment_date=payment_date,
        payment_method=payment_method or None,
        notes=notes or None,
    )
    db.session.add(payment)
    db.session.commit()

    flash(f'Befizetes rogzitve: {float(amount):,.0f} Ft', 'success')
    return redirect(url_for('admin.payments'))


# ============================================================
# Maintenance Log
# ============================================================

@admin_bp.route('/maintenance')
@login_required
def maintenance():
    """View and manage maintenance logs."""
    logs = MaintenanceLog.query.order_by(MaintenanceLog.performed_date.desc()).limit(200).all()
    properties = Property.query.order_by(Property.name).all()
    return render_template('admin/maintenance.html',
                           logs=logs,
                           properties=properties)


@admin_bp.route('/maintenance/add', methods=['POST'])
@login_required
def add_maintenance():
    """Add a maintenance log entry."""
    property_id = request.form.get('property_id', type=int)
    description = request.form.get('description', '').strip()
    category = request.form.get('category', '').strip()
    cost = request.form.get('cost_huf', '').replace(',', '.').strip()
    performed_by = request.form.get('performed_by', '').strip()
    performed_date_str = request.form.get('performed_date', '')

    if not description:
        flash('Leiras kotelezo!', 'error')
        return redirect(url_for('admin.maintenance'))

    try:
        performed_date = date.fromisoformat(performed_date_str) if performed_date_str else date.today()
    except ValueError:
        performed_date = date.today()

    log = MaintenanceLog(
        property_id=property_id if property_id else None,
        description=description,
        category=category or None,
        cost_huf=float(cost) if cost else 0,
        performed_by=performed_by or None,
        performed_date=performed_date,
    )
    db.session.add(log)
    db.session.commit()

    flash('Karbantartas bejegyzes rogzitve!', 'success')
    return redirect(url_for('admin.maintenance'))


# ============================================================
# Todos
# ============================================================

@admin_bp.route('/todos')
@login_required
def todos():
    """View and manage todos."""
    all_todos = Todo.query.order_by(
        Todo.status.asc(), Todo.priority.desc(), Todo.due_date.asc()
    ).all()
    properties = Property.query.order_by(Property.name).all()
    return render_template('admin/todos.html',
                           todos=all_todos,
                           properties=properties)


@admin_bp.route('/todos/add', methods=['POST'])
@login_required
def add_todo():
    """Add a new todo."""
    title = request.form.get('title', '').strip()
    description = request.form.get('description', '').strip()
    priority = request.form.get('priority', 'medium')
    property_id = request.form.get('property_id', type=int)
    due_date_str = request.form.get('due_date', '')

    if not title:
        flash('Cim kotelezo!', 'error')
        return redirect(url_for('admin.todos'))

    try:
        due_date = date.fromisoformat(due_date_str) if due_date_str else None
    except ValueError:
        due_date = None

    todo = Todo(
        title=title,
        description=description or None,
        priority=priority,
        property_id=property_id if property_id else None,
        due_date=due_date,
    )
    db.session.add(todo)
    db.session.commit()

    flash(f'Todo letrehozva: {title}', 'success')
    return redirect(url_for('admin.todos'))


@admin_bp.route('/todos/<int:todo_id>/toggle', methods=['POST'])
@login_required
def toggle_todo(todo_id):
    """Toggle todo status."""
    todo = Todo.query.get_or_404(todo_id)

    if todo.status == 'done':
        todo.status = 'pending'
        todo.completed_at = None
    elif todo.status == 'pending':
        todo.status = 'in_progress'
    else:
        todo.status = 'done'
        todo.completed_at = datetime.utcnow()

    db.session.commit()
    return redirect(url_for('admin.todos'))


@admin_bp.route('/todos/<int:todo_id>/delete', methods=['POST'])
@login_required
def delete_todo(todo_id):
    """Delete a todo."""
    todo = Todo.query.get_or_404(todo_id)
    db.session.delete(todo)
    db.session.commit()
    flash('Todo torolve!', 'success')
    return redirect(url_for('admin.todos'))


# ============================================================
# Tariffs
# ============================================================

@admin_bp.route('/tariffs')
@login_required
def tariffs():
    """Manage tariff groups and tariffs."""
    groups = TariffGroup.query.all()
    all_tariffs = Tariff.query.order_by(Tariff.valid_from.desc()).all()
    return render_template('admin/tariffs.html',
                           groups=groups,
                           tariffs=all_tariffs)


@admin_bp.route('/tariffs/add', methods=['POST'])
@login_required
def add_tariff():
    """Add a new tariff."""
    tariff_group_id = request.form.get('tariff_group_id', type=int)
    utility_type = request.form.get('utility_type', '')
    rate = request.form.get('rate_huf', '').replace(',', '.').strip()
    unit = request.form.get('unit', '')
    valid_from_str = request.form.get('valid_from', '')

    if not all([tariff_group_id, utility_type, rate, unit]):
        flash('Minden mezo kotelezo!', 'error')
        return redirect(url_for('admin.tariffs'))

    try:
        valid_from = date.fromisoformat(valid_from_str) if valid_from_str else date.today()
    except ValueError:
        valid_from = date.today()

    tariff = Tariff(
        tariff_group_id=tariff_group_id,
        utility_type=utility_type,
        rate_huf=float(rate),
        unit=unit,
        valid_from=valid_from,
    )
    db.session.add(tariff)
    db.session.commit()

    flash('Tarifa letrehozva!', 'success')
    return redirect(url_for('admin.tariffs'))


# ============================================================
# ROI Calculator
# ============================================================

@admin_bp.route('/roi')
@login_required
def roi():
    """ROI calculator for properties."""
    properties = Property.query.filter(
        Property.purchase_price.isnot(None),
        Property.monthly_rent.isnot(None)
    ).all()

    roi_data = []
    for prop in properties:
        total_rent = sum(p.amount_huf for p in prop.payments.all())
        total_maintenance = sum(
            m.cost_huf for m in prop.maintenance_logs.all() if m.cost_huf
        )
        net_income = total_rent - total_maintenance
        monthly_net = prop.monthly_rent - (total_maintenance / max(1, len(prop.payments.all()))) if prop.payments.count() > 0 else prop.monthly_rent

        if monthly_net > 0 and prop.purchase_price > 0:
            breakeven_months = prop.purchase_price / monthly_net
        else:
            breakeven_months = None

        roi_data.append({
            'property': prop,
            'total_rent': total_rent,
            'total_maintenance': total_maintenance,
            'net_income': net_income,
            'monthly_net': monthly_net,
            'breakeven_months': breakeven_months,
            'roi_percent': (net_income / prop.purchase_price * 100) if prop.purchase_price > 0 else 0,
        })

    return render_template('admin/roi.html', roi_data=roi_data)


# ============================================================
# Settings
# ============================================================

@admin_bp.route('/settings')
@login_required
def settings():
    """Admin settings."""
    return render_template('admin/settings.html')


@admin_bp.route('/settings/change-password', methods=['POST'])
@login_required
def change_password():
    """Change admin password."""
    old_password = request.form.get('old_password', '')
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    if not bcrypt.checkpw(old_password.encode('utf-8'), current_user.password_hash.encode('utf-8')):
        flash('Hibas regi jelszo!', 'error')
        return redirect(url_for('admin.settings'))

    if new_password != confirm_password:
        flash('Az uj jelszavak nem egyeznek!', 'error')
        return redirect(url_for('admin.settings'))

    if len(new_password) < 6:
        flash('A jelszo tul rovid (min. 6 karakter)!', 'error')
        return redirect(url_for('admin.settings'))

    current_user.password_hash = bcrypt.hashpw(
        new_password.encode('utf-8'), bcrypt.gensalt()
    ).decode('utf-8')
    db.session.commit()

    flash('Jelszo sikeresen megvaltoztatva!', 'success')
    return redirect(url_for('admin.settings'))
