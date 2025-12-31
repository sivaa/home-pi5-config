# Heater Safety Watchdog

## Overview

The Heater Safety Watchdog is a Python Docker service that runs every 5 minutes to verify heater-window safety conditions. It acts as a **defense-in-depth** layer alongside Home Assistant automations.

```
+------------------------------------------------------------+
|  DEFENSE IN DEPTH ARCHITECTURE                              |
+------------------------------------------------------------+
|                                                             |
|  Layer 1: HA Automations (Event-Driven)                     |
|  - window_open_turn_off_heaters (30s delay)                |
|  - door_open_turn_off_heaters (2min delay)                 |
|  - co2_high_turn_off_heaters (immediate)                   |
|  - prevent_heating_if_window_open                          |
|  - all_windows_closed_resume_heaters                       |
|  - co2_low_resume_heaters                                  |
|  - watchdog_recovery_resume_check (every 1min)             |
|                                                             |
|  Layer 2: Heater Watchdog (Poll-Based) <-- THIS SERVICE    |
|  - Runs every 5 minutes                                    |
|  - Catches any violations Layer 1 might miss               |
|  - Full audit trail of all checks                          |
|                                                             |
+------------------------------------------------------------+
```

## Why It Exists

Event-driven automations can miss edge cases:
- HA restart during a window open event
- Sensor unavailable -> available transitions
- Race conditions between user input and automation triggers

The watchdog provides an independent, poll-based safety net.

## Logic

```
Every 5 minutes:
  1. Query all 8 contact sensors
  2. Query all 4 thermostat hvac_action states

  IF any_window_open AND any_heater_heating THEN:
     - Turn off ALL thermostats
     - Send mobile notification
     - Log violation
```

## Files

| File | Location | Purpose |
|------|----------|---------|
| `heater-watchdog.py` | `services/heater-watchdog/` | Main Python script |
| `Dockerfile` | `services/heater-watchdog/` | Container definition |
| `CLAUDE.md` | `services/heater-watchdog/` | Service documentation |
| `docker-compose.yml` | `configs/zigbee2mqtt/` | Service definition |

## Installation

### Step 1: Create Home Assistant Access Token

1. Open Home Assistant: `http://pi:8123`
2. Click your profile (bottom-left sidebar)
3. Scroll down to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Name: `heater-watchdog`
6. **Copy the token immediately** (you cannot view it again!)

### Step 2: Configure Environment

On the Pi, create/edit `/opt/zigbee2mqtt/.env`:

```bash
ssh pi@pi
echo "HEATER_WATCHDOG_HA_TOKEN=your_token_here" >> /opt/zigbee2mqtt/.env
```

### Step 3: Deploy

```bash
# Copy service files
scp -r services/heater-watchdog pi@pi:/opt/pi-setup/services/

# Copy updated docker-compose
scp configs/zigbee2mqtt/docker-compose.yml pi@pi:/opt/zigbee2mqtt/

# Build and start
ssh pi@pi "cd /opt/zigbee2mqtt && docker-compose up -d --build heater-watchdog"
```

### Step 4: Verify

```bash
# Check container is running
ssh pi@pi "docker ps | grep heater-watchdog"

# Watch logs
ssh pi@pi "docker logs heater-watchdog -f"
```

## Configuration

Environment variables in `docker-compose.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `HA_URL` | `http://homeassistant:8123` | Home Assistant URL |
| `HA_TOKEN` | (required) | Long-lived access token |
| `CHECK_INTERVAL` | `300` | Seconds between checks |
| `NOTIFY_SERVICE` | `notify.mobile_app_22111317pg` | HA notification service |
| `TZ` | `Europe/Berlin` | Timezone |

## Monitored Entities

### Contact Sensors (8)

| Entity | Location |
|--------|----------|
| `binary_sensor.bath_window_contact_sensor_contact` | Bathroom Window |
| `binary_sensor.bed_window_contact_sensor_contact` | Bedroom Window |
| `binary_sensor.kitchen_window_contact_sensor_contact` | Kitchen Window |
| `binary_sensor.study_window_contact_sensor_large_contact` | Study Large Window |
| `binary_sensor.study_window_contact_sensor_small_contact` | Study Small Window |
| `binary_sensor.living_window_contact_sensor_balcony_door_contact` | Balcony Door |
| `binary_sensor.living_window_contact_sensor_window_contact` | Living Window |
| `binary_sensor.hallway_window_contact_sensor_main_door_contact` | Main Door |

### Thermostats (4)

