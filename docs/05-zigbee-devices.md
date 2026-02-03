# Zigbee Device Inventory

> **Last Updated:** February 3, 2026
> **Total Devices:** 46 (including coordinator)
> **Purpose:** Complete device reference for disaster recovery

---

## The Network at a Glance

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              ZIGBEE NETWORK MAP                                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│                           ┌──────────────────┐                                        │
│                           │   Coordinator    │                                        │
│                           │  Sonoff V2 USB   │                                        │
│                           │   Channel: 25    │                                        │
│                           └────────┬─────────┘                                        │
│                                    │                                                  │
│  ┌───────┬───────┬───────┬────────┼────────┬───────┬───────┬───────┬───────┬───────┐ │
│  │       │       │       │        │        │       │       │       │       │       │ │
│┌─▼──┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐ ┌──▼──┐ ┌──▼──┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐ ┌─▼───┐ ┌▼──┐│
││IKEA│ │SNOFF│ │NOUS │ │SNOFF│ │ PIR │ │Door │ │Plug │ │SNOFF│ │IKEA │ │Light│ │Bot││
││Lite│ │Temp │ │ E10 │ │06P  │ │ Mtn │ │ Cnt │ │S60ZB│ │TRVZB│ │Rmte │ │Swtch│ │   ││
││(2x)│ │(12x)│ │ CO2 │ │(5x) │ │     │ │(8x) │ │(3x) │ │(4x) │ │(2x) │ │(3x) │ │   ││
│└────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └───┘│
│                                                                                       │
│  ┌─────┐ ┌─────┐                                                                     │
│  │AwoX │ │EGLO │                                                                     │
│  │Light│ │Rmte │                                                                     │
│  │     │ │     │                                                                     │
│  └─────┘ └─────┘                                                                     │
│                                                                                       │
│       Rooms: Balcony, Hallway, Study, Living, Kitchen, Bath, Bed, Mailbox            │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Device List

| # | Room | Friendly Name | Model | Manufacturer | Type |
|---|------|---------------|-------|--------------|------|
| 0 | - | Coordinator | Sonoff Dongle V2 | ITEAD | USB Adapter |
| 1 | Balcony | Temperature & Humidity | SNZB-02WD | SONOFF | Sensor (IP65) |
| 2 | Study | IKEA Remote | E1524/E1810 | IKEA | Remote Control |
| 3 | Study | IKEA Light | L1528 | IKEA | FLOALT Panel 30x90cm |
| 4 | Study | Temperature & Humidity | SNZB-02P | SONOFF | Sensor |
| 5 | Living | IKEA Remote | E1524/E1810 | IKEA | Remote Control |
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
| 29 | Kitchen | [Kitchen] Window Contact Sensor | SNZB-04P | SONOFF | Door/Window Sensor |
| 30 | Study | [Study] Window Contact Sensor - Large | SNZB-04P | SONOFF | Door/Window Sensor |
| 31 | Study | [Study] Window Contact Sensor - Small | SNZB-04P | SONOFF | Door/Window Sensor |
| 32 | Living | [Living] Window Contact Sensor - Balcony Door | SNZB-04P | SONOFF | Door/Window Sensor |
| 33 | Living | [Living] Window Contact Sensor - Window | SNZB-04P | SONOFF | Door/Window Sensor |
| 34 | Hallway | [Hallway] Window Contact Sensor - Main Door | SNZB-04P | SONOFF | Door/Window Sensor |
| 35 | Study | [Study] Light Switch | ZBM5-1C-80/86 | SONOFF | Wall Switch (Router) |
| 36 | Bedroom | [Bed] Light Switch | ZBM5-1C-80/86 | SONOFF | Wall Switch (Router) |
| 37 | Living | [Living] Light Switch | ZBM5-1C-80/86 | SONOFF | Wall Switch (Router) |
| 38 | - | Fingerbot | TS0001_fingerbot | Tuya | Button Pusher |
| 39 | Study | [Study] Human Presence | SNZB-06P | SONOFF | Presence Sensor (mmWave) |
| 40 | Living | [Living] Human Presence | SNZB-06P | SONOFF | Presence Sensor (mmWave) |
| 41 | Kitchen | [Kitchen] Human Presence | SNZB-06P | SONOFF | Presence Sensor (mmWave) |
| 42 | Bath | [Bath] Human Presence | SNZB-06P | SONOFF | Presence Sensor (mmWave) |
| 43 | Bed | [Bed] Human Presence | SNZB-06P | SONOFF | Presence Sensor (mmWave) |
| 44 | Bath | [Bath] Light | 33955 | AwoX | LED Light (Color Temp, Router) |
| 45 | Bath | [Bath] Light Remote | 99099 | EGLO | 3-Group Remote Controller |

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

