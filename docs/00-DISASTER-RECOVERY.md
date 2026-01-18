# Disaster Recovery Playbook

> **Purpose:** Complete guide to restore Pi from bare hardware to fully working system
> **Recovery Time Objective:** ~4 hours (2-3 hours for Zigbee device re-pairing)
> **Last Updated:** January 11, 2026

---

```
╔═══════════════════════════════════════════════════════════════════════════╗
║  ⚠️  MANUAL EXECUTION ONLY - NEVER AUTOMATED                              ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  This playbook and all recovery scripts MUST be:                          ║
║                                                                           ║
║    ✓ Run MANUALLY by a human operator                                     ║
║    ✓ Never triggered by cron, timers, or automation                       ║
║    ✓ Never run unattended or scheduled                                    ║
║                                                                           ║
║  UNCOMPROMISABLE REQUIREMENT:                                             ║
║  Recovery operations require human judgment and oversight.                ║
║  Automated execution is PROHIBITED.                                       ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## Pre-Recovery Checklist

Before starting, ensure you have:

```
HARDWARE CHECKLIST
------------------
[ ] Raspberry Pi 5 Model B Rev 1.1 (8GB RAM)
[ ] NVMe drive (476.9GB+ recommended) with HAT
[ ] SD Card (119GB+) for /mnt/storage
[ ] Sonoff Zigbee 3.0 USB Dongle Plus V2
[ ] USB-C power supply (5V/5A)
[ ] HDMI cable + monitor (for initial setup)
[ ] USB keyboard (for initial setup)

SOFTWARE CHECKLIST
------------------
[ ] Raspberry Pi Imager installed on your computer
[ ] This git repository cloned locally
[ ] SSH public key available
[ ] Access to password manager for secrets
```

---

## Phase 0: OS Installation

**Time Estimate:** 30 minutes

### Step 1: Download Raspberry Pi Imager

Download from: https://www.raspberrypi.com/software/

### Step 2: Flash OS to NVMe

1. Connect NVMe to your computer (via USB enclosure or HAT)
2. Open Raspberry Pi Imager
3. Click **Choose Device** → **Raspberry Pi 5**
4. Click **Choose OS** → **Raspberry Pi OS (other)** → **Raspberry Pi OS Lite (64-bit)**
   - This is Debian 13 (Trixie)
5. Click **Choose Storage** → Select your NVMe drive
6. Click **Next**, then **Edit Settings**

### Step 3: Configure OS Settings

In the **OS Customisation** dialog:

**GENERAL tab:**
```
Hostname:           pi
Username:           pi
Password:           [your secure password]
Configure WiFi:     Yes
  SSID:             [your WiFi network name]
  Password:         [your WiFi password]
  Country:          DE
Locale:             Europe/Berlin
Keyboard:           us
```

**SERVICES tab:**
```
Enable SSH:         Yes
  Use public-key:   Yes
  Paste your SSH public key (from ~/.ssh/id_rsa.pub)
```

7. Click **Save** → **Yes** to apply customization → **Yes** to confirm write

### Step 4: First Boot

1. Install NVMe in Pi 5 HAT
2. Connect power, monitor, keyboard
3. Wait for boot (1-2 minutes)
4. Verify WiFi connected (check router DHCP)
5. From your computer:
   ```bash
   ssh pi@pi
   ```

**Troubleshooting:**
- If `pi` hostname doesn't resolve: `ssh pi@192.168.0.X` (check router for IP)
- If SSH fails: Check WiFi settings in Pi Imager were correct

---

## Phase 1: System Setup

**Time Estimate:** 15 minutes (mostly automated)

### Step 1: Set Timezone

```bash
ssh pi@pi "sudo timedatectl set-timezone Europe/Berlin"
```

### Step 2: Update System

```bash
ssh pi@pi "sudo apt update && sudo apt upgrade -y"
```

### Step 3: Install Docker

```bash
ssh pi@pi "curl -fsSL https://get.docker.com | sh"
ssh pi@pi "sudo usermod -aG docker pi"
```

**Important:** Log out and back in for docker group to take effect:
```bash
ssh pi@pi "exit"
ssh pi@pi
```

### Step 4: Install Additional Packages

```bash
ssh pi@pi "sudo apt install -y git python3-pip vim htop"
```

### Step 5: Create Directory Structure

```bash
ssh pi@pi << 'EOF'
sudo mkdir -p /opt/zigbee2mqtt/data
sudo mkdir -p /opt/homeassistant
sudo mkdir -p /opt/mosquitto/{config,data,log}
sudo mkdir -p /opt/influxdb/data
sudo mkdir -p /opt/dashboard/{www,nginx}
sudo mkdir -p /opt/scripts
sudo chown -R pi:pi /opt/zigbee2mqtt /opt/homeassistant /opt/dashboard /opt/scripts
sudo chown -R 1883:1883 /opt/mosquitto
EOF
```

### Step 6: Mount SD Card as Storage

```bash
ssh pi@pi << 'EOF'
# Format SD card if needed (skip if already formatted)
# sudo mkfs.ext4 -L storage /dev/mmcblk0p1

