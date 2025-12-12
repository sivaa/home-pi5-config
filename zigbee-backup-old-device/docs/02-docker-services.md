# 🐳 Docker Services

> The complete containerized smart home stack - split across two machines.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTED ARCHITECTURE                               │
├─────────────────────────────────────┬───────────────────────────────────────────┤
│        🥧 DietPi (Raspberry Pi)     │           💻 MacBook (Laptop)             │
│            dietpi.local              │              localhost                    │
├─────────────────────────────────────┼───────────────────────────────────────────┤
│                                     │                                           │
│  ┌─────────────┐  ┌─────────────┐  │   ┌─────────────┐     ┌─────────────┐     │
│  │  Mosquitto  │◄─│ Zigbee2MQTT │  │   │   Grafana   │     │  InfluxDB   │     │
│  │    MQTT     │  │   Gateway   │  │   │  Dashboard  │────►│  Time-Series│     │
│  │   :1883     │  │   :8080     │  │   │   :3333     │     │   :8086     │     │
│  └──────┬──────┘  └─────────────┘  │   └─────────────┘     └──────▲──────┘     │
│         │                          │                              │            │
│         ▼                          │         ◄───── MQTT ─────────┘            │
│  ┌─────────────┐                   │         (sensor data flows               │
│  │    Home     │───────────────────┼──────────to InfluxDB)                    │
│  │  Assistant  │                   │                                           │
│  │   :8123     │                   │                                           │
│  └─────────────┘                   │                                           │
│                                    │                                           │
└────────────────────────────────────┴───────────────────────────────────────────┘

Data Flow:
  Zigbee Devices → Zigbee2MQTT → MQTT → Home Assistant → InfluxDB → Grafana
```

## Why Split Architecture?

| Reason | Explanation |
|--------|-------------|
| **Pi Resources** | Raspberry Pi 3B+ has limited RAM (1GB) - Grafana + InfluxDB would overwhelm it |
| **Visualization** | Grafana dashboards are primarily viewed on laptop anyway |
| **Data Retention** | Laptop SSD provides better storage for time-series data |
| **Network** | Both machines on same LAN - minimal latency |

---

## 📁 File Structure

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
│   └── SERVICE_ACCOUNT.json    # GCP credentials (secret!)
├── Dockerfile.bridge           # Python bridge container
├── remote_bridge.py            # IKEA remote to light mapper
└── requirements.txt            # Python dependencies
```

---

## 📝 docker-compose.yml

```yaml
services:
  # ===========================================
  # MQTT Broker - Message Bus
  # ===========================================
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
    deploy:
      resources:
        limits:
          memory: 50M
        reservations:
          memory: 25M

  # ===========================================
  # Zigbee2MQTT - Zigbee Gateway
  # ===========================================
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
    deploy:
      resources:
        limits:
          memory: 150M
        reservations:
          memory: 75M

  # ===========================================
  # Home Assistant - Automation Platform
  # ===========================================
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
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 150M

  # ===========================================
  # Remote Bridge - IKEA Remote Handler
  # ===========================================
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
    deploy:
      resources:
        limits:
          memory: 50M
        reservations:
          memory: 25M

volumes:
  mosquitto_data:
  mosquitto_log:
```

---

## 🦟 Mosquitto MQTT Broker

### Configuration: `mosquitto/mosquitto.conf`

```conf
# Listener - accept connections on all interfaces
listener 1883

# Authentication - disabled for internal network
# For production, enable password auth!
allow_anonymous true

# Persistence - retain messages across restarts
persistence true
persistence_location /mosquitto/data/

# Logging
log_dest stdout
log_type all
```

### What is MQTT?

```
MQTT is a lightweight publish/subscribe messaging protocol.
Perfect for IoT devices with limited resources.

PUBLISHER                    BROKER                    SUBSCRIBER
   │                           │                           │
   │   zigbee2mqtt/light/set   │                           │
   ├──────────────────────────►│                           │
   │                           │   zigbee2mqtt/light/set   │
   │                           ├──────────────────────────►│
   │                           │                           │
   │                           │   Topic Hierarchy:        │
   │                           │   zigbee2mqtt/            │
   │                           │   ├── bridge/             │
   │                           │   ├── study_ikea_light/   │
   │                           │   └── Bath Room/          │
```

