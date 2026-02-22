#!/bin/bash
# Unraid - Sajat appok update checker
# Ellenorzi hogy a GitHub repokban van-e ujabb commit mint a helyi
# Hasznalat: ./unraid_update_check.sh [--update]
# Cron: */30 * * * * /mnt/user/appdata/Scripts/unraid_update_check.sh
#
# Ha --update kapcsoloval futtatod, azonnal frissit is

set -e

# ============================================================
# Konfiguracio - ide add hozza az osszes sajat appot
# ============================================================
declare -A APPS
APPS=(
    ["rezsifigyelo"]="/mnt/user/appdata/rezsifigyelo"
    # ["truckscale"]="/mnt/user/TRADECARD/main"
    # ["rclone-dashboard"]="/mnt/user/appdata/rclone-dashboard"
)

# Hova mentsuk az update statuszokat (Unraid notification-hoz)
STATUS_DIR="/tmp/app-update-status"
mkdir -p "$STATUS_DIR"

AUTO_UPDATE="${1:-}"
LOG_PREFIX="[APP-UPDATE]"

# ============================================================
# Fuggvenyek
# ============================================================

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_PREFIX $1"
}

check_app() {
    local name="$1"
    local path="$2"

    if [ ! -d "$path/.git" ]; then
        log "SKIP $name - no git repo at $path"
        return
    fi

    cd "$path"
    local branch=$(git rev-parse --abbrev-ref HEAD)

    # Fetch latest from remote
    git fetch origin "$branch" --quiet 2>/dev/null

    local local_hash=$(git rev-parse HEAD)
    local remote_hash=$(git rev-parse "origin/$branch")

    if [ "$local_hash" = "$remote_hash" ]; then
        log "OK $name - up to date ($branch: ${local_hash:0:7})"
        echo "up-to-date" > "$STATUS_DIR/$name"
    else
        local behind=$(git rev-list HEAD..origin/$branch --count)
        log "UPDATE $name - $behind commit(s) behind ($branch: ${local_hash:0:7} -> ${remote_hash:0:7})"
        echo "update-available:$behind:${remote_hash:0:7}" > "$STATUS_DIR/$name"

        # Unraid notification
        /usr/local/emhttp/webGui/scripts/notify -i normal -s "App Update" \
            -d "$name: $behind uj commit elerheto ($branch)" 2>/dev/null || true

        # Auto update if --update flag
        if [ "$AUTO_UPDATE" = "--update" ]; then
            update_app "$name" "$path" "$branch"
        fi
    fi
}

update_app() {
    local name="$1"
    local path="$2"
    local branch="$3"

    log "UPDATING $name ..."
    cd "$path"

    # Pull latest
    git reset --hard "origin/$branch"

    # Find docker-compose file
    local compose_file=""
    if [ -f "docker-compose.yml" ]; then
        compose_file="docker-compose.yml"
    elif [ -f "docker/docker-compose.main.yml" ]; then
        compose_file="docker/docker-compose.main.yml"
    fi

    if [ -n "$compose_file" ]; then
        log "Rebuilding $name with $compose_file ..."
        docker compose -f "$compose_file" build --no-cache 2>&1 | tail -5
        docker compose -f "$compose_file" up -d 2>&1 | tail -5
        log "DONE $name updated and restarted"
        echo "up-to-date" > "$STATUS_DIR/$name"
    else
        log "WARN $name - no docker-compose file found, only git pulled"
    fi
}

# ============================================================
# Futtatas
# ============================================================

log "Checking ${#APPS[@]} app(s) for updates..."

for name in "${!APPS[@]}"; do
    check_app "$name" "${APPS[$name]}"
done

log "Done."

# Osszesites
echo ""
echo "=== App Status ==="
for name in "${!APPS[@]}"; do
    status=$(cat "$STATUS_DIR/$name" 2>/dev/null || echo "unknown")
    if [[ "$status" == update-available* ]]; then
        behind=$(echo "$status" | cut -d: -f2)
        echo "  $name: UPDATE AVAILABLE ($behind commit(s))"
    else
        echo "  $name: up to date"
    fi
done
