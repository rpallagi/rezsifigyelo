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

    # Bérlő életciklus
    is_active = db.Column(db.Boolean, default=True)
    move_in_date = db.Column(db.Date, nullable=True)
    move_out_date = db.Column(db.Date, nullable=True)
    deposit_amount = db.Column(db.Float, nullable=True)  # kaució

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
    building_property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=True)  # lakás -> épület

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
    building = db.relationship('Property', remote_side=[id], foreign_keys=[building_property_id], backref='units')
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
    source = db.Column(db.String(20), nullable=True, default='manual')  # manual/tenant/smart_ttn/smart_mqtt
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


# ============================================================
# Ingatlanadó (Property Tax)
# ============================================================

class PropertyTax(db.Model):
    """Ingatlanadó nyilvántartás évenként."""
    __tablename__ = 'property_taxes'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)

    # Fizetési adatok (határozatból)
    bank_account = db.Column(db.String(50), nullable=True)
    recipient = db.Column(db.String(200), nullable=True)
    annual_amount = db.Column(db.Float, nullable=False)
    installment_amount = db.Column(db.Float, nullable=True)
    payment_memo = db.Column(db.String(200), nullable=True)

    # Határidők (szept 15, márc 15)
    deadline_autumn = db.Column(db.Date, nullable=True)
    deadline_spring = db.Column(db.Date, nullable=True)

    # Befizetés nyomkövetés
    autumn_paid = db.Column(db.Boolean, default=False)
    autumn_paid_date = db.Column(db.Date, nullable=True)
    spring_paid = db.Column(db.Boolean, default=False)
    spring_paid_date = db.Column(db.Date, nullable=True)

    # Feltöltött határozat
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=True)

    # ROI integrálás
    include_in_roi = db.Column(db.Boolean, default=True)

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('property_taxes', lazy='dynamic'))
    document = db.relationship('Document', backref='property_tax')

    def __repr__(self):
        return f'<PropertyTax property_id={self.property_id} year={self.year}>'


# ============================================================
# Közös Költség (Common/Condo Fees)
# ============================================================

class CommonFee(db.Model):
    """Közös költség konfiguráció ingatlanonként."""
    __tablename__ = 'common_fees'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)

    bank_account = db.Column(db.String(50), nullable=True)
    recipient = db.Column(db.String(200), nullable=True)
    monthly_amount = db.Column(db.Float, nullable=False)
    payment_memo = db.Column(db.String(200), nullable=True)
    frequency = db.Column(db.String(20), default='monthly')  # monthly / quarterly
    payment_day = db.Column(db.Integer, nullable=True)  # hónap napja

    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'), nullable=True)
    include_in_roi = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    valid_from = db.Column(db.Date, nullable=True)
    valid_to = db.Column(db.Date, nullable=True)

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('common_fees', lazy='dynamic'))
    document = db.relationship('Document', backref='common_fee')


class CommonFeePayment(db.Model):
    """Közös költség befizetés nyomkövetés."""
    __tablename__ = 'common_fee_payments'

    id = db.Column(db.Integer, primary_key=True)
    common_fee_id = db.Column(db.Integer, db.ForeignKey('common_fees.id'), nullable=False)
    period_date = db.Column(db.Date, nullable=False)
    paid = db.Column(db.Boolean, default=False)
    paid_date = db.Column(db.Date, nullable=True)
    amount = db.Column(db.Float, nullable=True)  # override összeg
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    common_fee = db.relationship('CommonFee', backref=db.backref('payments_tracking', lazy='dynamic'))


# ============================================================
# Bérleti Jövedelem Adózás (Rental Income Tax Config)
# ============================================================