# Create mount point
sudo mkdir -p /mnt/storage

# Add to fstab for auto-mount
echo 'LABEL=storage  /mnt/storage  ext4  defaults,noatime  0  2' | sudo tee -a /etc/fstab

# Mount now
sudo mount /mnt/storage

# Create backup directory
sudo mkdir -p /mnt/storage/backups/zigbee2mqtt
sudo chown -R pi:pi /mnt/storage/backups
EOF
```

---

## Phase 2: Secrets Setup

**Time Estimate:** 15 minutes

### Step 1: Create .env File

On Pi:
```bash
ssh pi@pi "mkdir -p ~/pi-setup/configs/zigbee2mqtt"
ssh pi@pi "cat > ~/pi-setup/configs/zigbee2mqtt/.env << 'EOF'
# MQTT Broker Credentials
MQTT_USER=mqtt_user
MQTT_PASSWORD=[generate strong password]

# Home Assistant Long-Lived Token
# See: docs/secrets-recovery.md for how to generate
HA_TOKEN=[generate after HA is running]
EOF"
```

### Step 2: Regenerate Secrets

See **[docs/secrets-recovery.md](secrets-recovery.md)** for detailed instructions on:
- MQTT credentials setup
- Home Assistant token generation
- GCP Service Account download
- Cloudflared tunnel login

---

## Phase 3: Clone Repository & Deploy

**Time Estimate:** 20 minutes

### Step 1: Clone This Repository

```bash
ssh pi@pi "git clone https://github.com/sivaa/pi-setup.git ~/pi-setup"
```

### Step 2: Copy Configuration Files

```bash
ssh pi@pi << 'EOF'
# Zigbee2MQTT config
cp ~/pi-setup/configs/zigbee2mqtt/configuration.yaml /opt/zigbee2mqtt/data/

# Mosquitto config
cp ~/pi-setup/configs/zigbee2mqtt/mosquitto.conf /opt/mosquitto/config/

# Home Assistant config
cp ~/pi-setup/configs/homeassistant/configuration.yaml /opt/homeassistant/
cp ~/pi-setup/configs/homeassistant/automations.yaml /opt/homeassistant/
cp ~/pi-setup/configs/homeassistant/scripts.yaml /opt/homeassistant/

