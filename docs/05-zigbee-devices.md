# Zigbee Device Inventory

> **Last Updated:** December 16, 2025
> **Total Devices:** 22 (including coordinator)
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
││IKEA│ │SONOFF │ │ NOUS  │ │ PIR │ │Door │ │ Plug  │ │Mailbox│ │ IKEA  ││  │
││Lite│ │ Temp  │ │  E10  │ │ Mtn │ │ Cnt │ │ S60ZB │ │ Vibra │ │Remote ││  │
││(2x)│ │ (12x) │ │  CO2  │ │     │ │     │ │       │ │       │ │ (2x)  ││  │
│└────┘ └───────┘ └───────┘ └─────┘ └─────┘ └───────┘ └───────┘ └───────┘│  │
│                                                                              │
│        Rooms: Balcony, Study, Living, Kitchen, Bath, Bed, Mailbox           │
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
| 11 | Living | CO2 | E10 | NOUS | CO2 Detector |
| 12 | - | Motion Detector | SNZB-03P | SONOFF | PIR Motion Sensor |
| 13 | - | Smart Plug 1 | S60ZBTPF | SONOFF | Smart Plug (Energy) |
| 14 | - | Contact Sensor 1 | SNZB-04P | SONOFF | Door/Window Sensor |
| 15 | Mailbox | Vibration Sensor | ZG-102ZM | HOBEIAN | Vibration Sensor |
| 16 | Living | Temperature & Humidity 6 | SNZB-02P | SONOFF | Sensor |
| 17 | Living | Temperature & Humidity 7 | SNZB-02P | SONOFF | Sensor |
| 18 | Study | Temperature & Humidity 8 | SNZB-02P | SONOFF | Sensor |
| 19 | Bed | Temperature & Humidity 9 | SNZB-02P | SONOFF | Sensor |
| 20 | Kitchen | Temperature & Humidity 10 | SNZB-02P | SONOFF | Sensor |
| 21 | Bath | Temperature & Humidity 11 | SNZB-02P | SONOFF | Sensor |

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
│             Bed(2) = 11 units total                         │
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

### HOBEIAN ZG-102ZM - Mailbox Vibration Sensor

```
┌─────────────────────────────────────────────────────────────┐
│              HOBEIAN ZG-102ZM VIBRATION SENSOR               │
├─────────────────────────────────────────────────────────────┤
│  Manufacturer: HOBEIAN                                       │
│  Model: ZG-102ZM                                             │
│  Protocol: Zigbee 3.0                                        │
│  Power: CR2032 battery                                       │
│  Use: Mailbox notification / vibration detection             │
├─────────────────────────────────────────────────────────────┤
│  Sensors:                                                    │
│    - Vibration (true/false)                                  │
│    - Sensitivity (0-100, adjustable)                         │
│    - Battery level (%)                                       │
│    - Battery voltage (mV)                                    │
├─────────────────────────────────────────────────────────────┤
│  How it Works:                                               │
│    - Detects vibration when mailbox lid opens/closes         │
│    - Triggers vibration=true event                           │
│    - Auto-resets after motion stops                          │
│                                                              │
│  Sensitivity Tuning:                                         │
│    - Higher value = more sensitive                           │
│    - Default: 50                                              │
│    - Adjust via Zigbee2MQTT web UI                           │
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
│    Mount inside mailbox lid using adhesive                   │
└─────────────────────────────────────────────────────────────┘
```

**Example MQTT Payload:**
```json
{
  "battery": 100,
  "vibration": false,
  "sensitivity": 50,
  "linkquality": 152
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
│    [ ] SONOFF Smart Plug (S60ZBTPF) - acts as router!       │
│    [ ] NOUS E10 CO2 sensor (USB powered)                    │
│                                                             │
│  Step 3: Pair battery devices (end devices)                 │
│    [ ] SONOFF SNZB-02WD Balcony                             │
│    [ ] SONOFF SNZB-02P Study (x2)                           │
│    [ ] SONOFF SNZB-02P Living (x3)                          │
│    [ ] SONOFF SNZB-02P Kitchen (x2)                         │
│    [ ] SONOFF SNZB-02P Bath (x2)                            │
│    [ ] SONOFF SNZB-02P Bed (x2)                             │
│    [ ] SONOFF SNZB-03P Motion Detector                      │
│    [ ] SONOFF SNZB-04P Contact Sensor                       │
│    [ ] HOBEIAN ZG-102ZM Mailbox Vibration Sensor            │
│    [ ] IKEA Remote Study                                    │
│    [ ] IKEA Remote Living                                   │
│                                                             │
│  Step 4: Rename all devices with [Room] prefix              │
│                                                             │
│  Step 5: Disable permit_join                                │
│                                                             │
│  Step 6: Set up light bindings (remotes → lights)           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

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
| 2025-12-16 | Added HOBEIAN ZG-102ZM mailbox vibration sensor |
| 2025-12-16 | Added 6 new SNZB-02P temperature sensors (total now 11) |
| 2025-12-16 | Updated device count: 15 → 22 devices |
| 2025-12-12 | Added SONOFF SNZB-04P contact sensor |
| 2025-12-12 | Added SONOFF SNZB-03P PIR sensor, SONOFF S60ZBTPF smart plug |
| 2025-12-12 | Added NOUS E10 CO2 sensor |
| 2025-12-12 | Initial device inventory created |
