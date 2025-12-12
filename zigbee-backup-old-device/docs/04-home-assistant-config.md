# 🏠 Home Assistant Configuration

> Your central hub for home automation and voice control.

```
                    HOME ASSISTANT ARCHITECTURE
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │                  HOME ASSISTANT                     │
    │                                                     │
    │   ┌───────────────────────────────────────────┐   │
    │   │              Integrations                  │   │
    │   │                                           │   │
    │   │   ┌─────┐  ┌──────┐  ┌────────────┐     │   │
    │   │   │MQTT │  │Google│  │ Mobile App │     │   │
    │   │   │     │  │Assist│  │            │     │   │
    │   │   └──┬──┘  └──┬───┘  └─────┬──────┘     │   │
    │   │      │        │            │             │   │
    │   └──────│────────│────────────│─────────────┘   │
    │          │        │            │                  │
    │   ┌──────┴────────┴────────────┴─────────────┐   │
    │   │              Entity Registry              │   │
    │   │                                           │   │
    │   │   light.study_ikea_light                 │   │
    │   │   sensor.bath_room_temperature           │   │
    │   │   sensor.bath_room_humidity              │   │
    │   │                                           │   │
    │   └───────────────────────────────────────────┘   │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
~/zigbee/homeassistant/
├── configuration.yaml      # Main config
├── automations.yaml        # Automation rules (auto-created)
├── scripts.yaml            # Scripts (auto-created)
├── scenes.yaml             # Scenes (auto-created)
├── secrets.yaml            # Sensitive data (optional)
├── SERVICE_ACCOUNT.json    # Google Cloud credentials (SECRET!)
└── .storage/               # UI-configured data (DO NOT EDIT)
```

---

## 📝 configuration.yaml

```yaml
# ============================================
# Home Assistant Configuration
# ============================================

homeassistant:
  name: Home
  unit_system: metric
  time_zone: Australia/Sydney
  # URLs for external/internal access
  external_url: "https://ha.sivaa.in"
  internal_url: "http://dietpi.local:8123"

# ============================================
# Frontend & UI
# ============================================
frontend:

# Enable Configuration UI
config:

# ============================================
# HTTP Settings (Critical for Cloudflare Tunnel)
# ============================================
http:
  server_port: 8123
  # Required for reverse proxy (Cloudflare Tunnel)
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 172.18.0.0/16    # Docker bridge network
    - 172.17.0.0/16    # Docker default network

# ============================================
# Google Assistant Integration
# ============================================
google_assistant:
  project_id: siva-home-assistant
  service_account: !include SERVICE_ACCOUNT.json
  report_state: true
  exposed_domains:
    - light
    - switch
    - sensor
  entity_config:
    light.study_ikea_light:
      name: Desk Lamp
      room: Study
      aliases:
        - study light
        - desk light
        - ikea light

# ============================================
# Logging
# ============================================
logger:
  default: info
  logs:
    homeassistant.components.http: warning
    homeassistant.components.google_assistant: debug

# ============================================
# MQTT - Configured via UI
# ============================================
# Go to: Settings → Devices & Services → Add Integration → MQTT
# Broker: mosquitto
# Port: 1883
```

---

## 🚀 Initial Setup

### First Access

1. Open: **http://dietpi.local:8123**
2. Create admin account (remember this!)
3. Complete onboarding wizard

```
┌─────────────────────────────────────────────────────┐
│           Welcome to Home Assistant                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  👤 Create Owner Account                           │
│                                                     │
│  Name:     ___________________                     │
│  Username: ___________________                     │
│  Password: ___________________                     │
│  Confirm:  ___________________                     │
│                                                     │
│                            [Create Account]         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Configure MQTT Integration

1. **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for **MQTT**
4. Configure:

| Field | Value |
|-------|-------|
| Broker | `mosquitto` |
| Port | `1883` |
| Username | (leave empty) |
| Password | (leave empty) |

After adding MQTT, Zigbee devices will automatically appear!

---

## 🎛️ Entity Management

### View All Entities

**Settings** → **Devices & Services** → **Entities**

### Expected Entities

| Entity ID | Type | Description |
|-----------|------|-------------|
| `light.study_ikea_light` | Light | IKEA FLOALT panel |
| `sensor.bath_room_temperature` | Sensor | Temperature reading |
| `sensor.bath_room_humidity` | Sensor | Humidity reading |
| `sensor.bath_room_battery` | Sensor | Sensor battery level |
| `sensor.study_ikea_light_linkquality` | Sensor | Zigbee signal strength |

### Customize Entity

1. Click entity → **⚙️ Settings**
2. Change name, icon, or entity ID
3. Save

---

## 🤖 Automations

### Create via UI

**Settings** → **Automations & Scenes** → **+ Create Automation**

### Example: Motion Light

```yaml
alias: Motion Light
trigger:
  - platform: state
    entity_id: binary_sensor.motion_sensor
    to: "on"
