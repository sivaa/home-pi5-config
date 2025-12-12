# 📱 Device Reference

> Complete guide to all paired devices and how to add new ones.

```
                              ZIGBEE NETWORK MAP
    ┌──────────────────────────────────────────────────────────────────────┐
    │                                                                      │
    │                          ┌───────────────┐                           │
    │                          │  Coordinator  │                           │
    │                          │ (USB Dongle)  │                           │
    │                          └───────┬───────┘                           │
    │                                  │                                   │
    │  ┌───────────────────────────────┼───────────────────────────────┐   │
    │  │         │         │           │           │         │         │   │
    │  ▼         ▼         ▼           ▼           ▼         ▼         ▼   │
    │ ┌─────┐ ┌─────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐ │
    │ │Study│ │Livng│ │Study    │ │Living   │ │    TRH SENSORS (x5)     │ │
    │ │Light│ │Light│ │Remote   │ │Remote   │ ├─────────────────────────┤ │
    │ │ROUT │ │ROUT │ │EndDev   │ │EndDev   │ │ 🛋️ Living  │ 🛏️ Bedroom│ │
    │ └─────┘ └─────┘ └─────────┘ └─────────┘ │ 📚 Study   │ 🍳 Kitchen│ │
    │                                         │ 🚿 Bathroom │            │ │
    │                                         │     (All EndDevice)     │ │
    │                                         └─────────────────────────┘ │
    │                                                                      │
    │   Legend: ROUT = Router (mains powered, extends network)             │
    │           EndDev = End Device (battery powered)                      │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Currently Paired Devices

### 💡 Lights & Remotes

| IEEE Address | Friendly Name | Model | Type | Role | Location |
|--------------|---------------|-------|------|------|----------|
| `0xd0cf5efffe25ab28` | Study Room Light | IKEA FLOALT L1528 | Light | Router | Study |
| `0x90fd9ffffef4cebf` | Study Room Light Remote | IKEA E1524/E1810 | Remote | EndDevice | Study |
| `0xd0cf5efffe24d093` | Living Room Light | IKEA FLOALT L1528 | Light | Router | Living Room |
| `0x90fd9ffffee43106` | Living Room Light Remote | IKEA E1524/E1810 | Remote | EndDevice | Living Room |

### 🌡️ TRH Sensors (Temperature/Relative Humidity)

| # | IEEE Address | Friendly Name | Model | Location |
|---|--------------|---------------|-------|----------|
| 1 | `0xc09b9efffed502b9` | Living Room TRH (1) | Sonoff SNZB-02P | Living Room |
| 2 | `0xc09b9efffef541a8` | Bed Room TRH (2) | Sonoff SNZB-02P | Bedroom |
| 3 | `0xc09b9efffef541b2` | Study Room TRH (3) | Sonoff SNZB-02P | Study |
| 4 | `0xc09b9efffed502b7` | Kitchen TRH (4) | Sonoff SNZB-02P | Kitchen |
| 5 | `0xc09b9efffec0e447` | Bath Room TRH (5) | Sonoff SNZB-02P | Bathroom |

---

## 💡 IKEA FLOALT Light Panel (Study Room Light)

```
┌─────────────────────────────────────────────────────┐
│  IKEA FLOALT Panel 30x90cm (LED1546G12)            │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │                                         │     │
│    │            💡 LED Panel                │     │
│    │                                         │     │
│    │         30cm x 90cm (12" x 36")        │     │
│    │                                         │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│  Features:                                          │
│  ✅ On/Off                                         │
│  ✅ Brightness (1-254)                             │
│  ✅ Color Temperature (250-454 mireds)             │
│  ✅ Acts as Zigbee router                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Specifications

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xd0cf5efffe25ab28` |
| **Model** | IKEA L1528 (FLOALT) |
| **Manufacturer** | IKEA |
| **Power Source** | Mains |
| **Zigbee Role** | Router |
| **Supported Features** | state, brightness, color_temp |

### Home Assistant Entity

| Entity ID | Type | Description |
|-----------|------|-------------|
| `light.study_ikea_light` | Light | Main control |
| `sensor.study_ikea_light_linkquality` | Sensor | Signal strength |

### Google Assistant

| Google Name | Room | Aliases |
|-------------|------|---------|
| Desk Lamp | Study | "study light", "desk light", "ikea light" |

### MQTT Topics

```bash
# State (subscribe)
zigbee2mqtt/study_ikea_light

# Control (publish)
zigbee2mqtt/study_ikea_light/set

# Example payloads
{"state": "ON"}
{"state": "OFF"}
{"brightness": 128}
{"color_temp": 370}
{"state": "ON", "brightness": 200, "color_temp": 300}
```

### Control Examples

```bash
# Turn on
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/set' \
  -m '{"state": "ON"}'

