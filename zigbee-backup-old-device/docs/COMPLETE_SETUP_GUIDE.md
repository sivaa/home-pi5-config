# Complete Smart Home Setup Guide

> **One-Shot Recreation Guide**: Everything needed to rebuild this smart home system from scratch.

```
                    SMART HOME ARCHITECTURE
    ┌─────────────────────────────────────────────────────────┐
    │                   Raspberry Pi 3B+                       │
    │                     (DietPi OS)                          │
    │  ┌───────────────────────────────────────────────────┐  │
    │  │              Docker Compose Stack                  │  │
    │  │                                                    │  │
    │  │  ┌──────────┐   ┌─────────────┐   ┌───────────┐  │  │
    │  │  │Mosquitto │◄──│ Zigbee2MQTT │◄──│USB Dongle │  │  │
    │  │  │  (MQTT)  │   │  (Gateway)  │   │(ZBDongle-E│  │  │
    │  │  └────┬─────┘   └─────────────┘   └───────────┘  │  │
    │  │       │                                           │  │
    │  │       ▼                                           │  │
    │  │  ┌──────────┐         ┌─────────────┐            │  │
    │  │  │  Home    │────────►│ Cloudflare  │            │  │
    │  │  │Assistant │         │   Tunnel    │            │  │
    │  │  └────┬─────┘         └──────┬──────┘            │  │
    │  │       │                      │                    │  │
    │  └───────│──────────────────────│────────────────────┘  │
    └──────────│──────────────────────│───────────────────────┘
               │                      │
               ▼                      ▼
    ┌──────────────────┐    ┌─────────────────────┐
    │ Google Assistant │    │   ha.sivaa.in       │
    │   (Voice Control)│    │   (HTTPS Access)    │
    └──────────────────┘    └─────────────────────┘
```

---

## Table of Contents