| Entity | Location |
|--------|----------|
| `climate.study_thermostat` | Study |
| `climate.living_thermostat_inner` | Living Room (Inner Wall) |
| `climate.living_thermostat_outer` | Living Room (Outer Wall) |
| `climate.bed_thermostat` | Bedroom |

## Logs

```bash
# View live logs
docker logs heater-watchdog -f

# Last 100 lines
docker logs heater-watchdog --tail 100

# Search for violations
docker logs heater-watchdog 2>&1 | grep VIOLATION
```

### Log Output Example

```
================================================================================
       HEATER SAFETY WATCHDOG
       Independent safety monitor for heater-window violations
       Runs every 5 minutes as defense-in-depth layer
================================================================================

[2024-12-27 10:00:00] [INFO] Configuration:
[2024-12-27 10:00:00] [INFO]   HA_URL: http://homeassistant:8123
[2024-12-27 10:00:00] [INFO]   CHECK_INTERVAL: 300s (5min)
[2024-12-27 10:00:00] [INFO]   Monitoring 8 contact sensors
[2024-12-27 10:00:00] [INFO]   Monitoring 4 thermostats
[2024-12-27 10:00:00] [INFO] Testing connection to http://homeassistant:8123...
[2024-12-27 10:00:00] [INFO] Connected to Home Assistant: API running.
[2024-12-27 10:00:00] [INFO] Starting safety monitoring loop...
============================================================
[2024-12-27 10:00:00] [INFO] ============================================================
[2024-12-27 10:00:00] [INFO] Performing safety check...
[2024-12-27 10:00:00] [INFO] Open windows/doors: 0 - None
[2024-12-27 10:00:00] [INFO] Heaters actively heating: 0 - None
[2024-12-27 10:00:00] [INFO] Safety check: OK
```

## Troubleshooting

### Container Won't Start

```bash
# Check for errors
docker logs heater-watchdog

# Common issues:
# - HA_TOKEN not set -> Add to .env file
# - Network issues -> Check HA container is running
```

### "Failed to connect to Home Assistant"

```bash
# Verify HA is running
docker ps | grep homeassistant

# Test connectivity from watchdog container
docker exec heater-watchdog wget -O- http://homeassistant:8123/api/ 2>&1
```

### "HTTP error 401: Unauthorized"

- Token is invalid or expired
- Create a new long-lived access token in HA

### Notifications Not Received

1. Check `NOTIFY_SERVICE` matches your HA notification service
2. Verify mobile app is configured in HA:
   - Settings -> Devices -> Mobile App -> Check it exists

## Recovery

After Pi rebuild:

1. Create new HA access token (Step 1 above)
2. Set `HEATER_WATCHDOG_HA_TOKEN` in `/opt/zigbee2mqtt/.env`
3. Run: `docker-compose up -d --build heater-watchdog`

## Testing

### Manual Test Procedure

1. Open a window (any of the 8 monitored)
2. Manually turn on a heater via HA UI
3. Wait for next check (or restart container: `docker restart heater-watchdog`)
4. Verify:
   - Logs show "SAFETY VIOLATION"
   - Heaters turn off
   - Mobile notification received

### Local Testing (Mac)

```bash
cd services/heater-watchdog
export HA_URL="http://pi:8123"
export HA_TOKEN="your_token"
export CHECK_INTERVAL=30  # Faster for testing
python3 heater-watchdog.py
```

## Related: HA Watchdog Recovery Automation

In addition to this Python watchdog service, there's an HA automation (`watchdog_recovery_resume_check`) that runs **every 1 minute** to catch missed resume triggers.

```
┌─────────────────────────────────────────────────────────────────┐
│              WATCHDOG RECOVERY (HA Automation)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TRIGGER: Every 1 minute                                        │
│                                                                 │
│  CHECKS:                                                        │
│  1. Is guard flag ON? (window OR CO2)                           │
│  2. Are ALL 8 sensors closed?                                   │
│  3. If CO2 guard: Is CO2 < 1100 ppm?                            │
│                                                                 │
│  ACTION:                                                        │
│  - Window guard ON → Trigger all_windows_closed_resume          │
│  - CO2 guard ON + CO2 low → Trigger co2_low_resume_heaters      │
│                                                                 │
│  PURPOSE:                                                       │
│  Catch cases where event-driven resume missed threshold         │
│  crossing (e.g., HA busy, value jumped over threshold)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Bug Fixed (2025-12-31):** Originally only checked window guard flag. Now also checks CO2 guard to catch CO2-triggered shutoffs where resume was missed.

See `docs/15-ha-automations.md` for full details.
