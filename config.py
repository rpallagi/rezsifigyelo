"""Application configuration loaded from environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration."""

    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    FLASK_PORT = int(os.environ.get('FLASK_PORT', 5003))
    FLASK_ENV = os.environ.get('FLASK_ENV', 'development')

    # Database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if not DATABASE_URL:
        POSTGRES_HOST = os.environ.get('POSTGRES_HOST', 'localhost')
        POSTGRES_PORT = os.environ.get('POSTGRES_PORT', '5432')
        POSTGRES_DB = os.environ.get('POSTGRES_DB', 'rezsi_dev')
        POSTGRES_USER = os.environ.get('POSTGRES_USER', 'rezsi_user')
        POSTGRES_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'devpassword')
        DATABASE_URL = (
            f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
            f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
        )

    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'max_overflow': 10,
        'pool_recycle': 1800,
        'pool_pre_ping': True,
    }

    # Uploads
    MAX_UPLOAD_SIZE_MB = int(os.environ.get('MAX_UPLOAD_SIZE_MB', 5))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

    # Admin
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