1. [Hardware Requirements](#1-hardware-requirements)
2. [Software Prerequisites](#2-software-prerequisites)
3. [Initial Pi Setup](#3-initial-pi-setup)
4. [Project Structure](#4-project-structure)
5. [Configuration Files](#5-configuration-files)
6. [Deployment Steps](#6-deployment-steps)
7. [Cloudflare Tunnel Setup](#7-cloudflare-tunnel-setup)
8. [Google Assistant Integration](#8-google-assistant-integration)
9. [Device Pairing](#9-device-pairing)
10. [Registered Devices](#10-registered-devices)
11. [Voice Commands](#11-voice-commands)
12. [Troubleshooting](#12-troubleshooting)
13. [Maintenance](#13-maintenance)
14. [Performance Optimizations](#14-performance-optimizations-pi-3b)

---

## 1. Hardware Requirements

| Component | Model | Purpose |
|-----------|-------|---------|
| **Single Board Computer** | Raspberry Pi 3B+ | Main controller |
| **Zigbee Coordinator** | Sonoff ZBDongle-E (EFR32MG21) | Zigbee USB adapter |
| **Smart Light** | IKEA FLOALT Panel (L1528) | Study light |
| **Remote Control** | IKEA TRADFRI Remote (E1524/E1810) | 5-button remote |
| **Temp/Humidity Sensor** | Sonoff SNZB-02P | Bathroom sensor |
| **Storage** | 16GB+ SD Card | DietPi OS |
| **Power** | 5V 2.5A Power Supply | Pi power |

---

## 2. Software Prerequisites

### On Raspberry Pi (DietPi)
- DietPi OS (Debian-based, lightweight)
- Docker & Docker Compose plugin
- cloudflared (Cloudflare tunnel)

### External Services
- Cloudflare account (for tunnel)
- Google Cloud Platform account (for Google Assistant)
- Domain name (ha.sivaa.in)

---

## 3. Initial Pi Setup

### 3.1 Install DietPi
1. Download DietPi for Raspberry Pi 3: https://dietpi.com/
2. Flash to SD card using Balena Etcher
3. Boot Pi and complete initial setup

### 3.2 Install Docker
```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Add user to docker group
usermod -aG docker root
```

### 3.3 Configure Network
- Hostname: `dietpi`
- Access via: `ssh root@dietpi.local`
- Default password: `root` (change this!)

---

## 4. Project Structure

```
~/zigbee/
├── docker-compose.yml          # Main orchestration
├── mosquitto/
│   └── mosquitto.conf          # MQTT broker config
├── zigbee2mqtt/
│   └── data/
│       └── configuration.yaml  # Zigbee2MQTT config
├── homeassistant/
│   ├── configuration.yaml      # Home Assistant config
│   └── SERVICE_ACCOUNT.json    # GCP service account (secret!)
├── Dockerfile.bridge           # Python bridge container
├── remote_bridge.py            # IKEA remote to light mapper
└── requirements.txt            # Python dependencies
```

---

## 5. Configuration Files

### 5.1 docker-compose.yml
```yaml
services:
  # MQTT Broker
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf
      - mosquitto_data:/mosquitto/data
      - mosquitto_log:/mosquitto/log

  # Zigbee2MQTT Gateway
  zigbee2mqtt:
    image: koenkk/zigbee2mqtt
    container_name: zigbee2mqtt
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "8080:8080"
    volumes:
      - ./zigbee2mqtt/data:/app/data
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0
    environment:
      - TZ=Australia/Sydney
    group_add:
      - dialout

  # Remote to Light Bridge (optional)
  remote-bridge:
    build:
      context: .
      dockerfile: Dockerfile.bridge
    container_name: remote-bridge
    restart: unless-stopped
    depends_on:
      - mosquitto
      - zigbee2mqtt
    environment:
      - MQTT_BROKER=mosquitto
      - MQTT_PORT=1883

  # Home Assistant
  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "8123:8123"
    volumes:
      - ./homeassistant:/config
    environment:
      - TZ=Australia/Sydney
    privileged: true

volumes:
  mosquitto_data:
  mosquitto_log:
```

### 5.2 mosquitto/mosquitto.conf
```conf
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest stdout
```

### 5.3 zigbee2mqtt/data/configuration.yaml
```yaml
homeassistant:
  enabled: true
  discovery_topic: homeassistant
  status_topic: homeassistant/status

mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883

serial:
  port: /dev/ttyUSB0
  adapter: ember

frontend:
  enabled: true
  port: 8080

advanced:
  log_level: info
  channel: 15

devices:
  '0xd0cf5efffe25ab28':
    friendly_name: study_ikea_light
  '0x90fd9ffffef4cebf':
    friendly_name: study_ikea_remote
  '0xc09b9efffec0e447':
    friendly_name: Bath Room

groups:
  '1':
    friendly_name: living_room
```

### 5.4 homeassistant/configuration.yaml
```yaml
# Home Assistant Configuration

homeassistant:
  name: Home
  unit_system: metric
  time_zone: Australia/Sydney
  external_url: "https://ha.sivaa.in"
  internal_url: "http://dietpi.local:8123"

# Enable frontend
frontend:

# Enable configuration UI
config:

# HTTP settings
http:
  server_port: 8123
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 172.18.0.0/16
    - 172.17.0.0/16

# MQTT is configured via UI: Settings → Devices & Services → Add Integration → MQTT
# Broker: mosquitto, Port: 1883

# Google Assistant Integration
google_assistant:
  project_id: siva-home-assistant
  service_account: !include SERVICE_ACCOUNT.json
  report_state: true
  exposed_domains:
    - light
    - switch
  entity_config:
    light.study_ikea_light:
      name: Desk Lamp
      room: Study
      aliases:
        - study light
        - desk light
        - ikea light

# Logging
logger:
  default: info
```

---

## 6. Deployment Steps

### 6.1 Clone/Copy Project to Pi
```bash
# From your local machine
rsync -avz ~/zigbee/ root@dietpi.local:~/zigbee/
```

### 6.2 Start Docker Stack
```bash
# SSH into Pi
ssh root@dietpi.local

# Navigate to project
cd ~/zigbee

# Start all services
docker compose up -d

# Check status
docker ps
```

### 6.3 Verify Services
| Service | URL | Purpose |
|---------|-----|---------|
| Zigbee2MQTT | http://dietpi.local:8080 | Zigbee management |
| Home Assistant | http://dietpi.local:8123 | Home automation |
| MQTT Broker | localhost:1883 | Message broker |

### 6.4 Configure MQTT in Home Assistant
1. Open http://dietpi.local:8123
2. Complete onboarding (create admin account)
3. Go to: **Settings → Devices & Services → Add Integration**
4. Search: **MQTT**
5. Configure:
   - Broker: `mosquitto`
   - Port: `1883`
   - Username/Password: leave empty

---

## 7. Cloudflare Tunnel Setup

### 7.1 Create Tunnel (one-time on any machine)
```bash
# Install cloudflared
# macOS: brew install cloudflared
# Debian: apt install cloudflared

# Login to Cloudflare
cloudflared login

# Create tunnel
cloudflared tunnel create ha-tunnel

# This creates:
# ~/.cloudflared/<TUNNEL_ID>.json  (credentials)
# ~/.cloudflared/cert.pem          (certificate)
```

### 7.2 Configure DNS in Cloudflare Dashboard
1. Go to Cloudflare Dashboard → DNS
2. Add CNAME record:
   - Name: `ha`
   - Target: `<TUNNEL_ID>.cfargotunnel.com`
   - Proxy: Yes

### 7.3 Install cloudflared on Pi
```bash
# Add Cloudflare repo
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' \
  > /etc/apt/sources.list.d/cloudflared.list

apt-get update && apt-get install -y cloudflared
```

### 7.4 Configure Tunnel on Pi
```bash
# Create config directory
mkdir -p /root/.cloudflared

# Copy credentials from local machine
scp ~/.cloudflared/<TUNNEL_ID>.json root@dietpi.local:/root/.cloudflared/

# Create config file
cat > /root/.cloudflared/config.yml << 'EOF'
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: ha.sivaa.in
    service: http://localhost:8123
  - service: http_status:404
EOF
```

### 7.5 Install as Service
```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared

# Verify
systemctl status cloudflared
```

---

## 8. Google Assistant Integration

### 8.1 Prerequisites
- GCP Project with billing enabled
- Service account with HomeGraph API access
- Domain accessible via HTTPS (Cloudflare tunnel)

### 8.2 GCP Setup

#### Create Project
1. Go to https://console.cloud.google.com
2. Create project: `siva-home-assistant`

#### Enable HomeGraph API
1. Go to: APIs & Services → Library
2. Search: `HomeGraph API`
3. Click **Enable**

#### Create Service Account
1. Go to: IAM & Admin → Service Accounts
2. Create service account:
   - Name: `id-home-assistant`
   - Role: `Service Account Token Creator`
3. Create key (JSON format)
4. Download and rename to `SERVICE_ACCOUNT.json`
5. Copy to: `~/zigbee/homeassistant/SERVICE_ACCOUNT.json`

### 8.3 Google Home Developer Console

1. Go to: https://console.home.google.com
2. Create/select project
3. Add **Cloud-to-Cloud** integration
4. Configure OAuth:

| Field | Value |
|-------|-------|
| Client ID | `https://oauth-redirect.googleusercontent.com/r/siva-home-assistant` |
| Authorization URL | `https://ha.sivaa.in/auth/authorize` |
| Token URL | `https://ha.sivaa.in/auth/token` |
| Cloud Fulfillment URL | `https://ha.sivaa.in/api/google_assistant` |
| Scopes | `email`, `name` |

### 8.4 Link in Google Home App
1. Open Google Home app on phone
2. Tap **+** → **Set up device** → **Works with Google**
3. Search for **[test] Home Assistant** or project name
4. Sign in with Home Assistant credentials
5. Say: **"Hey Google, sync my devices"**

---

## 9. Device Pairing

### 9.1 Enable Pairing Mode
```bash
# Via MQTT
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/permit_join' \
  -m '{"value": true, "time": 120}'

# Or via Zigbee2MQTT UI: http://dietpi.local:8080
# Click "Permit Join" button
```

### 9.2 Pair Devices

#### IKEA TRADFRI Light (L1528)
1. Power cycle the light 6 times quickly
2. Light will flash indicating pairing mode

#### IKEA TRADFRI Remote (E1524/E1810)
1. Open battery compartment
2. Press pairing button 4 times within 5 seconds
3. LED will flash

#### Sonoff SNZB-02P Sensor
1. Press and hold button for 5+ seconds
2. LED will flash indicating pairing mode

### 9.3 Rename Device
```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/rename' \
  -m '{"from": "0x...", "to": "friendly_name"}'
```

---

## 10. Registered Devices

| IEEE Address | Friendly Name | Model | Type |
|--------------|---------------|-------|------|
| `0xd0cf5efffe25ab28` | study_ikea_light | IKEA L1528 | Light (Router) |
| `0x90fd9ffffef4cebf` | study_ikea_remote | IKEA E1524/E1810 | Remote (EndDevice) |
| `0xc09b9efffec0e447` | Bath Room | Sonoff SNZB-02P | Temp/Humidity Sensor |

### Device Details

#### study_ikea_light
- **Type**: IKEA FLOALT Panel 30x90cm
- **Features**: On/Off, Brightness, Color Temperature
- **Zigbee Role**: Router (extends network)
- **Home Assistant Entity**: `light.study_ikea_light`
- **Google Assistant Name**: "Desk Lamp"

#### study_ikea_remote
- **Type**: IKEA TRADFRI 5-button Remote
- **Features**: On, Off, Brightness Up/Down, Left/Right
- **Battery**: CR2032
- **Zigbee Role**: EndDevice

#### Bath Room
- **Type**: Sonoff Temperature & Humidity Sensor
- **Features**: Temperature, Humidity, Battery
- **Battery**: CR2450
- **Home Assistant Entities**:
  - `sensor.bath_room_temperature`
  - `sensor.bath_room_humidity`
  - `sensor.bath_room_battery`

---

## 11. Voice Commands

### Lights
| Command | Action |
|---------|--------|
| "Hey Google, turn on Desk Lamp" | Turn on study light |
| "Hey Google, turn off Desk Lamp" | Turn off study light |
| "Hey Google, dim Desk Lamp to 50%" | Set brightness to 50% |
| "Hey Google, turn on the light in Study" | Turn on lights in Study room |
| "Hey Google, turn off all lights" | Turn off all lights |

### Sensors
| Command | Action |
|---------|--------|
| "Hey Google, what's the temperature in the bathroom?" | Get bathroom temperature |
| "Hey Google, what's the humidity in the bathroom?" | Get bathroom humidity |

### System
| Command | Action |
|---------|--------|
| "Hey Google, sync my devices" | Re-sync devices from Home Assistant |

---

## 12. Troubleshooting

### Service Won't Start
```bash
# Check logs
docker logs zigbee2mqtt
docker logs homeassistant
docker logs mosquitto

# Restart services
docker compose restart
```

### Zigbee Device Not Pairing
1. Check permit join is enabled
2. Move device closer to coordinator
3. Check USB dongle is detected: `ls -la /dev/ttyUSB0`
4. Restart Zigbee2MQTT: `docker restart zigbee2mqtt`

### Home Assistant 400 Error via Tunnel
- Check `trusted_proxies` includes Docker networks
- Verify `external_url` is set correctly
- Check cloudflared is running: `systemctl status cloudflared`

### Google Assistant Not Recognizing Device
1. Say "Hey Google, sync my devices"
2. Check device name in Google Home app
3. Verify device is exposed in `configuration.yaml`
4. Check Home Assistant logs for Google Assistant errors

### MQTT Connection Issues
```bash
# Test MQTT connection
docker exec mosquitto mosquitto_sub -t '#' -v

# Check MQTT broker logs
docker logs mosquitto
```

---

## 13. Maintenance

### Backup Configuration
```bash
# From Pi
tar -czvf zigbee-backup-$(date +%Y%m%d).tar.gz \
  ~/zigbee/docker-compose.yml \
  ~/zigbee/mosquitto/ \
  ~/zigbee/zigbee2mqtt/data/configuration.yaml \
  ~/zigbee/homeassistant/configuration.yaml \
  /root/.cloudflared/config.yml

# Copy to local machine
scp root@dietpi.local:~/zigbee-backup-*.tar.gz ./
```

### Update Services
```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker logs -f zigbee2mqtt
docker logs -f homeassistant
```

### System Health
```bash
# Pi status
uptime
free -h
df -h
cat /sys/class/thermal/thermal_zone0/temp  # CPU temp (divide by 1000)

# Docker status
docker ps
docker system df
```

---

## 14. Performance Optimizations (Pi 3B+)

> The Pi 3B+ has only 1GB RAM. These optimizations help it run the full stack smoothly.

### 14.1 zram Compressed Swap (Installed)
```bash
# Install zram
apt-get install -y zram-tools

# Configure: /etc/default/zramswap
ALGO=lz4
PERCENT=50
PRIORITY=100

# Enable
systemctl enable zramswap
systemctl start zramswap

# Verify
zramctl
swapon --show
```

### 14.2 Docker Memory Limits (Applied)
All containers have memory limits in `docker-compose.yml`:

| Container | Memory Limit | Swap Limit |
|-----------|--------------|------------|
| mosquitto | 50 MB | 100 MB |
| zigbee2mqtt | 150 MB | 200 MB |
| remote-bridge | 50 MB | 75 MB |
| homeassistant | 256 MB | 384 MB |

### 14.3 Kernel Tuning (Applied)
```bash
# /etc/sysctl.d/99-pi-optimization.conf
vm.swappiness=10
vm.dirty_ratio=10
vm.dirty_background_ratio=5
vm.overcommit_memory=0
```

### 14.4 Disabled Services
- **Samba (smbd/nmbd)** - Freed ~20MB RAM
  ```bash
  # Re-enable if needed:
  systemctl enable smbd nmbd
  systemctl start smbd nmbd
  ```

### 14.5 Resource Monitoring
```bash
# Quick status
ssh root@dietpi.local "uptime && free -h && docker stats --no-stream"

# Container memory usage
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
```

---

## Quick Reference

### URLs
| Service | Local | External |
|---------|-------|----------|
| Home Assistant | http://dietpi.local:8123 | https://ha.sivaa.in |
| Zigbee2MQTT | http://dietpi.local:8080 | - |
| MQTT Broker | localhost:1883 | - |

### SSH Access
```bash
ssh root@dietpi.local
# Password: root (change this!)
```

### Key Files
| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration |
| `zigbee2mqtt/data/configuration.yaml` | Zigbee devices & settings |
| `homeassistant/configuration.yaml` | HA settings & Google Assistant |
| `homeassistant/SERVICE_ACCOUNT.json` | GCP credentials (SECRET!) |
| `/root/.cloudflared/config.yml` | Cloudflare tunnel config |

---

*Last updated: December 2025*
*Created with Claude Code*
