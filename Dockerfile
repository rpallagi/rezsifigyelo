FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl git \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Create upload directory
RUN mkdir -p /app/uploads

# Non-root user with docker group access for self-rebuild
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app && \
    groupadd -g 999 docker 2>/dev/null || true && \
    usermod -aG docker appuser 2>/dev/null || true
USER appuser

EXPOSE 5003

# Use gunicorn in production, flask dev server in development
CMD ["sh", "-c", "if [ \"$FLASK_ENV\" = 'development' ]; then python app.py; else gunicorn -c gunicorn.conf.py 'app:create_app()'; fi"]
