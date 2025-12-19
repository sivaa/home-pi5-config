# Zigbee Device Inventory

> **Last Updated:** December 19, 2025
> **Total Devices:** 29 (including coordinator)
> **Purpose:** Complete device reference for disaster recovery

---

## The Network at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ZIGBEE NETWORK MAP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ┌──────────────────┐                                  │
│                        │   Coordinator    │                                  │
│                        │  Sonoff V2 USB   │                                  │
│                        │   Channel: 25    │                                  │
│                        └────────┬─────────┘                                  │
│                                 │                                            │
│  ┌──────────┬──────────┬───────┼───────┬──────────┬──────────┬──────────┐  │
│  │          │          │       │       │          │          │          │  │
│┌─▼──┐ ┌───▼───┐ ┌───▼───┐ ┌──▼──┐ ┌──▼──┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐│  │
││IKEA│ │SONOFF │ │ NOUS  │ │ PIR │ │Door │ │ Plug  │ │SONOFF │ │ IKEA  ││  │
││Lite│ │ Temp  │ │  E10  │ │ Mtn │ │ Cnt │ │ S60ZB │ │ TRVZB │ │Remote ││  │
││(2x)│ │ (12x) │ │  CO2  │ │     │ │(2x) │ │ (3x)  │ │ (4x)  │ │ (2x)  ││  │
│└────┘ └───────┘ └───────┘ └─────┘ └─────┘ └───────┘ └───────┘ └───────┘│  │
│                                                                              │
│      Rooms: Balcony, Hallway, Study, Living, Kitchen, Bath, Bed, Mailbox    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Device List

| # | Room | Friendly Name | Model | Manufacturer | Type |
|---|------|---------------|-------|--------------|------|
| 0 | - | Coordinator | Sonoff Dongle V2 | ITEAD | USB Adapter |
| 1 | Balcony | Temperature & Humidity | SNZB-02WD | SONOFF | Sensor (IP65) |
| 2 | Study | Light Remote | E1524/E1810 | IKEA | Remote Control |
| 3 | Study | IKEA Light | L1528 | IKEA | FLOALT Panel 30x90cm |
| 4 | Study | Temperature & Humidity | SNZB-02P | SONOFF | Sensor |
| 5 | Living | Light Remote | E1524/E1810 | IKEA | Remote Control |
| 6 | Living | IKEA Light | L1529 | IKEA | FLOALT Panel 60x60cm |
| 7 | Living | Temperature & Humidity | SNZB-02P | SONOFF | Sensor |
| 8 | Kitchen | Temperature & Humidity | SNZB-02P | SONOFF | Sensor |
| 9 | Bath | Temperature & Humidity | SNZB-02P | SONOFF | Sensor |
| 10 | Bed | Temperature & Humidity | SNZB-02P | SONOFF | Sensor |
| 11 | Hallway | [Hallway] CO2 | E10 | NOUS | CO2 Detector |
| 12 | Mailbox | [Mailbox] Motion Sensor | SNZB-03P | SONOFF | PIR Motion Sensor |
| 13 | - | Smart Plug [1] | S60ZBTPF | SONOFF | Smart Plug (Energy) |
| 14 | - | Smart Plug [2] | S60ZBTPF | SONOFF | Smart Plug (Energy) |
| 15 | - | Smart Plug [3] | S60ZBTPF | SONOFF | Smart Plug (Energy) |
| 16 | Bath | [Bath] Window Contact Sensor | SNZB-04P | SONOFF | Door/Window Sensor |
| 17 | Bed | [Bed] Window Contact Sensor | SNZB-04P | SONOFF | Door/Window Sensor |
| 18 | - | Vibration Sensor | ZG-102ZM | HOBEIAN | Vibration Sensor |
| 19 | Living | Temperature & Humidity 6 | SNZB-02P | SONOFF | Sensor |
| 20 | Living | Temperature & Humidity 7 | SNZB-02P | SONOFF | Sensor |
| 21 | Study | Temperature & Humidity 8 | SNZB-02P | SONOFF | Sensor |
| 22 | Bed | Temperature & Humidity 9 | SNZB-02P | SONOFF | Sensor |
| 23 | Kitchen | Temperature & Humidity 10 | SNZB-02P | SONOFF | Sensor |
| 24 | Bath | Temperature & Humidity 11 | SNZB-02P | SONOFF | Sensor |
| 25 | Study | [Study] Thermostat | TRVZB | SONOFF | Radiator Valve |
| 26 | Bed | [Bed] Thermostat | TRVZB | SONOFF | Radiator Valve |
| 27 | Living | [Living] Thermostat Inner | TRVZB | SONOFF | Radiator Valve |
| 28 | Living | [Living] Thermostat Outer | TRVZB | SONOFF | Radiator Valve |