# Set brightness to 50%
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/set' \
  -m '{"brightness": 128}'

# Warm white
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/study_ikea_light/set' \
  -m '{"color_temp": 454}'
```

---

## 🎛️ IKEA TRADFRI Remote (Study Room Light Remote)

```
┌─────────────────────────────────────────────────────┐
│  IKEA TRADFRI 5-Button Remote (E1524/E1810)        │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────┐                   │
│              │       🔆        │  Brightness Up    │
│              │     (dimUp)     │                   │
│              ├────────┬────────┤                   │
│              │   ◀    │   ▶    │  Left / Right    │
│              │(arrow) │(arrow) │                   │
│              ├────────┴────────┤                   │
│              │       ⬤        │  Toggle On/Off   │
│              │    (toggle)     │                   │
│              ├─────────────────┤                   │
│              │       🔅        │  Brightness Down │
│              │   (dimDown)     │                   │
│              └─────────────────┘                   │
│                                                     │
│  Battery: CR2032                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Specifications

| Property | Value |
|----------|-------|
| **IEEE Address** | `0x90fd9ffffef4cebf` |
| **Model** | IKEA E1524/E1810 |
| **Manufacturer** | IKEA |
| **Power Source** | Battery (CR2032) |
| **Zigbee Role** | EndDevice |
| **Battery Life** | ~2 years |

### Button Actions

| Button | Action | MQTT Payload |
|--------|--------|--------------|
| Center | Toggle | `{"action": "toggle"}` |
| Top | Brightness Up | `{"action": "brightness_up_click"}` |
| Top (hold) | Brightness Up (smooth) | `{"action": "brightness_up_hold"}` |
| Bottom | Brightness Down | `{"action": "brightness_down_click"}` |
| Bottom (hold) | Brightness Down (smooth) | `{"action": "brightness_down_hold"}` |
| Left | Left Arrow | `{"action": "arrow_left_click"}` |
| Right | Right Arrow | `{"action": "arrow_right_click"}` |

### MQTT Topic

```bash
# Subscribe to actions
mosquitto_sub -t 'zigbee2mqtt/study_ikea_remote' -v
```

### Binding to Light

The remote can be directly bound to the light for latency-free control:

```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{"from": "study_ikea_remote", "to": "study_ikea_light", "clusters": ["genOnOff", "genLevelCtrl"]}'
```

---

## 💡 IKEA FLOALT Light Panel (Living Room Light)

```
┌─────────────────────────────────────────────────────┐
│  IKEA FLOALT Panel - Living Room                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │                                         │     │
│    │            💡 LED Panel                │     │
│    │                                         │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│  Features:                                          │
│  ✅ On/Off                                         │
│  ✅ Brightness (1-254)                             │
│  ✅ Color Temperature (250-454 mireds)             │
│  ✅ Acts as Zigbee router                          │
│  ✅ Bound to Living Room Remote                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Specifications

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xd0cf5efffe24d093` |
| **Model** | IKEA L1528 (FLOALT) |
| **Manufacturer** | IKEA |
| **Power Source** | Mains |
| **Zigbee Role** | Router |
| **Supported Features** | state, brightness, color_temp |

### Home Assistant Entity

| Entity ID | Type | Description |
|-----------|------|-------------|
| `light.living_room` | Light | Main control |

### Google Assistant

| Google Name | Room | Aliases |
|-------------|------|---------|
| Living Room Light | Living Room | "living light", "living room lamp", "lounge light" |

### MQTT Topics

```bash
# State (subscribe)
zigbee2mqtt/Living Room Light

# Control (publish)
zigbee2mqtt/Living Room Light/set

# Example payloads
{"state": "ON"}
{"state": "OFF"}
{"brightness": 128}
{"color_temp": 370}
```

---

## 🎛️ IKEA TRADFRI Remote (Living Room Light Remote)

