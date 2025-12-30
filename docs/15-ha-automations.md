# Home Assistant Automations

> **Last Updated:** 2025-12-30
> **Total Automations:** 23
> **File:** `configs/homeassistant/automations.yaml`

---

## Quick Reference

| Category | Count | Purpose |
|----------|-------|---------|
| [Mailbox Alerts](#-mailbox-alerts) | 2 | Motion detection & sensor status |
| [CO2 Monitoring](#-co2-monitoring) | 3 | Air quality alerts & ventilation reminders |
| [Window Alerts](#-window-open-alerts) | 2 | Bathroom & bedroom window open too long |
| [Heater Notifications](#-heater-notifications) | 8 | Start/stop notifications for all 4 heaters |
| [Thermostat Audit](#-thermostat-audit) | 1 | Track all setpoint changes |
| [Window-Heater Safety](#-window-heater-safety) | 5 | Auto-shutoff when windows open + prevention |
| [Cold Weather Alert](#-cold-weather-alert) | 1 | Remind to close windows when cold |
| [TTS Logging](#-tts-logging) | 1 | Publish TTS events to MQTT for dashboard |

---

## Automation Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         HOME ASSISTANT AUTOMATION SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SENSORS                          AUTOMATIONS                    OUTPUTS        │
│  ───────                          ───────────                    ───────        │
│                                                                                 │
│  ┌─────────────┐                                                                │
│  │ Mailbox PIR │─────────────────► Mailbox Motion Alert ──────► TTS + Mobile   │
│  └─────────────┘                                                                │
│                                                                                 │
│  ┌─────────────┐                  ┌─────────────────────┐                       │
│  │ CO2 Sensor  │─────────────────►│ >1200: High Alert   │──────► TTS + Mobile   │
│  │ (Hallway)   │                  │ >1600: Critical     │                       │
│  └─────────────┘                  │ <500:  All Clear    │                       │
│                                   └─────────────────────┘                       │
│                                                                                 │
│  ┌─────────────┐                  ┌─────────────────────┐                       │
│  │ 8 Contact   │─────────────────►│ Door: 2min delay    │──────► Turn OFF      │
│  │ Sensors     │                  │ Window: 30s delay   │        heaters       │
│  │ (doors +    │                  │ All closed: Resume  │──────► Turn ON       │
│  │  windows)   │                  │ 15min + <18°C: Alert│        heaters       │
│  └─────────────┘                  └─────────────────────┘                       │
│                                                                                 │
│  ┌─────────────┐                                                                │
│  │ 4 TRV       │─────────────────► Heater Start/Stop ─────────► Mobile Push    │
│  │ Thermostats │─────────────────► Setpoint Audit ────────────► Mobile Push    │
│  └─────────────┘                                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Notification Channels

| Channel | Priority | Used By |
|---------|----------|---------|
| `Critical` | Max (vibrate) | CO2 critical, window-heater safety, main door |
| `Alerts` | High | Mailbox, window open, CO2 high |
| `Heater` | Default | Heater start/stop |
| `Audit` | High | Thermostat setpoint changes |
| `Info` | Default | Sensor online, all windows closed |

---

## Detailed Automation Reference

### 📬 Mailbox Alerts

#### 1. Mailbox Motion Alert
| Property | Value |
|----------|-------|
| **ID** | `mailbox_motion_alert` |
| **Trigger** | Motion detected (`binary_sensor.motion_detector_occupancy` → on) |
| **Quiet Hours** | 23:00 - 06:00 (no announcements) |
| **Cooldown** | 30 seconds |
| **Action** | TTS on all 3 speakers + mobile notification |

#### 2. Mailbox Sensor Online
| Property | Value |
|----------|-------|
| **ID** | `mailbox_sensor_online` |
| **Trigger** | Sensor changes from `unavailable`/`unknown` to available |
| **Quiet Hours** | 23:00 - 06:00 |
| **Action** | TTS on all 3 speakers + mobile notification |

---

### 🌬️ CO2 Monitoring

#### 3. CO2 High Level Alert
| Property | Value |
|----------|-------|
| **ID** | `co2_high_alert` |
| **Trigger** | CO2 > 1200 ppm OR HA startup (if already high) |
| **Hours** | 07:00 - 23:00 only |
| **Cooldown** | 10 minutes |
| **Action** | TTS on kitchen display + mobile notification |
| **Message** | "Nithya, the Criuse Owner, please ventilate..." |

#### 4. CO2 Critical Level Alert
| Property | Value |
|----------|-------|
| **ID** | `co2_critical_alert` |
| **Trigger** | Every 5 minutes check OR immediate when > 1600 ppm |
| **Hours** | **24/7 (no quiet hours - safety critical)** |
| **Action** | TTS + mobile notification with vibration pattern |
| **Message** | "Warning! CO2 level is critical... Please open windows immediately!" |

#### 5. CO2 Good Level Notification
| Property | Value |
|----------|-------|
| **ID** | `co2_good_level` |
| **Trigger** | CO2 drops below 500 ppm |
| **Condition** | Only if high/critical alert was triggered within 2 hours |
| **Cooldown** | 30 minutes |
| **Action** | TTS thanking for ventilating + mobile notification |
| **Message** | "Thanks Nithya! Air quality is good now. Ventilated in X minutes." |

---

### 🪟 Window Open Alerts

#### 6. Bathroom Window Open Too Long
| Property | Value |
|----------|-------|
| **ID** | `bath_window_open_too_long` |
| **Trigger** | Bathroom window open for 10+ minutes |
| **Action** | TTS every 1 minute + mobile notification (until closed) |

#### 7. Bedroom Window Open Too Long
| Property | Value |
|----------|-------|
| **ID** | `bed_window_open_too_long` |
| **Trigger** | Bedroom window open for 10+ minutes |
| **Action** | TTS every 1 minute + mobile notification (until closed) |

---

### 🔥 Heater Notifications

All heater notifications send mobile push only (no TTS).

| # | ID | Heater | Trigger | Title |
|---|---|--------|---------|-------|
| 8 | `study_heater_started` | Study | hvac_action → heating | 🔥 Study Heater ON |
| 9 | `study_heater_stopped` | Study | hvac_action → idle | ❄️ Study Heater OFF |
| 10 | `living_inner_heater_started` | Living Inner | hvac_action → heating | 🔥 Living Inner Heater ON |
| 11 | `living_inner_heater_stopped` | Living Inner | hvac_action → idle | ❄️ Living Inner Heater OFF |
| 12 | `living_outer_heater_started` | Living Outer | hvac_action → heating | 🔥 Living Outer Heater ON |
| 13 | `living_outer_heater_stopped` | Living Outer | hvac_action → idle | ❄️ Living Outer Heater OFF |
| 14 | `bed_heater_started` | Bedroom | hvac_action → heating | 🔥 Bedroom Heater ON |
| 15 | `bed_heater_stopped` | Bedroom | hvac_action → idle | ❄️ Bedroom Heater OFF |

---

### 📊 Thermostat Audit

#### 16. Thermostat Setpoint Changed (Audit)
| Property | Value |
|----------|-------|
| **ID** | `thermostat_setpoint_changed_audit` |
| **Trigger** | Any temperature setpoint change on any of 4 thermostats |
| **Mode** | Parallel (tracks all changes simultaneously) |
| **Action** | Mobile notification with old→new values and timestamp |
| **Purpose** | Catch rogue temperature changes from unknown sources |

---

### 🏠 Window-Heater Safety

These automations protect against heating waste when windows/doors are open.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         WINDOW-HEATER SAFETY FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DOOR OPENS (Balcony/Main)          WINDOW OPENS (Any of 6)                     │
│       │                                    │                                    │
│       ▼                                    ▼                                    │
│  ┌──────────┐                        ┌──────────┐                               │
│  │ Wait 2   │                        │ Wait 30  │                               │
│  │ minutes  │                        │ seconds  │                               │
│  └──────────┘                        └──────────┘                               │
│       │                                    │                                    │
│       │ (still open?)                      │ (still open?)                      │
│       ▼                                    ▼                                    │
│  ┌──────────────────────────────────────────────────────────────────┐           │
│  │ 1. SAVE current setpoints to input_number entities               │           │
│  │ 2. SAVE current HVAC mode to input_boolean entities              │           │
│  │ 3. TURN OFF all 4 heaters + TTS + mobile notification            │           │
│  └──────────────────────────────────────────────────────────────────┘           │
│                                                                                 │
│                         ALL WINDOWS/DOORS CLOSED                                │
│                                    │                                            │
│                                    ▼                                            │
│                    ┌────────────────────────────────────────────┐               │
│                    │ 1. RESTORE HVAC mode from input_boolean    │               │
│                    │ 2. Reset open_window flag via MQTT         │               │
│                    │ 3. RESTORE setpoints from input_number     │               │
│                    │ 4. TTS + mobile notification               │               │
│                    └────────────────────────────────────────────┘               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Why Temperature Save/Restore is Needed

The Sonoff TRVZB thermostats have firmware behavior that causes setpoint loss:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TRVZB FIRMWARE BEHAVIOR (The Problem)                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  When system_mode is set to "off":                                              │
│                                                                                 │
│    ┌─────────────────┐                                                          │
│    │ Thermostat at   │                                                          │
│    │ 18°C, mode=heat │                                                          │
│    └────────┬────────┘                                                          │
│             │                                                                   │
│             │  climate.set_hvac_mode: off                                       │
│             ▼                                                                   │
│    ┌─────────────────────────────────────┐                                      │
│    │ TRVZB firmware automatically:       │                                      │
│    │  • Sets open_window: "ON"           │                                      │
│    │  • Drops setpoint to 7°C            │  ← SETPOINT LOST!                    │
│    │    (frost_protection_temperature)   │                                      │
│    └─────────────────────────────────────┘                                      │
│                                                                                 │
│  Without save/restore, turning heater back ON would use 7°C setpoint!           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 17. Door Open 2min - Turn Off All Heaters
| Property | Value |
|----------|-------|
| **ID** | `door_open_turn_off_heaters` |
| **Trigger** | Balcony door OR main door open for 2 minutes |
| **Mode** | Parallel (max: 2) |
| **Action** | Turn OFF all 4 heaters, TTS on all speakers, mobile notification |
| **Cancellation** | If door closes within 2 min, NO action taken |

#### 18. Window Open 30s - Turn Off All Heaters
| Property | Value |
|----------|-------|
| **ID** | `window_open_turn_off_heaters` |
| **Sensors** | Bath, Bed, Kitchen, Study Large, Study Small, Living windows |
| **Trigger** | Any window open for 30 seconds |
| **Mode** | Parallel (max: 6) |
| **Action** | Turn OFF all 4 heaters, TTS on all speakers, mobile notification |
| **Cancellation** | If window closes within 30s, NO action taken |

#### 19. All Windows Closed - Resume Heaters
| Property | Value |
|----------|-------|
| **ID** | `all_windows_closed_resume_heaters` |
| **Trigger** | Any contact sensor closes |
| **Condition** | ALL 8 sensors must be closed |
| **Action** | Turn ON all heaters (heat mode), TTS, mobile notification |

#### 20. Main Door Open Too Long - Repeat Alert
| Property | Value |
|----------|-------|
| **ID** | `main_door_open_too_long` |
| **Trigger** | Main door open for 3+ minutes |
| **Action** | TTS every 5 minutes until closed + mobile notification |
| **Note** | Does NOT affect heaters (handled by door_open_turn_off_heaters) |

---

### 🥶 Cold Weather Alert

#### 21. Window Open Cold Weather Alert
| Property | Value |
|----------|-------|
| **ID** | `window_open_cold_weather_alert` |
| **Trigger** | Any of 8 sensors open for 15+ minutes |
| **Condition** | Balcony temperature < 18°C |
| **Mode** | Parallel (max: 8) |
| **Action** | TTS on kitchen display every 2 minutes |
| **Stops When** | Window closes OR temperature rises ≥18°C |
| **Message** | "Attention! {window} has been open for a long time and it's {temp} degrees outside." |

#### 22. Prevent Heating If Window Open
| Property | Value |
|----------|-------|
| **ID** | `prevent_heating_if_window_open` |
| **Trigger** | Any thermostat enters "heating" state (hvac_action → heating) |
| **Condition** | At least one window/door sensor is open |
| **Mode** | Parallel (max: 4) |
| **Action** | Save heater state → Turn off that heater → TTS + mobile notification |
| **Purpose** | Prevents heaters from starting while windows are open |
| **Note** | Does NOT set guard flag - allows window_open timer to save ALL heaters |

---

### 📢 TTS Logging

#### 23. TTS Event MQTT Publisher
| Property | Value |
|----------|-------|
| **ID** | `tts_event_mqtt_publisher` |
| **Trigger** | Any call to `tts.google_translate_say` service |
| **Mode** | Parallel (max: 10) |
| **Action** | Publish event to `dashboard/tts` MQTT topic |
| **Fields** | timestamp, message, devices, availability status |
| **Purpose** | Dashboard logging of all TTS announcements |

---

## Entity Reference

### Contact Sensors (8 total)

| Entity ID | Location | Type |
|-----------|----------|------|
| `binary_sensor.bath_window_contact_sensor_contact` | Bathroom | Window |
| `binary_sensor.bed_window_contact_sensor_contact` | Bedroom | Window |
| `binary_sensor.kitchen_window_contact_sensor_contact` | Kitchen | Window |
| `binary_sensor.study_window_contact_sensor_large_contact` | Study | Window (large) |
| `binary_sensor.study_window_contact_sensor_small_contact` | Study | Window (small) |
| `binary_sensor.living_window_contact_sensor_window_contact` | Living Room | Window |
| `binary_sensor.living_window_contact_sensor_balcony_door_contact` | Living Room | Balcony Door |
| `binary_sensor.hallway_window_contact_sensor_main_door_contact` | Hallway | Main Door |

### Thermostats (4 total)

| Entity ID | Location |
|-----------|----------|
| `climate.study_thermostat` | Study |
| `climate.living_thermostat_inner` | Living Room (inner wall) |
| `climate.living_thermostat_outer` | Living Room (outer wall) |
| `climate.bed_thermostat` | Bedroom |

### Media Players (TTS targets)

| Entity ID | Location |
|-----------|----------|
| `media_player.kitchen_display` | Kitchen |
| `media_player.broken_display` | Living Room |
| `media_player.master_bedroom_clock` | Bedroom |

### Other Sensors

| Entity ID | Purpose |
|-----------|---------|
| `sensor.hallway_co2_co2` | CO2 level (ppm) |
| `sensor.balcony_temperature_humidity_temperature` | Outdoor temperature reference |
| `binary_sensor.motion_detector_occupancy` | Mailbox motion sensor |

### State Memory (input_boolean)

Used to remember heater states before window-triggered shutoff:

| Entity ID | Purpose |
|-----------|---------|
| `input_boolean.study_heater_was_on` | Was Study heater on before shutoff? |
| `input_boolean.living_inner_heater_was_on` | Was Living Inner heater on? |
| `input_boolean.living_outer_heater_was_on` | Was Living Outer heater on? |
| `input_boolean.bedroom_heater_was_on` | Was Bedroom heater on? |
| `input_boolean.heaters_off_due_to_window` | Guard flag to prevent state overwrite |

### Saved Setpoints (input_number)

Used to save thermostat setpoints before window-triggered shutoff (TRVZB firmware drops setpoint to 7°C frost protection when turned off):

| Entity ID | Purpose | Range |
|-----------|---------|-------|
| `input_number.study_heater_saved_temp` | Study setpoint backup | 5-22°C |
| `input_number.living_inner_heater_saved_temp` | Living Inner setpoint backup | 5-22°C |
| `input_number.living_outer_heater_saved_temp` | Living Outer setpoint backup | 5-22°C |
| `input_number.bedroom_heater_saved_temp` | Bedroom setpoint backup | 5-22°C |

---

## Troubleshooting

### Automation Not Firing

1. Check HA logs: `docker logs homeassistant | grep automation_id`
2. Verify entity states in Developer Tools → States
3. Check if conditions are met (time, cooldown, etc.)
4. Reload automations: Developer Tools → YAML → Reload Automations

### TTS Not Working

1. Verify media player is available: `media_player.kitchen_display`
2. Check Google Home integration status
3. Test with Developer Tools → Services → `tts.google_translate_say`

### Heaters Not Resuming

1. Check ALL 8 contact sensors are showing "off" state
2. Look for stuck sensors (battery dead, out of range)
3. Manually call `climate.set_hvac_mode` with `heat` to verify thermostats respond

### Heaters Resume But Wrong Temperature

This happens when TRVZB firmware drops setpoint to frost protection (7°C).

1. Check `input_number.*_saved_temp` entities have correct values
2. Verify `open_window` flag is "OFF" on thermostats (check via Zigbee2MQTT)
3. Manual fix via MQTT:
   ```bash
   docker exec mosquitto mosquitto_pub \
     -t "zigbee2mqtt/[Study] Thermostat/set" \
     -m '{"system_mode": "heat", "occupied_heating_setpoint": 18, "open_window": "OFF"}'
   ```
4. Check automation logs: `docker logs homeassistant 2>&1 | grep all_windows_closed`

---

## Complete Heating Scenarios Matrix

This section documents all possible heating scenarios and their expected behaviors across both layers of protection.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HEATING CONTROL LAYERS                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 1: HA Automations (Event-Driven, ~1s response)                     │   │
│  │  ├─ window_open_turn_off_heaters (30s delay for windows)                │   │
│  │  ├─ door_open_turn_off_heaters (2min delay for doors)                   │   │
│  │  ├─ prevent_heating_if_window_open (immediate block)                    │   │
│  │  └─ all_windows_closed_resume_heaters (auto-restore)                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                            │
│                                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ LAYER 2: Heater Watchdog (Poll-Based, 5min intervals)                    │   │
│  │  ├─ Independent Python service running in Docker                        │   │
│  │  ├─ Catches anything Layer 1 might miss                                 │   │
│  │  ├─ Survives HA restarts                                                │   │
│  │  └─ Hybrid approach: Safety first, best-effort state save              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Category A: Normal Operation

| # | Scenario | Trigger | Expected Behavior | Status |
|---|----------|---------|-------------------|--------|
| A1 | Heater reaches target | localTemp >= targetTemp | running_state → idle, notification sent | ✅ Working |
| A2 | User adjusts setpoint via dashboard | MQTT command | Setpoint changes, audit logged | ✅ Working |
| A3 | User toggles power via dashboard | MQTT mode command | Mode changes, event logged | ✅ Working |
| A4 | User adjusts setpoint via HA | climate.set_temperature | Setpoint changes, audit notification | ✅ Working |
| A5 | Heater starts heating | Temp drops below setpoint | running_state → heat, notification sent | ✅ Working |

### Category B: Window/Door Safety

| # | Scenario | Trigger | Expected Behavior | Status |
|---|----------|---------|-------------------|--------|
| B1 | Window opens, heater ON | Window sensor → on | Wait 30s → save state → turn off → TTS + notify | ✅ Working |
| B2 | Door opens, heater ON | Door sensor → on | Wait 2min → save state → turn off → TTS + notify | ✅ Working |
| B3 | Window closes within 30s | Window sensor → off | Timer cancelled, no action | ✅ Working |
| B4 | All windows close | Last sensor → off | Restore modes → reset flags → restore temps → TTS | ✅ Working |
| B5 | Heater tries to start, window open | hvac_action → heating | Save state → turn off that heater → TTS + notify | ✅ Fixed |
| B6 | Multiple windows open | 2nd window opens | Guard flag prevents duplicate save action | ✅ Working |
| B7 | Door + Window open together | Both open | First to timeout triggers; guard blocks other | ✅ Working |
| B8 | Window open > 15min, cold outside | Open + temp < 18°C | Cold weather alert every 2min | ✅ Working |

### Category C: State Recovery

| # | Scenario | Trigger | Expected Behavior | Status |
|---|----------|---------|-------------------|--------|
| C1 | Resume after window shutoff | All sensors closed | Setpoints restored to saved values | ✅ Working |
| C2 | HA restarts during window shutoff | HA container restart | Guard flag preserved (no initial:) | ✅ Fixed |
| C3 | Watchdog detects violation | 5-min poll | Save state → turn off → notify with status | ✅ Fixed |
| C4 | Partial sensor failure | 1 sensor unavailable | Resume blocked, heaters stay off | ⚠️ Edge case |
| C5 | Power outage during shutoff | Pi loses power | All state lost, heaters boot to last known | ℹ️ Known limitation |

### Category D: Dashboard Control

| # | Scenario | Trigger | Expected Behavior | Status |
|---|----------|---------|-------------------|--------|
| D1 | Dashboard offline | MQTT disconnected | Controls disabled, stale indicator | ✅ Working |
| D2 | Thermostat leaves network | Zigbee device_leave | Critical alert, multi-channel notification | ✅ Working |
| D3 | Low battery warning | Battery < 20% | Event logged, shown in timeline | ✅ Working |
| D4 | Critical battery | Battery < 10% | Alert priority event | ✅ Working |
| D5 | User tries to heat with window open | Dashboard mode=heat | HA blocks if valve opens | ✅ Working |

### Category E: Watchdog Scenarios

| # | Scenario | Trigger | Expected Behavior | Status |
|---|----------|---------|-------------------|--------|
| E1 | Normal check, no violation | 5-min poll | Log "OK", continue | ✅ Working |
| E2 | Violation detected | Window open + heating | Save state (best-effort) → turn off → notify | ✅ Fixed |
| E3 | HA unreachable | Network/container issue | Retry once, then fail | ✅ Working |
| E4 | Token expired | Invalid auth | HTTP 401, exit | ✅ Working |
| E5 | State save fails during violation | HA API slow | Turn off heaters → notify with "manual intervention required" | ✅ Fixed |

### Edge Cases & Known Limitations

#### EDGE-1: Sensor Unavailable Blocks Resume

If ANY of 8 sensors is unavailable, the resume condition fails because `unavailable` != `off`. Heaters stay off indefinitely until sensor returns.

**Workaround:** Manually enable heaters via dashboard or check sensor battery/connectivity.

#### EDGE-2: Manual Override Not Possible

If user intentionally wants to ventilate while heating (brief fresh air), there's no way to temporarily disable safety. This is intentional safety design.

#### EDGE-3: Dashboard Mode Change While Window Open

If user sets mode=heat via dashboard while window open:
1. Mode changes to 'heat'
2. If temp below setpoint, valve opens
3. `prevent_heating_if_window_open` catches `hvac_action: heating`
4. Saves state and turns off that specific heater

### Watchdog vs HA Automation Behavior

| Aspect | HA Automation | Watchdog |
|--------|---------------|----------|
| TTS Announcement | Yes (all 3 speakers) | No |
| State Preservation | Always | Best-effort |
| Auto-Resume | Yes | Yes (if state save succeeded) |
| Response Time | ~1 second | 5 minutes |
| Notification | "Window Open - Heaters Off" | "WATCHDOG: Heaters Emergency Off" |
| Manual Intervention | Never needed | Only if state save failed |

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-30 | Updated count from 21→23 automations; added docs for `prevent_heating_if_window_open` (#22) and `tts_event_mqtt_publisher` (#23) |
| 2025-12-29 | **Fixed 4 bugs in heating safety system:** (1) Removed `initial:` from input helpers so state persists across HA restarts, (2) Fixed `prevent_heating_if_window_open` to save heater state before turning off, (3) Updated heater-watchdog to use hybrid approach (safety first, best-effort state save), (4) Increased resume delay from 1s to 3s for TRVZB timing. Added complete scenarios matrix documentation. |
| 2025-12-29 | **Fixed temperature restoration** - Added input_number entities to save/restore thermostat setpoints when windows trigger heater shutoff. TRVZB firmware drops setpoint to 7°C frost protection when mode=off; now setpoints are explicitly saved before shutoff and restored after. Also resets `open_window` flag via MQTT on restore. |
| 2025-12-27 | Added cool-off delays: doors (2min), windows (30sec) |
| 2025-12-27 | Added cold weather alert (15min + <18°C) |
| 2025-12-14 | Initial window-heater safety automations |