### SONOFF ZBM5-1C-80/86 - Wall Switch

```
┌─────────────────────────────────────────────────────────────────┐
│              SONOFF ZBM5-1C-80/86 WALL SWITCH                   │
├─────────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                           │
│  Model: ZBM5-1C-80/86                                           │
│  Protocol: Zigbee 3.0                                           │
│  Power: Mains (230V AC)                                         │
│  Type: Router (extends mesh network)                            │
├─────────────────────────────────────────────────────────────────┤
│  Features:                                                      │
│    - On/Off state control                                       │
│    - Power-on behavior (off/on/toggle/previous)                │
│    - Network indicator LED (on/off)                            │
│    - Device work mode (router/end device)                      │
│    - Detach relay mode (for smart load control)                │
│    - OTA firmware updates supported                            │
├─────────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                             │
│    1. Turn off power to the switch                              │
│    2. Turn on power while holding button                        │
│    3. LED flashes rapidly when in pairing mode                  │
│    4. Release button when LED starts blinking                   │
│    5. Interview completes in ~30 seconds                        │
│                                                                 │
│  Factory Reset:                                                 │
│    Hold button for 10+ seconds until LED flashes rapidly       │
│                                                                 │
│  Locations: Study(1), Bed(1), Living(1) = 4 units              │
└─────────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "state": "ON",
  "power_on_behavior": "off",
  "device_work_mode": "Zigbee router",
  "network_indicator": true,
  "detach_relay_mode": {"detach_relay_outlet1": "DISABLE"},
  "linkquality": 164
}
```

---

### Tuya Fingerbot Plus - TS0001_fingerbot

```
┌─────────────────────────────────────────────────────────────────┐
│               TUYA FINGERBOT PLUS (TS0001)                      │
├─────────────────────────────────────────────────────────────────┤
│  Manufacturer: Tuya                                             │
│  Model: TS0001_fingerbot                                        │
│  Protocol: Zigbee 3.0                                           │
│  Power: Battery                                                 │
│  Type: End Device                                               │
├─────────────────────────────────────────────────────────────────┤
│  Features:                                                      │
│    - Switch state (ON/OFF trigger)                             │
│    - Mode: click, switch, program                              │
│    - Upper position (0-50%)                                    │
│    - Lower position (50-100%)                                  │
│    - Delay (0-10 seconds)                                      │
│    - Reverse direction toggle                                  │
│    - Touch enable/disable                                      │
│    - Battery level reporting                                   │
├─────────────────────────────────────────────────────────────────┤
│  Modes:                                                         │
│    - click: Quick press and release                            │
│    - switch: Push and hold (toggle)                            │
│    - program: Custom sequence                                  │
│                                                                 │
│  Pairing Procedure:                                             │
│    1. Press and hold button for 5+ seconds                     │
│    2. LED blinks rapidly                                       │
│    3. Device enters pairing mode                               │
│    4. Interview completes in ~20 seconds                       │
│                                                                 │
│  Factory Reset:                                                 │
│    Same as pairing - hold button 5+ seconds                    │
└─────────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "state": "ON",
  "battery": 85,
  "mode": "click",
  "lower": 85,
  "upper": 0,
  "delay": 0,
  "reverse": "ON",
  "touch": "ON",
  "linkquality": 164
}
```