```
┌─────────────────────────────────────────────────────┐
│  IKEA TRADFRI 5-Button Remote - Living Room        │
├─────────────────────────────────────────────────────┤
│                                                     │
│              ┌─────────────────┐                   │
│              │       🔆        │  Brightness Up    │
│              ├────────┬────────┤                   │
│              │   ◀    │   ▶    │  Left / Right    │
│              ├────────┴────────┤                   │
│              │       ⬤        │  Toggle On/Off   │
│              ├─────────────────┤                   │
│              │       🔅        │  Brightness Down │
│              └─────────────────┘                   │
│                                                     │
│  Battery: CR2032 (21% remaining)                   │
│  Bound to: Living Room Light                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Specifications

| Property | Value |
|----------|-------|
| **IEEE Address** | `0x90fd9ffffee43106` |
| **Model** | IKEA E1524/E1810 |
| **Manufacturer** | IKEA |
| **Power Source** | Battery (CR2032) |
| **Zigbee Role** | EndDevice |
| **Battery Status** | 21% (consider replacing soon) |

### MQTT Topic

```bash
# Subscribe to actions
mosquitto_sub -t 'zigbee2mqtt/Living Room Light Remote' -v
```

### Binding Status

The remote is directly bound to the Living Room Light:
- **genOnOff** - Toggle on/off
- **genLevelCtrl** - Brightness up/down

---

## 🌡️ Sonoff SNZB-02P TRH Sensors (5 Units)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   SONOFF SNZB-02P TEMPERATURE & HUMIDITY SENSORS            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│   │ ┌──────┐ │   │ ┌──────┐ │   │ ┌──────┐ │   │ ┌──────┐ │   │ ┌──────┐ │ │
│   │ │24.5°C│ │   │ │23.2°C│ │   │ │25.1°C│ │   │ │26.3°C│ │   │ │27.8°C│ │ │
│   │ │ 58%  │ │   │ │ 52%  │ │   │ │ 48%  │ │   │ │ 45%  │ │   │ │ 72%  │ │ │
│   │ └──────┘ │   │ └──────┘ │   │ └──────┘ │   │ └──────┘ │   │ └──────┘ │ │
│   │  [btn]   │   │  [btn]   │   │  [btn]   │   │  [btn]   │   │  [btn]   │ │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘ │
│     🛋️ (1)        🛏️ (2)         📚 (3)        🍳 (4)         🚿 (5)      │
│   Living Room     Bed Room      Study Room     Kitchen       Bath Room    │
│                                                                             │
│   Battery: CR2450  |  Updates: Every 5 min or on change  |  All EndDevice  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hardware Specifications

| Property | Value |
|----------|-------|
| **Model** | Sonoff SNZB-02P |
| **Manufacturer** | Sonoff |
| **Power Source** | Battery (CR2450) |
| **Zigbee Role** | EndDevice |
| **Temperature Range** | -10°C to 60°C |
| **Humidity Range** | 0% to 100% |
| **Accuracy** | ±0.3°C, ±3% RH |
| **Battery Life** | ~1.5-2 years |
| **Display** | LCD (shows temp & humidity) |

---

### Sensor Details by Room

#### 🛋️ Living Room TRH (1)

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xc09b9efffed502b9` |
| **Friendly Name** | Living Room TRH (1) |

| Home Assistant Entity | Type |
|-----------------------|------|
| `sensor.living_room_trh_1_temperature` | Temperature (°C) |
| `sensor.living_room_trh_1_humidity` | Humidity (%) |
| `sensor.living_room_trh_1_battery` | Battery (%) |

---

#### 🛏️ Bed Room TRH (2)

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xc09b9efffef541a8` |
| **Friendly Name** | Bed Room TRH (2) |

| Home Assistant Entity | Type |
|-----------------------|------|
| `sensor.bed_room_trh_2_temperature` | Temperature (°C) |
| `sensor.bed_room_trh_2_humidity` | Humidity (%) |
| `sensor.bed_room_trh_2_battery` | Battery (%) |

---

#### 📚 Study Room TRH (3)

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xc09b9efffef541b2` |
| **Friendly Name** | Study Room TRH (3) |

| Home Assistant Entity | Type |
|-----------------------|------|
| `sensor.study_room_trh_3_temperature` | Temperature (°C) |
| `sensor.study_room_trh_3_humidity` | Humidity (%) |
| `sensor.study_room_trh_3_battery` | Battery (%) |

---

#### 🍳 Kitchen TRH (4)

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xc09b9efffed502b7` |
| **Friendly Name** | Kitchen TRH (4) |

| Home Assistant Entity | Type |
|-----------------------|------|
| `sensor.kitchen_trh_4_temperature` | Temperature (°C) |
| `sensor.kitchen_trh_4_humidity` | Humidity (%) |
| `sensor.kitchen_trh_4_battery` | Battery (%) |

---

#### 🚿 Bath Room TRH (5)

| Property | Value |
|----------|-------|
| **IEEE Address** | `0xc09b9efffec0e447` |
| **Friendly Name** | Bath Room TRH (5) |

| Home Assistant Entity | Type |
|-----------------------|------|
| `sensor.bath_room_trh_5_temperature` | Temperature (°C) |
| `sensor.bath_room_trh_5_humidity` | Humidity (%) |
| `sensor.bath_room_trh_5_battery` | Battery (%) |

---

### MQTT Topics

```bash
# Subscribe to all sensor readings
mosquitto_sub -t 'zigbee2mqtt/Living Room TRH (1)' -v
mosquitto_sub -t 'zigbee2mqtt/Bed Room TRH (2)' -v
mosquitto_sub -t 'zigbee2mqtt/Study Room TRH (3)' -v
mosquitto_sub -t 'zigbee2mqtt/Kitchen TRH (4)' -v
mosquitto_sub -t 'zigbee2mqtt/Bath Room TRH (5)' -v

