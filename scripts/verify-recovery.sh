#!/bin/bash
# =============================================================================
# Recovery Verification Script
# =============================================================================
# Checks all services and endpoints after disaster recovery
#
# ⚠️  MANUAL EXECUTION ONLY - NEVER AUTOMATED ⚠️
#     This script MUST be run by a human operator.
#     Never schedule via cron, timers, or any automation.
#     This is an UNCOMPROMISABLE requirement.
#
# Usage:
#   ./scripts/verify-recovery.sh
#   OR
#   ssh pi@pi "/opt/scripts/verify-recovery.sh"
#
# Exit codes:
#   0 = All checks passed
#   1 = One or more checks failed
# =============================================================================

set -uo pipefail

# =============================================================================
# MANUAL EXECUTION CHECK - This script must NEVER run unattended
# =============================================================================
if [[ ! -t 0 ]]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  ERROR: This script requires interactive execution"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "  This script MUST be run manually by a human operator."
    echo "  Automated/scheduled execution is PROHIBITED."
    echo ""
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
PASSED=0
FAILED=0
WARNED=0

# Check functions
check_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNED++))
}

check_skip() {
    echo -e "${BLUE}[SKIP]${NC} $1"
}

# Banner
echo "
╔═══════════════════════════════════════════════════════════════╗
║           PI-SETUP RECOVERY VERIFICATION                       ║
╚═══════════════════════════════════════════════════════════════╝
"

# =============================================================================
# DOCKER CONTAINERS
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  DOCKER CONTAINERS"
echo "═══════════════════════════════════════════════════════════════"

EXPECTED_CONTAINERS=(
    "mosquitto"
    "zigbee2mqtt"
    "homeassistant"
    "influxdb"
    "mqtt-influx-bridge"
    "dashboard"
    "cast-ip-monitor"
    "heater-watchdog"
)

for container in "${EXPECTED_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        STATUS=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null)
        if [[ "$STATUS" == "running" ]]; then
            check_pass "$container is running"
        else
            check_fail "$container status: $STATUS"
        fi
    else
        check_fail "$container container not found"
    fi
done

# =============================================================================
# SERVICE ENDPOINTS
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SERVICE ENDPOINTS"
echo "═══════════════════════════════════════════════════════════════"

# Dashboard
if curl -s --connect-timeout 3 http://localhost:8888 | head -c 100 | grep -q "<!DOCTYPE html"; then
    check_pass "Dashboard (port 8888) responding"
else
    check_fail "Dashboard (port 8888) not responding"
fi

# Home Assistant
if curl -s --connect-timeout 3 http://localhost:8123/api/ | grep -q "API running"; then
    check_pass "Home Assistant API (port 8123) responding"
else
    check_fail "Home Assistant API (port 8123) not responding"
fi

# Zigbee2MQTT
if curl -s --connect-timeout 3 http://localhost:8080 | head -c 100 | grep -qiE "(zigbee2mqtt|html)"; then
    check_pass "Zigbee2MQTT (port 8080) responding"
else
    check_fail "Zigbee2MQTT (port 8080) not responding"
fi

# InfluxDB
INFLUX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 http://localhost:8086/ping)
if [[ "$INFLUX_STATUS" == "204" ]]; then
    check_pass "InfluxDB (port 8086) responding"
else
    check_fail "InfluxDB (port 8086) not responding (status: $INFLUX_STATUS)"
fi

# MQTT Broker
if timeout 3 mosquitto_sub -h localhost -t '#' -C 1 -W 2 &>/dev/null; then
    check_pass "MQTT Broker (port 1883) accepting connections"
else
    # Try without auth
    if timeout 3 bash -c 'echo "" | nc -z localhost 1883' &>/dev/null; then
        check_warn "MQTT Broker port open but subscription failed (auth?)"
    else
        check_fail "MQTT Broker (port 1883) not responding"
    fi
fi

# =============================================================================
# ZIGBEE COORDINATOR
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ZIGBEE COORDINATOR"
echo "═══════════════════════════════════════════════════════════════"