---

### SONOFF SNZB-06P - Human Presence Sensor (mmWave)

```
┌─────────────────────────────────────────────────────────────────┐
│               SONOFF SNZB-06P PRESENCE SENSOR                    │
├─────────────────────────────────────────────────────────────────┤
│  Manufacturer: SONOFF                                            │
│  Model: SNZB-06P                                                 │
│  Protocol: Zigbee 3.0                                            │
│  Power: USB-C (5V)                                               │
│  Type: End Device (requires mains power but not a router)        │
├─────────────────────────────────────────────────────────────────┤
│  Sensors:                                                        │
│    - Occupancy (human presence via mmWave radar)                │
│    - Illuminance (lux)                                          │
├─────────────────────────────────────────────────────────────────┤
│  Features:                                                       │
│    - 5GHz mmWave radar (detects stationary humans)              │
│    - No PIR blind spots                                         │
│    - Detection range: 4m                                        │
│    - Detection angle: 120°                                      │
│    - Illuminance threshold configurable                         │
│    - Motion sensitivity (low/medium/high)                       │
│    - Presence keep time (15s to 30min)                          │
├─────────────────────────────────────────────────────────────────┤
│  Pairing Procedure:                                              │
│    1. Power on via USB-C                                         │
│    2. Hold button for 5+ seconds                                 │
│    3. LED blinks rapidly when in pairing mode                    │
│    4. Interview completes in ~30 seconds                         │
│                                                                  │
│  Factory Reset:                                                  │
│    Hold button 10+ seconds until LED flashes rapidly             │
│                                                                  │
│  Locations: Study, Living, Kitchen, Bath, Bed (5 units)         │
└─────────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "occupancy": true,
  "illuminance": 156,
  "illuminance_lux": 156,
  "motion_sensitivity": "medium",
  "presence_keep_time": 30,
  "illuminance_threshold": 500,
  "linkquality": 180
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
│    [ ] SONOFF ZBM5 Wall Switch Study - router!              │
│    [ ] SONOFF ZBM5 Wall Switch Bed - router!                │
│    [ ] SONOFF ZBM5 Wall Switch Living - router!             │
│    [ ] AwoX 33955 Bath Light - router!                      │
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
│    [ ] SONOFF SNZB-04P Kitchen Window Contact               │
│    [ ] SONOFF SNZB-04P Study Window Contact - Large         │
│    [ ] SONOFF SNZB-04P Study Window Contact - Small         │
│    [ ] SONOFF SNZB-04P Living Window Contact - Balcony Door │
│    [ ] SONOFF SNZB-04P Living Window Contact - Window       │
│    [ ] SONOFF SNZB-04P Hallway Window Contact - Main Door   │
│    [ ] SONOFF TRVZB Study Thermostat                        │
│    [ ] SONOFF TRVZB Bed Thermostat                          │
│    [ ] SONOFF TRVZB Living Thermostat Inner                 │
│    [ ] SONOFF TRVZB Living Thermostat Outer                 │
│    [ ] IKEA Remote Study                                    │
│    [ ] IKEA Remote Living                                   │
│    [ ] EGLO 99099 Bath Light Remote                         │
│    [ ] HOBEIAN ZG-102ZM Vibration Sensor (optional)         │
│    [ ] Tuya Fingerbot Plus (TS0001_fingerbot)               │
│    [ ] SONOFF SNZB-06P Study Human Presence (USB powered)   │
│    [ ] SONOFF SNZB-06P Living Human Presence (USB powered)  │
│    [ ] SONOFF SNZB-06P Kitchen Human Presence (USB powered) │
│    [ ] SONOFF SNZB-06P Bath Human Presence (USB powered)    │
│    [ ] SONOFF SNZB-06P Bed Human Presence (USB powered)     │
│                                                             │
│  Step 4: Rename all devices with [Room] prefix              │
│                                                             │
│  Step 5: Disable permit_join                                │
│                                                             │
│  Step 6: Set up light bindings (remotes → lights)           │
│    [ ] Bind [Study] IKEA Remote → [Study] IKEA Light        │
│        (genOnOff, genLevelCtrl, genScenes - keep pressing!) │
│    [ ] Bind [Study] IKEA Remote → Coordinator               │
│    [ ] Bind [Living] IKEA Remote → [Living] IKEA Light      │
│        (genOnOff, genLevelCtrl, genScenes - keep pressing!) │
│    [ ] Bind [Living] IKEA Remote → Coordinator              │
│    [ ] Add [Bath] Light to group 32780 (eglo_remote_group1) │
│        (EGLO remote uses factory group, not direct binding) │
│    [ ] Verify EGLO remote controls Bath Light directly      │
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
│  [Study] IKEA Remote ─────────────────→ [Study] IKEA Light                  │
│     ├─ genOnOff (toggle on/off)              └─ L1528 FLOALT 30x90          │
│     ├─ genLevelCtrl (brightness up/down)                                    │
│     └─ genScenes (color temp via arrows)                                    │
│                                                                              │
│  [Study] IKEA Remote ─────────────────→ Coordinator                         │
│     ├─ genOnOff (for HA automations)                                        │
│     └─ genLevelCtrl (for HA automations)                                    │
│                                                                              │
│  [Living] IKEA Remote ────────────────→ [Living] IKEA Light                 │
│     ├─ genOnOff (toggle on/off)              └─ L1529 FLOALT 60x60          │
│     ├─ genLevelCtrl (brightness up/down)                                    │
│     └─ genScenes (color temp via arrows)                                    │
│                                                                              │
│  [Living] IKEA Remote ────────────────→ Coordinator                         │
│     ├─ genOnOff (for HA automations)                                        │
│     └─ genLevelCtrl (for HA automations)                                    │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Button Functions:                                                           │
│    • Center button → Toggle on/off (genOnOff)                               │
│    • Up/Down buttons → Brightness (genLevelCtrl)                            │
│    • Left/Right arrows → Color temp warm↔cold (genScenes)                   │
│                                                                              │
│  Benefits:                                                                   │
│    ✓ Works even if Zigbee2MQTT is down                                      │
│    ✓ Works even if Home Assistant is down                                   │
│    ✓ Works even if the Pi is rebooting                                      │
│    ✓ Faster response time (direct mesh communication)                       │
│    ✓ Coordinator binding enables HA to see button events                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Binding Commands (After Re-Pairing)

**IMPORTANT:** Remote must be kept awake during binding - **keep pressing buttons repeatedly** until binding completes (~15 seconds per binding).

```bash
# =============================================================================
# STUDY REMOTE BINDINGS
# =============================================================================

