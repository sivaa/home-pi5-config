#!/bin/bash
#
# CSS Performance Linter for Pi Dashboard
# ========================================
# Scans CSS files for expensive properties that cause high CPU on Raspberry Pi
#
# Usage:
#   ./scripts/lint-css-performance.sh              # Scan all dashboard CSS
#   ./scripts/lint-css-performance.sh path/to.css  # Scan specific file
#
# Exit codes:
#   0 = All checks passed
#   1 = Errors found (banned properties)
#   2 = Warnings found (use with caution)

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
ERRORS=0
WARNINGS=0

# Get directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default CSS path
CSS_PATH="${1:-$PROJECT_ROOT/services/dashboard/www/styles}"

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  CSS Performance Linter for Pi Kiosk${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "Scanning: ${CSS_PATH}"
echo ""

# Check if path exists
if [ ! -e "$CSS_PATH" ]; then
    echo -e "${RED}Error: Path does not exist: $CSS_PATH${NC}"
    exit 1
fi

# Function to scan for a pattern
scan_pattern() {
    local pattern="$1"
    local description="$2"
    local severity="$3"  # error or warning
    local suggestion="$4"

    local results
    if [ -d "$CSS_PATH" ]; then
        results=$(grep -rn "$pattern" "$CSS_PATH" --include="*.css" 2>/dev/null || true)
    else
        results=$(grep -n "$pattern" "$CSS_PATH" 2>/dev/null || true)
    fi

    if [ -n "$results" ]; then
        if [ "$severity" = "error" ]; then
            echo -e "${RED}[ERROR]${NC} $description"
            ((ERRORS++)) || true
        else
            echo -e "${YELLOW}[WARN]${NC} $description"
            ((WARNINGS++)) || true
        fi
        echo -e "        Suggestion: $suggestion"
        echo "$results" | head -5 | while read -r line; do
            echo -e "        ${CYAN}$line${NC}"
        done
        local count=$(echo "$results" | wc -l | tr -d ' ')
        if [ "$count" -gt 5 ]; then
            echo -e "        ... and $((count - 5)) more"
        fi
        echo ""
    fi
}

# Function to count multi-layer box-shadows
check_multi_shadow() {
    local results
    if [ -d "$CSS_PATH" ]; then
        results=$(grep -rn "box-shadow:" "$CSS_PATH" --include="*.css" 2>/dev/null || true)
    else
        results=$(grep -n "box-shadow:" "$CSS_PATH" 2>/dev/null || true)
    fi

    if [ -n "$results" ]; then
        # Check each box-shadow for multiple layers (commas indicate multiple shadows)
        echo "$results" | while read -r line; do
            # Count commas that indicate multiple shadow layers (not inside rgba)
            # This is a simplified check - counts commas outside of parentheses
            local file_line=$(echo "$line" | cut -d: -f1-2)
            local shadow_value=$(echo "$line" | cut -d: -f3-)

            # Simple heuristic: if there are 2+ shadows, there will be ")" followed by ","
            local shadow_count=$(echo "$shadow_value" | grep -o ")," | wc -l | tr -d ' ')

            if [ "$shadow_count" -ge 2 ]; then
                echo -e "${RED}[ERROR]${NC} Multi-layer box-shadow (${shadow_count}+ layers) causes high CPU"
                echo -e "        Suggestion: Use single shadow with max 10px blur"
                echo -e "        ${CYAN}$file_line${NC}"
                echo ""
                ((ERRORS++)) || true
            fi
        done
    fi
}

echo -e "${CYAN}--- Checking for banned properties ---${NC}"
echo ""

# ERRORS - These should never be used
scan_pattern "backdrop-filter:" \
    "backdrop-filter found (extremely CPU intensive)" \
    "error" \
    "Use solid background: rgba(0,0,0,0.8) instead of blur"

scan_pattern "filter:.*blur" \
    "filter: blur() found (CPU intensive)" \
    "error" \
    "Use pre-blurred images or solid colors"

# WARNINGS - Use with caution
scan_pattern "filter:.*grayscale" \
    "filter: grayscale() found (CPU intensive)" \
    "warning" \
    "Use opacity: 0.5 for disabled states"

scan_pattern "animation:.*infinite" \
    "Infinite animation found (constant CPU work)" \
    "warning" \
    "Use finite animations or CSS transitions"

scan_pattern "@keyframes.*{" \
    "Keyframe animation defined" \
    "warning" \
    "Ensure animation is not infinite and uses transform/opacity only"

scan_pattern "will-change:" \
    "will-change property found" \
    "warning" \
    "Use sparingly - can increase memory usage"

echo -e "${CYAN}--- Checking box-shadow complexity ---${NC}"
echo ""
check_multi_shadow

# Summary
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Summary${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}All checks passed! No performance issues found.${NC}"
    exit 0
elif [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo -e "Fix errors before deploying to Pi kiosk."
    echo -e "See: services/dashboard/CLAUDE.md -> CSS Performance Guidelines"
    exit 1
else
    echo -e "${YELLOW}Found $WARNINGS warning(s)${NC}"
    echo ""
    echo -e "Review warnings to ensure they're justified."
    echo -e "See: services/dashboard/CLAUDE.md -> CSS Performance Guidelines"
    exit 2
fi
