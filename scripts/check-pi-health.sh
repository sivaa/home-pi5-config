#!/bin/bash
#
# Pi Dashboard Health Check Script
# =================================
# Verifies Pi kiosk is running efficiently after CSS/dashboard changes
#
# Usage:
#   ./scripts/check-pi-health.sh           # Quick check
#   ./scripts/check-pi-health.sh --wait    # Wait 60s for metrics to stabilize
#
# Thresholds:
#   - CPU Temp: < 55C (warning at 55C, critical at 60C)
#   - Fan State: 0-1 (warning at 2)
#   - System Load: < 2.0 (warning at 3.0, critical at 4.0)
#   - Browser CPU: < 50% (warning at 100%, critical at 150%)
#   - Display: 60Hz (critical if > 60Hz)

set -e

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# Thresholds
TEMP_WARN=55000    # millidegrees C
TEMP_CRIT=60000
FAN_WARN=2
LOAD_WARN=3.0
LOAD_CRIT=4.0
BROWSER_WARN=100
BROWSER_CRIT=150

# Track status
OVERALL_STATUS="ok"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Pi Dashboard Health Check${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if we should wait
if [ "$1" = "--wait" ]; then
    echo -e "Waiting 60 seconds for metrics to stabilize..."
    sleep 60
    echo ""
fi

# Function to run SSH command
run_ssh() {
    ssh -o ConnectTimeout=5 pi@pi "$1" 2>/dev/null
}

# Test SSH connection
echo -e "${CYAN}Testing connection to Pi...${NC}"
if ! run_ssh "echo ok" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Cannot connect to pi@pi via SSH${NC}"
    exit 1
fi
echo -e "${GREEN}Connected!${NC}"
echo ""

# Get all metrics in one SSH call
echo -e "${CYAN}--- Collecting Metrics ---${NC}"
echo ""

METRICS=$(run_ssh '
    echo "TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)"
    echo "FAN=$(cat /sys/class/thermal/cooling_device0/cur_state 2>/dev/null || echo 0)"
    echo "LOAD=$(uptime | awk -F"load average:" "{print \$2}" | cut -d, -f1 | tr -d " ")"

    # Get browser CPU (sum of all WebKit processes)
    BROWSER_CPU=$(ps aux | grep -E "epiphany|WebKit" | grep -v grep | awk "{sum += \$3} END {print sum+0}")
    echo "BROWSER_CPU=$BROWSER_CPU"

    # Get display refresh rate (only the current mode, marked with "(current)")
    REFRESH=$(WAYLAND_DISPLAY=wayland-0 wlr-randr 2>/dev/null | grep "(current)" | grep -oP "\d+\.\d+ Hz" | cut -d. -f1 || echo "unknown")
    echo "REFRESH=$REFRESH"

    # Get uptime
    echo "UPTIME=$(uptime -p)"
')

# Parse metrics
TEMP=$(echo "$METRICS" | grep "^TEMP=" | cut -d= -f2)
FAN=$(echo "$METRICS" | grep "^FAN=" | cut -d= -f2)
LOAD=$(echo "$METRICS" | grep "^LOAD=" | cut -d= -f2)
BROWSER_CPU=$(echo "$METRICS" | grep "^BROWSER_CPU=" | cut -d= -f2)
REFRESH=$(echo "$METRICS" | grep "^REFRESH=" | cut -d= -f2)
UPTIME=$(echo "$METRICS" | grep "^UPTIME=" | cut -d= -f2-)

# Convert temp to Celsius
TEMP_C=$((TEMP / 1000))

# Display metrics with status
echo -e "${CYAN}--- Results ---${NC}"
echo ""

# Temperature
if [ "$TEMP" -ge "$TEMP_CRIT" ]; then
    echo -e "${RED}[CRITICAL]${NC} CPU Temperature: ${TEMP_C}C (>= 60C)"
    OVERALL_STATUS="critical"
elif [ "$TEMP" -ge "$TEMP_WARN" ]; then
    echo -e "${YELLOW}[WARNING]${NC} CPU Temperature: ${TEMP_C}C (>= 55C)"
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warning"
else
    echo -e "${GREEN}[OK]${NC} CPU Temperature: ${TEMP_C}C"
fi

# Fan
if [ "$FAN" -ge "$FAN_WARN" ]; then
    echo -e "${YELLOW}[WARNING]${NC} Fan State: $FAN (spinning fast)"
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warning"
else
    echo -e "${GREEN}[OK]${NC} Fan State: $FAN"
fi

# Load
LOAD_INT=$(echo "$LOAD" | cut -d. -f1)
if [ "$LOAD_INT" -ge 4 ]; then
    echo -e "${RED}[CRITICAL]${NC} System Load: $LOAD (>= 4.0)"
    OVERALL_STATUS="critical"
elif [ "$LOAD_INT" -ge 3 ]; then
    echo -e "${YELLOW}[WARNING]${NC} System Load: $LOAD (>= 3.0)"
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warning"
else
    echo -e "${GREEN}[OK]${NC} System Load: $LOAD"
fi

# Browser CPU
BROWSER_INT=$(echo "$BROWSER_CPU" | cut -d. -f1)
if [ "$BROWSER_INT" -ge "$BROWSER_CRIT" ]; then
    echo -e "${RED}[CRITICAL]${NC} Browser CPU: ${BROWSER_CPU}% (>= 150%)"
    OVERALL_STATUS="critical"
elif [ "$BROWSER_INT" -ge "$BROWSER_WARN" ]; then
    echo -e "${YELLOW}[WARNING]${NC} Browser CPU: ${BROWSER_CPU}% (>= 100%)"
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warning"
else
    echo -e "${GREEN}[OK]${NC} Browser CPU: ${BROWSER_CPU}%"
fi

# Display refresh
if [ "$REFRESH" = "unknown" ]; then
    echo -e "${YELLOW}[WARNING]${NC} Display Refresh: unknown (could not detect)"
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warning"
elif [ "$REFRESH" -gt 60 ]; then
    echo -e "${RED}[CRITICAL]${NC} Display Refresh: ${REFRESH}Hz (should be 60Hz)"
    OVERALL_STATUS="critical"
else
    echo -e "${GREEN}[OK]${NC} Display Refresh: ${REFRESH}Hz"
fi

echo ""
echo -e "Pi uptime: $UPTIME"
echo ""

# Summary
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Summary${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

case "$OVERALL_STATUS" in
    "ok")
        echo -e "${GREEN}All checks passed! Pi is running efficiently.${NC}"
        echo ""
        echo "Safe to deploy dashboard changes."
        exit 0
        ;;
    "warning")
        echo -e "${YELLOW}Some warnings detected.${NC}"
        echo ""
        echo "Review warnings above. Deploy with caution."
        exit 2
        ;;
    "critical")
        echo -e "${RED}Critical issues detected!${NC}"
        echo ""
        echo "DO NOT deploy. Investigate and fix issues first."
        echo "Check: services/dashboard/CLAUDE.md -> CSS Performance Guidelines"
        exit 1
        ;;
esac