# 1. Bind Study Remote → Study Light (keep pressing remote!)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Study] IKEA Remote\", \"to\": \"[Study] IKEA Light\", \"clusters\": [\"genOnOff\", \"genLevelCtrl\"]}'"

# 2. Bind Study Remote → Study Light (genScenes for color temp)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Study] IKEA Remote\", \"to\": \"[Study] IKEA Light\", \"clusters\": [\"genScenes\"]}'"

# 3. Bind Study Remote → Coordinator (for HA automations)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Study] IKEA Remote\", \"to\": \"Coordinator\", \"clusters\": [\"genOnOff\", \"genLevelCtrl\"]}'"

# =============================================================================
# LIVING REMOTE BINDINGS
# =============================================================================

# 4. Bind Living Remote → Living Light (keep pressing remote!)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Living] IKEA Remote\", \"to\": \"[Living] IKEA Light\", \"clusters\": [\"genOnOff\", \"genLevelCtrl\"]}'"

# 5. Bind Living Remote → Living Light (genScenes for color temp)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Living] IKEA Remote\", \"to\": \"[Living] IKEA Light\", \"clusters\": [\"genScenes\"]}'"

# 6. Bind Living Remote → Coordinator (for HA automations)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/bind' \
  -m '{\"from\": \"[Living] IKEA Remote\", \"to\": \"Coordinator\", \"clusters\": [\"genOnOff\", \"genLevelCtrl\"]}'"

