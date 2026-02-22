FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Create upload directory
RUN mkdir -p /app/uploads

# Non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 5003

# Use gunicorn in production, flask dev server in development
CMD ["sh", "-c", "if [ \"$FLASK_ENV\" = 'development' ]; then python app.py; else gunicorn -c gunicorn.conf.py 'app:create_app()'; fi"]
