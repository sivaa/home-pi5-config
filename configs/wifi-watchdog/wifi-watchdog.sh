#!/bin/bash
# WiFi Watchdog - Restart NetworkManager if WiFi is down
# Location on Pi: /usr/local/bin/wifi-watchdog.sh
#
# This script runs every 2 minutes via systemd timer.
# If the gateway is unreachable and WiFi is disconnected,
# it restarts NetworkManager to force a reconnection.

LOG_TAG="wifi-watchdog"

# Check if we can ping the gateway
check_connection() {
    # Get default gateway
    GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
    if [ -z "$GATEWAY" ]; then
        return 1
    fi
    # Try to ping gateway (1 packet, 5 second timeout)
    ping -c 1 -W 5 "$GATEWAY" > /dev/null 2>&1
    return $?
}

# Check if wlan0 is connected
check_wifi_state() {
    STATE=$(nmcli -t -f DEVICE,STATE device status | grep "^wlan0:" | cut -d: -f2)
    [ "$STATE" = "connected" ]
}

# Main logic
if check_connection; then
    # Connection is fine - log success (comment out for less verbose logging)
    # logger -t "$LOG_TAG" "WiFi OK - gateway reachable"
    exit 0
fi

# Connection failed - check WiFi state
if ! check_wifi_state; then
    logger -t "$LOG_TAG" "WiFi disconnected - restarting NetworkManager"
    systemctl restart NetworkManager
    sleep 15

    if check_connection; then
        logger -t "$LOG_TAG" "WiFi recovered after restart"
    else
        logger -t "$LOG_TAG" "WiFi still down after restart - may need manual intervention"
    fi
else
    # WiFi shows connected but can't reach gateway - might be router issue
    logger -t "$LOG_TAG" "WiFi connected but gateway unreachable - possible router issue"
fi
