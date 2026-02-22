# Multi-stage build: Node for React frontend + Python for Flask API

# Stage 1: Build React frontend (for production)
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --production=false
COPY frontend/ .
RUN npm run build
# vite outDir: ../static/dist => /static/dist

# Stage 2: Python app + Node (for dev vite server)
FROM python:3.12-slim

WORKDIR /app

# System deps + Node.js for dev mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl git gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Install frontend node_modules (for dev mode vite)
RUN cd /app/frontend && npm install --production=false 2>/dev/null || true

# Copy built React frontend from stage 1 (for prod)
COPY --from=frontend-build /static/dist /app/static/dist

# Create upload directory
RUN mkdir -p /app/uploads

# Non-root user with docker group access
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app && \
    groupadd -g 999 docker 2>/dev/null || true && \
    usermod -aG docker appuser 2>/dev/null || true
USER appuser

EXPOSE 5003 5173

# Dev: Flask + Vite dev server. Prod: gunicorn serves built React SPA.
CMD ["sh", "-c", "if [ \"$FLASK_ENV\" = 'development' ]; then cd /app/frontend && npx vite --host 0.0.0.0 & python /app/app.py; else gunicorn -c gunicorn.conf.py 'app:create_app()'; fi"]
