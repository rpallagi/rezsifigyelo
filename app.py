"""Rezsi Figyelo - Flask application factory."""
import os
import bcrypt
from datetime import date
from flask import Flask
from flask_login import LoginManager

from config import config
from models import db, AdminUser, TariffGroup, Tariff


login_manager = LoginManager()


def create_app(config_name=None):
    """Create and configure the Flask application."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))

    # Ensure upload folder exists
    os.makedirs(app.config.get('UPLOAD_FOLDER', 'uploads'), exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'admin.admin_login'

    @login_manager.user_loader
    def load_user(user_id):
        return AdminUser.query.get(int(user_id))

    # Register blueprints
    from routes.tenant import tenant_bp
    from routes.admin import admin_bp
    app.register_blueprint(tenant_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')

    # Create tables and seed data
    with app.app_context():
        db.create_all()
        seed_initial_data(app)

    return app


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
        lakas = TariffGroup(name='Lakas', description='Lakoingatlanok tarifai')
        uzleti = TariffGroup(name='Uzleti', description='Uzleti ingatlanok tarifai')
        db.session.add_all([lakas, uzleti])
        db.session.commit()

        # Default tariffs
        today = date.today()
        tariffs = [
            # Lakas tarifak
            Tariff(tariff_group_id=lakas.id, utility_type='villany',
                   rate_huf=212.0, unit='kWh', valid_from=today),
            Tariff(tariff_group_id=lakas.id, utility_type='viz',
                   rate_huf=758.19, unit='m3', valid_from=today),
            Tariff(tariff_group_id=lakas.id, utility_type='csatorna',
                   rate_huf=1160.78, unit='m3', valid_from=today),
            # Uzleti tarifak
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


# ============================================================
# Run the app
# ============================================================

if __name__ == '__main__':
    app = create_app()
    port = app.config.get('FLASK_PORT', 5003)
    debug = app.config.get('DEBUG', True)
    print(f"Starting Rezsi Figyelo on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=debug)
