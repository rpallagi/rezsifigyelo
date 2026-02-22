"""Database models for Rezsi Figyelo application."""
from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()


# ============================================================
# Admin User
# ============================================================

class AdminUser(UserMixin, db.Model):
    """Admin felhasználó."""
    __tablename__ = 'admin_users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<AdminUser {self.username}>'


# ============================================================
# Tenant User (berlo)
# ============================================================

class TenantUser(db.Model):
    """Bérlő felhasználó - email + jelszó bejelentkezés."""
    __tablename__ = 'tenant_users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # nullable for social login only users
    name = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(30), nullable=True)

    # Social login providers
    google_id = db.Column(db.String(255), unique=True, nullable=True)
    facebook_id = db.Column(db.String(255), unique=True, nullable=True)
    apple_id = db.Column(db.String(255), unique=True, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Many-to-many: tenant can access multiple properties
    properties = db.relationship('Property', secondary='tenant_property_access',
                                  backref=db.backref('tenants', lazy='dynamic'))

    def __repr__(self):
        return f'<TenantUser {self.email}>'


# Association table: which tenant can access which properties
tenant_property_access = db.Table('tenant_property_access',
    db.Column('tenant_user_id', db.Integer, db.ForeignKey('tenant_users.id'), primary_key=True),
    db.Column('property_id', db.Integer, db.ForeignKey('properties.id'), primary_key=True),
)


# ============================================================
# Tarifa Csoportok és Tarifák
# ============================================================

class TariffGroup(db.Model):
    """Tarifa csoport (pl. Lakás, Üzleti)."""
    __tablename__ = 'tariff_groups'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # pl. "Lakás", "Üzleti"
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    tariffs = db.relationship('Tariff', backref='tariff_group', lazy='dynamic')
    properties = db.relationship('Property', backref='tariff_group', lazy='dynamic')

    def __repr__(self):
        return f'<TariffGroup {self.name}>'


class Tariff(db.Model):
    """Tarifa (díjszabás) - történeti, dátumhoz kötött."""
    __tablename__ = 'tariffs'

    id = db.Column(db.Integer, primary_key=True)
    tariff_group_id = db.Column(db.Integer, db.ForeignKey('tariff_groups.id'), nullable=False)
    utility_type = db.Column(db.String(20), nullable=False)  # 'villany', 'viz', 'csatorna'
    rate_huf = db.Column(db.Float, nullable=False)  # Ft / egység
    unit = db.Column(db.String(10), nullable=False)  # 'kWh', 'm3'
    valid_from = db.Column(db.Date, nullable=False, default=date.today)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Tariff {self.utility_type} {self.rate_huf} Ft/{self.unit} from {self.valid_from}>'


# ============================================================
# Ingatlanok
# ============================================================

class Property(db.Model):
    """Ingatlan (lakás, üzlet, stb.)."""
    __tablename__ = 'properties'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # pl. "1. Lakás", "Üzlet"
    property_type = db.Column(db.String(20), nullable=False, default='lakas')  # lakas/uzlet/egyeb
    pin_hash = db.Column(db.String(255), nullable=True)  # legacy PIN auth (optional)
    tariff_group_id = db.Column(db.Integer, db.ForeignKey('tariff_groups.id'), nullable=False)

    # Kapcsolattartó
    contact_name = db.Column(db.String(100), nullable=True)
    contact_phone = db.Column(db.String(30), nullable=True)
    contact_email = db.Column(db.String(120), nullable=True)

    # Cím, megjegyzés
    address = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # ROI számításhoz
    purchase_price = db.Column(db.Float, nullable=True)  # Ft
    monthly_rent = db.Column(db.Float, nullable=True)  # Ft/hó

    # Ingatlan fotó (avatar)
    avatar_filename = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    readings = db.relationship('MeterReading', backref='property', lazy='dynamic',
                               order_by='MeterReading.reading_date.desc()')
    payments = db.relationship('Payment', backref='property', lazy='dynamic',
                               order_by='Payment.payment_date.desc()')
    maintenance_logs = db.relationship('MaintenanceLog', backref='property', lazy='dynamic')
    todos = db.relationship('Todo', backref='property', lazy='dynamic')
    documents = db.relationship('Document', backref='property', lazy='dynamic',
                                order_by='Document.uploaded_at.desc()')
    marketing = db.relationship('MarketingContent', backref='property', uselist=False)

    def __repr__(self):
        return f'<Property {self.name}>'


# ============================================================
# Mérőállások
# ============================================================

class MeterReading(db.Model):
    """Mérőállás bejegyzés."""
    __tablename__ = 'meter_readings'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    utility_type = db.Column(db.String(20), nullable=False)  # 'villany', 'viz'
    value = db.Column(db.Float, nullable=False)  # aktuális mérőállás
    prev_value = db.Column(db.Float, nullable=True)  # előző mérőállás (auto)
    consumption = db.Column(db.Float, nullable=True)  # fogyasztás (auto: value - prev_value)
    tariff_id = db.Column(db.Integer, db.ForeignKey('tariffs.id'), nullable=True)
    cost_huf = db.Column(db.Float, nullable=True)  # számított költség
    photo_filename = db.Column(db.String(255), nullable=True)  # feltöltött fotó
    reading_date = db.Column(db.Date, nullable=False, default=date.today)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to tariff
    tariff = db.relationship('Tariff', backref='readings')

    def __repr__(self):
        return f'<MeterReading {self.property_id} {self.utility_type} {self.value}>'


# ============================================================
# Befizetések
# ============================================================

class Payment(db.Model):
    """Befizetés bejegyzés."""
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    amount_huf = db.Column(db.Float, nullable=False)
    payment_date = db.Column(db.Date, nullable=False, default=date.today)
    payment_method = db.Column(db.String(50), nullable=True)  # készpénz, átutalás, stb.
    period_from = db.Column(db.Date, nullable=True)
    period_to = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Payment {self.property_id} {self.amount_huf} Ft>'


# ============================================================
# Karbantartás Napló
# ============================================================

class MaintenanceLog(db.Model):
    """Karbantartás bejegyzés."""
    __tablename__ = 'maintenance_logs'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=True)  # nullable = általános
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=True)  # villanyszerelés, vízszerelés, festés, stb.
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


# ============================================================
# Dokumentumok (feltöltött fájlok ingatlanhoz)
# ============================================================

class Document(db.Model):
    """Feltöltött dokumentum egy ingatlanhoz."""
    __tablename__ = 'documents'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)        # eredeti fájlnév
    stored_filename = db.Column(db.String(255), nullable=False)  # UUID-s tárolt név
    category = db.Column(db.String(50), nullable=False, default='egyeb')
    # category értékek: atadas_atvetel / szerzodes / marketing / egyeb
    notes = db.Column(db.Text, nullable=True)
    file_size = db.Column(db.Integer, nullable=True)
    mime_type = db.Column(db.String(100), nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Document {self.filename}>'


# ============================================================
# Marketing tartalom (hirdetés szöveg + fotók)
# ============================================================

class MarketingContent(db.Model):
    """Marketing tartalom egy ingatlanhoz (ingatlan.com hirdetés stb.)."""
    __tablename__ = 'marketing_contents'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False, unique=True)
    listing_title = db.Column(db.String(200), nullable=True)
    listing_description = db.Column(db.Text, nullable=True)
    listing_url = db.Column(db.String(500), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<MarketingContent property_id={self.property_id}>'
