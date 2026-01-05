# Zigbee Network Incident Report - 2026-01-04

## Executive Summary

On January 4, 2026 at 22:42, the Zigbee network experienced a catastrophic failure resulting in the loss of all 35 paired devices. The root cause was database corruption triggered by multiple rapid Docker restart commands combined with a USB timeout. This document details the incident, investigation, recovery efforts, and preventive measures implemented.

---

## Timeline of Events

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INCIDENT TIMELINE - January 4, 2026                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  20:29:19  Z2M started normally                                                 │
│            → "Adapter network matches config"                                   │
│            → All 35 devices loaded                                              │
│                                                                                 │
│  22:41:44  Config files copied to Pi (automations.yaml, configuration.yaml)    │
│  22:41:55  docker compose restart homeassistant zigbee2mqtt                    │
│  22:42:08  docker compose stop homeassistant zigbee2mqtt                       │
│  22:42:11  docker compose start homeassistant zigbee2mqtt                      │
│  22:42:16  docker restart homeassistant zigbee2mqtt                            │
│                                                                                 │
│  22:42:27  USB TIMEOUT: cp210x ttyUSB0 failed (error -110)                     │
│                                                                                 │
│  22:42:29  Z2M starts with CORRUPTED database                                  │
│  22:42:30  "Adapter network does not match config. Leaving network..."         │
│  22:42:31  "Config does not match backup"                                       │
│  22:42:31  "Forming from config" ← POINT OF NO RETURN                          │
│  22:42:32  "NEW NETWORK FORMED!" ← All 35 devices LOST                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Root Cause Analysis

### Primary Cause: Rapid Docker Restart Commands

Four restart-related commands were issued within 21 seconds:
```bash
22:41:55  docker compose restart
22:42:08  docker compose stop
22:42:11  docker compose start
22:42:16  docker restart
```

This created a race condition where the Zigbee coordinator's USB connection was interrupted mid-operation.

### Contributing Factor: USB Timeout

```
Jan 04 22:42:27 pi kernel: cp210x ttyUSB0: failed set request 0x12 status: -110
```

- Error -110 = `ETIMEDOUT` (connection timeout)
- The USB serial connection to the Sonoff Zigbee dongle failed
- This corrupted the database.db file during write operation

### Chain of Events

```
Rapid restart commands
        ↓
USB serial timeout during shutdown
        ↓
database.db truncated/corrupted (561 bytes instead of 55KB)
        ↓
Z2M detected "config does not match backup"
        ↓
Z2M decided to FORM NEW NETWORK (destructive)
        ↓
All 35 devices lost (new network key generated)
```

---

## Technical Details

### Network Parameters

| Parameter | Value |
|-----------|-------|
| Network Key (recovered) | `fad7adda6f486f8e9764d701a7341306` |
| PAN ID | 6754 (0x1a62) |
| Extended PAN ID | dddddddddddddddd |
| Channel | 25 |
| Coordinator IEEE | 0x08b95ffffed8f574 |

### Why Devices Couldn't Auto-Rejoin Initially

1. **Frame Counter Reset**: Coordinator's frame counter reset from ~344,521 to 1
2. **New Trust Center Link Key (TCLK)**: New hash generated when network reformed
3. **Devices still had old credentials**: Couldn't authenticate with new network

### Device Recovery Behavior

| Device Type | Behavior | Recovery Method |
|-------------|----------|-----------------|
| Battery EndDevices | Auto-rejoin on wake cycle | Wait 30-60 min per device |
| Router Devices (Plugs, Lights) | Don't auto-rejoin | Need power cycle |
| IKEA Devices | Sticky to old network | Factory reset required |

---

## Recovery Progress

### January 5, 2026 - Recovery Timeline

| Time | Event | Devices |
|------|-------|---------|
| 03:30 | Network key restored, permit_join enabled | 2 |
| 08:13 | First batch of devices rejoin | 7 |
| 08:25 | [Mailbox] Motion Sensor interview FAILED | 7 |
| 13:16 | 24-hour permit_join script started | 8 |
| 20:14 | More devices auto-rejoin | 18 |

