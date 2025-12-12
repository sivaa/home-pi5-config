# 📡 Zigbee2MQTT Configuration

> Transform your USB dongle into a powerful Zigbee gateway.

```
                    ZIGBEE NETWORK
    ┌───────────────────────────────────────────────────┐
    │                                                   │
    │         ┌─────────────────────────────┐          │
    │         │      USB Coordinator        │          │
    │         │     (Sonoff ZBDongle-E)     │          │
    │         │         Channel 15          │          │
    │         └──────────────┬──────────────┘          │
    │                        │                         │
    │         ┌──────────────┼──────────────┐         │
    │         │              │              │         │
    │         ▼              ▼              ▼         │
    │    ┌─────────┐   ┌─────────┐   ┌─────────┐    │
    │    │  Light  │   │ Remote  │   │ Sensor  │    │
    │    │(Router) │   │(EndDev) │   │(EndDev) │    │
    │    └─────────┘   └─────────┘   └─────────┘    │
    │                                                 │
    │    Legend:                                      │
    │    ▬▬▬ = Direct to Coordinator                 │
    │    ─ ─ = Can route through other routers       │
    │                                                 │
    └───────────────────────────────────────────────┘
```

---

## 📁 Configuration File

**Location**: `~/zigbee/zigbee2mqtt/data/configuration.yaml`

### Complete Configuration

```yaml
# ============================================
# Zigbee2MQTT Configuration
# ============================================

# Home Assistant MQTT Discovery
homeassistant:
  enabled: true
  discovery_topic: homeassistant
  status_topic: homeassistant/status

# MQTT Broker Connection
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
  # Uncomment if you enable MQTT authentication:
  # user: your_username
  # password: your_password

# Serial Connection to USB Dongle
serial:
  port: /dev/ttyUSB0
  adapter: ember    # For EFR32MG21 chip (Sonoff ZBDongle-E)

# Web Frontend
frontend:
  enabled: true
  port: 8080
  # Optional: enable authentication
  # auth_token: your_secret_token

# Advanced Settings
advanced:
  log_level: info
  channel: 15          # Zigbee channel (11-26)
  network_key: GENERATE  # Auto-generated on first run
  pan_id: GENERATE       # Auto-generated on first run

# ============================================
# Registered Devices
# ============================================
devices:
  # IKEA FLOALT Light Panel
  '0xd0cf5efffe25ab28':
    friendly_name: study_ikea_light

  # IKEA TRADFRI Remote
  '0x90fd9ffffef4cebf':
    friendly_name: study_ikea_remote

  # Sonoff Temperature/Humidity Sensor
  '0xc09b9efffec0e447':
    friendly_name: Bath Room

# ============================================
# Groups (Optional)
# ============================================
groups:
  '1':
    friendly_name: living_room
```

---

## ⚙️ Configuration Explained

### Home Assistant Integration

```yaml
homeassistant:
  enabled: true              # Enable auto-discovery
  discovery_topic: homeassistant  # HA default topic
  status_topic: homeassistant/status
```

This enables **MQTT Discovery** - devices automatically appear in Home Assistant!

### Serial Adapter Settings

```yaml
serial:
  port: /dev/ttyUSB0
  adapter: ember    # CRITICAL for Sonoff ZBDongle-E
```

| Dongle | Adapter Type |
|--------|--------------|
| Sonoff ZBDongle-E (EFR32MG21) | `ember` |
| Sonoff ZBDongle-P (CC2652P) | `zstack` |
| ConBee II | `deconz` |
| HUSBZB-1 | `ezsp` |

### Zigbee Channel

```yaml
advanced:
  channel: 15
```

**Channel Selection Tips:**
```
Channel 11: ███████░░░░░ (overlaps WiFi Ch 1)
Channel 15: ░░░███████░░ (minimal WiFi overlap)  ← RECOMMENDED
Channel 20: ░░░░░░░████░ (overlaps WiFi Ch 6)
Channel 25: ░░░░░░░░░███ (overlaps WiFi Ch 11)

WiFi 2.4GHz: ████████████████████████████████████
             Ch1    Ch6         Ch11
```

---

## 🌐 Web Interface

### Access

Open: **http://dietpi.local:8080**

### Dashboard Features

