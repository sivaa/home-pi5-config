#!/bin/bash
# Start dashboard locally for development
# Connects to Pi services (MQTT, InfluxDB, Home Assistant, Zigbee2MQTT)

set -e

PORT=8888
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WWW_DIR="$SCRIPT_DIR/services/dashboard/www"

# Check if www directory exists
if [[ ! -d "$WWW_DIR" ]]; then
    echo "Error: Dashboard directory not found: $WWW_DIR"
    exit 1
fi

# Kill any existing process on the port
if lsof -ti:$PORT >/dev/null 2>&1; then
    echo "Killing existing process on port $PORT..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

cd "$WWW_DIR"

echo "Starting dashboard at http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

python3 -m http.server $PORT
