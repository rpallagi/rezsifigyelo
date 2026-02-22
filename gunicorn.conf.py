"""Gunicorn configuration for production."""
import os

# Server
bind = f"0.0.0.0:{os.environ.get('FLASK_PORT', '5003')}"
workers = int(os.environ.get('GUNICORN_WORKERS', '2'))
threads = 2
worker_class = 'gthread'

# Timeouts
timeout = 120
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Process naming
proc_name = 'rezsi-figyelo'

# Reload
reload = os.environ.get('FLASK_ENV', 'production') == 'development'
