# Heater Safety Watchdog

## Purpose

Independent safety monitor that runs every 5 minutes to detect and correct heater-window safety violations. Acts as a **defense-in-depth** layer alongside Home Assistant automations.

## Why This Exists

Home Assistant already has event-driven automations for window-heater safety. This watchdog provides:

1. **Independent safety net** - Runs outside HA, survives HA restarts
2. **Catches edge cases** - Sensor unavailable->available transitions, state sync issues
3. **Full audit trail** - Logs every check for debugging
4. **Poll-based verification** - Catches violations that event-driven automations might miss

## Logic

```
Every 5 minutes:
  Check windows: IF any_window == "on" (open) → trigger immediately
  Check doors:   IF any_door == "on" (open) for >= 2 minutes → trigger
                 (brief door openings for entry/exit are ignored)

  IF (open_windows OR doors_open_2min+) AND any_thermostat.hvac_action == "heating"
  THEN:
     1. Turn off ALL thermostats (hvac_mode: "off")
     2. Send mobile notification with details
     3. Log violation
```

**Why the 2-minute door delay?**
Doors (Main Door, Balcony Door) are frequently opened briefly for entry/exit. Without a delay, the watchdog would trigger false positives if its 5-minute poll happens during these brief openings. This matches the HA automation behavior.

**Worst-case response time:**
- Windows: up to 5 minutes (next poll)
- Doors: up to 7 minutes (5-min poll + 2-min delay)

## Entities Monitored

### Window Sensors (6) - Immediate Response

| Entity | Location |
|--------|----------|
| `bath_window_contact_sensor_contact` | Bathroom Window |
| `bed_window_contact_sensor_contact` | Bedroom Window |
| `kitchen_window_contact_sensor_contact` | Kitchen Window |
| `study_window_contact_sensor_large_contact` | Study Large Window |
| `study_window_contact_sensor_small_contact` | Study Small Window |
| `living_window_contact_sensor_window_contact` | Living Window |

### Door Sensors (2) - 2-Minute Delay

| Entity | Location | Why Delay? |
|--------|----------|------------|
| `living_window_contact_sensor_balcony_door_contact` | Balcony Door | Brief entry/exit |
| `hallway_window_contact_sensor_main_door_contact` | Main Door | Brief entry/exit |

### Thermostats (4)

| Entity | Location |
|--------|----------|
| `climate.study_thermostat` | Study |
| `climate.living_thermostat_inner` | Living Room (Inner) |
| `climate.living_thermostat_outer` | Living Room (Outer) |
| `climate.bed_thermostat` | Bedroom |

## Configuration

Environment variables (set in docker-compose.yml):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HA_URL` | No | `http://homeassistant:8123` | Home Assistant URL |
| `HA_TOKEN` | **Yes** | None | Long-lived access token |
| `CHECK_INTERVAL` | No | `300` | Seconds between checks (5 min) |
| `DOOR_OPEN_DELAY` | No | `120` | Seconds door must be open before triggering (2 min) |
| `NOTIFY_SERVICE` | No | `notify.mobile_app_22111317pg` | HA notification service |
| `TZ` | No | `Europe/Berlin` | Timezone |

## Creating HA Access Token

1. Open Home Assistant: `http://pi:8123`
2. Click profile icon (bottom-left)
3. Scroll to "Long-Lived Access Tokens"
4. Create Token -> Name: `heater-watchdog`
5. **Copy immediately** (cannot view again)
6. Add to `/opt/zigbee2mqtt/.env`:
   ```
   HEATER_WATCHDOG_HA_TOKEN=your_token_here
   ```

## Logs

```bash
# View logs
docker logs heater-watchdog -f

# Last 100 lines
docker logs heater-watchdog --tail 100
```

## Testing

1. Start the container
2. Open a window
3. Manually set a thermostat to heat mode (via HA UI)
4. Wait for next check (or restart container for immediate check)
5. Verify:
   - Heaters turn off
   - Mobile notification received
   - Logs show "SAFETY VIOLATION"

## Architecture

