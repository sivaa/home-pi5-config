#!/bin/bash
# =============================================================================
# Disaster Recovery Script
# =============================================================================
# Automates Pi setup after fresh OS install
#
# ⚠️  MANUAL EXECUTION ONLY - NEVER AUTOMATED ⚠️
#     This script MUST be run by a human operator.
#     Never schedule via cron, timers, or any automation.
#     This is an UNCOMPROMISABLE requirement.
#
# Usage:
#   ssh pi@pi 'bash -s' < scripts/disaster-recovery.sh
#   OR
#   ssh pi@pi
#   curl -fsSL https://raw.githubusercontent.com/[user]/pi-setup/main/scripts/disaster-recovery.sh | bash
#
# Prerequisites:
#   - Fresh Raspberry Pi OS Lite (64-bit) installed
#   - SSH access working
#   - WiFi connected
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

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
    echo "  Run with: ssh -t pi@pi 'bash -s' < scripts/disaster-recovery.sh"
    echo ""
    exit 1
fi

# Banner
echo "
╔═══════════════════════════════════════════════════════════════╗
║           PI-SETUP DISASTER RECOVERY SCRIPT                    ║
║                                                                ║
║  ⚠️  MANUAL EXECUTION ONLY - NEVER AUTOMATED                   ║
║                                                                ║
║  This script automates post-OS-install setup                   ║
║  See: docs/00-DISASTER-RECOVERY.md for full guide              ║
╚═══════════════════════════════════════════════════════════════╝
"

# Require explicit confirmation
echo -e "${YELLOW}This script will modify system configuration.${NC}"
read -p "Are you a human operator running this manually? [yes/NO] " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    log_error "Aborted. This script requires manual confirmation."
    exit 1
fi
echo ""

# Check if running on Pi
if [[ ! -f /etc/rpi-issue ]]; then
    log_warn "This doesn't appear to be a Raspberry Pi OS system"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# =============================================================================
# PHASE 1: SYSTEM SETUP
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 1: SYSTEM SETUP"
echo "═══════════════════════════════════════════════════════════════"

# Set timezone
log_info "Setting timezone to Europe/Berlin..."
sudo timedatectl set-timezone Europe/Berlin
log_success "Timezone set"

# Update system
log_info "Updating system packages (this may take a few minutes)..."
sudo apt update
sudo apt upgrade -y
log_success "System updated"

# Install Docker
if command -v docker &> /dev/null; then
    log_success "Docker already installed"
else
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    log_success "Docker installed"
    log_warn "You may need to log out and back in for docker group to take effect"
fi

# Install additional packages
log_info "Installing additional packages..."
sudo apt install -y git python3-pip vim htop curl mosquitto-clients
log_success "Packages installed"

# =============================================================================
# PHASE 2: CREATE DIRECTORIES
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 2: CREATE DIRECTORIES"
echo "═══════════════════════════════════════════════════════════════"

log_info "Creating directory structure..."

# Service directories
sudo mkdir -p /opt/zigbee2mqtt/data
sudo mkdir -p /opt/homeassistant
sudo mkdir -p /opt/mosquitto/{config,data,log}
sudo mkdir -p /opt/influxdb/data
sudo mkdir -p /opt/dashboard/{www,nginx}
sudo mkdir -p /opt/scripts

# Set ownership
sudo chown -R $USER:$USER /opt/zigbee2mqtt /opt/homeassistant /opt/dashboard /opt/scripts
sudo chown -R 1883:1883 /opt/mosquitto

log_success "Directories created"

# Mount SD card storage (if available)
if [[ -b /dev/mmcblk0p1 ]]; then
    log_info "Setting up SD card storage..."
    sudo mkdir -p /mnt/storage

    # Check if already in fstab
    if ! grep -q "LABEL=storage" /etc/fstab; then
        echo 'LABEL=storage  /mnt/storage  ext4  defaults,noatime  0  2' | sudo tee -a /etc/fstab
    fi

    sudo mount -a 2>/dev/null || log_warn "SD card mount failed - check if formatted"
    sudo mkdir -p /mnt/storage/backups/zigbee2mqtt
    sudo chown -R $USER:$USER /mnt/storage/backups
    log_success "SD card storage configured"