---

## Device Details

### NOUS E10 - CO2 Detector

```
┌─────────────────────────────────────────────────────────────┐
│                     NOUS E10 CO2 SENSOR                      │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: NOUS (Tuya-based)                            │
│  Model: E10                                                 │
│  Protocol: Zigbee 3.0                                       │
│  Power: USB-C (5V)                                          │
│  Display: LCD screen                                        │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                   │
│    - CO2 (ppm) with NDIR sensor                            │
│    - Temperature (°C)                                       │
│    - Humidity (%)                                           │
│    - Air Quality (excellent/moderate/poor)                  │
│                                                             │
│  Features:                                                  │
│    - Configurable alarm (melody_1, melody_2, OFF)          │
│    - Backlight brightness (1-3)                            │
│    - Battery state indicator                                │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Hold button on BACK for 10+ seconds                   │
│    2. Screen shows Zigbee icon blinking                     │
│    3. Device auto-enters pairing mode                       │
│    4. Interview completes in ~30 seconds                    │
│                                                             │
│  Factory Reset (if previously paired):                      │
│    Same as pairing - hold back button 10+ seconds           │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "co2": 1422,
  "temperature": 23,
  "humidity": 54,
  "air_quality": "moderate",
  "battery_state": "high",
  "alarm_ringtone": "OFF",
  "backlight_mode": 1,
  "linkquality": 200
}
```

---

### SONOFF SNZB-02P - Temperature & Humidity Sensor

```
┌─────────────────────────────────────────────────────────────┐
│                   SONOFF SNZB-02P SENSOR                     │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                       │
│  Model: SNZB-02P                                            │
│  Protocol: Zigbee 3.0                                       │
│  Power: CR2477 battery                                      │
│  Size: Compact, no display                                  │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                   │
│    - Temperature (°C) with calibration                     │
│    - Humidity (%) with calibration                         │
│    - Battery level (%)                                      │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Press and hold button for 5 seconds                   │
│    2. LED blinks rapidly (3 times)                          │
│    3. Release and device enters pairing mode                │
│                                                             │
│  Locations: Study(2), Living(3), Kitchen(2), Bath(2),      │
│             Bed(2), Balcony(1) = 12 units total             │
└─────────────────────────────────────────────────────────────┘
```

---

### SONOFF SNZB-02WD - Waterproof Sensor with Display

```
┌─────────────────────────────────────────────────────────────┐
│                  SONOFF SNZB-02WD SENSOR                     │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                       │
│  Model: SNZB-02WD                                           │
│  Protocol: Zigbee 3.0                                       │
│  Power: 2x AAA batteries                                    │
│  Rating: IP65 (waterproof)                                  │
│  Display: LCD screen (temp/humidity)                        │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                   │
│    - Temperature (°C/°F switchable)                        │
│    - Humidity (%)                                           │
│    - Voltage (mV)                                           │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Press button on back for 5+ seconds                   │
│    2. Display shows pairing icon                            │
│    3. Device enters pairing mode                            │
│                                                             │
│  Location: Balcony (outdoor use)                           │
└─────────────────────────────────────────────────────────────┘
```

---

