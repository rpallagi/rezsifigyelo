"""Rezsi Figyelo - Flask application factory."""
import os
import logging
import bcrypt
from datetime import date, datetime
from flask import Flask, jsonify
from flask_login import LoginManager

from config import config
from models import db, AdminUser, TariffGroup, Tariff

APP_VERSION = '1.0.0'

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

    # Health check endpoint (monitoring, uptime checks)
    @app.route('/api/health')
    def health_check():
        """Health check - DB connection test."""
        try:
            db.session.execute(db.text('SELECT 1'))
            db_status = 'ok'
        except Exception as e:
            db_status = f'error: {str(e)}'

        return jsonify({
            'status': 'ok' if db_status == 'ok' else 'degraded',
            'version': APP_VERSION,
            'database': db_status,
            'timestamp': datetime.utcnow().isoformat(),
        }), 200 if db_status == 'ok' else 503

    # Register blueprints
    from routes.tenant import tenant_bp
    from routes.admin import admin_bp
    app.register_blueprint(tenant_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')

    # Create tables and seed data
    with app.app_context():
        db.create_all()
        seed_initial_data(app)

    app.logger.info(f"Rezsi Figyelo v{APP_VERSION} started ({config_name})")
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