else
    log_warn "SD card not detected (/dev/mmcblk0p1 not found)"
fi

# =============================================================================
# PHASE 3: CLONE REPOSITORY
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 3: CLONE REPOSITORY"
echo "═══════════════════════════════════════════════════════════════"

if [[ -d ~/pi-setup ]]; then
    log_info "Repository exists, pulling latest..."
    git -C ~/pi-setup pull
else
    log_info "Cloning repository..."
    # Try SSH first, fallback to HTTPS
    if git clone git@github.com:sivaa/pi-setup.git ~/pi-setup 2>/dev/null; then
        log_success "Cloned via SSH"
    elif git clone https://github.com/sivaa/pi-setup.git ~/pi-setup 2>/dev/null; then
        log_success "Cloned via HTTPS"
    else
        log_error "Failed to clone repository"
        log_info "Clone manually: git clone <your-repo-url> ~/pi-setup"
        exit 1
    fi
fi

log_success "Repository ready"

# =============================================================================
# PHASE 4: CHECK SECRETS
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 4: CHECK SECRETS"
echo "═══════════════════════════════════════════════════════════════"

ENV_FILE=~/pi-setup/configs/zigbee2mqtt/.env

if [[ -f "$ENV_FILE" ]]; then
    log_success ".env file exists"

    # Check for placeholder values
    if grep -q "your_.*_here" "$ENV_FILE"; then
        log_warn "Found placeholder values in .env - update before deploying!"
        echo ""
        echo "  Edit: $ENV_FILE"
        echo "  See: docs/secrets-recovery.md for instructions"
        echo ""
    fi
else
    log_warn ".env file not found"
    log_info "Creating from example..."
    cp ~/pi-setup/configs/zigbee2mqtt/.env.example "$ENV_FILE"
    log_warn "Edit $ENV_FILE with your secrets before continuing"
    echo ""
    echo "  Required secrets:"
    echo "    - MQTT_USER / MQTT_PASSWORD"
    echo "    - HA_TOKEN (generate after Home Assistant starts)"
    echo ""
    echo "  See: docs/secrets-recovery.md for instructions"
    echo ""
fi

# =============================================================================
# PHASE 5: COPY CONFIGURATIONS
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 5: COPY CONFIGURATIONS"
echo "═══════════════════════════════════════════════════════════════"

log_info "Copying configuration files..."

# Zigbee2MQTT config
cp ~/pi-setup/configs/zigbee2mqtt/configuration.yaml /opt/zigbee2mqtt/data/ 2>/dev/null || log_warn "Z2M config not found"

# Docker compose file (required for systemd zigbee2mqtt.service)
cp ~/pi-setup/configs/zigbee2mqtt/docker-compose.yml /opt/zigbee2mqtt/ 2>/dev/null || log_warn "docker-compose.yml not found"

# Mosquitto config
cp ~/pi-setup/configs/zigbee2mqtt/mosquitto.conf /opt/mosquitto/config/ 2>/dev/null || log_warn "Mosquitto config not found"

# Home Assistant config
cp ~/pi-setup/configs/homeassistant/configuration.yaml /opt/homeassistant/ 2>/dev/null || log_warn "HA config not found"
cp ~/pi-setup/configs/homeassistant/automations.yaml /opt/homeassistant/ 2>/dev/null || true
cp ~/pi-setup/configs/homeassistant/scripts.yaml /opt/homeassistant/ 2>/dev/null || true

