# Zigbee Dongle Setup

> **Last Updated:** December 12, 2025
> **Status:** Hardware detected and ready for Zigbee coordinator software
>
> **Note:** The network now has 49 devices (48 + coordinator). This doc covers the dongle hardware setup only. For the full device inventory, see [docs/05-zigbee-devices.md](05-zigbee-devices.md).

---

## The Story

```
    ┌──────────────────────────────────────────────────────────────┐
    │                                                              │
    │    🔌 USB Port ──► 📡 Zigbee Dongle ──► 🏠 Smart Home       │
    │                                                              │
    │    The bridge between your Pi and hundreds of Zigbee        │
    │    devices: lights, sensors, switches, and more!            │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
```

We connected a **Sonoff Zigbee 3.0 USB Dongle Plus V2** to the Pi. This dongle
acts as a **Zigbee Coordinator** - the brain that manages all your Zigbee smart
home devices.

---

## Device Identification

### Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZIGBEE DONGLE INFO                           │
├─────────────────────────────────────────────────────────────────┤
│  Device:     Sonoff Zigbee 3.0 USB Dongle Plus V2              │
│  Maker:      Itead                                              │
│  Chip:       Silicon Labs CP210x UART Bridge                    │
│  Vendor ID:  10c4                                               │
│  Product ID: ea60                                               │
├─────────────────────────────────────────────────────────────────┤
│  Serial:     76e8abf6fd73ef1197c4c274d9b539e6                  │
│  Device:     /dev/ttyUSB0                                       │
│  Speed:      Full Speed USB 2.0 (12Mbps)                        │
│  Power:      100mA (Bus Powered)                                │
└─────────────────────────────────────────────────────────────────┘
```

### Persistent Device Path (Use This!)

```bash
# This path survives reboots and USB reconnections
/dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_76e8abf6fd73ef1197c4c274d9b539e6-if00-port0
```

> **Why use this?** The `/dev/ttyUSB0` path can change if you plug in other
> USB devices. The `/dev/serial/by-id/` path is based on the device's unique
> serial number and never changes.

---

## Evidence: How We Verified This

### 1. USB Device Detection

```bash
$ lsusb
Bus 003 Device 002: ID 10c4:ea60 Silicon Labs CP210x UART Bridge
```

### 2. Kernel Messages (dmesg)

```bash
$ dmesg | grep -i sonoff
usb 3-1: Product: Sonoff Zigbee 3.0 USB Dongle Plus V2
usb 3-1: Manufacturer: Itead
usb 3-1: SerialNumber: 76e8abf6fd73ef1197c4c274d9b539e6
usb 3-1: cp210x converter now attached to ttyUSB0
```

### 3. Serial Port Created

```bash
$ ls -la /dev/ttyUSB0
crw-rw---- 1 root dialout 188, 0 Dec 12 15:39 /dev/ttyUSB0

