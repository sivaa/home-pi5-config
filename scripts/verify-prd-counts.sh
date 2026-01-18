#!/bin/bash
#
# verify-prd-counts.sh - Verify PRD metrics match actual config files
#
# Run this script to validate that docs/PRD.md counts are accurate.
# If any count fails, update PRD.md with the new number.
#
# Usage: ./scripts/verify-prd-counts.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected counts (from PRD.md)
EXPECTED_DEVICES=35
EXPECTED_AUTOMATIONS=57
EXPECTED_DOCKER=8  # Main docker-compose only (data-scraper is separate)
EXPECTED_SYSTEMD_SERVICES=14
EXPECTED_SYSTEMD_TIMERS=5
EXPECTED_CLASSIC_VIEWS=10
EXPECTED_REACT_VIEWS=10  # 9 active routes + PlaceholderPage (unused)

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  PRD Count Verification"
echo "  Project: $PROJECT_ROOT"
echo "========================================"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

check_count() {
    local name="$1"
    local actual="$2"
    local expected="$3"
    local source="$4"

    if [ "$actual" -eq "$expected" ]; then
        echo -e "${GREEN}PASS${NC} $name: $actual (expected $expected)"
        echo "      Source: $source"
        ((PASS_COUNT++))
    else
        echo -e "${RED}FAIL${NC} $name: $actual (expected $expected)"
        echo "      Source: $source"
        echo -e "      ${YELLOW}Update PRD.md with new count: $actual${NC}"
        ((FAIL_COUNT++))
    fi
    echo ""
}

# Count Zigbee devices
DEVICES=$(grep -c "friendly_name:" "$PROJECT_ROOT/configs/zigbee2mqtt/configuration.yaml" 2>/dev/null || echo 0)
check_count "Zigbee Devices" "$DEVICES" "$EXPECTED_DEVICES" "configs/zigbee2mqtt/configuration.yaml"

# Count automations
AUTOMATIONS=$(grep -c "alias:" "$PROJECT_ROOT/configs/homeassistant/automations.yaml" 2>/dev/null || echo 0)
check_count "Automations" "$AUTOMATIONS" "$EXPECTED_AUTOMATIONS" "configs/homeassistant/automations.yaml"

# Count Docker services (main compose only)
DOCKER=$(grep -c "container_name:" "$PROJECT_ROOT/configs/zigbee2mqtt/docker-compose.yml" 2>/dev/null || echo 0)
check_count "Docker Services (main)" "$DOCKER" "$EXPECTED_DOCKER" "configs/zigbee2mqtt/docker-compose.yml"

# Count systemd services
SYSTEMD_SERVICES=$(find "$PROJECT_ROOT/configs" -name "*.service" 2>/dev/null | wc -l | tr -d ' ')
check_count "Systemd Services" "$SYSTEMD_SERVICES" "$EXPECTED_SYSTEMD_SERVICES" "configs/**/*.service"

# Count systemd timers
SYSTEMD_TIMERS=$(find "$PROJECT_ROOT/configs" -name "*.timer" 2>/dev/null | wc -l | tr -d ' ')
check_count "Systemd Timers" "$SYSTEMD_TIMERS" "$EXPECTED_SYSTEMD_TIMERS" "configs/**/*.timer"

# Count Classic dashboard views
CLASSIC_VIEWS=$(ls "$PROJECT_ROOT/services/dashboard/www/views/"*.js 2>/dev/null | wc -l | tr -d ' ')
check_count "Classic Dashboard Views" "$CLASSIC_VIEWS" "$EXPECTED_CLASSIC_VIEWS" "services/dashboard/www/views/*.js"

# Count React dashboard views
REACT_VIEWS=$(ls "$PROJECT_ROOT/services/dashboard-react/src/routes/"*Page.tsx 2>/dev/null | wc -l | tr -d ' ')
check_count "React Dashboard Views" "$REACT_VIEWS" "$EXPECTED_REACT_VIEWS" "services/dashboard-react/src/routes/*Page.tsx"

# Summary
echo "========================================"
echo "  Summary"
echo "========================================"
echo -e "  ${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "  ${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}All PRD counts are accurate!${NC}"
    exit 0
else
    echo -e "${YELLOW}PRD.md needs updating with $FAIL_COUNT new counts${NC}"
    exit 1
fi
