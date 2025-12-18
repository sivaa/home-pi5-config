#!/bin/bash
# =============================================================================
# Input Wake Monitor for Night Mode
# =============================================================================
# Monitors input devices directly and wakes display on touch/mouse/keyboard.
# Works around the issue where wlopm-blanked displays don't trigger swayidle
# resume events.
#
# Usage: Run as a systemd service during night mode
# =============================================================================

set -euo pipefail

LOG_TAG="input-wake-monitor"
IDLE_TIMEOUT=300  # 5 minutes
DISPLAY_OUTPUT="HDMI-A-1"

# Find touch/mouse input devices
INPUT_DEVICES=$(find /dev/input -name 'event*' 2>/dev/null | head -5)

log() {
    logger -t "$LOG_TAG" "$1"
    echo "$(date '+%H:%M:%S') $1"
}

wake_display() {
    if wlopm 2>/dev/null | grep -q "off"; then
        log "Input detected - waking display"
        wlopm --on "$DISPLAY_OUTPUT"
    fi
}

# Use libinput to monitor all input events
# When any input is detected, wake the display
monitor_input() {
    log "Starting input monitor (watching for touch/mouse/keyboard)"

    # libinput monitor outputs events as they happen
    # We wake the display on any event, then swayidle handles the idle timeout
    stdbuf -oL libinput debug-events 2>/dev/null | while read -r line; do
        # Only act on actual input events (not DEVICE_ADDED etc)
        if echo "$line" | grep -qE "TOUCH|POINTER|KEYBOARD|BUTTON"; then
            wake_display
        fi
    done
}

# Check if libinput is available
if ! command -v libinput &>/dev/null; then
    log "ERROR: libinput not found"
    exit 1
fi

# Check if we can access input devices
if ! libinput debug-events --help &>/dev/null; then
    log "ERROR: Cannot access libinput debug-events (need input group membership?)"
    exit 1
fi

log "Input wake monitor started"
monitor_input
