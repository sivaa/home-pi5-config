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
|                                                             |
|  Layer 2: Heater Watchdog (Poll-Based, 5min intervals)      |
|  +- This service - catches anything Layer 1 might miss     |
+------------------------------------------------------------+
```

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