# Dashboard files
cp -r ~/pi-setup/services/dashboard/www/* /opt/dashboard/www/
cp ~/pi-setup/services/dashboard/nginx/dashboard.conf /opt/dashboard/nginx/

# Scripts
cp ~/pi-setup/scripts/*.sh /opt/scripts/
chmod +x /opt/scripts/*.sh
EOF
```

### Step 3: Start Docker Services

```bash
ssh pi@pi << 'EOF'
cd ~/pi-setup/configs/zigbee2mqtt

# Start services (in dependency order via depends_on)
docker compose up -d

# Verify all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF
```

**Expected Output:**
```
NAMES               STATUS              PORTS
mosquitto           Up 2 minutes        0.0.0.0:1883->1883, 9001
zigbee2mqtt         Up 2 minutes        0.0.0.0:8080->8080
homeassistant       Up 2 minutes        0.0.0.0:8123->8123
influxdb            Up 2 minutes        0.0.0.0:8086->8086
mqtt-influx-bridge  Up 2 minutes
dashboard           Up 2 minutes        0.0.0.0:8888->80
cast-ip-monitor     Up 2 minutes
heater-watchdog     Up 2 minutes
```

### Step 4: Deploy Systemd Services

**System Services (run as root):**
```bash
ssh pi@pi << 'EOF'
# Zigbee2MQTT systemd service (with validation)
sudo cp ~/pi-setup/configs/systemd/zigbee2mqtt.service /etc/systemd/system/
sudo cp ~/pi-setup/configs/wifi-watchdog/wifi-watchdog.service /etc/systemd/system/
sudo cp ~/pi-setup/configs/wifi-watchdog/wifi-watchdog.timer /etc/systemd/system/
sudo cp ~/pi-setup/configs/wifi-watchdog/wifi-watchdog.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/wifi-watchdog.sh

# Pi System Metrics Collector (publishes to MQTT + InfluxDB)
sudo mkdir -p /opt/pi-metrics-collector
sudo cp ~/pi-setup/services/pi-metrics-collector/pi-metrics-collector.py /opt/pi-metrics-collector/
sudo cp ~/pi-setup/configs/systemd/pi-metrics-collector.service /etc/systemd/system/
sudo pip3 install --break-system-packages paho-mqtt influxdb

sudo systemctl daemon-reload
sudo systemctl enable zigbee2mqtt wifi-watchdog.timer pi-metrics-collector
sudo systemctl start wifi-watchdog.timer pi-metrics-collector
EOF
```

**User Services (run as pi user):**
```bash
ssh pi@pi << 'EOF'
mkdir -p ~/.config/systemd/user ~/.local/bin

# Display scheduler
cp ~/pi-setup/configs/display-scheduler/*.service ~/.config/systemd/user/
cp ~/pi-setup/configs/display-scheduler/*.timer ~/.config/systemd/user/
cp ~/pi-setup/configs/display-scheduler/*.sh ~/.local/bin/
chmod +x ~/.local/bin/*.sh

# Kiosk browser
cp ~/pi-setup/configs/kiosk-browser/kiosk-browser.service ~/.config/systemd/user/

systemctl --user daemon-reload
systemctl --user enable display-on.timer display-off.timer kiosk-browser
EOF
```

---

## Phase 4: Zigbee Network Recovery

**Time Estimate:** 2-3 hours (39 devices)

### Important: Zigbee Network Key

If you have a backup of the Zigbee network:
```bash
# Restore from backup (if available)
ssh pi@pi << 'EOF'
# Find the latest backup (files are timestamped like database.db.20260112_1530)
LATEST=$(ls -t /mnt/storage/backups/zigbee2mqtt/database.db.* 2>/dev/null | head -1)
if [[ -n "$LATEST" ]]; then
    TIMESTAMP=$(echo "$LATEST" | sed 's/.*database.db.//')
    cp "/mnt/storage/backups/zigbee2mqtt/database.db.$TIMESTAMP" /opt/zigbee2mqtt/data/database.db
    cp "/mnt/storage/backups/zigbee2mqtt/coordinator_backup.json.$TIMESTAMP" /opt/zigbee2mqtt/data/coordinator_backup.json
    echo "Restored from backup: $TIMESTAMP"
else
    echo "No backups found!"
fi
# Use systemctl (NOT docker restart) to trigger validation
sudo systemctl restart zigbee2mqtt
EOF
```

### If Starting Fresh: Re-pair All Devices

Follow **[docs/05-zigbee-devices.md](05-zigbee-devices.md)** for complete pairing instructions.

**Recommended Order:**
1. **Thermostats first** (4x TRVZB) - Critical for heating control
2. **Contact sensors** (8x SNZB-04P) - Security alerts
3. **Temperature sensors** (12x) - Monitoring
4. **Lights & plugs** (7x) - Convenience

**Per-device time:** 3-5 minutes each
**Total for 39 devices:** 2-3 hours

---

## Phase 5: Verification

**Time Estimate:** 10 minutes

### Step 1: Run Verification Script

```bash
ssh pi@pi "/opt/scripts/verify-recovery.sh"
```

### Step 2: Manual Checks

| Check | Command | Expected |
|-------|---------|----------|
| Docker containers | `docker ps` | 8 containers running |
| Zigbee coordinator | `curl -s pi:8080/api/health` | `{"status":"ok"}` |
| Home Assistant | `curl -s pi:8123/api/` | JSON response |
| Dashboard | `curl -s pi:8888` | HTML response |
| MQTT | `mosquitto_sub -h pi -t '#' -C 1` | Any message |
| InfluxDB | `curl -s pi:8086/ping` | 204 response |

### Step 3: Service Endpoints

After recovery, these should be accessible:

| Service | URL | Notes |
|---------|-----|-------|
| Dashboard | http://pi:8888 | Main control panel |
| Dashboard v2 | http://pi:8888/v2/ | React version (beta) |
| Home Assistant | http://pi:8123 | Automations |
| Zigbee2MQTT | http://pi:8080 | Device management |
| InfluxDB | http://pi:8086 | Time-series data |

---

## Quick Reference: Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SERVICE DEPENDENCY ORDER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Level 1 (No dependencies):                                         │
│    mosquitto ──────┬──────────────────────────────────────┐         │
│    influxdb ───────┤                                      │         │
│                    │                                      │         │
│  Level 2 (Depends on Level 1):                            │         │
│    zigbee2mqtt ────┼── depends on: mosquitto              │         │
│    homeassistant ──┼── depends on: mosquitto              │         │
│    mqtt-influx ────┼── depends on: mosquitto, influxdb    │         │
│    dashboard ──────┼── depends on: mosquitto, influxdb    │         │
│                    │                                      │         │
│  Level 3 (Depends on Level 2):                            │         │
│    heater-watchdog ┼── depends on: homeassistant          │         │
│    cast-ip-monitor ┴── depends on: homeassistant          │         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Recovery Timeline Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RECOVERY TIMELINE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PHASE 0: OS Installation                                           │
│  ├── Download Pi Imager ............... 5 min                       │
│  ├── Flash OS to NVMe ................. 15 min                      │
│  └── First boot + verify SSH .......... 10 min                      │
│  SUBTOTAL: 30 min                                                   │
│                                                                     │
│  PHASE 1: System Setup                                              │
│  ├── Timezone + packages .............. 10 min                      │
│  ├── Docker install ................... 5 min                       │
│  └── Create directories ............... 2 min                       │
│  SUBTOTAL: 15 min                                                   │
│                                                                     │
│  PHASE 2: Secrets                                                   │
│  ├── Create .env file ................. 5 min                       │
│  └── Regenerate secrets ............... 10 min                      │
│  SUBTOTAL: 15 min                                                   │
│                                                                     │
│  PHASE 3: Deploy Services                                           │
│  ├── Clone repo ....................... 2 min                       │
│  ├── Copy configs ..................... 5 min                       │
│  ├── Docker compose up ................ 5 min                       │
│  └── Systemd services ................. 8 min                       │
│  SUBTOTAL: 20 min                                                   │
│                                                                     │
│  PHASE 4: Zigbee Recovery                                           │
│  └── Re-pair 39 devices ............... 2-3 HOURS                   │
│  SUBTOTAL: 2-3 hours                                                │
│                                                                     │
│  PHASE 5: Verification                                              │
│  └── Run checks ....................... 10 min                      │
│  SUBTOTAL: 10 min                                                   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  TOTAL RECOVERY TIME: ~3.5 - 4.5 hours                              │
│  (Bottleneck: Zigbee device re-pairing)                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Docker Container Won't Start

```bash
# Check logs
docker logs [container_name] --tail 50

# Common issues:
# - Port already in use: docker ps -a | grep [port]
# - Volume permissions: ls -la /opt/[service]
# - Missing .env: Check ~/pi-setup/configs/zigbee2mqtt/.env exists
```

### Zigbee Coordinator Not Found

```bash
# Check USB device
ls -la /dev/serial/by-id/

# Expected:
# usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_...

# If missing: Re-seat USB dongle, check cable
```

### Home Assistant Entities Missing

After Zigbee re-pairing, HA entities auto-create but may have different IDs.
Update automations in `/opt/homeassistant/automations.yaml` with new entity IDs.

### WiFi Not Connecting

```bash
# Check NetworkManager
sudo systemctl status NetworkManager

# Check WiFi config
sudo cat /etc/wpa_supplicant/wpa_supplicant.conf

# Restart networking
sudo systemctl restart NetworkManager
```

---

## Related Documents

- [Secrets Recovery](secrets-recovery.md) - How to regenerate credentials
- [Zigbee Devices](05-zigbee-devices.md) - Complete device pairing guide
- [NVMe Boot Setup](01-nvme-boot-setup.md) - Partitioning details
- [Zigbee2MQTT Setup](04-zigbee2mqtt-setup.md) - Docker configuration