$ ls -la /dev/serial/by-id/
usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_76e8abf6fd73ef1197c4c274d9b539e6-if00-port0 -> ../../ttyUSB0
```

### 4. User Permissions Verified

```bash
$ groups pi
pi : pi adm dialout cdrom sudo audio video plugdev games users input render netdev spi i2c gpio
```

The `pi` user is in the `dialout` group, which has access to serial devices.

### 5. Kernel Module Loaded

```bash
$ lsmod | grep cp210
cp210x                 49152  0
usbserial              81920  1 cp210x
```

---

## Device Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HARDWARE STACK                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    USB 2.0     ┌──────────────────────────────┐  │
│  │              │ ◄────────────► │ Sonoff Zigbee 3.0 Dongle V2  │  │
│  │  Raspberry   │                │                              │  │
│  │    Pi 5      │                │  ┌────────────────────────┐  │  │
│  │              │                │  │ CP210x USB-UART Bridge │  │  │
│  │  Bus 003     │                │  └──────────┬─────────────┘  │  │
│  │  Port 3-1    │                │             │                │  │
│  └──────────────┘                │  ┌──────────▼─────────────┐  │  │
│                                  │  │ Silicon Labs EFR32     │  │  │
│                                  │  │ Zigbee 3.0 SoC         │  │  │
│                                  │  └──────────┬─────────────┘  │  │
│                                  │             │                │  │
│                                  │      ┌──────▼──────┐         │  │
│                                  │      │  Antenna    │         │  │
│                                  │      │   📡        │         │  │
│                                  └──────┴─────────────┴─────────┘  │
│                                                                      │
│                                  2.4 GHz Zigbee Network             │
│                                         │                            │
│                           ┌─────────────┼─────────────┐              │
│                           ▼             ▼             ▼              │
│                        💡           🌡️            🚪           │
│                       Bulbs       Sensors       Switches            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Zigbee Device Inventory

> **Purpose:** Track all devices for disaster recovery. If you need to re-pair
> everything after a reset, this is your checklist!

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        YOUR ZIGBEE NETWORK                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                            📡 Coordinator                                │
│                      Sonoff Zigbee 3.0 Dongle                           │
│                               │                                          │
│       ┌───────────┬───────────┼───────────┬───────────┐                 │
│       │           │           │           │           │                  │
│       ▼           ▼           ▼           ▼           ▼                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Sensors │ │ Climate │ │  Safety │ │ Lights  │ │ Remotes │           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │           │                  │
│  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐           │
│  │ Temp/   │ │ Heater  │ │  CO2    │ │  IKEA   │ │  IKEA   │           │
│  │ Humid   │ │  TRV    │ │ Monitor │ │ Ceiling │ │ Circle  │           │
│  ├─────────┤ └─────────┘ └─────────┘ │ Light x2│ │Remote x2│           │
│  │ Motion  │                         └─────────┘ └─────────┘           │
│  ├─────────┤                                                            │
│  │ Door    │                                                            │
│  ├─────────┤                                                            │
│  │Vibration│                                                            │
│  └─────────┘                                                            │
│                                                                          │
│  Total: 49 devices (48 + coordinator) - see docs/05 for full list      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

> **Note:** This table reflects the initial setup (Dec 2025). For the current full device list (49 devices), see [docs/05-zigbee-devices.md](05-zigbee-devices.md).

### Device List

| # | Device | Brand | Type | Purpose | Status |
|---|--------|-------|------|---------|--------|
| 1 | Temperature & Humidity Sensor | Sonoff | SNZB-02P / SNZB-02WD | Climate monitoring | Pending setup |
| 2 | Door/Window Sensor | Sonoff | SNZB-04 (likely) | Entry detection | Pending setup |
| 3 | Motion Sensor | Sonoff | SNZB-03 (likely) | Presence detection | Pending setup |
| 4 | CO2 Monitor | Nous | NOUS E10 | Air quality monitoring | Pending setup |
| 5 | Vibration Sensor | Sonoff | DW2 / Other | Vibration/tilt detection | Pending setup |
| 6 | Thermostatic Radiator Valve | Sonoff | TRVZB | Heater control | Pending setup |
| 7 | Ceiling Light #1 | IKEA | TRADFRI | Lighting | Pending setup |
| 8 | Ceiling Light #2 | IKEA | TRADFRI | Lighting | Pending setup |
| 9 | Circle Remote #1 | IKEA | STYRBAR/TRADFRI | Light control | Pending setup |
| 10 | Circle Remote #2 | IKEA | STYRBAR/TRADFRI | Light control | Pending setup |

### Device Categories

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ENVIRONMENTAL SENSORS                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  🌡️ Temp/Humidity Sensor          📊 CO2 Monitor                        │
│  ├─ Reports: Temperature           ├─ Reports: CO2 ppm                   │
│  ├─ Reports: Humidity %            ├─ Reports: Temperature               │
│  └─ Battery powered                ├─ Reports: Humidity                  │
│                                    └─ USB powered (usually)              │
│                                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  SECURITY SENSORS                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  🚪 Door/Window Sensor             👋 Motion Sensor                      │
│  ├─ Reports: Open/Closed           ├─ Reports: Motion detected           │
│  ├─ Magnetic reed switch           ├─ PIR sensor                         │
│  └─ Battery powered                └─ Battery powered                    │
│                                                                           │
│  📳 Vibration Sensor                                                      │
│  ├─ Reports: Vibration detected                                          │
│  ├─ Reports: Tilt angle (some models)                                    │
│  └─ Battery powered                                                       │
│                                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  CLIMATE CONTROL                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  🔥 Thermostatic Radiator Valve (TRV)                                    │
│  ├─ Controls: Radiator flow                                              │
│  ├─ Reports: Current temperature                                         │
│  ├─ Accepts: Target temperature                                          │
│  └─ Battery powered                                                       │
│                                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│  LIGHTING                                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  💡 IKEA TRADFRI Ceiling Light (x2)    🎛️ IKEA Circle Remote (x2)       │
│  ├─ Controls: On/Off, Brightness       ├─ Controls: Paired light(s)      │
│  ├─ Possibly: Color temperature        ├─ Buttons: On/Off, Dim +/-       │
│  ├─ Acts as Zigbee ROUTER              ├─ Battery powered                │
│  └─ Mains powered                      └─ Can bind directly to lights    │
│                                                                           │
│  NOTE: Mains-powered lights act as Zigbee routers, extending your        │
│        network range and improving reliability!                           │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recovery: Re-pairing Devices

When disaster strikes and you need to re-pair all devices:

1. **Put coordinator in pairing mode** (via Zigbee2MQTT web UI or CLI)
2. **For each device, trigger pairing:**

| Device Type | How to Pair |
|------------|-------------|
| Sonoff Sensors | Hold button 5+ seconds until LED blinks |
| Sonoff TRV | Hold button until display shows pairing icon |
| Nous CO2 | Check manual (usually hold button) |
| IKEA TRADFRI Light | Turn on/off 6 times quickly (on-off-on-off-on-off) |
| IKEA Circle Remote | Hold pairing button (inside battery cover) 10+ sec |

3. **After pairing:** Update device names and assign to rooms
4. **Re-create automations** that depend on these devices

> **Note:** This table only covers the original 10 devices. Pairing procedures for all 49 devices (including ZBM5 wall switches, SNZB-06P presence sensors, AwoX/EGLO lights, Aqara T1M, and more) are documented in [docs/05-zigbee-devices.md](05-zigbee-devices.md).

---

## Next Steps: Coordinator Software

The dongle is just hardware. You need software to make it useful:

### Option 1: Zigbee2MQTT (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZIGBEE2MQTT STACK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Zigbee    │───►│ Zigbee2MQTT │───►│    MQTT Broker      │ │
│  │   Dongle    │    │  (Node.js)  │    │    (Mosquitto)      │ │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘ │
│                                                    │            │
│                                        ┌───────────┴──────────┐│
│                                        ▼                      ▼││
│                                  ┌──────────┐          ┌──────────┐│
│                                  │Home      │          │ Node-RED │││
│                                  │Assistant │          │          │││
│                                  └──────────┘          └──────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Option 2: ZHA (Home Assistant Native)

If using Home Assistant, ZHA (Zigbee Home Automation) integration can use
this dongle directly.

---

## Recovery Information

### If Dongle Not Detected After Reboot

1. **Check physical connection:**
   ```bash
   lsusb | grep 10c4
   ```

2. **Check kernel messages:**
   ```bash
   dmesg | tail -20
   ```

3. **Verify kernel module:**
   ```bash
   sudo modprobe cp210x
   ```

4. **Check permissions:**
   ```bash
   ls -la /dev/ttyUSB*
   sudo usermod -aG dialout $USER
   # Then logout and login again
   ```

### If Device Path Changes

Always use the persistent path in your configurations:
```
/dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_76e8abf6fd73ef1197c4c274d9b539e6-if00-port0
```

---

## Device Specifications

| Specification | Value |
|--------------|-------|
| Model | Sonoff Zigbee 3.0 USB Dongle Plus V2 |
| Manufacturer | Itead |
| Chipset | Silicon Labs EFR32MG21 |
| USB Interface | CP210x UART Bridge |
| Zigbee Protocol | Zigbee 3.0 |
| Frequency | 2.4 GHz |
| USB Version | 2.0 Full Speed (12 Mbps) |
| Power | 100mA (Bus Powered) |
| Antenna | External (included) |
| Firmware | Pre-flashed (Coordinator ready) |

---

## Supported Software

This dongle works with:

| Software | Type | Notes |
|----------|------|-------|
| Zigbee2MQTT | Bridge | Most popular, huge device support |
| ZHA (Home Assistant) | Integration | Native HA integration |
| deCONZ | Gateway | With Phoscon app |
| OpenHAB | Binding | Via Zigbee binding |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-12 | Added IKEA lights and remotes (now 10 devices) |
| 2025-12-12 | Added device inventory (6 devices) |
| 2025-12-12 | Initial setup: Dongle detected and documented |
