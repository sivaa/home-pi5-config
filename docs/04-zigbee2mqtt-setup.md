# Zigbee2MQTT Setup via Docker

> **Last Updated:** December 30, 2025
> **Status:** Running and verified (8 Docker services)

---

## The Story

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   "I want my Zigbee devices to talk to Home Assistant..."               │
│                                                                          │
│   ┌──────────┐     ┌─────────────┐     ┌───────────┐     ┌──────────┐  │
│   │  Zigbee  │────►│ Zigbee2MQTT │────►│ Mosquitto │────►│   Home   │  │
│   │ Devices  │     │  (Bridge)   │ MQTT│  (Broker) │ MQTT│ Assistant│  │
│   └──────────┘     └──────────────┘     └───────────┘     └──────────┘  │
│                                                                          │
│   All running in Docker containers on the Pi!                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

We're using **Docker** to run Zigbee2MQTT because:
- Easy updates (just pull new image)
- Isolated environment
- Same setup works everywhere
- Easy backup/restore

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DOCKER STACK ON PI (8 SERVICES)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  Mosquitto   │◄───│ Zigbee2MQTT  │    │  InfluxDB    │                   │
│  │  MQTT Broker │    │   :8080      │    │   :8086      │                   │
│  │  :1883/:9001 │    └──────┬───────┘    └──────▲───────┘                   │
│  └──────┬───────┘           │                   │                           │
│         │                   ▼                   │                           │
│         │           ┌─────────────┐    ┌───────┴────────┐                   │
│         │           │ /dev/ttyUSB0│    │mqtt-influx-    │                   │
│         │           │ Zigbee Dongl│    │    bridge      │                   │
│         │           └─────────────┘    └────────────────┘                   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐    ┌────────────────┐    ┌──────────────┐                 │
│  │Home Assistant│───►│   Dashboard    │    │heater-watchdog│                │
│  │   :8123      │    │  (Nginx):8888  │    │ (safety)     │                 │
│  └──────────────┘    └────────────────┘    └──────────────┘                 │
│         │                                                                    │
│         └──────────────────┐                                                │
│                            ▼                                                │
│                   ┌────────────────┐                                        │
│                   │cast-ip-monitor │                                        │
│                   │(Google Cast)   │                                        │
│                   └────────────────┘                                        │
│                                                                              │
│  Data Flow:                                                                  │
│    Zigbee Devices → Zigbee2MQTT → MQTT → Home Assistant → InfluxDB         │
│    Dashboard reads from: MQTT (live) + InfluxDB (historical)               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before this setup, you need:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Raspberry Pi 5 | Done | See `docs/01-nvme-boot-setup.md` |
| Zigbee Dongle | Done | See `docs/03-zigbee-dongle.md` |
| Docker | Installing... | This doc covers it |

---

## Installation Steps

### Step 1: Install Docker on Pi

```bash
# Install prerequisites
ssh pi@pi "sudo apt update && sudo apt install -y ca-certificates curl gnupg"

# Add Docker GPG key
ssh pi@pi "sudo install -m 0755 -d /etc/apt/keyrings && \
  curl -fsSL https://download.docker.com/linux/debian/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
  sudo chmod a+r /etc/apt/keyrings/docker.gpg"

# Add Docker repository
ssh pi@pi 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null'

# Install Docker
ssh pi@pi "sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"

# Add pi user to docker group
ssh pi@pi "sudo usermod -aG docker pi"

# Enable Docker to start on boot
ssh pi@pi "sudo systemctl enable docker && sudo systemctl start docker"
```

**Verify:**
```bash
ssh pi@pi "docker --version && docker compose version"
```

### Step 2: Create Directories on Pi

```bash
ssh pi@pi "sudo mkdir -p /opt/zigbee2mqtt/data /opt/mosquitto/{config,data,log} && \
  sudo chown -R pi:pi /opt/zigbee2mqtt /opt/mosquitto"
```

### Step 3: Deploy Config Files

Config files are stored in this repo at `configs/zigbee2mqtt/`:

```bash
# From local machine (pi-setup directory)
scp configs/zigbee2mqtt/docker-compose.yml pi@pi:/opt/zigbee2mqtt/
scp configs/zigbee2mqtt/configuration.yaml pi@pi:/opt/zigbee2mqtt/data/
scp configs/zigbee2mqtt/mosquitto.conf pi@pi:/opt/mosquitto/config/
```

### Step 4: Start the Stack

```bash
ssh pi@pi "cd /opt/zigbee2mqtt && docker compose up -d"
```

### Step 5: Verify

```bash
# Check containers are running
ssh pi@pi "docker ps"

# Check Zigbee2MQTT logs
ssh pi@pi "docker logs zigbee2mqtt"

# Test web UI responds
ssh pi@pi "curl -s http://localhost:8080 | head -5"
```

---

## Config Files

### docker-compose.yml

Location: `configs/zigbee2mqtt/docker-compose.yml`

