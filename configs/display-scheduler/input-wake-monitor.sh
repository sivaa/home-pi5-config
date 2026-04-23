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

set -uo pipefail

LOG_TAG="input-wake-monitor"
DISPLAY_OUTPUT="HDMI-A-1"
DEBOUNCE_SEC=2      # Skip wakes within N seconds of previous wake

# Debounce state — bash builtin $EPOCHSECONDS, zero fork per check
LAST_WAKE=0

# Under systemd --user, stdout already goes to journald — drop the `logger`
# fork that was duplicating every line into syslog.
log() {
    echo "$(date '+%H:%M:%S') $1"
}

wake_display() {
    # ┌─────────────────────────────────────────────────────────────────┐
    # │  INCIDENT 2026-04-23: Pi 5 load hit 6.02 / CPU 59% for 5 min   │
    # │                                                                 │
    # │  Root cause: ILITEK touchscreen (USB 222a:0001) is powered     │
    # │  via the monitor's USB hub. wlopm --off HDMI-A-1 drops the     │
    # │  hub, USB re-enumerates, kernel emits HID init reports that    │
    # │  libinput reports as TOUCH/POINTER events. This fires          │
    # │  wake_display ~950×/min. Each call was forking wlopm + grep +  │
    # │  brightness-dimmer.sh (sudo + ddcutil) + logger = ~10 forks.   │
    # │                                                                 │
    # │  Fix: debounce to 1 wake per N seconds, skip entirely when     │
    # │  display is already on. Real user touches still wake instantly │
    # │  because the first event per quiet window passes through.      │
    # └─────────────────────────────────────────────────────────────────┘
    local now=$EPOCHSECONDS
    (( now - LAST_WAKE < DEBOUNCE_SEC )) && return 0
    LAST_WAKE=$now

    # Idempotent: only do work when display is actually off.
    local status
    status=$(wlopm 2>/dev/null) || return 0
    [[ "$status" == *"$DISPLAY_OUTPUT off"* ]] || return 0

    log "Input detected - waking display"
    wlopm --on "$DISPLAY_OUTPUT" || true

    if [[ -x "$HOME/.local/bin/brightness-dimmer.sh" ]]; then
        "$HOME/.local/bin/brightness-dimmer.sh" wake &>/dev/null || true
    fi
}

# Use libinput to monitor all input events. Wake on TOUCH/POINTER/KEYBOARD/BUTTON.
# IMPORTANT: bash builtin =~ used instead of `echo | grep` — saves 2 forks per
# event line, critical at >10 events/sec.
monitor_input() {
    log "Starting input monitor (watching for touch/mouse/keyboard)"

    stdbuf -oL libinput debug-events 2>/dev/null | while read -r line; do
        if [[ "$line" =~ (TOUCH|POINTER|KEYBOARD|BUTTON) ]]; then
            wake_display
        fi
    done

    # libinput exited or the pipe broke. `set -e` would NOT catch this because
    # `while` is in a subshell of a pipeline. Return non-zero so systemd's
    # Restart=on-failure actually restarts us instead of silently going dormant.
    log "ERROR: libinput debug-events stream ended unexpectedly"
    return 1
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

log "Input wake monitor started (debounce=${DEBOUNCE_SEC}s)"
monitor_input
