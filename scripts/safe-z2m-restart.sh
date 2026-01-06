#!/bin/bash
#
# Safe Z2M Restart Script
# =======================
# Prevents catastrophic network loss during restarts
#
# WHY THIS EXISTS:
# On Jan 4, 2026, rapid docker restart commands caused complete network loss.
# This script ensures:
#   1. Backup before restart
#   2. Graceful stop with timeout
#   3. USB settle time
#   4. Validation before start
#   5. Startup verification
#
# USAGE:
#   sudo /opt/scripts/safe-z2m-restart.sh
#
# DO NOT USE:
#   docker restart zigbee2mqtt    (bypasses validation!)
#   docker stop/start zigbee2mqtt (bypasses validation!)
#

set -e  # Exit on error

SCRIPT_DIR="$(dirname "$0")"
BACKUP_SCRIPT="${SCRIPT_DIR}/z2m-backup.sh"
STOP_TIMEOUT=30
USB_SETTLE_TIME=5
MAX_STARTUP_WAIT=60

echo ""
echo "========================================"
echo "  Safe Z2M Restart"
echo "========================================"
echo ""
echo "Time: $(date)"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] This script must be run as root (sudo)"
    exit 1
fi

# Step 1: Pre-restart backup
echo "Step 1/5: Creating backup before restart..."
echo ""
if [ -x "$BACKUP_SCRIPT" ]; then
    "$BACKUP_SCRIPT" || {
        echo "[ERROR] Backup failed! Aborting restart."
        exit 1
    }
else
    echo "[WARNING] Backup script not found at $BACKUP_SCRIPT"
    echo "          Continuing without backup (not recommended)"
fi
echo ""

# Step 2: Stop Z2M gracefully
echo "Step 2/5: Stopping Z2M gracefully (${STOP_TIMEOUT}s timeout)..."
echo ""

# Get container status first
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' zigbee2mqtt 2>/dev/null || echo "not_found")

if [ "$CONTAINER_STATUS" = "running" ]; then
    docker stop --time=$STOP_TIMEOUT zigbee2mqtt
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to stop Z2M gracefully"
        exit 1
    fi
    echo "  Z2M stopped successfully"
elif [ "$CONTAINER_STATUS" = "exited" ]; then
    echo "  Z2M already stopped"
else
    echo "  Z2M container not found or not running (status: $CONTAINER_STATUS)"
fi
echo ""

# Step 3: Wait for USB to settle
echo "Step 3/5: Waiting ${USB_SETTLE_TIME}s for USB to settle..."
echo ""
sleep $USB_SETTLE_TIME
echo "  USB settle complete"
echo ""

# Step 4: Validation (via systemd service which calls z2m-validate.sh)
echo "Step 4/5: Starting Z2M via systemctl (includes validation)..."
echo ""

# Start using systemctl - this will run the validation script automatically
systemctl start zigbee2mqtt
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Z2M failed to start!"
    echo ""
    echo "Check validation output:"
    echo "  journalctl -u zigbee2mqtt -n 50"
    echo ""
    echo "If validation blocked startup, see recovery procedures:"
    echo "  /opt/pi-setup/configs/zigbee2mqtt/NETWORK_KEYS.md"
    exit 1
fi
echo ""

# Step 5: Verify startup success
echo "Step 5/5: Verifying startup (waiting up to ${MAX_STARTUP_WAIT}s)..."
echo ""

START_TIME=$(date +%s)
while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [ $ELAPSED -gt $MAX_STARTUP_WAIT ]; then
        echo "[WARNING] Timeout waiting for Z2M to fully start"
        echo "          Check logs: docker logs zigbee2mqtt --tail 50"
        break
    fi

    # Check if Z2M is responding
    if docker logs zigbee2mqtt --tail 5 2>&1 | grep -q "MQTT publish"; then
        echo "  Z2M is publishing to MQTT - startup verified!"
        break
    fi

    if docker logs zigbee2mqtt --tail 5 2>&1 | grep -q "Zigbee2MQTT started"; then
        echo "  Z2M started successfully"
        break
    fi

    # Check for startup errors
    if docker logs zigbee2mqtt --tail 5 2>&1 | grep -qE "Error|error|FATAL"; then
        echo "[WARNING] Potential error detected in logs"
        echo "          Check: docker logs zigbee2mqtt --tail 20"
        break
    fi

    echo -n "."
    sleep 2
done
echo ""

# Final status
echo ""
echo "========================================"
echo "  Restart Complete"
echo "========================================"
echo ""
echo "Status:"
systemctl status zigbee2mqtt --no-pager | head -10
echo ""
echo "Device count:"
docker exec mosquitto mosquitto_sub -t "zigbee2mqtt/bridge/devices" -C 1 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  {len(d)} devices')" || \
    echo "  (Unable to query - check logs)"
echo ""
echo "Time: $(date)"
echo "========================================"
