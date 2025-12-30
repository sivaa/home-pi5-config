#!/bin/bash
# Zigbee2MQTT Watchdog - monitors and restarts Z2M if crashed
# Sends mobile notification via Home Assistant
#
# This script runs every minute via systemd timer.
# It handles the Docker restart race condition where USB device
# temporarily disappears during reconnection.

set -euo pipefail

# Configuration
USB_DEVICE="/dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_*"
CONTAINER="zigbee2mqtt"
HA_URL="http://localhost:8123"
HA_TOKEN="${ZIGBEE_WATCHDOG_HA_TOKEN:-}"
NOTIFY_SERVICE="notify.mobile_app_22111317pg"

# Check if container is running
if docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q "true"; then
    exit 0  # Running, all good
fi

# Container not running - check if USB device is available
if ls $USB_DEVICE 1>/dev/null 2>&1; then
    logger -t zigbee-watchdog "USB device available, restarting $CONTAINER"

    if docker start "$CONTAINER"; then
        logger -t zigbee-watchdog "Successfully restarted $CONTAINER"

        # Send notification via Home Assistant
        if [ -n "$HA_TOKEN" ]; then
            curl -s -X POST "$HA_URL/api/services/notify/${NOTIFY_SERVICE#notify.}" \
                -H "Authorization: Bearer $HA_TOKEN" \
                -H "Content-Type: application/json" \
                -d '{"message": "Zigbee2MQTT was down and has been automatically restarted by watchdog"}' \
                >/dev/null 2>&1 || true
        fi

        # Publish to MQTT for dashboard awareness
        mosquitto_pub -h localhost -t "zigbee2mqtt/watchdog" \
            -m "{\"action\":\"restart\",\"timestamp\":\"$(date -Iseconds)\"}" 2>/dev/null || true
    else
        logger -t zigbee-watchdog "ERROR: Failed to restart $CONTAINER"
    fi
else
    logger -t zigbee-watchdog "USB device not available, waiting..."
fi
