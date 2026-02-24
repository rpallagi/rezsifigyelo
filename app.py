"""Rezsi Követés - Flask application factory with React SPA frontend."""
import os
import logging
import bcrypt
from datetime import date, datetime
from flask import Flask, jsonify, send_from_directory
from flask_login import LoginManager

from config import config
from models import (db, AdminUser, TenantUser, Property, TariffGroup, Tariff,
                    PropertyTax, CommonFee, CommonFeePayment, RentalTaxConfig,
                    TenantHistory, HandoverChecklist, ChatMessage, MeterInfo,
                    SmartMeterDevice, SmartMeterLog)

APP_VERSION = '3.1.1'

login_manager = LoginManager()


def create_app(config_name=None):
    """Create and configure the Flask application."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))

    # Logging
    log_level = logging.DEBUG if app.config.get('DEBUG') else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    app.logger.setLevel(log_level)

    # Ensure upload folder exists
    os.makedirs(app.config.get('UPLOAD_FOLDER', 'uploads'), exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'admin.admin_login'

    @login_manager.user_loader
    def load_user(user_id):
        return AdminUser.query.get(int(user_id))

    # Security headers (prod)
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if app.config.get('FLASK_ENV') == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    # Store app version and base dir in config
    app.config['APP_VERSION'] = APP_VERSION
    app.config['BASE_DIR'] = os.path.dirname(os.path.abspath(__file__))

    # Register API blueprint (JSON endpoints for React frontend)
    from routes.api import api_bp
    app.register_blueprint(api_bp)

    # Keep legacy Jinja blueprints for backward compatibility
    from routes.tenant import tenant_bp
    from routes.admin import admin_bp
    app.register_blueprint(tenant_bp, url_prefix='/legacy')
    app.register_blueprint(admin_bp, url_prefix='/legacy/admin')

    # Serve uploaded files (avatars, photos, documents)
    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        """Serve uploaded files (avatars, meter photos, documents)."""
        upload_folder = app.config.get('UPLOAD_FOLDER', 'uploads')
        return send_from_directory(upload_folder, filename)

    # Serve React SPA (built files from frontend/dist or static/dist)
    dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'dist')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        """Serve React SPA - all non-API routes go to index.html."""
        # Skip API routes
        if path.startswith('api/'):
            return jsonify({'error': 'Not found'}), 404

        # Try to serve static file from dist
        file_path = os.path.join(dist_dir, path)
        if path and os.path.isfile(file_path):
            return send_from_directory(dist_dir, path)

        # Fallback to index.html for SPA routing
        index_path = os.path.join(dist_dir, 'index.html')
        if os.path.isfile(index_path):
            return send_from_directory(dist_dir, 'index.html')

        # If no build yet, show helpful message
        return jsonify({
            'message': 'Rezsi Követés API running. Frontend not built yet.',
            'api_health': '/api/health',
            'version': APP_VERSION,
        })

    # Create tables and seed data
    with app.app_context():
        db.create_all()
        _run_migrations()
        seed_initial_data(app)

    # Start MQTT background client if enabled
    if app.config.get('MQTT_ENABLED'):
        try:
            from services.mqtt_client import MQTTSmartMeterClient
            mqtt_client = MQTTSmartMeterClient(app)
            mqtt_client.start()
            app.mqtt_client = mqtt_client
            app.logger.info("MQTT smart meter client started")
        except Exception as e:
            app.logger.warning(f"MQTT client failed to start: {e}")

    app.logger.info(f"Rezsi Figyelo v{APP_VERSION} started ({config_name})")
    return app


def _run_migrations():
    """Run manual migrations for columns that db.create_all() cannot add to existing tables."""
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    # v3.0: Add avatar_filename to properties table
    if 'properties' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('properties')]
        if 'avatar_filename' not in columns:
            db.session.execute(text('ALTER TABLE properties ADD COLUMN avatar_filename VARCHAR(255)'))
            db.session.commit()
            print("[MIGRATE] Added avatar_filename to properties table")
        if 'building_property_id' not in columns:
            db.session.execute(text('ALTER TABLE properties ADD COLUMN building_property_id INTEGER'))
            db.session.commit()
            print("[MIGRATE] Added building_property_id to properties table")

    # v3.1: Add tenant lifecycle fields to tenant_users
    if 'tenant_users' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('tenant_users')]
        new_cols = []
        if 'is_active' not in columns:
            new_cols.append('ALTER TABLE tenant_users ADD COLUMN is_active BOOLEAN DEFAULT TRUE')
        if 'move_in_date' not in columns:
            new_cols.append('ALTER TABLE tenant_users ADD COLUMN move_in_date DATE')
        if 'move_out_date' not in columns:
            new_cols.append('ALTER TABLE tenant_users ADD COLUMN move_out_date DATE')
        if 'deposit_amount' not in columns:
            new_cols.append('ALTER TABLE tenant_users ADD COLUMN deposit_amount FLOAT')
        if new_cols:
            for sql in new_cols:
                db.session.execute(text(sql))
            db.session.commit()
            print("[MIGRATE] Added tenant lifecycle fields to tenant_users")

    # v3.1.1: Add source column to meter_readings
    if 'meter_readings' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('meter_readings')]
        if 'source' not in columns:
            db.session.execute(text("ALTER TABLE meter_readings ADD COLUMN source VARCHAR(20) DEFAULT 'manual'"))
            db.session.commit()
            print("[MIGRATE] Added source column to meter_readings")


def seed_initial_data(app):
    """Seed default tariff groups, tariffs, and admin user if empty."""

    # Create admin user if none exists
    if AdminUser.query.count() == 0:
        username = app.config.get('ADMIN_USERNAME', 'admin')
        password = app.config.get('ADMIN_PASSWORD', 'admin')
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = AdminUser(username=username, password_hash=password_hash)
        db.session.add(admin)
        db.session.commit()
        print(f"[SEED] Admin user created: {username}")

    # Create tariff groups if none exist
    if TariffGroup.query.count() == 0:
        lakas = TariffGroup(name='Lakás', description='Lakóingatlanok tarifái')
        uzleti = TariffGroup(name='Üzleti', description='Üzleti ingatlanok tarifái')
        db.session.add_all([lakas, uzleti])
        db.session.commit()

        # Default tariffs
        today = date.today()
        tariffs = [
            # Lakás tarifák
            Tariff(tariff_group_id=lakas.id, utility_type='villany',
                   rate_huf=212.0, unit='kWh', valid_from=today),
            Tariff(tariff_group_id=lakas.id, utility_type='viz',
                   rate_huf=758.19, unit='m3', valid_from=today),
            Tariff(tariff_group_id=lakas.id, utility_type='csatorna',
                   rate_huf=1160.78, unit='m3', valid_from=today),
            # Üzleti tarifák
            Tariff(tariff_group_id=uzleti.id, utility_type='villany',
                   rate_huf=212.0, unit='kWh', valid_from=today),
            Tariff(tariff_group_id=uzleti.id, utility_type='viz',
                   rate_huf=758.19, unit='m3', valid_from=today),
            Tariff(tariff_group_id=uzleti.id, utility_type='csatorna',
                   rate_huf=1160.78, unit='m3', valid_from=today),
        ]
        db.session.add_all(tariffs)
        db.session.commit()
        print("[SEED] Default tariff groups and tariffs created.")

    # Fix accent issues in existing tariff group names
    for tg in TariffGroup.query.all():
        fixes = {
            'Lakas': 'Lakás',
            'Uzleti': 'Üzleti',
            'Lakoingatlanok tarifai': 'Lakóingatlanok tarifái',
            'Uzleti ingatlanok tarifai': 'Üzleti ingatlanok tarifái',
        }
        if tg.name in fixes:
            tg.name = fixes[tg.name]
        if tg.description in fixes:
            tg.description = fixes[tg.description]

    # Fix accent issues in existing property names
    for p in Property.query.all():
        import re
        name = p.name
        # Fix common accent-less patterns in property names
        name = re.sub(r'\bLakas\b', 'Lakás', name)
        name = re.sub(r'\bUzlet\b', 'Üzlet', name)
        name = re.sub(r'\bBerlo\b', 'Bérlő', name)
        if name != p.name:
            p.name = name
        # Fix contact_name
        if p.contact_name:
            cn = p.contact_name
            cn = re.sub(r'\bBerlo\b', 'Bérlő', cn)
            if cn != p.contact_name:
                p.contact_name = cn

    db.session.commit()

    # Create demo tenant user if none exists
    if TenantUser.query.count() == 0:
        demo_password = bcrypt.hashpw('demo123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        demo_tenant = TenantUser(
            email='demo@rezsikoves.hu',
            password_hash=demo_password,
            name='Demo Bérlő',
        )
        db.session.add(demo_tenant)
        db.session.commit()

        # Assign first property to demo tenant (1 property = no selection screen)
        first_prop = Property.query.first()
        if first_prop:
            demo_tenant.properties.append(first_prop)
            db.session.commit()
            print(f"[SEED] Demo tenant created: demo@rezsikoves.hu / demo123 (property: {first_prop.name})")
        else:
            print("[SEED] Demo tenant created: demo@rezsikoves.hu / demo123 (no properties yet)")


# ============================================================
# Run the app
# ============================================================

if __name__ == '__main__':
    app = create_app()
    port = app.config.get('FLASK_PORT', 5003)
    debug = app.config.get('DEBUG', True)
    print(f"Starting Rezsi Figyelo on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=debug)