---

## 📡 Zigbee2MQTT

### Key Features

| Feature | Description |
|---------|-------------|
| **Device Support** | 3000+ Zigbee devices |
| **Web UI** | http://dietpi.local:8080 |
| **MQTT Integration** | Publishes all device events |
| **OTA Updates** | Firmware updates for devices |
| **Device Binding** | Direct device-to-device pairing |

### Configuration

See [Zigbee2MQTT Config](./03-zigbee2mqtt-config.md) for detailed setup.

---

## 🏠 Home Assistant

### Key Features

| Feature | Description |
|---------|-------------|
| **Automation Engine** | Complex rule-based automations |
| **Web UI** | http://dietpi.local:8123 |
| **Integrations** | 2000+ supported integrations |
| **Google Assistant** | Voice control integration |
| **Mobile App** | iOS and Android apps |

### Configuration

See [Home Assistant Config](./04-home-assistant-config.md) for detailed setup.

---

## 🌉 Remote Bridge (Optional)

A Python service that maps IKEA remote buttons to light actions.

### Dockerfile.bridge

```dockerfile
FROM python:3.11-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY remote_bridge.py .

CMD ["python", "-u", "remote_bridge.py"]
```

### requirements.txt

```
paho-mqtt==1.6.1
```

### remote_bridge.py (Summary)

The bridge listens for IKEA remote button presses and translates them:

| Button | Action |
|--------|--------|
| Toggle (center) | Turn light on/off |
| Brightness Up | Increase brightness 10% |
| Brightness Down | Decrease brightness 10% |
| Arrow Left | Color temperature warmer |
| Arrow Right | Color temperature cooler |

---

## 🚀 Deployment Commands

### Start All Services

```bash
cd ~/zigbee
docker compose up -d
```

### View Status

```bash
docker ps
```

Expected output:
```
CONTAINER ID   IMAGE                     STATUS          PORTS
xxxx           home-assistant:stable     Up X hours      0.0.0.0:8123->8123/tcp
xxxx           koenkk/zigbee2mqtt        Up X hours      0.0.0.0:8080->8080/tcp
xxxx           eclipse-mosquitto:2       Up X hours      0.0.0.0:1883->1883/tcp
xxxx           zigbee-remote-bridge      Up X hours
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker logs -f zigbee2mqtt
docker logs -f homeassistant
docker logs -f mosquitto
```

### Restart Services

```bash
# All
docker compose restart

# Specific
docker restart zigbee2mqtt
```

### Update Images

```bash
# Pull latest images
docker compose pull

# Recreate with new images
docker compose up -d

# Clean up old images
docker image prune -f
```

### Stop All Services

```bash
docker compose down
```

---

## 💾 Memory Optimization (Pi 3B+)

With only 1GB RAM, memory limits are critical:

| Container | Memory Limit | Actual Usage |
|-----------|--------------|--------------|
| mosquitto | 50 MB | ~15 MB |
| zigbee2mqtt | 150 MB | ~80 MB |
| homeassistant | 256 MB | ~180 MB |
| remote-bridge | 50 MB | ~30 MB |
| **Total** | **506 MB** | **~305 MB** |

Monitor with:
```bash
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'
```

---

## 🔍 Service URLs

### On DietPi (Raspberry Pi)

| Service | URL | Purpose |
|---------|-----|---------|
| Home Assistant | http://dietpi.local:8123 | Main dashboard & automations |
| Zigbee2MQTT | http://dietpi.local:8080 | Zigbee device management |
| MQTT Broker | dietpi.local:1883 | Message bus (no UI) |

### On MacBook (Laptop)

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana | http://localhost:3333 | Climate visualization dashboards |
| InfluxDB | http://localhost:8086 | Time-series database for sensor data |

---

## 🔗 Next Steps

Docker stack is ready! Continue to:
→ [Zigbee2MQTT Configuration](./03-zigbee2mqtt-config.md)

---

*Last updated: December 2025*