```
┌─────────────────────────────────────────────────────┐
│  Zigbee2MQTT                              [Permit] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Devices (3)                                        │
│  ─────────────────────────────────────────────────  │
│  ▢ study_ikea_light      Router    Connected ✓    │
│  ▢ study_ikea_remote     EndDevice Connected ✓    │
│  ▢ Bath Room             EndDevice Connected ✓    │
│                                                     │
│  Network Map     Settings     Extensions     Logs  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Key Operations

| Action | How |
|--------|-----|
| **Permit Join** | Click button (top right) - allows new devices to pair |
| **Rename Device** | Click device → Edit friendly name |
| **View Network** | Map tab → Visual network topology |
| **OTA Updates** | Device page → OTA tab |
| **Device Info** | Click device → See all attributes |

---

## 📤 MQTT Topics

Zigbee2MQTT publishes to these topics:

### Device Topics

```
zigbee2mqtt/study_ikea_light         # Device state
zigbee2mqtt/study_ikea_light/set     # Control device
zigbee2mqtt/study_ikea_light/get     # Request state

zigbee2mqtt/Bath Room                # Sensor readings
```

### Bridge Topics

```
zigbee2mqtt/bridge/state             # Online/offline status
zigbee2mqtt/bridge/logging           # Log messages
zigbee2mqtt/bridge/devices           # All device info
zigbee2mqtt/bridge/groups            # Group info
zigbee2mqtt/bridge/request/permit_join   # Enable pairing
```

### Example Messages

**Light State:**
```json
{
  "state": "ON",
  "brightness": 254,
  "color_temp": 370,
  "linkquality": 120
}
```

**Sensor Reading:**
```json
{
  "temperature": 23.5,
  "humidity": 45,
  "battery": 100,
  "linkquality": 90
}
```

---

## 🔧 Testing MQTT

### Subscribe to All Topics

```bash
docker exec mosquitto mosquitto_sub -t 'zigbee2mqtt/#' -v
```

### Control a Device

```bash
# Turn light on
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/set' \
  -m '{"state": "ON"}'

# Set brightness
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/set' \
  -m '{"brightness": 128}'

# Turn light off
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/set' \
  -m '{"state": "OFF"}'
```

### Get Device State

```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/get' \
  -m '{"state": ""}'
```

---

## 🔗 Device Binding (Direct Control)

Device binding allows devices to communicate directly without going through the coordinator.

### Bind Remote to Light

```bash
# Via MQTT
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{"from": "study_ikea_remote", "to": "study_ikea_light", "clusters": ["genOnOff", "genLevelCtrl"]}'
```

### Check Binding Status

```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/binds' \
  -m '{"device": "study_ikea_remote"}'
```

---

## 📊 Network Visualization

The web UI provides a network map showing:

```
              ┌─────────────┐
              │ Coordinator │
              │   (root)    │
              └──────┬──────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────┴────┐            ┌────┴────┐
    │ Router  │            │ Router  │
    │ (light) │            │ (plug)  │
    └────┬────┘            └────┬────┘
         │                      │
    ┌────┴────┐            ┌────┴────┐
    │EndDevice│            │EndDevice│
    │(remote) │            │(sensor) │
    └─────────┘            └─────────┘
```

**Routers** (mains-powered devices like lights, plugs):
- Extend network range
- Can relay messages for other devices

**End Devices** (battery-powered like remotes, sensors):
- Sleep most of the time to save battery
- Can't relay messages

---

## 🔒 Security (Optional)

### Enable MQTT Authentication

1. Create password file:
```bash
docker exec mosquitto mosquitto_passwd -c /mosquitto/config/passwd username
```

2. Update `mosquitto.conf`:
```conf
listener 1883
allow_anonymous false
password_file /mosquitto/config/passwd
```

3. Update `zigbee2mqtt/data/configuration.yaml`:
```yaml
mqtt:
  user: username
  password: your_password
```

### Enable Frontend Authentication

```yaml
frontend:
  enabled: true
  port: 8080
  auth_token: your_secret_token_here
```

---

## 🔍 Troubleshooting

### Check Logs

```bash
docker logs -f zigbee2mqtt
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `Error: SRSP - SYS - ping after 6000ms` | Wrong adapter type in config |
| `Error: Failed to connect to the adapter` | Check `/dev/ttyUSB0` exists |
| Device not pairing | Move closer to coordinator |
| Device disconnected | Check battery / restart Z2M |

### Reset Zigbee2MQTT

```bash
# WARNING: This removes all paired devices!
rm ~/zigbee/zigbee2mqtt/data/database.db
rm ~/zigbee/zigbee2mqtt/data/state.json
docker restart zigbee2mqtt
```

---

## 🔗 Next Steps

Zigbee2MQTT is ready! Continue to:
→ [Home Assistant Configuration](./04-home-assistant-config.md)

---

*Last updated: December 2025*