# =============================================================================
# VERIFICATION
# =============================================================================

# Check binding responses
ssh pi@pi "docker logs zigbee2mqtt 2>&1 | grep 'response/device/bind' | tail -10"

# Monitor remote events (to verify coordinator binding)
ssh pi@pi "timeout 30 docker exec mosquitto mosquitto_sub -v \
  -t 'zigbee2mqtt/[Study] IKEA Remote' \
  -t 'zigbee2mqtt/[Living] IKEA Remote'"

# =============================================================================
# UNBIND (if needed)
# =============================================================================

ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/bridge/request/device/unbind' \
  -m '{\"from\": \"[Study] IKEA Remote\", \"to\": \"[Study] IKEA Light\"}'"
```

### Important: Sleepy Device Wake-Up Protocol

IKEA remotes are "sleepy devices" - they sleep after ~3 seconds to save battery.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️  BINDING WAKE-UP PROTOCOL                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  For EACH binding command:                                                   │
│                                                                              │
│  1. Have the SSH command ready (copied to clipboard)                        │
│  2. Start pressing ANY button on the remote REPEATEDLY                      │
│  3. While still pressing, execute the binding command                       │
│  4. KEEP PRESSING until you see "status":"ok" (~15 seconds)                 │
│                                                                              │
│  If you see "Delivery failed" or "timed out":                               │
│    → Remote went back to sleep → RETRY with faster button pressing          │
│                                                                              │
│  Wait 10 seconds between each binding command.                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Binding Status (Last Updated: 2026-01-08)

| Binding | Status | Clusters |
|---------|--------|----------|
| Study Remote → Study Light | ✅ Active | genOnOff, genLevelCtrl, genScenes |
| Study Remote → Coordinator | ✅ Active | genOnOff, genLevelCtrl |
| Living Remote → Living Light | ✅ Active | genOnOff, genLevelCtrl, genScenes |
| Living Remote → Coordinator | ✅ Active | genOnOff, genLevelCtrl |

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
| 2026-02-03 | Added 2 devices: 1x AwoX 33955 Bath Light (router), 1x EGLO 99099 Bath Remote |
| 2026-02-03 | Set up EGLO remote → Bath Light binding via group 32780 (factory group, works offline) |
| 2026-02-03 | Updated device count: 44 → 46 devices |
| 2026-01-19 | Added 5x SONOFF SNZB-06P human presence sensors (Study, Living, Kitchen, Bath, Bed) |
| 2026-01-19 | Updated device count: 39 → 44 devices |
| 2026-01-19 | Fixed light switch count: was documented as 4, actually 3 (Study, Bed, Living) |
| 2026-01-19 | Synced Z2M configuration.yaml with actual Pi config |
| 2026-01-17 | Added 4 devices: 3x SONOFF ZBM5 wall switches (Study, Bed, Living) + 1x Tuya Fingerbot |
| 2026-01-17 | Updated device count: 35 → 39 devices |
| 2026-01-08 | Re-created IKEA remote bindings: genOnOff, genLevelCtrl, genScenes + Coordinator |
| 2026-01-08 | Updated binding docs with correct device names: `[Study] IKEA Remote`, `[Living] IKEA Remote` |
| 2026-01-08 | Added genScenes cluster for color temperature control via arrow buttons |
| 2025-12-27 | Added 6x SNZB-04P contact sensors (Kitchen, Study×2, Living×2, Hallway Main Door) |
| 2025-12-27 | Updated device count: 29 → 35 devices |
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
