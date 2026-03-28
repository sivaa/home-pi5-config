#!/bin/bash
# Deploy where-is-siva (tracker + fake-garmin) to the Pi
# Run from pi-setup root: ./services/where-is-siva/deploy.sh
set -e

DEST=/opt/where-is-siva
SERVICE=where-is-siva

echo "=== Deploying Where Is Siva ==="

# Copy files (exclude __pycache__ bytecode from dev machine)
sudo mkdir -p $DEST/data
sudo rsync -a --exclude='__pycache__' services/$SERVICE/backend/ $DEST/backend/
sudo rsync -a --exclude='data.json' services/$SERVICE/static/ $DEST/static/
sudo cp services/$SERVICE/requirements.txt $DEST/
sudo cp services/$SERVICE/fake-garmin.py $DEST/

# Create .env from template if missing
if [ ! -f "$DEST/.env" ]; then
    echo "WARNING: No .env file found. Copy configs/where-is-siva/.env.example to $DEST/.env and fill in values."
fi

# Create venv and install deps (first time only)
if [ ! -d "$DEST/.venv" ]; then
    echo "Creating venv..."
    sudo python3 -m venv $DEST/.venv
fi
sudo $DEST/.venv/bin/pip install -r $DEST/requirements.txt --quiet

# Set ownership
sudo chown -R pi:pi $DEST

# Install systemd services
sudo cp configs/systemd/$SERVICE.service /etc/systemd/system/
sudo cp configs/systemd/fake-garmin.service /etc/systemd/system/
sudo systemctl daemon-reload

# Flush filesystem before restart
sync

# Enable and start tracker (always on)
sudo systemctl enable $SERVICE
sudo systemctl restart $SERVICE

# Install fake-garmin but don't enable on boot (start manually for testing)
# To use: sudo systemctl start fake-garmin
# For real Garmin feed: edit where-is-siva.service GARMIN_FEED_URL
echo ""
echo "=== fake-garmin installed (not auto-started) ==="
echo "  Test mode:  sudo systemctl start fake-garmin"
echo "  Production: Edit GARMIN_FEED_URL in /etc/systemd/system/where-is-siva.service"

echo ""
echo "=== Deployed. Status: ==="
sudo systemctl status $SERVICE --no-pager -l
echo ""
echo "Tracker API: http://$(hostname -I | awk '{print $1}'):8000"
echo "Dashboard view: navigate to Sailing in the kiosk dashboard"