### IKEA TRADFRI Remote Control (E1524/E1810)

```
┌─────────────────────────────────────────────────────────────┐
│                  IKEA TRADFRI REMOTE                         │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: IKEA                                         │
│  Model: E1524/E1810                                         │
│  Protocol: Zigbee 3.0                                       │
│  Power: CR2032 battery                                      │
│  Buttons: 5 (on/off, brightness, left/right)               │
├─────────────────────────────────────────────────────────────┤
│  Actions:                                                   │
│    - toggle (center button)                                 │
│    - brightness_up_click / brightness_up_hold              │
│    - brightness_down_click / brightness_down_hold          │
│    - arrow_left_click / arrow_right_click                  │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Open battery compartment                              │
│    2. Press pair button 4 times quickly                     │
│    3. LED blinks red                                        │
│    4. Device enters pairing mode                            │
│                                                             │
│  Binding: Can be bound directly to IKEA lights             │
│  Locations: Study, Living (2 units)                        │
└─────────────────────────────────────────────────────────────┘
```

---

### IKEA FLOALT Light Panels

```
┌─────────────────────────────────────────────────────────────┐
│                   IKEA FLOALT PANELS                         │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: IKEA                                         │
│  Models:                                                    │
│    - L1528: 30x90 cm (Study)                               │
│    - L1529: 60x60 cm (Living)                              │
│  Protocol: Zigbee 3.0                                       │
│  Power: Mains (LED driver)                                  │
│  Type: White spectrum (warm to cool)                        │
├─────────────────────────────────────────────────────────────┤
│  Features:                                                  │
│    - Brightness control (0-100%)                           │
│    - Color temperature (2200K-4000K)                       │
│    - OTA firmware updates                                  │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Turn off power at switch                              │
│    2. Turn on power                                         │
│    3. Within 2 seconds, turn off and on 6 times            │
│    4. Light dims and brightens to confirm pairing mode     │
│                                                             │
│  Alternative: Use IKEA TRADFRI remote to reset             │
│  Locations: Study (L1528), Living (L1529)                  │
└─────────────────────────────────────────────────────────────┘
```

---

### SONOFF SNZB-03P - PIR Motion Sensor

```
┌─────────────────────────────────────────────────────────────┐
│                  SONOFF SNZB-03P PIR SENSOR                  │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                       │
│  Model: SNZB-03P                                            │
│  Protocol: Zigbee 3.0                                       │
│  Power: CR2477 battery                                      │
│  Detection: 110° FOV, 6m range                              │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                   │
│    - Occupancy (motion detection)                          │
│    - Illumination (dim/bright)                             │
│    - Battery level (%)                                      │
│    - Motion timeout (configurable)                         │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Press and hold button for 5 seconds                   │
│    2. LED blinks rapidly                                    │
│    3. Release - device enters pairing mode                  │
│                                                             │
│  Factory Reset:                                             │
│    Hold button 10+ seconds until LED blinks 3 times         │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "battery": 100,
  "illumination": "dim",
  "occupancy": true,
  "motion_timeout": null,
  "linkquality": 220,
  "voltage": 3200
}
```

---

