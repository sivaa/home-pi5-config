# Home Assistant Automations

> **Last Updated:** 2026-01-04
> **Total Automations:** 47
> **File:** `configs/homeassistant/automations.yaml`

---

## Quick Reference

| Category | Count | Purpose |
|----------|-------|---------|
| [Mailbox Alerts](#-mailbox-alerts) | 2 | Motion detection & sensor status |
| [CO2 Monitoring](#-co2-monitoring) | 3 | Air quality alerts & ventilation reminders |
| [CO2-Heater Control](#-co2-heater-control) | 3 | Auto-shutoff heaters when CO2 high |
| [Window Alerts](#-window-open-alerts) | 2 | Bathroom & bedroom window open too long |
| [Heater Notifications](#-heater-notifications) | 8 | Start/stop notifications for all 4 heaters |
| [Thermostat Audit](#-thermostat-audit) | 1 | Track all setpoint changes |
| [Window-Heater Safety](#-window-heater-safety) | 5 | Auto-shutoff when windows open + prevention |
| [Cold Weather Alert](#-cold-weather-alert) | 1 | Remind to close windows when cold |
| [TTS Logging](#-tts-logging) | 1 | Publish TTS events to MQTT for dashboard |
| [Heater Guard MQTT](#-heater-guard-mqtt) | 2 | Publish guard state to dashboard |
| [Watchdog Recovery](#-watchdog-recovery) | 1 | Periodic safety net for missed events |
| [Bedroom Night Mode](#-bedroom-night-mode) | 4 | Limit bedroom temp 23:00-06:00 |
| [Heater Safety Limits](#-heater-safety-limits) | 2 | Cap all thermostats at 22°C max |
| [Circadian Lighting](#-circadian-lighting) | 8 | Schedule-based brightness/color temp with override detection |
| [Sensor Offline Alerts](#-sensor-offline-alerts) | 3 | Alert when contact sensors go unavailable |

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
| **Trigger** | Motion detected (`binary_sensor.mailbox_motion_sensor_occupancy` → on) |
| **Quiet Hours** | 23:00 - 07:00 (no announcements) |
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

### 🌡️ CO2-Heater Control

These automations automatically turn off heaters when CO2 is high (to avoid heating air that will soon be vented) and restore them when CO2 drops.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      CO2-HEATER CONTROL PRIORITY                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PRIORITY: WINDOW OPEN > CO2 HIGH > NORMAL THERMOSTAT                          │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                        THRESHOLDS                                      │    │
│  │                                                                        │    │
│  │   1200 ppm ─┼─ HEATER OFF (aligned with verbal CO2 alert)             │    │
│  │             │    ▲                                                     │    │
│  │             │    │ 100 ppm hysteresis                                  │    │
│  │             │    ▼                                                     │    │
│  │   1100 ppm ─┼─ HEATER RESTORE (if windows closed)                     │    │
│  │                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  SCENARIOS:                                                                     │
│  • CO2 high → heaters off, CO2 flag ON                                          │
│  • Window opens while CO2 high → window takes over, CO2 flag cleared           │
│  • Window closes, CO2 still high → CO2 flag ON, heaters stay off               │
│  • CO2 drops below 1100 → heaters restored                                      │
│                                                                                 │
│  SAFETY FEATURES:                                                               │
│  • HA startup trigger checks state on restart                                   │
│  • 30-minute sensor timeout fallback restores heaters                           │
│  • prevent_heating_if_co2_high blocks manual override                           │
│  • Quiet hours (23:00-07:00): TTS suppressed, mobile notification only         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### CO2-4. CO2 High - Turn Off All Heaters
| Property | Value |
|----------|-------|
| **ID** | `co2_high_turn_off_heaters` |
| **Trigger** | CO2 > 1200 ppm OR HA startup with CO2 > 1200 |
| **Condition** | CO2 flag OFF, at least one heater in heat mode |
| **Action** | Save state, turn off heaters, TTS (07:00-23:00), mobile notification |
| **Priority** | If window flag ON, don't save state (window already saved it) |

#### CO2-5. CO2 Low - Resume Heaters
| Property | Value |
|----------|-------|
| **ID** | `co2_low_resume_heaters` |
| **Trigger** | CO2 < 1100 ppm OR HA startup OR sensor unavailable 30min |
| **Condition** | CO2 flag ON, window flag OFF, all windows/doors closed |
| **Action** | Restore HVAC mode, reset open_window flag, restore setpoints, TTS |
| **Safety** | 30-minute sensor timeout fallback with warning notification |

#### CO2-6. Prevent Heating If CO2 High
| Property | Value |
|----------|-------|
| **ID** | `prevent_heating_if_co2_high` |
| **Trigger** | Any thermostat enters "heating" state |
| **Condition** | CO2 > 1200 ppm |
| **Action** | Immediately turn off that specific heater + mobile notification |
| **Purpose** | Catch manual overrides or race conditions |

---

### 🪟 Window Open Alerts

These automations use the `smart_tts_window_alert` script for robust TTS with retry, fallback speakers, and obsolescence checking.

#### 6. Window Open Too Long (Temperature-Aware)

| Property | Value |
|----------|-------|
| **ID** | `window_open_too_long` |
| **Mode** | `parallel` (max: 7) |
| **Sensors** | All 7 windows + balcony door |
| **Trigger** | 5 min if temp ≤0°C (freezing), 10 min if temp >0°C |
| **Condition** | Temperature-based via balcony sensor |
| **TTS Script** | `script.smart_tts_window_alert` with retry & fallback |
| **Action** | TTS + mobile notification every 1 min until closed |
| **Backup** | Cold weather alert (15min, <18°C) catches edge cases |

**Sensors Covered:**
| Sensor | Entity ID |
|--------|-----------|
| Bathroom Window | `binary_sensor.bath_window_contact_sensor_contact` |
| Bedroom Window | `binary_sensor.bed_window_contact_sensor_contact` |
| Kitchen Window | `binary_sensor.kitchen_window_contact_sensor_contact` |
| Study Large Window | `binary_sensor.study_window_contact_sensor_large_contact` |
| Study Small Window | `binary_sensor.study_window_contact_sensor_small_contact` |
| Living Window | `binary_sensor.living_window_contact_sensor_window_contact` |
| Balcony Door | `binary_sensor.living_window_contact_sensor_balcony_door_contact` |

**Temperature Logic:**
```
┌─────────────────────────────────────────────────────────────┐
│  TEMPERATURE-AWARE WINDOW ALERTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Balcony Temp ≤ 0°C (Freezing):                            │
│  └─ Alert after 5 minutes                                   │
│     └─ Title: 🥶 [Window Name]                             │
│     └─ Channel: Critical (max importance)                   │
│     └─ Message: "It's X degrees outside - freezing!"       │
│                                                             │
│  Balcony Temp > 0°C (Normal):                              │
│  └─ Alert after 10 minutes                                  │
│     └─ Title: 🪟 [Window Name]                             │
│     └─ Channel: Alerts (high importance)                    │
│                                                             │
│  Sensor Unavailable:                                        │
│  └─ Defaults to freezing behavior (safer)                   │
│                                                             │
│  Note: Main door has separate 3-min alert (security)        │
└─────────────────────────────────────────────────────────────┘
```

**Known Limitation:** If temperature drops from warm to freezing mid-window (e.g., opens at 5°C, drops to -3°C at minute 7), the alert may be delayed to 15 minutes via the cold weather backup. This is rare as temperature rarely drops 5°C in 5 minutes.

#### Smart TTS Window Alert Script

The `smart_tts_window_alert` script (defined in `scripts.yaml`) provides:

```
┌────────────────────────────────────────────────────────────────────┐
│  SMART TTS WINDOW ALERT - FLOW                                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. Check Kitchen Display available?                               │
│     ├─ YES + window open → Play TTS immediately                   │
│     └─ NO → Wait up to 5 minutes                                  │
│                                                                    │
│  2. During wait, check:                                            │
│     ├─ Window closed? → Stop (obsolete)                           │
│     ├─ Kitchen Display available? → Play TTS                      │
│     └─ Timeout (5 min)? → Use fallback speakers                   │
│                                                                    │
│  3. Fallback speakers:                                             │
│     ├─ media_player.broken_display (Living Room)                  │
│     └─ media_player.master_bedroom_clock (Bedroom)                │
│                                                                    │
│  4. If ALL speakers unavailable:                                   │
│     └─ Send mobile notification with full message                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

| Field | Description |
|-------|-------------|
| `message` | The TTS message to announce |
| `window_entity` | Window sensor entity to check if still open |

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

#### 23. Watchdog Recovery - Periodic Resume Check
| Property | Value |
|----------|-------|
| **ID** | `watchdog_recovery_resume_check` |
| **Trigger** | Every 1 minute (time_pattern) |
| **Condition** | (Window OR CO2 guard ON) AND all 8 sensors closed |
| **Action** | Routes to appropriate resume automation based on active guard |
| **Purpose** | Safety net for missed event-driven resume triggers |

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    WATCHDOG RECOVERY LOGIC (Every 1 Minute)                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CHECK: Is ANY guard flag ON?                                                    │
│  ├─ heaters_off_due_to_window = ON?                                             │
│  └─ heaters_off_due_to_co2 = ON?                                                │
│                                                                                 │
│  IF NO → Exit (nothing to recover)                                              │
│                                                                                 │
│  IF YES → CHECK: Are ALL 8 sensors closed?                                      │
│           │                                                                      │
│           IF NO → Exit (can't resume yet)                                       │
│           │                                                                      │
│           IF YES → Which guard is active?                                       │
│                    │                                                            │
│                    ├─ Window guard ON → Trigger all_windows_closed_resume       │
│                    │                                                            │
│                    └─ CO2 guard ON (and window OFF)?                            │
│                       └─ Is CO2 < 1100 ppm?                                     │
│                          ├─ YES → Trigger co2_low_resume_heaters               │
│                          └─ NO → Log and wait (CO2 still high)                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Why This Exists:**

Event-driven automations (`co2_low_resume_heaters`, `all_windows_closed_resume_heaters`) use `numeric_state` triggers that require the value to **cross** the threshold. If HA is busy or the value jumps over the threshold in a single update, the trigger can miss. This periodic check catches those edge cases.

**Bug Fixed (2025-12-31):** Originally only checked `heaters_off_due_to_window`. Now also checks `heaters_off_due_to_co2` to catch CO2-triggered shutoffs where the resume was missed.

---

### 📢 TTS Logging

#### 24. TTS Event MQTT Publisher
| Property | Value |
|----------|-------|
| **ID** | `tts_event_mqtt_publisher` |
| **Trigger** | Any call to `tts.google_translate_say` service |
| **Mode** | Parallel (max: 10) |
| **Action** | Publish event to `dashboard/tts` MQTT topic |
| **Fields** | timestamp, message, devices, availability status |
| **Purpose** | Dashboard logging of all TTS announcements |

---

### 🛡️ Heater Guard MQTT

These automations publish heater guard state to MQTT for dashboard display.

#### 25. Heater Guard Combined State Publisher
| Property | Value |
|----------|-------|
| **ID** | `heater_guard_combined_publisher` |
| **Trigger** | Guard flag changes, window state changes, CO2 level changes |
| **Condition** | At least one guard flag ON |
| **Action** | Publish combined state to `dashboard/heater-guard/combined` |
| **Payload** | `{ active, reason, window_guard, co2_guard, windows, co2_level }` |
| **Retained** | Yes (dashboard shows state on page load) |

#### 26. Heater Guard Clear on Resume
| Property | Value |
|----------|-------|
| **ID** | `heater_guard_clear_on_resume` |
| **Trigger** | Either guard flag turns OFF |
| **Condition** | BOTH guards must be OFF |
| **Action** | Publish `{ active: false }` to clear retained message |
| **Purpose** | Clears dashboard indicator when heaters resume |

---

### 🔄 Watchdog Recovery

#### 27. Watchdog Recovery - Periodic Resume Check
| Property | Value |
|----------|-------|
| **ID** | `watchdog_recovery_resume_check` |
| **Trigger** | Every 1 minute (time_pattern) |
| **Condition** | (Window OR CO2 guard ON) AND all 8 sensors closed |
| **Action** | Routes to appropriate resume automation based on active guard |
| **Purpose** | Safety net for missed event-driven resume triggers |

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    WATCHDOG RECOVERY LOGIC (Every 1 Minute)                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CHECK: Is ANY guard flag ON?                                                    │
│  ├─ heaters_off_due_to_window = ON?                                             │
│  └─ heaters_off_due_to_co2 = ON?                                                │
│                                                                                 │
│  IF YES + ALL sensors closed → Route to appropriate resume automation          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🌙 Bedroom Night Mode

These automations limit bedroom temperature to 17°C during sleeping hours (23:00-06:00).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BEDROOM NIGHT MODE FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  23:00 ──► Save current setpoint ──► Cap to 17°C ──► Set night mode flag       │
│                                                                                 │
│  During night: Any setpoint > 17°C ──► Force back to 17°C + notify             │
│                                                                                 │
│  06:00 ──► Restore saved setpoint ──► Clear night mode flag                    │
│                                                                                 │
│  HA Restart during night ──► Re-activate night mode + cap if needed            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 28. Bedroom Night Mode - Start (23:00)
| Property | Value |
|----------|-------|
| **ID** | `bedroom_night_mode_start` |
| **Trigger** | Time = 23:00:00 |
| **Condition** | Night mode flag OFF |
| **Action** | Set flag, save setpoint to `input_number.bedroom_pre_night_setpoint`, cap to 17°C |
| **Notify** | "Night mode activated. Capped X°C → 17°C" |

#### 29. Bedroom Night Mode - Enforcement
| Property | Value |
|----------|-------|
| **ID** | `bedroom_night_mode_enforcement` |
| **Trigger** | Bedroom thermostat setpoint changes |
| **Condition** | Night mode ON AND heater in heat mode AND setpoint > 17°C |
| **Action** | Cap back to 17°C |
| **Notify** | "Attempted X°C during night mode. Capped to 17°C" |

#### 30. Bedroom Night Mode - End (06:00)
| Property | Value |
|----------|-------|
| **ID** | `bedroom_night_mode_end` |
| **Trigger** | Time = 06:00:00 |
| **Condition** | Night mode flag ON |
| **Action** | Clear flag, restore setpoint from `input_number.bedroom_pre_night_setpoint` |
| **Notify** | "Restored to X°C" |

#### 31. Bedroom Night Mode - HA Startup Check
| Property | Value |
|----------|-------|
| **ID** | `bedroom_night_mode_startup_check` |
| **Trigger** | HA starts |
| **Condition** | Time 23:00-06:00 AND night mode flag OFF |
| **Action** | Set flag, save setpoint, cap if needed |
| **Purpose** | Handles HA restart during night hours |

---

### 🔥 Heater Safety Limits

These automations enforce a 22°C maximum temperature on all thermostats.

#### 32. Heater Safety - 22°C Maximum Cap
| Property | Value |
|----------|-------|
| **ID** | `heater_safety_max_22c_cap` |
| **Trigger** | Any thermostat setpoint changes |
| **Condition** | New setpoint > 22°C |
| **Mode** | Parallel (max: 4) |
| **Action** | Cap to 22°C |
| **Notify** | "X Heater capped from Y°C to 22°C" |
| **Purpose** | Prevent excessive heating and energy waste |

#### 33. Heater Safety - 22°C Cap on HA Startup
| Property | Value |
|----------|-------|
| **ID** | `heater_safety_22c_startup_check` |
| **Trigger** | HA starts |
| **Condition** | Any thermostat > 22°C |
| **Action** | Cap all thermostats above 22°C |
| **Notify** | Lists all capped heaters |
| **Purpose** | Catches thermostats set above 22°C before automation existed |

---

### 💡 Circadian Lighting

These automations manage automatic brightness and color temperature adjustments throughout the day for IKEA lights, with manual override detection.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CIRCADIAN LIGHTING FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SCHEDULE (every 10 min)                                                        │
│  ├─ Read sensor.circadian_brightness & sensor.circadian_color_temp             │
│  ├─ Apply to ON lights that aren't overridden                                  │
│  └─ Uses 30-second transition for smooth changes                               │
│                                                                                 │
│  POWER ON                                                                       │
│  ├─ Light turns on → Set to warmest color (2200K) + scheduled brightness       │
│  └─ Gentle start regardless of time of day                                     │
│                                                                                 │
│  OVERRIDE DETECTION                                                             │
│  ├─ Manual adjustment detected (remote/app)                                    │
│  ├─ 30-minute override timer starts                                            │
│  ├─ Schedule paused for that light                                             │
│  └─ After 30 min → restore scheduled settings                                  │
│                                                                                 │
│  MQTT CONTROL                                                                   │
│  └─ Dashboard can enable/disable circadian globally                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 34. Circadian - Schedule Update
| Property | Value |
|----------|-------|
| **ID** | `circadian_schedule_update` |
| **Trigger** | Every 10 minutes (time pattern) |
| **Condition** | `input_boolean.circadian_enabled` is ON |
| **Action** | Apply scheduled brightness/color temp to ON lights (not overridden) |
| **Lights** | Study IKEA Light, Living IKEA Light |
| **Transition** | 30 seconds |

#### 35. Circadian - Light Power On
| Property | Value |
|----------|-------|
| **ID** | `circadian_power_on` |
| **Trigger** | Study or Living light turns on |
| **Condition** | Circadian enabled, light not overridden |
| **Action** | Set to 2200K (warmest) + scheduled brightness |
| **Purpose** | Gentle warm start when light is turned on |

#### 36. Circadian - Override Detection
| Property | Value |
|----------|-------|
| **ID** | `circadian_override_detect` |
| **Trigger** | Light brightness or color_temp attribute changes |
| **Condition** | Circadian enabled AND automation NOT actively changing lights |
| **Action** | Set 30-minute override timer, notify user |
| **Purpose** | Detects manual changes (remote presses, app control) |

#### 37. Circadian - Override Expiry Check
| Property | Value |
|----------|-------|
| **ID** | `circadian_override_expiry` |
| **Trigger** | Every 1 minute (time pattern) |
| **Condition** | At least one override is active |
| **Action** | Clear expired overrides, restore scheduled settings |
| **Transition** | 60 seconds (slow restore) |

#### 38. Circadian - Phase Notification
| Property | Value |
|----------|-------|
| **ID** | `circadian_phase_notification` |
| **Trigger** | Circadian phase changes (Morning → Day → Evening → Night) |
| **Action** | Send mobile notification with phase name and color temp |
| **Purpose** | User awareness of schedule progression |

#### 39. Circadian - HA Startup Check
| Property | Value |
|----------|-------|
| **ID** | `circadian_ha_startup` |
| **Trigger** | Home Assistant starts |
| **Action** | Apply current scheduled settings to all ON lights |
| **Purpose** | Restore circadian state after HA restart |

#### 40. Circadian - MQTT Control
| Property | Value |
|----------|-------|
| **ID** | `circadian_mqtt_control` |
| **Trigger** | MQTT message to `dashboard/circadian/command` |
| **Action** | Enable/disable circadian based on `{ "enabled": true/false }` |
| **Purpose** | Dashboard control of circadian system |

#### 41. Circadian - MQTT State Publisher
| Property | Value |
|----------|-------|
| **ID** | `circadian_mqtt_state_publisher` |
| **Trigger** | Circadian enabled changes, phase changes, 10-min schedule |
| **Action** | Publish state to `dashboard/circadian/state` (retained) |
| **Payload** | `{ enabled, phase, brightness, color_temp, study_override, living_override }` |
| **Purpose** | Dashboard displays current circadian state |

---

### 📵 Sensor Offline Alerts

These automations alert when contact sensors go offline, which is critical because the heater resume system requires ALL 8 sensors to be in `state: "off"` - sensors showing `unavailable` block heater restoration indefinitely.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      SENSOR OFFLINE ALERT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SENSOR UNAVAILABLE (5+ min)                                                    │
│       │                                                                         │
│       ▼                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐         │
│  │ 📵 SENSOR OFFLINE notification                                     │         │
│  │ - Sensor name (e.g., "Kitchen Window")                            │         │
│  │ - Warning: Heaters may not resume automatically                   │         │
│  │ - Instructions: Open/close window to wake sensor                  │         │
│  └────────────────────────────────────────────────────────────────────┘         │
│                                                                                 │
│  STILL OFFLINE (every 4 hours)                                                  │
│       │                                                                         │
│       ▼                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐         │
│  │ 📵 X SENSOR(S) STILL OFFLINE reminder                             │         │
│  │ - Lists all offline sensors                                       │         │
│  │ - "Heaters won't auto-resume until fixed"                        │         │
│  └────────────────────────────────────────────────────────────────────┘         │
│                                                                                 │
│  SENSOR RECOVERS                                                                │
│       │                                                                         │
│       ▼                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐         │
│  │ ✅ SENSOR ONLINE notification                                      │         │
│  │ - Replaces previous offline notification (same tag)              │         │
│  └────────────────────────────────────────────────────────────────────┘         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Why This Matters:**

After a 34-hour power outage, 2 contact sensors (Bath, Kitchen) stayed offline while 6 others recovered. The heater resume automation requires `all 8 sensors state == "off"`, but `unavailable ≠ "off"`, so heaters stayed off indefinitely. The system was SAFE (heaters off when uncertain), but failed to ALERT that attention was needed.

#### 42. Contact Sensor Offline Alert
| Property | Value |
|----------|-------|
| **ID** | `contact_sensor_offline_alert` |
| **Trigger** | Any of 8 contact sensors → `unavailable` for 5+ minutes |
| **Mode** | Parallel (max: 8) |
| **Action** | Mobile notification to `notify.all_phones` |
| **Title** | 📵 SENSOR OFFLINE |
| **Message** | "{Sensor} sensor is offline. Heaters may not resume automatically. Try opening/closing the window to wake it." |
| **Tag** | `sensor_offline_{entity_id}` (for replacement on recovery) |
| **Channel** | Alerts (high importance) |

#### 43. Contact Sensor Offline - Repeat Alert
| Property | Value |
|----------|-------|
| **ID** | `contact_sensor_offline_repeat` |
| **Trigger** | Every 4 hours (time pattern) |
| **Condition** | At least one contact sensor is `unavailable` |
| **Mode** | Single |
| **Action** | Mobile notification listing ALL offline sensors |
| **Title** | 📵 {count} SENSOR(S) STILL OFFLINE |
| **Message** | "{list} sensor(s) offline. Heaters won't auto-resume until fixed. Open/close window or check battery." |
| **Purpose** | Persistent reminder every 4 hours while sensors remain offline |

#### 44. Contact Sensor Back Online
| Property | Value |
|----------|-------|
| **ID** | `contact_sensor_back_online` |
| **Trigger** | Any contact sensor transitions FROM `unavailable` |
| **Mode** | Parallel (max: 8) |
| **Action** | Mobile notification + system log |
| **Title** | ✅ SENSOR ONLINE |
| **Message** | "{Sensor} sensor is back online" |
| **Tag** | `sensor_offline_{entity_id}` (replaces offline notification) |
| **Purpose** | Confirms recovery and clears previous offline alert |

**Monitored Sensors:**
| Sensor | Entity ID |
|--------|-----------|
| Bathroom Window | `binary_sensor.bath_window_contact_sensor_contact` |
| Bedroom Window | `binary_sensor.bed_window_contact_sensor_contact` |
| Kitchen Window | `binary_sensor.kitchen_window_contact_sensor_contact` |
| Study Large Window | `binary_sensor.study_window_contact_sensor_large_contact` |
| Study Small Window | `binary_sensor.study_window_contact_sensor_small_contact` |
| Living Window | `binary_sensor.living_window_contact_sensor_window_contact` |
| Balcony Door | `binary_sensor.living_window_contact_sensor_balcony_door_contact` |
| Main Door | `binary_sensor.hallway_window_contact_sensor_main_door_contact` |

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
| `binary_sensor.mailbox_motion_sensor_occupancy` | Mailbox motion sensor |

### State Memory (input_boolean)

Used to remember heater states before window/CO2-triggered shutoff:

| Entity ID | Purpose |
|-----------|---------|
| `input_boolean.study_heater_was_on` | Was Study heater on before shutoff? |
| `input_boolean.living_inner_heater_was_on` | Was Living Inner heater on? |
| `input_boolean.living_outer_heater_was_on` | Was Living Outer heater on? |
| `input_boolean.bedroom_heater_was_on` | Was Bedroom heater on? |
| `input_boolean.heaters_off_due_to_window` | Guard flag: window triggered shutoff |
| `input_boolean.heaters_off_due_to_co2` | Guard flag: CO2 high triggered shutoff |
| `input_boolean.bedroom_night_mode_active` | Night mode active flag (23:00-06:00) |

### Saved Setpoints (input_number)

Used to save thermostat setpoints before window-triggered shutoff (TRVZB firmware drops setpoint to 7°C frost protection when turned off):

| Entity ID | Purpose | Range |
|-----------|---------|-------|
| `input_number.study_heater_saved_temp` | Study setpoint backup | 5-22°C |
| `input_number.living_inner_heater_saved_temp` | Living Inner setpoint backup | 5-22°C |
| `input_number.living_outer_heater_saved_temp` | Living Outer setpoint backup | 5-22°C |
| `input_number.bedroom_heater_saved_temp` | Bedroom setpoint backup | 5-22°C |
| `input_number.bedroom_pre_night_setpoint` | Bedroom pre-night mode setpoint | 5-22°C |

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

**Mitigation (2026-01-04):** Sensor Offline Alert system now notifies users when any sensor goes unavailable:
- 📵 Immediate notification after 5 minutes of unavailability
- 📵 Repeat reminder every 4 hours while offline
- ✅ Recovery notification when sensor comes back online
- Instructions included to open/close window to wake sleeping sensor

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
| 2026-01-07 | **Unified temperature-aware window alerts:** Replaced `bath_window_open_too_long` and `bed_window_open_too_long` with single `window_open_too_long` automation. Now covers ALL 7 windows + balcony door. **Key change:** 5-minute alert when temp ≤0°C (freezing), 10-minute when >0°C. Uses balcony sensor for outdoor temp. If sensor unavailable, defaults to freezing behavior (safer). Main door unchanged at 3-min (security). Cold weather alert (15min, <18°C) provides backup for edge cases. |
| 2026-01-04 | **Added Sensor Offline Alert system:** After a 34-hour power outage, 2 contact sensors stayed offline blocking heater resume (unavailable ≠ off). Added 3 automations: (1) `contact_sensor_offline_alert` - immediate notification after 5 min offline, (2) `contact_sensor_offline_repeat` - repeat every 4 hours, (3) `contact_sensor_back_online` - recovery notification. Also increased Z2M passive timeout 1500→2400 for better short-outage recovery. Documented 8 Circadian Lighting automations. Total count: 33→47 automations. |
| 2025-12-31 | **Fixed CO2 guard not triggering heater resume:** The `watchdog_recovery_periodic_resume_check` automation only checked `heaters_off_due_to_window` flag, missing cases where heaters were paused due to high CO2. When `co2_low_resume_heaters` missed the threshold crossing (e.g., HA busy, value jumped), heaters stayed off indefinitely. Fix: Watchdog now checks BOTH window AND CO2 guard flags and routes to the appropriate resume automation. |
| 2025-12-30 | **Added robust TTS for window alerts:** Created `smart_tts_window_alert` script with retry logic, fallback speakers, and obsolescence checking. Updated bathroom and bedroom window automations to use this script. Fixes silent TTS failures when Kitchen Display appears available but doesn't play audio. |
| 2025-12-30 | Updated count from 21→23 automations; added docs for `prevent_heating_if_window_open` (#22) and `tts_event_mqtt_publisher` (#23) |
| 2025-12-29 | **Fixed 4 bugs in heating safety system:** (1) Removed `initial:` from input helpers so state persists across HA restarts, (2) Fixed `prevent_heating_if_window_open` to save heater state before turning off, (3) Updated heater-watchdog to use hybrid approach (safety first, best-effort state save), (4) Increased resume delay from 1s to 3s for TRVZB timing. Added complete scenarios matrix documentation. |
| 2025-12-29 | **Fixed temperature restoration** - Added input_number entities to save/restore thermostat setpoints when windows trigger heater shutoff. TRVZB firmware drops setpoint to 7°C frost protection when mode=off; now setpoints are explicitly saved before shutoff and restored after. Also resets `open_window` flag via MQTT on restore. |
| 2025-12-27 | Added cool-off delays: doors (2min), windows (30sec) |
| 2025-12-27 | Added cold weather alert (15min + <18°C) |
| 2025-12-14 | Initial window-heater safety automations |