class RentalTaxConfig(db.Model):
    """Bérleti jövedelem adózási konfiguráció ingatlanonként."""
    __tablename__ = 'rental_tax_configs'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False, unique=True)

    # Adózási mód (NAV szerint)
    # maganszemely_10pct:  Magánszemély + 10% költséghányad
    # maganszemely_teteles: Magánszemély + tételes költségelszámolás
    # egyeni_vallalkozo_atalany: EV + átalányadó
    # egyeni_vallalkozo_vszja: EV + vállalkozói SZJA
    tax_mode = db.Column(db.String(50), nullable=False, default='maganszemely_10pct')

    # ÁFA státusz
    is_vat_registered = db.Column(db.Boolean, default=False)
    vat_rate = db.Column(db.Float, nullable=True)  # 0.27 (27%) vagy 0.05 (5% lakás)

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('rental_tax_config', uselist=False))


# ============================================================
# Bérlő Történet (archivált bérlők)
# ============================================================

class TenantHistory(db.Model):
    """Archivált bérlő rekord."""
    __tablename__ = 'tenant_history'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    tenant_user_id = db.Column(db.Integer, db.ForeignKey('tenant_users.id'), nullable=True)
    tenant_name = db.Column(db.String(100), nullable=True)
    tenant_email = db.Column(db.String(255), nullable=True)

    move_in_date = db.Column(db.Date, nullable=True)
    move_out_date = db.Column(db.Date, nullable=True)
    deposit_amount = db.Column(db.Float, nullable=True)
    deposit_returned = db.Column(db.Float, nullable=True)
    deposit_deductions = db.Column(db.Float, nullable=True)
    deposit_notes = db.Column(db.Text, nullable=True)
    total_payments = db.Column(db.Float, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('tenant_history', lazy='dynamic'))


# ============================================================
# Átadás-Átvételi Checklist (be/kiköltözés workflow)
# ============================================================

class HandoverChecklist(db.Model):
    """Átadás-átvételi jegyzőkönyv tételek."""
    __tablename__ = 'handover_checklist'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    tenant_user_id = db.Column(db.Integer, db.ForeignKey('tenant_users.id'), nullable=True)
    checklist_type = db.Column(db.String(20), nullable=False)  # 'move_in' / 'move_out'

    # Wizard lépés azonosító
    step = db.Column(db.String(50), nullable=False)
    # move_in lépések: meter_readings, handover_protocol, key_handover, contract_upload
    # move_out lépések: final_readings, condition_assessment, deposit_settlement, key_return

    status = db.Column(db.String(20), default='pending')  # pending / completed
    data_json = db.Column(db.Text, nullable=True)  # lépés-specifikus adat (JSON)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('handover_checklists', lazy='dynamic'))


# ============================================================
# Chat Üzenetek
# ============================================================

class ChatMessage(db.Model):
    """Chat üzenet admin és bérlő között."""
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    sender_type = db.Column(db.String(10), nullable=False)  # 'admin' / 'tenant'
    sender_id = db.Column(db.Integer, nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('chat_messages', lazy='dynamic'))

    def __repr__(self):
        return f'<ChatMessage {self.sender_type} property={self.property_id}>'


# ============================================================
# Mérőóra nyilvántartás (gyári számok)
# ============================================================

class MeterInfo(db.Model):
    """Mérőóra gyári szám és adatok ingatlanhoz."""
    __tablename__ = 'meter_info'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    utility_type = db.Column(db.String(20), nullable=False)  # villany / viz / gaz
    serial_number = db.Column(db.String(100), nullable=True)  # gyári szám
    location = db.Column(db.String(200), nullable=True)  # hol van (pl. "pince", "konyha")
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('meters', lazy='dynamic'))


# ============================================================
# Okos mérő integráció (LoRaWAN/TTN/MQTT)
# ============================================================

