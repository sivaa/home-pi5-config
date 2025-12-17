#!/bin/bash
# =============================================================================
# Router Reboot Script (Phase 1 - Graceful Only)
# =============================================================================
# Uses arris-tg3442-reboot Python script to gracefully reboot the Vodafone router.
#
# Prerequisites:
#   pip3 install beautifulsoup4 pycryptodome requests lxml --break-system-packages
#   git clone https://github.com/diveflo/arris-tg3442-reboot.git ~/arris-tg3442-reboot
#   (firmware.py patched to support 01.05.063.13.EURO.PC20)
#
# Schedule (cron):
#   0 4 * * * /home/pi/pi-setup/scripts/router-reboot.sh >> /var/log/router-reboot.log 2>&1
#
# Phase 2 (Future): Add smart plug fallback if graceful reboot fails
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REBOOT_SCRIPT="/home/pi/arris-tg3442-reboot/arris_tg3442_reboot.py"
ROUTER_IP="192.168.0.1"
RECOVERY_WAIT=120

# Load password from .env file
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
else
    echo "ERROR: .env file not found at $SCRIPT_DIR/.env"
    exit 1
fi

if [ -z "$ROUTER_PASSWORD" ]; then
    echo "ERROR: ROUTER_PASSWORD not set in .env file"
    exit 1
fi

# Logging function (writes to both syslog and stdout)
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

    logger -t "router-reboot" "[$level] $message"
    echo "$timestamp [$level] $message"
}

# Main execution
main() {
    log "INFO" "=========================================="
    log "INFO" "Router reboot initiated (Phase 1 - Graceful)"
    log "INFO" "=========================================="

    # Check if reboot script exists
    if [ ! -f "$REBOOT_SCRIPT" ]; then
        log "ERROR" "Reboot script not found at $REBOOT_SCRIPT"
        log "ERROR" "Run: git clone https://github.com/diveflo/arris-tg3442-reboot.git ~/arris-tg3442-reboot"
        exit 1
    fi

    log "INFO" "Sending graceful reboot command to router at $ROUTER_IP..."

    cd "$(dirname "$REBOOT_SCRIPT")"
    if python3 "$REBOOT_SCRIPT" -t "http://$ROUTER_IP" -p "$ROUTER_PASSWORD"; then
        log "INFO" "Graceful reboot command sent successfully"
    else
        log "ERROR" "Graceful reboot failed"
        exit 1
    fi

    log "INFO" "Waiting ${RECOVERY_WAIT}s for router to come back online..."
    sleep "$RECOVERY_WAIT"

    # Verify connectivity
    log "INFO" "Verifying internet connectivity..."
    if ping -c 3 -W 10 8.8.8.8 > /dev/null 2>&1; then
        log "INFO" "Internet connectivity restored - router reboot successful"
    else
        log "WARN" "Internet still down after reboot - may need manual intervention"
    fi

    log "INFO" "Router reboot script completed"
}

main "$@"