# Example payload (same for all sensors)
{
  "temperature": 23.5,
  "humidity": 45,
  "battery": 100,
  "linkquality": 90,
  "voltage": 3100
}
```

### Voice Commands (via Google Assistant)

| Command | Example Response |
|---------|------------------|
| "What's the temperature in the living room?" | "The living room is 24.5 degrees" |
| "What's the humidity in the bedroom?" | "The humidity in the bedroom is 52%" |
| "How hot is the kitchen?" | "The kitchen is 26.3 degrees" |
| "Is the bathroom humid?" | "The humidity in the bathroom is 72%" |
| "What's the temperature in the study?" | "The study room is 25.1 degrees" |

### Expected Temperature Ranges (Sydney, Australia)

| Room | Summer Range | Winter Range | Notes |
|------|--------------|--------------|-------|
| Living Room | 22-28°C | 18-24°C | Main living area |
| Bed Room | 20-26°C | 16-22°C | Usually cooler for sleep |
| Study Room | 22-28°C | 18-24°C | Heat from computer equipment |
| Kitchen | 24-32°C | 18-26°C | Cooking adds heat |
| Bath Room | 24-30°C | 20-28°C | Showers increase temp/humidity |

### Ideal Humidity Levels

```
┌────────────────────────────────────────────────────────────────┐
│                    HUMIDITY COMFORT ZONES                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  0%        30%       40%       60%       70%       100%        │
│  ├─────────┼─────────┼─────────┼─────────┼─────────┤          │
│  │  TOO    │  OKAY   │  IDEAL  │  OKAY   │  TOO    │          │
│  │  DRY    │         │  💚     │         │  HUMID  │          │
│  │  ⚠️     │         │         │         │  ⚠️     │          │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘          │
│                                                                 │
│  < 30%: Static electricity, dry skin, respiratory issues       │
│  30-40%: Acceptable but slightly dry                           │
│  40-60%: Optimal comfort zone                                  │
│  60-70%: Acceptable but slightly humid                         │
│  > 70%: Mold risk, condensation, discomfort                    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## ➕ Adding New Devices

### Step 1: Enable Pairing Mode

**Via Web UI:**
1. Open http://dietpi.local:8080
2. Click **Permit Join** button (top right)
3. Wait for countdown (usually 120 seconds)

**Via MQTT:**
```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/permit_join' \
  -m '{"value": true, "time": 120}'
```

### Step 2: Put Device in Pairing Mode

| Device Type | Pairing Method |
|-------------|----------------|
| **IKEA Lights** | Power cycle 6 times quickly |
| **IKEA Remotes** | Open battery cover, press pair button 4x |
| **Sonoff Sensors** | Hold button 5+ seconds |
| **Generic Devices** | Usually hold button until LED flashes |

### Step 3: Verify Pairing

Watch the Zigbee2MQTT logs:
```bash
docker logs -f zigbee2mqtt
```

Should see:
```
Successfully interviewed 'new_device', device has successfully been paired
```

### Step 4: Rename Device

**Via Web UI:**
1. Click on device
2. Edit friendly name
3. Save

**Via MQTT:**
```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/rename' \
  -m '{"from": "0x...", "to": "friendly_name"}'
```

### Step 5: Add to Home Assistant Config

```yaml
# homeassistant/configuration.yaml

google_assistant:
  entity_config:
    light.new_device:
      name: New Device Name
      room: Room Name
```

### Step 6: Sync with Google

Say: **"Hey Google, sync my devices"**

---

## 🔧 Device Management

### Check Device Status

```bash
# Via MQTT
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/status' \
  -m '{"device": "study_ikea_light"}'
```

### Remove Device

```bash
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/remove' \
  -m '{"id": "study_ikea_light"}'
```

### Factory Reset (Most Devices)

| Device | Reset Method |
|--------|--------------|
| IKEA Lights | Power cycle 6x during first 2 sec after power |
| IKEA Remotes | Hold pair button 10+ seconds |
| Sonoff Sensors | Hold button 10+ seconds |

---

## 🔗 Supported Devices

Zigbee2MQTT supports **3000+** devices. Check compatibility:
- https://www.zigbee2mqtt.io/supported-devices/

### Recommended Additions

| Device | Model | Purpose |
|--------|-------|---------|
| **Motion Sensor** | IKEA TRADFRI | Automation triggers |
| **Smart Plug** | Sonoff ZBMINI | Appliance control |
| **Door Sensor** | Aqara MCCGQ11LM | Security |
| **Button** | IKEA STYRBAR | Scene control |

---

*Last updated: December 2025*