class SmartMeterDevice(db.Model):
    """Okos mérő eszköz — külső device_id <-> property + közmű leképezés."""
    __tablename__ = 'smart_meter_devices'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    utility_type = db.Column(db.String(20), nullable=False)  # villany / viz

    # Külső eszköz azonosító (TTN device_id vagy MQTT topic azonosító)
    device_id = db.Column(db.String(200), unique=True, nullable=False)

    # Forrás: 'ttn' vagy 'mqtt'
    source = db.Column(db.String(20), nullable=False, default='ttn')

    # Eszköz neve (felhasználóbarát)
    name = db.Column(db.String(200), nullable=True)

    # TTN specifikus
    ttn_app_id = db.Column(db.String(200), nullable=True)

    # MQTT specifikus
    mqtt_topic = db.Column(db.String(500), nullable=True)

    # Payload dekódoló: melyik mező tartalmazza a mérőértéket
    value_field = db.Column(db.String(100), nullable=False, default='meter_value')

    # Szorzó/eltolás a nyers érték normalizáláshoz
    # végső_érték = nyers_érték * multiplier + offset
    multiplier = db.Column(db.Float, nullable=False, default=1.0)
    offset = db.Column(db.Float, nullable=False, default=0.0)

    # Eszköz mértékegység (kWh, m3, Wh, liter)
    device_unit = db.Column(db.String(20), nullable=True)

    # Aktív kapcsoló
    is_active = db.Column(db.Boolean, default=True)

    # Deduplikáció: ennyi percen belüli leolvasás elutasítása
    min_interval_minutes = db.Column(db.Integer, default=60)

    # Utolsó fogadott adat
    last_seen_at = db.Column(db.DateTime, nullable=True)
    last_raw_value = db.Column(db.Float, nullable=True)
    last_error = db.Column(db.Text, nullable=True)

    # Opcionális fizikai mérő linkje
    meter_info_id = db.Column(db.Integer, db.ForeignKey('meter_info.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('smart_meters', lazy='dynamic'))
    meter_info = db.relationship('MeterInfo', backref='smart_meter_device', uselist=False)

    def __repr__(self):
        return f'<SmartMeterDevice {self.device_id} → {self.property_id}/{self.utility_type}>'


class SmartMeterLog(db.Model):
    """Audit napló minden okos mérő üzenethez."""
    __tablename__ = 'smart_meter_logs'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(200), nullable=False)
    source = db.Column(db.String(20), nullable=False)  # ttn / mqtt
    raw_payload = db.Column(db.Text, nullable=True)
    parsed_value = db.Column(db.Float, nullable=True)
    final_value = db.Column(db.Float, nullable=True)  # multiplier+offset után

    # Eredmény
    status = db.Column(db.String(20), nullable=False)  # ok / rejected / error
    error_message = db.Column(db.Text, nullable=True)
    reading_id = db.Column(db.Integer, db.ForeignKey('meter_readings.id'), nullable=True)

    received_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<SmartMeterLog {self.device_id} {self.status}>'


# ============================================================
# WiFi hálózatok (ingatlanonkénti WiFi jelszavak)
# ============================================================

class WifiNetwork(db.Model):
    """WiFi hálózat adatai egy ingatlanhoz."""
    __tablename__ = 'wifi_networks'

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'), nullable=False)
    ssid = db.Column(db.String(200), nullable=False)
    password = db.Column(db.String(200), nullable=True)
    security_type = db.Column(db.String(20), default='WPA2')  # WPA2, WPA3, WEP, Open
    location = db.Column(db.String(200), nullable=True)  # pl. "Nappali router", "Emelet repeater"
    is_primary = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = db.relationship('Property', backref=db.backref('wifi_networks', lazy='dynamic'))

    def __repr__(self):
        return f'<WifiNetwork {self.ssid} @ property {self.property_id}>'


class AppSetting(db.Model):
    """Key-value alkalmazás beállítások (email, stb.)."""
    __tablename__ = 'app_settings'

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=True)

    @staticmethod
    def get(key: str, default: str = '') -> str:
        row = AppSetting.query.get(key)
        return row.value if row and row.value else default

    @staticmethod
    def set(key: str, value: str):
        row = AppSetting.query.get(key)
        if row:
            row.value = value
        else:
            db.session.add(AppSetting(key=key, value=value))
        db.session.commit()
