#!/bin/bash
# Rezsi Figyelo - PostgreSQL restore script
# Hasznalat: ./restore.sh <backup_file.sql.gz>

set -e

if [ -z "$1" ]; then
    echo "Hasznalat: $0 <backup_file.sql.gz>"
    echo ""
    echo "Elerheto backupok:"
    ls -la ${BACKUP_DIR:-/backups/rezsifigyelo}/*.sql.gz 2>/dev/null || echo "  Nincs backup."
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${POSTGRES_CONTAINER:-rezsi-postgres-prod}"
DB_NAME="${POSTGRES_DB:-rezsi_prod}"
DB_USER="${POSTGRES_USER:-rezsi_user}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Hiba: A fajl nem talalhato: $BACKUP_FILE"
    exit 1
fi

echo "FIGYELEM: Ez torolni fogja a jelenlegi '$DB_NAME' adatbazist es visszaallitja a backupbol!"
echo "Backup fajl: $BACKUP_FILE"
read -p "Biztosan folytatod? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Visszaallitas megszakitva."
    exit 0
fi

echo "$(date) - Adatbazis torles es ujra letrehozas..."
docker exec "$CONTAINER_NAME" dropdb -U "$DB_USER" --if-exists "$DB_NAME"
docker exec "$CONTAINER_NAME" createdb -U "$DB_USER" "$DB_NAME"

echo "$(date) - Visszaallitas a backupbol..."
zcat "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" "$DB_NAME"

echo "$(date) - Visszaallitas kesz!"