action:
  - service: light.turn_on
    target:
      entity_id: light.study_ikea_light
    data:
      brightness_pct: 100
mode: single
```

### Example: Night Mode

```yaml
alias: Night Mode
trigger:
  - platform: time
    at: "22:00:00"
action:
  - service: light.turn_on
    target:
      entity_id: light.study_ikea_light
    data:
      brightness_pct: 20
      color_temp: 500  # Warm
```

---

## 📱 Dashboard Customization

### Lovelace Cards

**Overview** → **Edit Dashboard** → **+ Add Card**

### Light Card Example

```yaml
type: light
entity: light.study_ikea_light
name: Desk Lamp
icon: mdi:desk-lamp
```

### Sensor Card Example

```yaml
type: entities
title: Bathroom
entities:
  - entity: sensor.bath_room_temperature
    name: Temperature
    icon: mdi:thermometer
  - entity: sensor.bath_room_humidity
    name: Humidity
    icon: mdi:water-percent
  - entity: sensor.bath_room_battery
    name: Battery
    icon: mdi:battery
```

### Gauge Card

```yaml
type: gauge
entity: sensor.bath_room_temperature
name: Bathroom Temp
min: 10
max: 40
severity:
  green: 18
  yellow: 26
  red: 30
```

---

## 🔧 Useful Services

### Call Services via Developer Tools

**Developer Tools** → **Services**

### Light Controls

```yaml
# Turn on with brightness
service: light.turn_on
target:
  entity_id: light.study_ikea_light
data:
  brightness_pct: 75
  color_temp: 370

# Turn off
service: light.turn_off
target:
  entity_id: light.study_ikea_light

# Toggle
service: light.toggle
target:
  entity_id: light.study_ikea_light
```

### Reload Configuration

```yaml
service: homeassistant.reload_config_entry
# Or restart from UI: Developer Tools → Restart
```

---

## 📊 History & Logbook

### View History

**History** → Select entity → View graphs

### Configure Recorder

```yaml
# Add to configuration.yaml for custom retention
recorder:
  purge_keep_days: 7
  exclude:
    domains:
      - automation
    entity_globs:
      - sensor.*_linkquality
```

---

## 🔐 Security Best Practices

### Multi-Factor Authentication

1. **Profile** → **Security**
2. Enable **Multi-Factor Authentication**
3. Scan QR code with authenticator app

### Long-Lived Access Tokens

For API access / scripts:
1. **Profile** → **Long-Lived Access Tokens**
2. Create token with descriptive name
3. Store securely!

### IP Bans

Home Assistant auto-bans IPs after failed login attempts.

View/manage bans:
```bash
cat ~/zigbee/homeassistant/.storage/http.ip_bans
```

---

## 🧰 Debugging

### View Logs

**Settings** → **System** → **Logs**

Or via command line:
```bash
docker logs -f homeassistant
```

### Enable Debug Logging

Add to `configuration.yaml`:
```yaml
logger:
  default: warning
  logs:
    homeassistant.components.mqtt: debug
    homeassistant.components.google_assistant: debug
```

### Check Configuration

```bash
docker exec homeassistant hass --script check_config
```

---

## 🔄 Restart Methods

| Method | When to Use |
|--------|-------------|
| **Quick Reload** | After editing YAML (automations, scripts) |
| **Restart** | After editing configuration.yaml |
| **Hard Restart** | Container issues |

```bash
# Quick reload (from UI)
# Developer Tools → YAML → Reload Location & Customizations

# Restart (from UI)
# Developer Tools → Restart

# Hard restart
docker restart homeassistant
```

---

## 🔗 Next Steps

Home Assistant is configured! Continue to:
→ [Cloudflare Tunnel Setup](./05-cloudflare-tunnel.md)

---

*Last updated: December 2025*