### Current Status (as of 20:24)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  RECOVERY STATUS                                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Devices Recovered: 18 / 35 (51%)                                              │
│                                                                                 │
│  ✅ REJOINED (17 EndDevices):                                                   │
│     [Bed] Temperature & Humidity Sensor 9                                       │
│     [Living] Temperature & Humidity 7                                           │
│     [Study] Thermostat                                                          │
│     [Balcony] Temperature & Humidity                                            │
│     [Study] Window Contact Sensor - Small                                       │
│     [Bed] Thermostat                                                            │
│     [Living] Thermostat Inner                                                   │
│     [Living] Thermostat Outer                                                   │
│     [Study] Window Contact Sensor - Large                                       │
│     [Study] Temperature & Humidity                                              │
│     [Living] Window Contact Sensor - Balcony Door                               │
│     [Living] Window Contact Sensor - Window                                     │
│     [Bed] Window Contact Sensor                                                 │
│     [Bath] Window Contact Sensor                                                │
│     [Kitchen] Window Contact Sensor                                             │
│     [Hallway] Window Contact Sensor - Main Door                                 │
│     [Mailbox] Motion Sensor                                                     │
│                                                                                 │
│  ❌ NOT REJOINED (17 devices):                                                  │
│     Router Devices (need power cycle):                                          │
│       - Smart Plug [1], [2], [3]                                                │
│       - [Study] IKEA Light                                                      │
│       - [Living] IKEA Light                                                     │
│       - [Hallway] CO2 Sensor                                                    │
│       - [Study] Light Switch                                                    │
│                                                                                 │
│     Battery Devices (waiting for wake):                                         │
│       - Remaining temperature sensors (~5)                                      │
│       - IKEA Remotes (2)                                                        │
│       - Vibration Sensor                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Known Issues

1. **Window Sensors showing `contact: null`**: Newly rejoined sensors haven't reported state yet. Fix: Open/close each window to trigger report.

2. **Router devices not rejoining**: Always-on devices don't detect network loss. Fix: Power cycle each router device.

3. **IKEA devices**: May require factory reset (6x power cycle for lights, button sequence for remotes).

---

## Preventive Measures Implemented

### 1. Mobile Alerts (Deployed)

Three new Home Assistant automations:

```yaml
# Alerts when any device successfully joins
- id: zigbee_device_joined_alert
  alias: "Zigbee Device Joined Alert"
  trigger: MQTT event on zigbee2mqtt/bridge/event
  action: notify.all_phones

# Alerts when router devices go offline
- id: zigbee_router_offline_alert
  alias: "Zigbee Router Offline Alert"
  trigger: Router unavailable for 2+ minutes
  action: notify.all_phones (Critical channel)

# Alerts when router devices come back online
- id: zigbee_router_online_alert
  alias: "Zigbee Router Back Online Alert"
  trigger: Router recovers from unavailable
  action: notify.all_phones
```

### 2. 24-Hour Permit Join Script

```bash
# /opt/scripts/keep_permit_join_24h.sh
# Keeps permit_join enabled continuously for device recovery
# Logs device count every 4 minutes
# Location: /tmp/permit_join_monitor.log
```

### 3. Recommended Backup System (To Be Implemented)

| File | Purpose | Backup Frequency |
|------|---------|------------------|
| `coordinator_backup.json` | Frame counter + TCLK | Hourly + before restart |
| `database.db` | Device data | Hourly |
| `configuration.yaml` | Network key + device list | On change |

### 4. Safe Restart Procedure (To Be Implemented)

```bash
# /opt/scripts/safe-z2m-restart.sh
1. Backup coordinator_backup.json and database.db
2. Stop Z2M gracefully (30s timeout)
3. Verify file integrity
4. Wait for USB to settle (5s)
5. Start Z2M
6. Verify startup success
```

---

## Lessons Learned

1. **Never issue rapid restart commands** - Wait at least 30 seconds between operations
2. **USB connection is fragile** - Consider USB extension cable to reduce EMI
3. **coordinator_backup.json is CRITICAL** - Must be backed up regularly
4. **Network key alone isn't enough** - Frame counter and TCLK are equally important
5. **Battery devices auto-recover** - Router devices need manual intervention
6. **Z2M forms new network on corruption** - This is destructive and irreversible

---

## Commands for Monitoring

```bash
# Check device count
ssh pi@pi 'docker exec mosquitto mosquitto_sub -t "zigbee2mqtt/bridge/devices" -C 1 | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d),\"devices\")"'

# Check permit_join log
ssh pi@pi "tail -20 /tmp/permit_join_monitor.log"

# Watch for new device joins
ssh pi@pi "docker logs -f zigbee2mqtt 2>&1 | grep -E 'joined|interview'"

# Check specific sensor state
ssh pi@pi 'docker logs zigbee2mqtt --tail 50 2>&1 | grep "contact"'
```

---

## Files Modified

| File | Change |
|------|--------|
| `configs/homeassistant/automations.yaml` | Added 3 Zigbee monitoring automations |
| `/opt/scripts/keep_permit_join_24h.sh` | Created permit_join keepalive script |
| `/opt/zigbee2mqtt/data/configuration.yaml` | Network key explicitly set |

---

## References

- [Zigbee Frame Counter Security](https://docs.digi.com/resources/documentation/digidocs/90002002/concepts/c_zb_frame_counter.htm)
- [Silicon Labs TCLK Documentation](https://www.silabs.com/community/wireless/zigbee-and-thread/forum.topic.html/tclk_is_not_resetw-AO4V)
- [Zigbee2MQTT Pairing Guide](https://www.zigbee2mqtt.io/guide/usage/pairing_devices.html)

---

*Report generated: 2026-01-05 20:25 CET*
*Author: Claude Code (automated investigation)*