# Dashboard files
if [[ -d ~/pi-setup/services/dashboard/www ]]; then
    cp -r ~/pi-setup/services/dashboard/www/* /opt/dashboard/www/
    log_success "Dashboard files copied"
fi

# Nginx config
cp ~/pi-setup/services/dashboard/nginx/dashboard.conf /opt/dashboard/nginx/ 2>/dev/null || log_warn "Nginx config not found"

# Scripts
cp ~/pi-setup/scripts/*.sh /opt/scripts/ 2>/dev/null || true
chmod +x /opt/scripts/*.sh 2>/dev/null || true

log_success "Configurations copied"

# =============================================================================
# PHASE 6: DOCKER SERVICES (OPTIONAL)
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 6: DOCKER SERVICES"
echo "═══════════════════════════════════════════════════════════════"

read -p "Start Docker services now? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    log_info "Skipping Docker services"
    log_info "To start later: cd ~/pi-setup/configs/zigbee2mqtt && docker compose up -d"
else
    log_info "Starting Docker services..."
    cd ~/pi-setup/configs/zigbee2mqtt

    # Check if .env has real values
    if grep -q "your_.*_here" .env 2>/dev/null; then
        log_error ".env still has placeholder values!"
        log_info "Edit .env first, then run: docker compose up -d"
    else
        docker compose up -d
        log_success "Docker services started"

        # Wait and check
        sleep 5
        echo ""
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    fi
fi

# =============================================================================
# PHASE 7: SYSTEMD SERVICES (OPTIONAL)
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  PHASE 7: SYSTEMD SERVICES"
echo "═══════════════════════════════════════════════════════════════"

read -p "Deploy systemd services? [Y/n] " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    log_info "Skipping systemd services"
else
    log_info "Deploying systemd services..."

    # Create user systemd directory
    mkdir -p ~/.config/systemd/user ~/.local/bin

    # Display scheduler (user services)
    if [[ -d ~/pi-setup/configs/display-scheduler ]]; then
        cp ~/pi-setup/configs/display-scheduler/*.service ~/.config/systemd/user/ 2>/dev/null || true
        cp ~/pi-setup/configs/display-scheduler/*.timer ~/.config/systemd/user/ 2>/dev/null || true
        cp ~/pi-setup/configs/display-scheduler/*.sh ~/.local/bin/ 2>/dev/null || true
        chmod +x ~/.local/bin/*.sh 2>/dev/null || true
        log_success "Display scheduler copied"
    fi

    # Kiosk browser (user service)
    if [[ -f ~/pi-setup/configs/kiosk-browser/kiosk-browser.service ]]; then
        cp ~/pi-setup/configs/kiosk-browser/kiosk-browser.service ~/.config/systemd/user/
        log_success "Kiosk browser copied"
    fi

    # System services
    if [[ -f ~/pi-setup/configs/systemd/zigbee2mqtt.service ]]; then
        sudo cp ~/pi-setup/configs/systemd/zigbee2mqtt.service /etc/systemd/system/
        log_success "Zigbee2MQTT service copied"
    fi

    if [[ -d ~/pi-setup/configs/wifi-watchdog ]]; then
        sudo cp ~/pi-setup/configs/wifi-watchdog/wifi-watchdog.service /etc/systemd/system/
        sudo cp ~/pi-setup/configs/wifi-watchdog/wifi-watchdog.timer /etc/systemd/system/
        sudo cp ~/pi-setup/configs/wifi-watchdog/wifi-watchdog.sh /usr/local/bin/
        sudo chmod +x /usr/local/bin/wifi-watchdog.sh
        log_success "WiFi watchdog copied"
    fi

    # Reload and enable
    systemctl --user daemon-reload 2>/dev/null || true
    sudo systemctl daemon-reload

    # Enable services (don't fail if they don't exist)
    systemctl --user enable display-on.timer display-off.timer kiosk-browser 2>/dev/null || true
    sudo systemctl enable zigbee2mqtt wifi-watchdog.timer 2>/dev/null || true

    log_success "Systemd services deployed"
fi

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  RECOVERY COMPLETE - NEXT STEPS"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  1. Update secrets in: ~/pi-setup/configs/zigbee2mqtt/.env"
echo "     See: docs/secrets-recovery.md"
echo ""
echo "  2. Start Docker (if skipped):"
echo "     cd ~/pi-setup/configs/zigbee2mqtt && docker compose up -d"
echo ""
echo "  3. Re-pair Zigbee devices (if network lost):"
echo "     See: docs/05-zigbee-devices.md"
echo ""
echo "  4. Verify recovery:"
echo "     /opt/scripts/verify-recovery.sh"
echo ""
echo "  Dashboard:        http://pi:8888"
echo "  Home Assistant:   http://pi:8123"
echo "  Zigbee2MQTT:      http://pi:8080"
echo ""
log_success "Script complete!"