```
+------------------------------------------------------------+
|  Layer 1: HA Automations (Event-Driven, ~1s response)       |
|  +- window_open_turn_off_heaters (30s delay for windows)   |
|  +- door_open_turn_off_heaters (2min delay for doors)      |
|  +- prevent_heating_if_window_open (immediate block)       |
|  +- all_windows_closed_resume_heaters                      |
|  +- watchdog_recovery_resume_check (1min periodic safety)  |
|  +- daily_valve_exercise (3 AM, prevents motor seizure)    |
|                                                             |
|  Layer 2: Heater Watchdog (Poll-Based, 5min intervals)      |
|  +- Window safety check - catches anything L1 might miss   |
|  +- Ghost external temp detection (clears stale values)    |
|  +- Stuck-idle detection (tiered: 20min urgent / 45min)    |
|  +- Valve voltage early warning (motor degradation alert)  |
|  +- Sets guard flag with retry (3 attempts) for resume     |
+------------------------------------------------------------+
```

## Ghost External Temperature Detection (Feb 9, 2026)

**Proactive check** that runs every 5 minutes alongside window safety.

```
┌─────────────────────────────────────────────────────────────────┐
│  INCIDENT: Bedroom TRV idle despite 5.7°C deficit              │
│  ROOT CAUSE: external_temperature_input stuck at 24°C          │
│  while actual room was 16.3°C → TRV thought room was warm     │
│                                                                 │
│  DETECTION: |external_temp - local_temp| > 5°C                 │
│  ACTION: Clear to 0 via MQTT + send alert                      │
│  RUNS: Every 5 min (before stuck-idle check)                   │
│                                                                 │
│  WHY BEFORE STUCK-IDLE: Clearing the ghost temp may fix        │
│  the idle state, making stuck-idle recovery unnecessary.        │
└─────────────────────────────────────────────────────────────────┘
```

**Key function:**
- `check_ghost_external_temps()` — compares `number.*_external_temperature_input` to `climate.*_thermostat.current_temperature`

**Entities checked:**
| Thermostat | External Temp Entity |
|-----------|---------------------|
| `climate.study_thermostat` | `number.study_thermostat_external_temperature_input` |
| `climate.living_thermostat_inner` | `number.living_thermostat_inner_external_temperature_input` |
| `climate.living_thermostat_outer` | `number.living_thermostat_outer_external_temperature_input` |
| `climate.bed_thermostat` | `number.bed_thermostat_external_temperature_input` |

## Stuck-Idle Detection (Feb 7, 2026, updated Feb 9)

**Layer 2 backup** for HA automation `thermostat_stuck_idle_recovery`.

```
┌─────────────────────────────────────────────────────────────────┐
│  DETECTION: mode=heat + action=idle + entry deficit ≥ 2°C      │
│                                                                 │
│  TIERED THRESHOLDS (Fix 1, Feb 9 2026):                        │
│  ┌──────────┬──────────┬──────────────────────────────────────┐ │
│  │ URGENT   │ 20 min   │ deficit ≥ 4°C → clearly broken       │ │
│  │ NORMAL   │ 45 min   │ any tracked TRV still idle           │ │
│  └──────────┴──────────┴──────────────────────────────────────┘ │
│                                                                 │
│  DEADLOCK FIX (Fix 5, Feb 9 2026):                             │
│  Once tracked, only remove when hvac_action != "idle".          │
│  Ambient warming reducing deficit does NOT clear tracker.       │
│  Before: deficit 3°C→1.5°C → removed → never recovers.        │
│  Now:    stays tracked until valve actually opens.              │
│                                                                 │
│  RATE LIMIT: 2 recoveries/thermostat/hour (in-memory)          │
│  (Note: HA Layer 1 allows 3/hour — watchdog is more            │
│   conservative as a backup layer)                               │
│                                                                 │
│  TWO-PHASE RECOVERY (same as HA automation):                   │
│    Phase 1 (gentle): MQTT open_window OFF + re-poke setpoint   │
│    Phase 2 (aggressive): off → heat → MQTT reset → setpoint    │
│                                                                 │
│  GUARDS:                                                       │
│    - Only when no windows are open (window safety priority)    │
│    - Only when no guard flags active (window/CO2 shutoff)      │
│    - Setpoint floor: max(current_setpoint, 18°C)               │
└─────────────────────────────────────────────────────────────────┘
```

