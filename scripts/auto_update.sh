#!/bin/bash
# Rezsi Figyelo - Auto update script
# Cron pelda: 0 */6 * * * /opt/rezsifigyelo/scripts/auto_update.sh
# Ez a script a VPS-en fut, 6 oranked ellenorzi a git repot

set -e

APP_DIR="${APP_DIR:-/opt/rezsifigyelo}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
LOG_FILE="${APP_DIR}/logs/auto_update.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

cd "$APP_DIR"

log "Checking for updates on branch: $BRANCH"

# Fetch latest
git fetch origin "$BRANCH" 2>/dev/null

# Compare
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    log "Already up to date."
    exit 0
fi

log "Update available: $LOCAL -> $REMOTE"

# Pull changes
git reset --hard "origin/$BRANCH"
log "Code updated."

# Rebuild and restart
docker compose -f "$COMPOSE_FILE" build --no-cache rezsi-app
docker compose -f "$COMPOSE_FILE" up -d
log "Containers rebuilt and restarted."

log "Update complete!"
