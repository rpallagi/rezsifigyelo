"""Database models for Rezsi Figyelo application."""
from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()


# ============================================================
# Admin User
# ============================================================

class AdminUser(UserMixin, db.Model):
    """Admin felhasznalo."""
    __tablename__ = 'admin_users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<AdminUser {self.username}>'


# ============================================================
# Tarifa Csoportok es Tarifak
# ============================================================

class TariffGroup(db.Model):
    """Tarifa csoport (pl. Lakas, Uzleti)."""
    __tablename__ = 'tariff_groups'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # pl. "Lakas", "Uzleti"
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    tariffs = db.relationship('Tariff', backref='tariff_group', lazy='dynamic')
    properties = db.relationship('Property', backref='tariff_group', lazy='dynamic')

    def __repr__(self):
        return f'<TariffGroup {self.name}>'


class Tariff(db.Model):
    """Tarifa (dijszabas) - torteneti, datumhoz kotott."""
    __tablename__ = 'tariffs'

    id = db.Column(db.Integer, primary_key=True)
    tariff_group_id = db.Column(db.Integer, db.ForeignKey('tariff_groups.id'), nullable=False)
    utility_type = db.Column(db.String(20), nullable=False)  # 'villany', 'viz', 'csatorna'
    rate_huf = db.Column(db.Float, nullable=False)  # Ft / egyseg
    unit = db.Column(db.String(10), nullable=False)  # 'kWh', 'm3'
    valid_from = db.Column(db.Date, nullable=False, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Tariff {self.utility_type} {self.rate_huf} Ft/{self.unit} from {self.valid_from}>'


# ============================================================
# Ingatlanok
# ============================================================

class Property(db.Model):
    """Ingatlan (lakas, uzlet, stb.)."""
    __tablename__ = 'properties'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # pl. "1. Lakas", "Uzlet"
    property_type = db.Column(db.String(20), nullable=False, default='lakas')  # lakas/uzlet/egyeb
    pin_hash = db.Column(db.String(255), nullable=False)  # bcrypt hash
    tariff_group_id = db.Column(db.Integer, db.ForeignKey('tariff_groups.id'), nullable=False)

    # Kapcsolattarto
    contact_name = db.Column(db.String(100), nullable=True)
    contact_phone = db.Column(db.String(30), nullable=True)
    contact_email = db.Column(db.String(120), nullable=True)

    # Cim, megjegyzes
    address = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # ROI szamitashoz
    purchase_price = db.Column(db.Float, nullable=True)  # Ft
    monthly_rent = db.Column(db.Float, nullable=True)  # Ft/ho

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    readings = db.relationship('MeterReading', backref='property', lazy='dynamic',
                               order_by='MeterReading.reading_date.desc()')
    payments = db.relationship('Payment', backref='property', lazy='dynamic',
                               order_by='Payment.payment_date.desc()')
    maintenance_logs = db.relationship('MaintenanceLog', backref='property', lazy='dynamic')
    todos = db.relationship('Todo', backref='property', lazy='dynamic')

    def __repr__(self):
        return f'<Property {self.name}>'


# ============================================================
# Meroallasok
# ============================================================

class MeterReading(db.Model):
    """Meroallas bejegyzes."""
    __tablename__ = 'meter_readings'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    utility_type = db.Column(db.String(20), nullable=False)  # 'villany', 'viz'
    value = db.Column(db.Float, nullable=False)  # aktualis meroallas
    prev_value = db.Column(db.Float, nullable=True)  # elozo meroallas (auto)
    consumption = db.Column(db.Float, nullable=True)  # fogyasztas (auto: value - prev_value)
    tariff_id = db.Column(db.Integer, db.ForeignKey('tariffs.id'), nullable=True)
    cost_huf = db.Column(db.Float, nullable=True)  # szamitott koltseg
    photo_filename = db.Column(db.String(255), nullable=True)  # feltoltott foto
    reading_date = db.Column(db.Date, nullable=False, default=date.today)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to tariff
    tariff = db.relationship('Tariff', backref='readings')

    def __repr__(self):
        return f'<MeterReading {self.property_id} {self.utility_type} {self.value}>'


# ============================================================
# Befizetesek
# ============================================================

class Payment(db.Model):
    """Befizetes bejegyzes."""
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    amount_huf = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.Date, nullable=False, default=date.today)
    payment_method = db.Column(db.String(50), nullable=True)  # keszpenz, atutalas, stb.
    period_from = db.Column(db.Date, nullable=True)
    period_to = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Payment {self.property_id} {self.amount_huf} Ft>'


# ============================================================
# Karbantartas Naplo
# ============================================================

class MaintenanceLog(db.Model):
    """Karbantartas bejegyzes."""
    __tablename__ = 'maintenance_logs'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=True)  # nullable = altalanos
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=True)  # villanyszereles, vizszereles, festes, stb.
    cost_huf = db.Column(db.Float, nullable=True, default=0)
    performed_by = db.Column(db.String(100), nullable=True)
    performed_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<MaintenanceLog {self.description[:30]}>'


# ============================================================
# Todo Lista
# ============================================================

class Todo(db.Model):
    """Admin todo bejegyzes."""
    __tablename__ = 'todos'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    priority = db.Column(db.String(10), nullable=False, default='medium')  # low/medium/high
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending/in_progress/done
    due_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<Todo {self.title}>'