# Check USB device
if ls /dev/serial/by-id/*Sonoff*Zigbee* &>/dev/null; then
    check_pass "Zigbee USB dongle detected"
else
    check_fail "Zigbee USB dongle not found"
fi

# Check Z2M coordinator status
Z2M_BRIDGE=$(curl -s --connect-timeout 3 http://localhost:8080/api/bridge 2>/dev/null)
if echo "$Z2M_BRIDGE" | grep -q '"state":"online"'; then
    check_pass "Zigbee2MQTT coordinator online"

    # Count devices
    DEVICE_COUNT=$(curl -s http://localhost:8080/api/devices 2>/dev/null | grep -o '"friendly_name"' | wc -l)
    if [[ "$DEVICE_COUNT" -gt 1 ]]; then
        check_pass "Zigbee devices paired: $DEVICE_COUNT"
    else
        check_warn "Only $DEVICE_COUNT device(s) - may need re-pairing"
    fi
else
    check_fail "Zigbee2MQTT coordinator not online"
fi

# =============================================================================
# SYSTEMD SERVICES
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SYSTEMD SERVICES"
echo "═══════════════════════════════════════════════════════════════"

# System services
if systemctl is-active --quiet wifi-watchdog.timer 2>/dev/null; then
    check_pass "wifi-watchdog.timer active"
else
    check_warn "wifi-watchdog.timer not active"
fi

# User services (only check if user session exists)
if systemctl --user is-active --quiet display-on.timer 2>/dev/null; then
    check_pass "display-on.timer active"
else
    check_warn "display-on.timer not active (may need user session)"
fi

if systemctl --user is-active --quiet kiosk-browser 2>/dev/null; then
    check_pass "kiosk-browser active"
else
    check_warn "kiosk-browser not active (may need user session)"
fi

# =============================================================================
# STORAGE
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  STORAGE"
echo "═══════════════════════════════════════════════════════════════"

# Check NVMe
if df -h / | grep -q nvme; then
    USAGE=$(df -h / | tail -1 | awk '{print $5}')
    check_pass "Root filesystem on NVMe ($USAGE used)"
else
    check_warn "Root filesystem not on NVMe"
fi

# Check SD storage
if mountpoint -q /mnt/storage 2>/dev/null; then
    USAGE=$(df -h /mnt/storage | tail -1 | awk '{print $5}')
    check_pass "/mnt/storage mounted ($USAGE used)"
else
    check_warn "/mnt/storage not mounted"
fi

# Check backup directory
if [[ -d /mnt/storage/backups/zigbee2mqtt ]]; then
    BACKUP_COUNT=$(ls /mnt/storage/backups/zigbee2mqtt/*.db* 2>/dev/null | wc -l)
    if [[ "$BACKUP_COUNT" -gt 0 ]]; then
        check_pass "Z2M backups found: $BACKUP_COUNT files"
    else
        check_warn "No Z2M backups found"
    fi
else
    check_warn "Z2M backup directory doesn't exist"
fi

# =============================================================================
# CONFIGURATION FILES
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  CONFIGURATION FILES"
echo "═══════════════════════════════════════════════════════════════"

CONFIG_FILES=(
    "/opt/zigbee2mqtt/data/configuration.yaml"
    "/opt/homeassistant/configuration.yaml"
    "/opt/mosquitto/config/mosquitto.conf"
    "/opt/dashboard/www/index.html"
)

for file in "${CONFIG_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        check_pass "$file exists"
    else
        check_fail "$file missing"
    fi
done

# Check .env file
if [[ -f ~/pi-setup/configs/zigbee2mqtt/.env ]]; then
    if grep -q "your_.*_here" ~/pi-setup/configs/zigbee2mqtt/.env 2>/dev/null; then
        check_warn ".env has placeholder values - update secrets!"
    else
        check_pass ".env configured"
    fi
else
    check_fail ".env file missing"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  SUMMARY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}PASSED:${NC}  $PASSED"
echo -e "  ${YELLOW}WARNED:${NC}  $WARNED"
echo -e "  ${RED}FAILED:${NC}  $FAILED"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    echo ""
    if [[ $WARNED -gt 0 ]]; then
        echo "Review warnings above for optional fixes."
    fi
    exit 0
else
    echo -e "${RED}Some checks failed - review output above${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Docker not running: docker compose up -d"
    echo "  - Missing configs: Re-run disaster-recovery.sh"
    echo "  - USB dongle: Check physical connection"
    echo "  - Secrets: Edit ~/pi-setup/configs/zigbee2mqtt/.env"
    exit 1
fi