### SONOFF S60ZBTPF - Smart Plug with Energy Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│               SONOFF S60ZBTPF SMART PLUG                     │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                       │
│  Model: S60ZBTPF                                            │
│  Protocol: Zigbee 3.0                                       │
│  Power: Mains (acts as Zigbee router)                       │
│  Max Load: 16A / 3680W                                      │
├─────────────────────────────────────────────────────────────┤
│  Features:                                                  │
│    - On/Off switching                                       │
│    - Energy monitoring (W, kWh)                            │
│    - Voltage monitoring (V)                                │
│    - Current monitoring (A)                                │
│    - Daily/Monthly energy tracking                         │
│    - Overload protection                                   │
│    - Power-on behavior (ON/OFF/RESTORE)                    │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Press and hold button for 5 seconds                   │
│    2. LED blinks rapidly                                    │
│    3. Release - device enters pairing mode                  │
│                                                             │
│  Note: Being mains-powered, this acts as a Zigbee router   │
│        improving mesh network coverage                      │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "state": "OFF",
  "voltage": 227.14,
  "current": 0,
  "power": 0,
  "energy": 0,
  "energy_today": 0,
  "energy_month": 0,
  "power_on_behavior": "off",
  "linkquality": 255
}
```

---

### SONOFF SNZB-04P - Contact Sensor

```
┌─────────────────────────────────────────────────────────────┐
│                SONOFF SNZB-04P CONTACT SENSOR                │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                       │
│  Model: SNZB-04P                                            │
│  Protocol: Zigbee 3.0                                       │
│  Power: CR2032 battery                                      │
│  Use: Door/window open/close detection                      │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                   │
│    - Contact (true=closed, false=open)                     │
│    - Tamper detection (cover removed)                      │
│    - Battery level (%)                                      │
│    - Battery low warning                                   │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                         │
│    1. Press and hold button for 5 seconds                   │
│    2. LED blinks rapidly                                    │
│    3. Release - device enters pairing mode                  │
│                                                             │
│  Factory Reset:                                             │
│    Hold button 10+ seconds until LED blinks 3 times         │
│                                                             │
│  Installation:                                              │
│    Mount main unit on door frame, magnet on door            │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "battery": 100,
  "battery_low": false,
  "contact": false,
  "tamper": true,
  "linkquality": 255,
  "voltage": 3200
}
```

---

### SONOFF SNZB-03P - Mailbox Motion Sensor

```
┌─────────────────────────────────────────────────────────────┐
│              SONOFF SNZB-03P MOTION SENSOR (MAILBOX)         │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                        │
│  Model: SNZB-03P                                             │
│  Protocol: Zigbee 3.0                                        │
│  Power: CR2477 battery                                       │
│  Use: Mailbox motion detection                               │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                    │
│    - Occupancy (true/false)                                  │
│    - Battery level (%)                                       │
│    - Illumination (bright/dim)                               │
├─────────────────────────────────────────────────────────────┤
│  Detection Specs:                                            │
│    - Detection angle: 110°                                   │
│    - Detection range: 6 meters                               │
│    - Motion timeout: 5 seconds (configurable)                │
├─────────────────────────────────────────────────────────────┤
│  How it Works:                                               │
│    - PIR sensor detects motion at mailbox                    │
│    - Triggers occupancy=true when motion detected            │
│    - Auto-resets after motion timeout                        │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                          │
│    1. Press and hold button for 5+ seconds                   │
│    2. LED blinks rapidly                                     │
│    3. Device enters pairing mode                             │
│                                                              │
│  Factory Reset:                                              │
│    Hold button 10+ seconds until LED blinks 3 times          │
│                                                              │
│  Installation:                                               │
│    Mount inside mailbox facing the opening                   │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "battery": 100,
  "occupancy": false,
  "illumination": "dim",
  "motion_timeout": 5,
  "linkquality": 180
}
```

---

### SONOFF TRVZB - Zigbee Radiator Valve (Thermostat)

```
┌─────────────────────────────────────────────────────────────┐
│                  SONOFF TRVZB THERMOSTAT                     │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                        │
│  Model: TRVZB                                                │
│  Protocol: Zigbee 3.0                                        │
│  Power: 2x AA batteries                                      │
│  Type: Thermostatic Radiator Valve (TRV)                    │
├─────────────────────────────────────────────────────────────┤
│  Features:                                                   │
│    - Local temperature sensing                               │
│    - Valve position control (0-100%)                        │
│    - Frost protection                                        │
│    - Child lock                                             │
│    - Window open detection                                  │
│    - Boost mode                                             │
├─────────────────────────────────────────────────────────────┤
│  Controls:                                                   │
│    - occupied_heating_setpoint: Target temperature          │
│    - local_temperature: Current room temperature            │
│    - running_state: heat / idle                             │
│    - pi_heating_demand: Valve position percentage           │
│    - system_mode: off / heat                                │
├─────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                          │
│    1. Remove batteries and re-insert                         │
│    2. Device automatically enters pairing mode               │
│    3. LED blinks during pairing                              │
│                                                              │
│  Factory Reset:                                              │
│    Hold both buttons (+ and -) for 10 seconds                │
│                                                              │
│  Installation:                                               │
│    Replace existing radiator valve head                      │
│    Includes adapters for common valve types                  │
│                                                              │
│  Locations: Study(1), Bed(1), Living(2) = 4 units           │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "battery": 100,
  "child_lock": "UNLOCK",
  "frost_protection": "OFF",
  "local_temperature": 21.5,
  "local_temperature_calibration": 0,
  "occupied_heating_setpoint": 22,
  "pi_heating_demand": 45,
  "running_state": "heat",
  "system_mode": "heat",
  "window_detection": false,
  "linkquality": 200
}
```

---

## Disaster Recovery Checklist

If rebuilding the Zigbee network from scratch:

```
┌─────────────────────────────────────────────────────────────┐
│               DEVICE RE-PAIRING ORDER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Enable permit_join in Zigbee2MQTT                  │
│                                                             │
│  Step 2: Pair mains-powered devices FIRST (routers)         │
│    [ ] IKEA FLOALT Study (L1528)                            │
│    [ ] IKEA FLOALT Living (L1529)                           │
│    [ ] SONOFF Smart Plug [1] (S60ZBTPF) - router!           │
│    [ ] SONOFF Smart Plug [2] (S60ZBTPF) - router!           │
│    [ ] SONOFF Smart Plug [3] (S60ZBTPF) - router!           │
│    [ ] NOUS E10 CO2 sensor (USB powered)                    │
│                                                             │
│  Step 3: Pair battery devices (end devices)                 │
│    [ ] SONOFF SNZB-02WD Balcony                             │
│    [ ] SONOFF SNZB-02P Study (x2)                           │
│    [ ] SONOFF SNZB-02P Living (x3)                          │
│    [ ] SONOFF SNZB-02P Kitchen (x2)                         │
│    [ ] SONOFF SNZB-02P Bath (x2)                            │
│    [ ] SONOFF SNZB-02P Bed (x2)                             │
│    [ ] SONOFF SNZB-03P Mailbox Motion Sensor                │
│    [ ] SONOFF SNZB-04P Bath Window Contact                  │
│    [ ] SONOFF SNZB-04P Bed Window Contact                   │
│    [ ] SONOFF TRVZB Study Thermostat                        │
│    [ ] SONOFF TRVZB Bed Thermostat                          │
│    [ ] SONOFF TRVZB Living Thermostat Inner                 │
│    [ ] SONOFF TRVZB Living Thermostat Outer                 │
│    [ ] IKEA Remote Study                                    │
│    [ ] IKEA Remote Living                                   │
│    [ ] HOBEIAN ZG-102ZM Vibration Sensor (optional)         │
│                                                             │
│  Step 4: Rename all devices with [Room] prefix              │
│                                                             │
│  Step 5: Disable permit_join                                │
│                                                             │
│  Step 6: Set up light bindings (remotes → lights)           │
│    [ ] Wake [Study] Light Remote (press button)             │
│    [ ] Bind [Study] Light Remote → [Study] IKEA Light       │
│    [ ] Wake [Living] Light Remote (press button)            │
│    [ ] Bind [Living] Light Remote → [Living] IKEA Light     │
│                                                             │
│  Step 7: Verify bindings work (test toggle/brightness)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Direct Device Binding (Remote → Light)