**Key functions:**
- `recover_stuck_idle_thermostat()` — two-phase recovery via HA REST API
- `check_stuck_idle()` — orchestrator called from `perform_safety_check()`

**When this fires vs HA automation:**
- HA automation: every 15min, 60min stuck threshold → catches most cases
- Watchdog urgent tier: 20min + 4°C deficit → fires before HA (catches severe cases fast)
- Watchdog normal tier: 45min tracking + up to 5min poll delay = 45-50min effective
- HA's effective response: 60min stuck + 15min poll = 75min

## Valve Voltage Early Warning (Feb 9, 2026)

**Proactive monitoring** for valve motor degradation.

```
┌─────────────────────────────────────────────────────────────────┐
│  INCIDENT: Feb 9, 2026 — Bedroom TRV at 1662 mV while         │
│  peers were at 2070 mV. Motor too weak to open valve.          │
│                                                                 │
│  DETECTION:                                                     │
│    1. Absolute: voltage < 1700 mV (motor failing)              │
│    2. Relative: >20% below peer average (outlier)              │
│                                                                 │
│  ACTION: Alert only (no recovery — early warning system)       │
│  COOLDOWN: 4 hours per TRV (avoid alert spam)                  │
│  RUNS: Every 5 min (after stuck-idle check)                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key function:**
- `check_valve_voltages()` — compares `sensor.*_valve_opening_limit_voltage` across TRVs

**Entities checked:**
| Thermostat | Voltage Entity |
|-----------|---------------|
| `climate.study_thermostat` | `sensor.study_thermostat_valve_opening_limit_voltage` |
| `climate.living_thermostat_inner` | `sensor.living_thermostat_inner_valve_opening_limit_voltage` |
| `climate.living_thermostat_outer` | `sensor.living_thermostat_outer_valve_opening_limit_voltage` |
| `climate.bed_thermostat` | `sensor.bed_thermostat_valve_opening_limit_voltage` |

## Daily Valve Exercise (Feb 9, 2026)

**HA automation** (`daily_valve_exercise`) — prevents motor seizure.

```
┌─────────────────────────────────────────────────────────────────┐
│  TRIGGER: 3:07 AM daily (offset from :00 to avoid /15 polls)   │
│  ACTION: For each TRV in heat mode + battery >= 40%:           │
│    1. Clear open_window flag via MQTT                          │
│    2. Bump setpoint +5°C (forces valve open)                   │
│    3. Wait 30s (motor exercises)                               │
│    4. Restore original setpoint (with retry verification)      │
│    5. 15s pause between TRVs (Zigbee traffic)                  │
│                                                                 │
│  SAFETY:                                                       │
│    - Only TRVs in heat mode + battery >= 40%                   │
│    - Skip if windows open or CO2 guard active                  │
│    - Setpoint restore retries once on failure                  │
│    - 3 AM = everyone asleep, brief bump is imperceptible       │
│                                                                 │
│  LOCATION: configs/homeassistant/automations.yaml              │
└─────────────────────────────────────────────────────────────────┘
```

## Auto-Resume Flow

When watchdog turns off heaters:
1. Saves heater states (best-effort)
2. Sets guard flag with **3 retry attempts** (critical for resume)
3. Turns off all heaters (core safety action)
4. Resume happens via:
   - Event-driven: HA automation triggers when windows close
   - Periodic backup: Every 1 minute, checks if guard ON + all closed → resumes

## Troubleshooting

### "HA_TOKEN environment variable is required"
- Token not set in docker-compose.yml or .env file
- Create token in HA and add to environment

### "Failed to connect to Home Assistant"
- Check HA container is running: `docker ps | grep homeassistant`
- Check network connectivity: `docker exec heater-watchdog wget -O- http://homeassistant:8123/api/ 2>&1`
- Verify token is valid in HA

### "HTTP error 401: Unauthorized"
- Token is invalid or expired
- Create a new long-lived access token in HA

### Notifications not received
- Check NOTIFY_SERVICE matches your HA notification service
- Verify mobile app is configured in HA
