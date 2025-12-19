#!/bin/bash
# =============================================================================
# Display Scheduler Control Script
# =============================================================================
# Controls display power and night-mode idle timeout for Raspberry Pi 5
# running labwc (Wayland compositor).
#
# Usage:
#   display-scheduler.sh on              # Turn display on, set 50% brightness
#   display-scheduler.sh off             # Turn display off, start idle monitoring
#   display-scheduler.sh status          # Show current state
#   display-scheduler.sh brightness [N]  # Get or set brightness (0-100)
#
# Prerequisites:
#   - wlopm (Wayland output power management)
#   - swayidle (idle detection daemon)
#   - ddcutil (DDC/CI monitor control)
#   - labwc or compatible Wayland compositor
#
# Schedule:
#   06:00 - Day mode (display ON, no idle timeout)
#   22:00 - Night mode (display OFF, 5-min idle timeout if woken)
# =============================================================================

set -euo pipefail

# Configuration
IDLE_TIMEOUT_SEC=300  # 5 minutes
DAY_BRIGHTNESS=50     # Day mode brightness (0-100)
LOG_TAG="display-scheduler"

# Detect display output (typically HDMI-A-1 for Pi 5)
get_output() {
    wlopm 2>/dev/null | head -1 | cut -d' ' -f1
}

# Set monitor brightness via DDC/CI (VCP code 0x10)
set_brightness() {
    local level="$1"
    if command -v ddcutil &>/dev/null; then
        if sudo ddcutil setvcp 10 "$level" 2>/dev/null; then
            log "INFO" "Brightness set to ${level}%"
        else
            log "WARN" "Failed to set brightness (DDC/CI may not be supported)"
        fi
    else
        log "WARN" "ddcutil not installed, skipping brightness control"
    fi
}

# Get current brightness level
get_brightness() {
    if command -v ddcutil &>/dev/null; then
        sudo ddcutil getvcp 10 2>/dev/null | grep -oP 'current value =\s*\K\d+' || echo "unknown"
    else
        echo "N/A"
    fi
}

# Logging function (writes to both syslog and stdout)
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

    logger -t "$LOG_TAG" "[$level] $message"
    echo "$timestamp [$level] $message"
}

# Turn display ON and disable night-mode idle
cmd_on() {
    local output
    output="$(get_output)"

    if [ -z "$output" ]; then
        log "ERROR" "No display output detected (is Wayland running?)"
        exit 1
    fi

    log "INFO" "DAY MODE: Turning display ON ($output)"
    wlopm --on "$output"

    # Stop night-mode services if running
    if systemctl --user is-active --quiet swayidle-night.service 2>/dev/null; then
        log "INFO" "Stopping night-mode idle monitoring"
        systemctl --user stop swayidle-night.service
    fi
    if systemctl --user is-active --quiet input-wake-monitor.service 2>/dev/null; then
        log "INFO" "Stopping input wake monitor"
        systemctl --user stop input-wake-monitor.service
    fi

    # Set daytime brightness
    set_brightness "$DAY_BRIGHTNESS"

    log "INFO" "Display is now ON at ${DAY_BRIGHTNESS}% brightness (no idle timeout)"
}

# Turn display OFF and enable night-mode idle
cmd_off() {
    local output
    output="$(get_output)"

    if [ -z "$output" ]; then
        log "ERROR" "No display output detected (is Wayland running?)"
        exit 1
    fi

    log "INFO" "NIGHT MODE: Turning display OFF ($output)"
    wlopm --off "$output"

    # Start night-mode services
    log "INFO" "Starting night-mode idle monitoring (${IDLE_TIMEOUT_SEC}s timeout)"
    systemctl --user start swayidle-night.service || log "WARN" "Failed to start swayidle-night.service"

    log "INFO" "Starting input wake monitor"
    systemctl --user start input-wake-monitor.service || log "WARN" "Failed to start input-wake-monitor.service"

    log "INFO" "Display is now OFF (wake-on-input enabled, 5-min idle timeout)"
}

# Boot-time check: determine correct mode based on current hour
cmd_boot_check() {
    local hour
    hour="$(date +%H)"

    log "INFO" "BOOT CHECK: Current hour is $hour"

    # Night mode: 22:00 (22) to 05:59 (05)
    # Day mode: 06:00 (06) to 21:59 (21)
    if [ "$hour" -ge 22 ] || [ "$hour" -lt 6 ]; then
        log "INFO" "BOOT CHECK: In night hours (22:00-06:00) → activating night mode"
        cmd_off
    else
        log "INFO" "BOOT CHECK: In day hours (06:00-22:00) → ensuring day mode"
        cmd_on
    fi
}

# Show current status
cmd_status() {
    local output
    output="$(get_output)"

    echo "=== Display Scheduler Status ==="
    echo ""
    echo "Display output: ${output:-NOT DETECTED}"

    if [ -n "$output" ]; then
        echo "Power state:    $(wlopm 2>/dev/null || echo 'unknown')"
        echo "Brightness:     $(get_brightness)%"
    fi

    echo ""
    echo "Night-mode services:"
    echo -n "  swayidle-night:      "
    if systemctl --user is-active --quiet swayidle-night.service 2>/dev/null; then
        echo "ACTIVE (5-min idle timeout)"
    else
        echo "INACTIVE"
    fi
    echo -n "  input-wake-monitor:  "
    if systemctl --user is-active --quiet input-wake-monitor.service 2>/dev/null; then
        echo "ACTIVE (touch wake enabled)"
    else
        echo "INACTIVE"
    fi

    echo ""
    echo "Scheduled timers:"
    systemctl --user list-timers 'display-*' --no-pager 2>/dev/null || echo "  (no timers found)"
}

# Main
case "${1:-status}" in
    on)
        cmd_on
        ;;
    off)
        cmd_off
        ;;
    status)
        cmd_status
        ;;
    boot-check)
        cmd_boot_check
        ;;
    brightness)
        if [ -z "${2:-}" ]; then
            echo "Current brightness: $(get_brightness)%"
        else
            set_brightness "$2"
        fi
        ;;
    *)
        echo "Usage: $0 {on|off|status|boot-check|brightness [0-100]}"
        echo ""
        echo "Commands:"
        echo "  on              Turn display on, set ${DAY_BRIGHTNESS}% brightness (day mode)"
        echo "  off             Turn display off, enable 5-min idle timeout (night mode)"
        echo "  status          Show current display and scheduler status"
        echo "  boot-check      Check current hour and activate appropriate mode"
        echo "  brightness [N]  Get or set brightness (0-100)"
        exit 1
        ;;
esac
