#!/bin/bash
# =============================================================================
# Brightness Dimmer Script
# =============================================================================
# Gradually dims the display brightness when idle, resets on input.
#
# Behavior:
#   - On input/touch: brightness set to 100%
#   - Every minute of idle: brightness decreases by 10%
#   - Minimum brightness: 10%
#
# Timeline:
#   Touch → 100% → 90% → 80% → 70% → 60% → 50% → 40% → 30% → 20% → 10% (idle)
#           0min   1min   2min   3min   4min   5min   6min   7min   8min   9min
#
# Integration:
#   - input-wake-monitor.sh calls "brightness-dimmer.sh wake" on touch
#   - This script runs as a systemd service, checking every 60 seconds
# =============================================================================

set -euo pipefail

# Configuration
WAKE_BRIGHTNESS=100     # Brightness on touch/wake
MIN_BRIGHTNESS=10       # Minimum brightness (idle state)
DIM_STEP=10             # Decrease per interval
DIM_INTERVAL=60         # Seconds between dim steps
ACTIVITY_FILE="/tmp/display-activity"
LOG_TAG="brightness-dimmer"

# Logging function
log() {
    local level="$1"
    local message="$2"
    logger -t "$LOG_TAG" "[$level] $message"
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $message"
}

# Set brightness via DDC/CI
set_brightness() {
    local level="$1"
    if sudo ddcutil setvcp 10 "$level" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Get current brightness
get_brightness() {
    sudo ddcutil getvcp 10 2>/dev/null | grep -oP 'current value =\s*\K\d+' || echo "0"
}

# Calculate target brightness based on idle time
calculate_target_brightness() {
    local idle_seconds="$1"
    local elapsed_intervals=$((idle_seconds / DIM_INTERVAL))
    local dim_amount=$((elapsed_intervals * DIM_STEP))
    local target=$((WAKE_BRIGHTNESS - dim_amount))

    # Clamp to minimum
    if [ "$target" -lt "$MIN_BRIGHTNESS" ]; then
        target="$MIN_BRIGHTNESS"
    fi

    echo "$target"
}

# Get seconds since last activity
get_idle_seconds() {
    if [ -f "$ACTIVITY_FILE" ]; then
        local last_activity
        last_activity=$(stat -c %Y "$ACTIVITY_FILE" 2>/dev/null || echo "0")
        local now
        now=$(date +%s)
        echo $((now - last_activity))
    else
        # No activity file, assume very long idle
        echo "9999"
    fi
}

# Wake command - reset brightness on input
cmd_wake() {
    touch "$ACTIVITY_FILE"
    local current
    current=$(get_brightness)

    if [ "$current" -lt "$WAKE_BRIGHTNESS" ]; then
        log "INFO" "Wake: Setting brightness to ${WAKE_BRIGHTNESS}% (was ${current}%)"
        set_brightness "$WAKE_BRIGHTNESS"
    fi
}

# Run the dimmer loop
cmd_run() {
    log "INFO" "Starting brightness dimmer (wake=${WAKE_BRIGHTNESS}%, min=${MIN_BRIGHTNESS}%, step=${DIM_STEP}%/min)"

    # Initialize activity file
    touch "$ACTIVITY_FILE"

    while true; do
        local idle_seconds
        idle_seconds=$(get_idle_seconds)

        local target
        target=$(calculate_target_brightness "$idle_seconds")

        local current
        current=$(get_brightness)

        # Only dim if current brightness is higher than target
        if [ "$current" -gt "$target" ]; then
            log "INFO" "Dimming: ${current}% → ${target}% (idle ${idle_seconds}s)"
            set_brightness "$target"
        fi

        sleep "$DIM_INTERVAL"
    done
}

# Show status
cmd_status() {
    local current
    current=$(get_brightness)
    local idle_seconds
    idle_seconds=$(get_idle_seconds)
    local target
    target=$(calculate_target_brightness "$idle_seconds")

    echo "=== Brightness Dimmer Status ==="
    echo "Current brightness: ${current}%"
    echo "Target brightness:  ${target}%"
    echo "Idle time:          ${idle_seconds}s"
    echo "Activity file:      $ACTIVITY_FILE"

    if [ -f "$ACTIVITY_FILE" ]; then
        echo "Last activity:      $(stat -c '%y' "$ACTIVITY_FILE" 2>/dev/null | cut -d. -f1)"
    else
        echo "Last activity:      (no activity recorded)"
    fi
}

# Main
case "${1:-status}" in
    wake)
        cmd_wake
        ;;
    run)
        cmd_run
        ;;
    status)
        cmd_status
        ;;
    *)
        echo "Usage: $0 {wake|run|status}"
        echo ""
        echo "Commands:"
        echo "  wake    Reset brightness to ${WAKE_BRIGHTNESS}% (call on input)"
        echo "  run     Start the dimmer loop (runs as service)"
        echo "  status  Show current dimmer status"
        exit 1
        ;;
esac