Direct binding allows IKEA remotes to control lights **without Zigbee2MQTT** or Home Assistant. The remote communicates directly with the light via Zigbee mesh.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DIRECT ZIGBEE BINDINGS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Study] Light Remote ────────────────→ [Study] IKEA Light                  │
│     └─ genOnOff (toggle)                     └─ L1528 FLOALT 30x90          │
│     └─ genLevelCtrl (brightness)                                            │
│                                                                              │
│  [Living] Light Remote ───────────────→ [Living] IKEA Light                 │
│     └─ genOnOff (toggle)                     └─ L1529 FLOALT 60x60          │
│     └─ genLevelCtrl (brightness)                                            │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Benefits:                                                                   │
│    ✓ Works even if Zigbee2MQTT is down                                      │
│    ✓ Works even if Home Assistant is down                                   │
│    ✓ Works even if the Pi is rebooting                                      │
│    ✓ Faster response time (direct mesh communication)                       │
│                                                                              │
│  Bound Clusters:                                                             │
│    • genOnOff - Toggle light on/off (center button)                         │
│    • genLevelCtrl - Brightness up/down (side buttons)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Binding Commands

```bash
# Bind remote to light (remote must be AWAKE - press a button first!)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Study] Light Remote\", \"to\": \"[Study] IKEA Light\", \"clusters\": [\"genOnOff\", \"genLevelCtrl\"]}'"

ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Living] Light Remote\", \"to\": \"[Living] IKEA Light\", \"clusters\": [\"genOnOff\", \"genLevelCtrl\"]}'"

# Check existing bindings
ssh pi@pi "docker logs zigbee2mqtt 2>&1 | grep -i 'bound cluster'"

# Unbind (if needed)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/unbind' \
  -m '{\"from\": \"[Study] Light Remote\", \"to\": \"[Study] IKEA Light\"}'"
```

