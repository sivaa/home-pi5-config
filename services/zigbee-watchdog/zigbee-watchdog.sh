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

    # Use systemctl to trigger validation before starting
    if systemctl start zigbee2mqtt; then
        logger -t zigbee-watchdog "Successfully restarted zigbee2mqtt via systemctl"

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
            -m "{\"action\":\"restart\",\"status\":\"success\",\"timestamp\":\"$(date -Iseconds)\"}" 2>/dev/null || true
    else
        logger -t zigbee-watchdog "CRITICAL: Restart BLOCKED - likely validation failure! Check: journalctl -u zigbee2mqtt"

        # ALERT: Validation blocked restart - user needs to intervene
        if [ -n "$HA_TOKEN" ]; then
            curl -s -X POST "$HA_URL/api/services/notify/${NOTIFY_SERVICE#notify.}" \
                -H "Authorization: Bearer $HA_TOKEN" \
                -H "Content-Type: application/json" \
                -d '{"message": "CRITICAL: Zigbee2MQTT restart was BLOCKED by validation! Database may be corrupted. Check Pi immediately!", "title": "Z2M Validation Failed"}' \
                >/dev/null 2>&1 || true
        fi

        # Publish failure to MQTT
        mosquitto_pub -h localhost -t "zigbee2mqtt/watchdog" \
            -m "{\"action\":\"restart\",\"status\":\"blocked\",\"reason\":\"validation_failed\",\"timestamp\":\"$(date -Iseconds)\"}" 2>/dev/null || true
    fi
else
    logger -t zigbee-watchdog "USB device not available, waiting..."
fi