> **Note:** This example shows 5 core services. The actual stack has 8 services - see `configs/zigbee2mqtt/docker-compose.yml` for the full configuration.

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "1883:1883"
      - "9001:9001"  # WebSocket for dashboard
    volumes:
      - /opt/mosquitto/config:/mosquitto/config
      - /opt/mosquitto/data:/mosquitto/data
      - /opt/mosquitto/log:/mosquitto/log

  zigbee2mqtt:
    image: koenkk/zigbee2mqtt
    container_name: zigbee2mqtt
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "8080:8080"
    volumes:
      - /opt/zigbee2mqtt/data:/app/data
    devices:
      - /dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_...-if00-port0:/dev/ttyUSB0
    environment:
      - TZ=Europe/Berlin

  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "8123:8123"
    volumes:
      - /opt/homeassistant:/config
    environment:
      - TZ=Europe/Berlin
    privileged: true

  influxdb:
    image: influxdb:1.8
    container_name: influxdb
    restart: unless-stopped
    ports:
      - "8086:8086"
    volumes:
      - /opt/influxdb/data:/var/lib/influxdb
    environment:
      - INFLUXDB_DB=homeassistant
      - INFLUXDB_HTTP_AUTH_ENABLED=false
      - INFLUXDB_REPORTING_DISABLED=true

  dashboard:
    image: nginx:alpine
    container_name: dashboard
    restart: unless-stopped
    ports:
      - "8888:80"
    volumes:
      - /opt/dashboard/www:/usr/share/nginx/html:ro
      - /opt/dashboard/nginx/dashboard.conf:/etc/nginx/conf.d/default.conf:ro
      - /opt/dashboard/nginx/.htpasswd:/etc/nginx/.htpasswd:ro
    depends_on:
      - mosquitto
      - influxdb
```

### configuration.yaml

Location: `configs/zigbee2mqtt/configuration.yaml`

```yaml
homeassistant: true
permit_join: false
frontend:
  port: 8080
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
serial:
  port: /dev/ttyUSB0
  adapter: ember    # For Sonoff Dongle V2 (firmware 7.4+)
advanced:
  network_key: GENERATE
  log_level: info
```

### mosquitto.conf

Location: `configs/zigbee2mqtt/mosquitto.conf`

```
listener 1883
allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest stdout
```

---

## Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Zigbee2MQTT Web UI | http://pi:8080 | Manage devices, view network |
| Home Assistant | http://pi:8123 | Smart home automation |
| Dashboard | http://pi:8888 | Custom sensor visualization |
| InfluxDB | http://pi:8086 | Time-series database |
| MQTT Broker | mqtt://pi:1883 | Message broker |
| MQTT WebSocket | ws://pi:9001 | WebSocket for dashboard |

---

## Common Operations

### View Logs

```bash
# Zigbee2MQTT logs
ssh pi@pi "docker logs -f zigbee2mqtt"

# Mosquitto logs
ssh pi@pi "docker logs -f mosquitto"
```

### Restart Services

```bash
ssh pi@pi "cd /opt/zigbee2mqtt && docker compose restart"
```

### Update to Latest Version

```bash
ssh pi@pi "cd /opt/zigbee2mqtt && docker compose pull && docker compose up -d"
```

### Stop Services

```bash
ssh pi@pi "cd /opt/zigbee2mqtt && docker compose down"
```

---

## Pairing Devices

1. Open web UI: http://pi:8080
2. Click "Permit join" (or set `permit_join: true` in config)
3. Put device in pairing mode (see `docs/05-zigbee-devices.md` for device-specific procedures)
4. Device appears in the web UI
5. Rename device with `[Room] Device Type` format
6. **Disable permit_join** when done!

> **Device Reference:** See `docs/05-zigbee-devices.md` for complete device inventory and pairing procedures.

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
ssh pi@pi "docker logs zigbee2mqtt 2>&1 | tail -50"

# Common issues:
# - Serial port not accessible: Check /dev/serial/by-id/ path
# - Permission denied: Ensure pi is in dialout group
# - Port already in use: Check nothing else uses 8080 or 1883
```

### Can't Access Web UI

```bash
# Check container is running
ssh pi@pi "docker ps | grep zigbee2mqtt"

# Check port is listening
ssh pi@pi "ss -tlnp | grep 8080"

# Check firewall (if enabled)
ssh pi@pi "sudo iptables -L -n | grep 8080"
```

### Zigbee Dongle Not Detected

```bash
# Check dongle is connected
ssh pi@pi "ls -la /dev/serial/by-id/"

# Check device permissions
ssh pi@pi "ls -la /dev/ttyUSB0"

# Verify user is in dialout group
ssh pi@pi "groups pi | grep dialout"
```

---

## Disaster Recovery

To rebuild this setup from scratch:

1. Install Docker (Step 1 above)
2. Create directories (Step 2)
3. Deploy configs from this repo (Step 3)
4. Start stack (Step 4)
5. Re-pair all devices (see `docs/05-zigbee-devices.md` for complete checklist)

**Important:** The Zigbee network key is auto-generated on first run. After devices are paired, backup the `configuration.yaml` from the Pi which contains the actual network key.

> **Device Inventory:** See `docs/05-zigbee-devices.md` for all 39 devices with pairing procedures.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-30 | Updated to 8-service stack (added mqtt-influx-bridge, cast-ip-monitor, heater-watchdog) |
| 2025-12-30 | Updated device count to 35, fixed timezone to Europe/Berlin |
| 2025-12-16 | Updated docker-compose to show full 5-service stack |
| 2025-12-16 | Updated architecture diagram, access points, device count (22) |
| 2025-12-12 | Added reference to device inventory (docs/05-zigbee-devices.md) |
| 2025-12-12 | Initial setup |
