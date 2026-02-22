#!/bin/bash
# Rezsi Figyelo - PostgreSQL backup script
# Hasznalat: ./backup.sh
# Cron pelda: 0 2 * * * /opt/rezsifigyelo/backup/backup.sh

set -e

# Configuration
CONTAINER_NAME="${POSTGRES_CONTAINER:-rezsi-postgres-prod}"
DB_NAME="${POSTGRES_DB:-rezsi_prod}"
DB_USER="${POSTGRES_USER:-rezsi_user}"
BACKUP_DIR="${BACKUP_DIR:-/backups/rezsifigyelo}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/rezsi_backup_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "$(date) - Starting backup..."

# pg_dump via docker exec
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Check backup
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "$(date) - Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Cleanup old backups
DELETED=$(find "$BACKUP_DIR" -name "rezsi_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "$(date) - Deleted $DELETED old backup(s) (older than ${RETENTION_DAYS} days)"
fi

echo "$(date) - Backup complete!"
