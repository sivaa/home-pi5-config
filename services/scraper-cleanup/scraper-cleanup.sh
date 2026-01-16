#!/bin/bash
# ============================================================================
# Scraper Cleanup Service
#
# Purpose: Stop data-scraper container after 30 minutes of inactivity
#          to reduce CPU usage when transport view is not being used.
#
# How it works:
# - The scraper writes a timestamp to /tmp/scraper-last-activity on each request
# - This script checks that timestamp and stops the container if too old
# - Runs every 5 minutes via systemd timer
#
# Integration:
# - scraper.py calls update_activity() on each /api/transport request
# - transport-store.js triggers auto-restart via HA when container is stopped
# ============================================================================

set -euo pipefail

ACTIVITY_FILE="/tmp/scraper-last-activity"
INACTIVITY_THRESHOLD=1800  # 30 minutes in seconds
CONTAINER_NAME="data-scraper"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [scraper-cleanup] $1"
}

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "Container not running, nothing to do"
    exit 0
fi

# Check if activity file exists
if [[ ! -f "$ACTIVITY_FILE" ]]; then
    log "No activity file found - container may be newly started or never received requests"
    exit 0
fi

# Read last activity timestamp
LAST_ACTIVITY=$(cat "$ACTIVITY_FILE" 2>/dev/null || echo "0")
NOW=$(date +%s)

# Handle potential floating point in timestamp
LAST_ACTIVITY_INT=${LAST_ACTIVITY%.*}

# Calculate idle time
IDLE_TIME=$((NOW - LAST_ACTIVITY_INT))

log "Last activity: ${IDLE_TIME}s ago (threshold: ${INACTIVITY_THRESHOLD}s)"

if [[ $IDLE_TIME -gt $INACTIVITY_THRESHOLD ]]; then
    log "Idle for ${IDLE_TIME}s (>${INACTIVITY_THRESHOLD}s) - stopping container"
    docker stop "$CONTAINER_NAME" || true
    rm -f "$ACTIVITY_FILE"
    log "Container stopped, activity file removed"
else
    log "Container still active, keeping alive"
fi