### Important: Sleepy Device Wake-Up

IKEA remotes are "sleepy devices" - they sleep to save battery. To bind:

1. **Press any button on the remote** to wake it up
2. **Immediately send the bind command** (within 2-3 seconds)
3. If binding fails with "Delivery failed", the remote went back to sleep - try again

---

## Quick Reference - Pairing Commands

```bash
# Enable pairing mode
ssh pi@pi "docker exec mosquitto mosquitto_pub -t 'zigbee2mqtt/bridge/request/permit_join' -m '{\"value\": true, \"time\": 254}'"

# Disable pairing mode
ssh pi@pi "docker exec mosquitto mosquitto_pub -t 'zigbee2mqtt/bridge/request/permit_join' -m '{\"value\": false}'"

# List all devices
ssh pi@pi "docker exec mosquitto mosquitto_sub -t 'zigbee2mqtt/bridge/devices' -C 1" | python3 -m json.tool

# Check specific device
ssh pi@pi "docker exec mosquitto mosquitto_sub -t 'zigbee2mqtt/[DEVICE_NAME]' -C 1"
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-20 | Re-paired IKEA lights and remotes after network issues |
| 2025-12-20 | Set up direct Zigbee bindings: remotes → lights (genOnOff + genLevelCtrl) |
| 2025-12-20 | Added Direct Device Binding section with commands |
| 2025-12-19 | Added 4x SONOFF TRVZB thermostats (Study, Bed, Living x2) |
| 2025-12-19 | Added 2x Smart Plugs [2] and [3], 1x Bed Window Contact Sensor |
| 2025-12-19 | Renamed: CO2 → [Hallway] CO2, Contact Sensor 1 → [Bath] Window Contact |
| 2025-12-19 | Updated device count: 22 → 29 devices |
| 2025-12-18 | Replaced mailbox vibration sensor with SONOFF SNZB-03P motion sensor |
| 2025-12-16 | Added HOBEIAN ZG-102ZM mailbox vibration sensor |
| 2025-12-16 | Added 6 new SNZB-02P temperature sensors (total now 11) |
| 2025-12-16 | Updated device count: 15 → 22 devices |
| 2025-12-12 | Added SONOFF SNZB-04P contact sensor |
| 2025-12-12 | Added SONOFF SNZB-03P PIR sensor, SONOFF S60ZBTPF smart plug |
| 2025-12-12 | Added NOUS E10 CO2 sensor |
| 2025-12-12 | Initial device inventory created |
