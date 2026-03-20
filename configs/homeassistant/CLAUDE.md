# Home Assistant Configuration

> **Purpose:** Smart home automation hub for Zigbee devices, thermostat control, and service orchestration
> **Container:** ghcr.io/home-assistant/home-assistant:stable
> **Port:** 8123 (web UI and API)

---

## Container Setup (CRITICAL)

Home Assistant runs in Docker with specific requirements:

```bash
docker run -d \
  --name homeassistant \
  --restart unless-stopped \
  -v /opt/homeassistant:/config \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --network host \
  -e TZ=Europe/Berlin \
  ghcr.io/home-assistant/home-assistant:stable
```

### Why These Settings Matter

| Setting | Purpose | What Breaks Without It |
|---------|---------|------------------------|
| `-v /var/run/docker.sock:/var/run/docker.sock` | Allow HA to control Docker containers | shell_commands using `docker` or Docker API fail |
| `--network host` | Direct access to host ports (8123, MQTT 1883) | API not accessible from localhost, MQTT discovery fails |
| `-v /opt/homeassistant:/config` | Persist configuration | All config lost on restart |

---

## Docker Socket Access (Jan 16, 2026 Learning)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HA DOCKER INTEGRATION                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PROBLEM:                                                                   │
│  shell_command runs INSIDE the HA container, not on the host.               │
│  Docker CLI (`docker start`) isn't in the HA image.                         │
│                                                                             │
│  SOLUTION:                                                                  │
│  1. Mount Docker socket: -v /var/run/docker.sock:/var/run/docker.sock       │
│  2. Use curl to talk to Docker API via socket                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WRONG (won't work):                                                        │
│  shell_command:                                                             │
│    start_container: "docker start my-container"                             │
│                                                                             │
│  CORRECT:                                                                   │
│  shell_command:                                                             │
│    start_container: "curl -s --unix-socket /var/run/docker.sock \           │
│                      -X POST http://localhost/v1.44/containers/NAME/start"  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Docker API Quick Reference

```bash
# Start a container
curl -s --unix-socket /var/run/docker.sock \
  -X POST http://localhost/v1.44/containers/CONTAINER_NAME/start

# Stop a container
curl -s --unix-socket /var/run/docker.sock \
  -X POST http://localhost/v1.44/containers/CONTAINER_NAME/stop

# Restart a container
curl -s --unix-socket /var/run/docker.sock \
  -X POST http://localhost/v1.44/containers/CONTAINER_NAME/restart

# Check container status
curl -s --unix-socket /var/run/docker.sock \
  http://localhost/v1.44/containers/CONTAINER_NAME/json | jq .State.Status
```

---

## Authentication

### Long-Lived Access Tokens

Create at: HA UI → Profile → Security → Long-lived access tokens

**Current tokens used by:**
- `dashboard/www/js/stores/weather-store.js`
- `dashboard/www/js/stores/thermostat-store.js`
- `dashboard/www/js/stores/transport-store.js`

**Token format:** JWT starting with `eyJhbG...`

**API usage:**
```javascript
fetch('http://pi:8123/api/services/shell_command/start_data_scraper', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbG...',  // Long-lived token
  },
});
```

---

## Shell Commands

Defined in `configuration.yaml`:

```yaml
shell_command:
  # Uses Docker socket API (docker CLI not in HA image)
  start_data_scraper: "curl -s --unix-socket /var/run/docker.sock -X POST http://localhost/v1.44/containers/data-scraper/start"
```

**Call via API:**
```bash
curl -X POST http://localhost:8123/api/services/shell_command/start_data_scraper \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

---

## Key Files

| File | Purpose |
|------|---------|
| `configuration.yaml` | Main config, shell_commands, http settings |
| `automations.yaml` | Event-driven automation rules |
| `scripts.yaml` | Reusable action sequences |
| `SERVICE_ACCOUNT.json` | Google Assistant integration credentials |

---

## Network Configuration

### HTTP Settings

```yaml
http:
  server_port: 8123
  use_x_forwarded_for: true
  cors_allowed_origins:
    - http://localhost:8888   # Local dashboard testing
    - http://127.0.0.1:8888
    - http://pi:8888
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 172.16.0.0/12          # Docker networks
    # Cloudflare IPs...
```

### Why Host Network?

With `--network host`:
- HA listens directly on host's port 8123
- Can access localhost services (MQTT on 1883)
- No port mapping needed

With bridge network:
- Need explicit port publish (`-p 8123:8123`)
- Service discovery may fail
- MQTT connection to `localhost:1883` won't work

---

## Troubleshooting

### HA Not Responding on Port 8123

```bash
# Check if HA is listening
docker exec homeassistant netstat -tlnp | grep 8123

# Check network mode
docker inspect homeassistant --format '{{.HostConfig.NetworkMode}}'
# Should be: host

# If bridge network, need to recreate with --network host
docker rm -f homeassistant
# Re-run with --network host
```

### Shell Command Returns 401 Unauthorized

Dashboard API calls need auth token:
```javascript
// WRONG - no auth
fetch('http://pi:8123/api/services/shell_command/start', { method: 'POST' })

// CORRECT - with token
fetch('http://pi:8123/api/services/shell_command/start', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer eyJhbG...' }
})
```

### Shell Command Doesn't Start Container

1. Check Docker socket is mounted:
   ```bash
   docker exec homeassistant ls -l /var/run/docker.sock
   ```

2. Test Docker API from inside HA:
   ```bash
   docker exec homeassistant curl -s --unix-socket /var/run/docker.sock \
     http://localhost/v1.44/version
   ```

3. Check shell_command uses curl, not docker CLI

---

## 🚨 CRITICAL: Service Hostnames with Host Network

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INCIDENT: Jan 17, 2026 - Heaters stuck OFF for 2+ hours                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CAUSE: After switching to --network host, MQTT and InfluxDB were still    │
│  configured with Docker hostnames ("mosquitto", "influxdb") instead of     │
│  "localhost". Host network can't resolve Docker container names!           │
│                                                                             │
│  SYMPTOMS:                                                                  │
│  - HA startup errors: "Failed to resolve 'mosquitto'"                      │
│  - Automations fail silently                                                │
│  - Watchdog scheduler enters bad state                                      │
│  - Heater guard never releases even when conditions are met                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  RULE: When using --network host, ALL service connections must use         │
│  "localhost" or "127.0.0.1", NEVER Docker container names!                 │
│                                                                             │
│  ✗ WRONG:  broker: "mosquitto"     host: "influxdb"                        │
│  ✓ RIGHT:  broker: "localhost"     host: "localhost"                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Connection Settings (MUST use localhost)

| Service | Config Location | Correct Setting |
|---------|-----------------|-----------------|
| MQTT | `.storage/core.config_entries` | `"broker": "localhost"` |
| InfluxDB | `configuration.yaml` | `host: localhost` |

### Why Docker Hostnames Don't Work

```
Bridge Network (zigbee2mqtt_default):
├─ Docker provides internal DNS
├─ "mosquitto" → 172.18.0.x ✓
└─ "influxdb" → 172.18.0.y ✓

Host Network (--network host):
├─ Shares host's network namespace
├─ No Docker DNS available
├─ "mosquitto" → DNS FAILURE ✗
├─ "influxdb" → DNS FAILURE ✗
└─ "localhost:1883" → Works ✓ (ports published to host)
```

---

## CO2 Episode Tracking (Jan 23, 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CO2 EPISODE STATE MACHINE                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  IDLE STATE (not tracking):                                                 │
│    co2_high_started = "1970-01-01 00:00:00" (sentinel)                      │
│    co2_window_opened = "1970-01-01 00:00:00" (sentinel)                     │
│                                                                             │
│                   ↓ CO2 crosses 1200 ppm                                    │
│                                                                             │
│  TRACKING STATE:                                                            │
│    co2_high_started = when CO2 first went high                              │
│    co2_window_opened = when first window opened (or still sentinel)         │
│                                                                             │
│                   ↓ CO2 drops below 500 ppm                                 │
│                                                                             │
│  ANNOUNCE + RESET:                                                          │
│    TTS: "CO2 was high for X minutes, ventilated in Y minutes"               │
│    Reset both to sentinel                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Was Built

**Problem:** The original `co2_good_level` TTS message showed wrong ventilation time because it used `automation.co2_alert.attributes.last_triggered`, which gets reset every 30 minutes by the reminder automation.

**Solution:** Use persistent `input_datetime` helpers with sentinel value pattern:
- Sentinel = `"1970-01-01 00:00:00"` (timestamp < 86400)
- Track two metrics: episode duration + ventilation duration
- Survives HA restarts (unlike `last_changed`)

### Key Entities

| Entity | Purpose |
|--------|---------|
| `input_datetime.co2_high_started` | When CO2 first crossed 1200 ppm |
| `input_datetime.co2_window_opened` | When first window opened during episode |

### Related Automations

| Automation | Trigger | Action |
|------------|---------|--------|
| `co2_episode_start` | CO2 > 1200 | Set `co2_high_started` (if sentinel) |
| `co2_episode_window_opened` | Any window opens | Set `co2_window_opened` (if episode active & sentinel) |
| `co2_episode_cleanup_on_start` | HA starts | Reset both to sentinel |
| `co2_good_level` | CO2 < 500 | Calculate metrics, announce, reset |

### Sentinel Value Pattern

```jinja2
{# In templates, check if tracking is active: #}
{% set sentinel = 86400 %}  {# 1 day after epoch #}
{% set ts = as_timestamp(states('input_datetime.co2_high_started')) | default(0) %}
{% if ts > sentinel %}
  {# Episode is active #}
{% else %}
  {# Not tracking #}
{% endif %}
```

### Example TTS Output

```
"Thanks Nithya! Air quality is good now. CO2 was high for 45 minutes,
 ventilated in 30 minutes. You can close the windows."
```

---

## Email Notifications (Gmail SMTP)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EMAIL NOTIFICATION SETUP                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SERVICE:   notify.email                                                     │
│  PROVIDER:  Gmail SMTP (smtp.gmail.com:587, STARTTLS)                       │
│  SENDER:    zoobave@gmail.com                                                │
│  RECIPIENT: siva@sivaa.net                                                   │
│  AUTH:      Gmail App Password stored in secrets.yaml                        │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  USAGE IN AUTOMATIONS:                                                       │
│                                                                              │
│  - service: notify.email                                                     │
│    data:                                                                     │
│      title: "Alert Title"                                                    │
│      message: "Alert details here"                                           │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  CREDENTIALS:                                                                │
│  secrets.yaml is NOT in git (gitignored).                                    │
│  If recreating from scratch:                                                 │
│    1. Log into zoobave@gmail.com                                             │
│    2. Enable 2FA → Create App Password → name "Pi Home Assistant"            │
│    3. Create /opt/homeassistant/secrets.yaml:                                │
│       gmail_app_password: "xxxx xxxx xxxx xxxx"                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Testing Email

```bash
# Via HA API
ssh pi@pi "curl -s -X POST http://localhost:8123/api/services/notify/email \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{\"title\": \"Test\", \"message\": \"Email works!\"}'"

# Or use HA Developer Tools → Services → notify.email
```

### Troubleshooting

| Problem | Check |
|---------|-------|
| HA won't start after adding SMTP | `docker logs homeassistant \| grep -i smtp` - likely secrets.yaml missing |
| Email not arriving | Check spam folder. Gmail may block first send from new App Password |
| Authentication error | Regenerate App Password. Ensure 2FA is still enabled on zoobave@gmail.com |
| `secrets.yaml` not found | File must be at `/opt/homeassistant/secrets.yaml` (same dir as configuration.yaml) |

---

## Bathroom Presence Lighting (Feb 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BATHROOM LIGHT LIFECYCLE                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WHY BATHROOM IS DIFFERENT FROM OTHER ROOMS:                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  Study/Living/Bed: SONOFF relay switch CUTS POWER to IKEA bulb       │   │
│  │  → Power restored = IKEA defaults to ON (hardware behavior)          │   │
│  │                                                                       │   │
│  │  Bathroom: AwoX smart bulb has NO relay switch                        │   │
│  │  → Zigbee turn_off = software off (bulb still powered)               │   │
│  │  → Needs explicit Zigbee turn_on to light up again                    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  FLOW:                                                                       │
│  ① Person enters → SNZB-06P occupancy: ON                                   │
│  ② bath_presence_light_on → light.turn_on                                   │
│  ③ circadian_power_on → sets brightness + 2200K (already existed)           │
│  ④ Person leaves → 3 min grace → bath_presence_light_off                    │
│  ⑤ Light OFF + circadian override cleared → ready for next visit            │
│                                                                              │
│  DUAL-TRIGGER PATTERN (both ON and OFF):                                     │
│  • State trigger: instant response to presence change                        │
│  • time_pattern /5: fallback catches HA restarts mid-visit                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related Automations

| Automation | ID | Trigger | Action |
|------------|-----|---------|--------|
| [Bath] Light On When Occupied | `bath_presence_light_on` | Presence ON | `light.turn_on` (circadian handles brightness) |
| [Bath] Light Off When Unoccupied | `bath_presence_light_off` | Presence OFF for 3 min | `light.turn_off` + clear circadian override |

### Key Entities

| Entity | Purpose |
|--------|---------|
| `light.bath_light` | AwoX 33955 smart light (primary control) |
| `binary_sensor.bath_human_presence_occupancy` | SNZB-06P mmWave presence sensor |
| `input_boolean.circadian_bath_override` | Manual brightness override (cleared on auto-off) |

---

## Alert Automations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ALERT NOTIFICATION SYSTEM                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CHANNELS:                                                                   │
│    Phone → notify.all_phones → Nithya only                                   │
│    Email → notify.email      → siva@sivaa.net only                           │
│                                                                              │
│  ┌──────────────────────────────┬──────────┬─────────┬───────┬────────────┐ │
│  │  Automation                  │ Severity │ Nithya  │ Siva  │ Trigger    │ │
│  │                              │          │ (phone) │(email)│            │ │
│  ├──────────────────────────────┼──────────┼─────────┼───────┼────────────┤ │
│  │  zigbee_device_left_alert    │ CRITICAL │   ✓     │   ✓   │ MQTT leave │ │
│  │  contact_sensor_offline_alert│ WARNING  │   ✓     │   ✓   │ Unavail    │ │
│  │  zigbee_router_offline_alert │ CRITICAL │         │   ✓   │ Unavail 2m │ │
│  │  thermostat_low_battery_alert│ WARNING  │         │   ✓   │ Batt < 30% │ │
│  │  zigbee_router_online_alert  │ INFO     │         │   ✓   │ Recovery   │ │
│  └──────────────────────────────┴──────────┴─────────┴───────┴────────────┘ │
│                                                                              │
│  Siva: email-only (removed from phone group Feb 2026).                       │
│  Nithya: phone push for critical events needing immediate action.            │
│  Router alerts: email-only (12 devices, phone too noisy).                    │
│  Router recovery: INFO email (resolves offline alert in inbox).               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Zigbee Router Monitoring

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MONITORED ROUTERS (always-powered — offline = real problem)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Smart Plug [1], [2], [3]          mains-powered                            │
│  [Study] Light Switch              hardwired SONOFF                          │
│  [Bed] Light Switch                hardwired SONOFF                          │
│  [Living] Light Switch             hardwired SONOFF                          │
│  [Hallway] CO2 Sensor              USB-powered (NOUS E10, router)            │
│  [Study] Human Presence            USB-powered (SNZB-06P, router)            │
│  [Living] Human Presence           USB-powered (SNZB-06P, router)            │
│  [Kitchen] Human Presence          USB-powered (SNZB-06P, router)            │
│  [Bath] Human Presence             USB-powered (SNZB-06P, router)            │
│  [Bed] Human Presence              USB-powered (SNZB-06P, router)            │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  EXCLUDED (manually powered off via wall switch — false positives)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Study] IKEA Light                wall switch                               │
│  [Living] IKEA Light               wall switch                               │
│  [Bath] Light (AwoX)               wall switch                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**If adding a new always-powered device**, add it to BOTH automations:
- `zigbee_router_offline_alert` (trigger + device_names)
- `zigbee_router_online_alert` (trigger + device_names)

---

## Temperature-Reached Energy Cap (Feb 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ENERGY CAP — PER-ROOM AUTO-LOWER WHEN WARM ENOUGH                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROBLEM: User sets thermostat to 22°C, forgets to lower it.                │
│  Room stays at 22°C cycling the heater endlessly.                            │
│                                                                              │
│  FIX: When a room's actual temp reaches 21°C → lower THAT ROOM             │
│  to 19°C. Other rooms untouched.                                             │
│                                                                              │
│  Study hits 21°C      Living still 18°C    Bedroom still 17°C               │
│  ────────────────      ────────────────     ──────────────────               │
│  22°C → 19°C (cap!)   22°C (untouched)     22°C (untouched)                 │
│                                                                              │
│  CONSTANTS:                                                                  │
│    ROOM_TEMP_THRESHOLD: 21°C                                                 │
│    ENERGY_CAP_SETPOINT: 19°C                                                 │
│                                                                              │
│  DUAL TRIGGER (complete coverage):                                           │
│    A) numeric_state: room temp crosses above 21°C                            │
│    B) state/attribute: setpoint changes while room already >21°C             │
│                                                                              │
│  LOOP PREVENTION: setpoint > 19 condition stops self-triggered re-fires     │
│                                                                              │
│  EXCLUSIONS:                                                                 │
│    - Window/CO2 guard active → heaters already off                           │
│    - hvac_mode = off → not heating                                           │
│                                                                              │
│  STARTUP CHECK: Companion automation runs 30s after HA start                 │
│                 (numeric_state only fires on crossing, not while above)       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related Automations

| Automation | ID | Trigger | Action |
|------------|-----|---------|--------|
| Energy Cap | `temperature_reached_energy_cap` | Room >21°C OR setpoint change | Lower that room to 19°C |
| Energy Cap Startup | `temperature_reached_energy_cap_startup` | HA start | Cap warm rooms with high setpoints |

---

## Anomalous Setpoint Guard (Feb 9, 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANOMALOUS SETPOINT GUARD — Catches dropped set_temperature commands        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INCIDENT: Living Inner TRV at 4°C setpoint in heat mode for 2+ hours      │
│  Resume sent set_temperature(19°C) while TRV was offline → command lost     │
│  TRV came online with mode=heat + firmware default 4°C                      │
│                                                                              │
│  DETECTION: mode=heat AND setpoint < 10°C AND guard flags OFF               │
│  THRESHOLD: 10°C (6°C below lowest legitimate 16°C schedule setting)        │
│  ACTION: Restore from input_number.*_heater_saved_temp (or 18°C default)    │
│                                                                              │
│  THREE LAYERS:                                                               │
│    Layer 1: HA automation (instant on setpoint change + /10 min poll)        │
│    Layer 2: Verify-retry in resume automations (30s after initial restore)   │
│    Layer 3: Heater watchdog (5 min poll, reads saved temp from HA API)       │
│                                                                              │
│  ANTI-LOOP: Restores to ~19°C → energy cap may fire → 19°C > 10°C → safe  │
│  30s COOLDOWN: After guard flag changes, avoids racing with resume           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related Automations

| Automation | ID | Trigger | Action |
|------------|-----|---------|--------|
| Anomalous Setpoint Guard | `anomalous_setpoint_guard` | setpoint change + /10 min | Restore from saved temp |
| Anomalous Guard Startup | `anomalous_setpoint_guard_startup` | HA start | Trigger main guard after 30s |

### Verify-Retry in Resume Automations

Both `all_windows_closed_resume_heaters` and `co2_low_resume_heaters` have a 30s verify-retry block that checks if each TRV's actual setpoint matches the saved temp. If divergence > 1°C, retries with MQTT open_window OFF + set_temperature.

---

## Stuck-Idle TRV Recovery (Feb 7, 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STUCK-IDLE RECOVERY — Defense-in-Depth                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INCIDENT: Living Inner TRV stuck idle 10+ hours (valve motor seized)        │
│  mode=heat, setpoint=19°C, temp=17.2°C, running_state=idle                  │
│  Valve voltage dropped 1770→1145 mV after 10h in OFF mode                   │
│                                                                              │
│  DETECTION (per-TRV, avoids room masking):                                   │
│    state=heat AND hvac_action=idle AND deficit≥2°C AND stuck>60min           │
│                                                                              │
│  TWO-PHASE RECOVERY:                                                         │
│    Phase 1 (gentle): MQTT open_window OFF + re-poke setpoint                │
│    Phase 2 (aggressive): off→heat→MQTT reset→setpoint (if Phase 1 fails)   │
│                                                                              │
│  RATE LIMIT: 3 attempts/hour per TRV (input_number + input_datetime)         │
│  ESCALATION: CRITICAL alert after 3 failures → manual fix needed             │
│  BATTERY: Skip auto-recovery if battery < 40% (alert only)                  │
│                                                                              │
│  Layer 1: HA Automation (15min poll, 60min threshold)                        │
│  Layer 2: Heater Watchdog (5min poll, 45min threshold)                      │
│  Layer 3: Zombie Recovery (OFF+7°C detection, now with last_changed>60min)  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related Automations

| Automation | ID | Trigger | Action |
|------------|-----|---------|--------|
| Stuck-Idle Recovery | `thermostat_stuck_idle_recovery` | time_pattern /15 + HA start | Two-phase recovery per TRV |
| Stuck-Idle Max Attempts | `thermostat_stuck_idle_max_attempts` | time_pattern /15 | CRITICAL alert when 3 attempts fail |

### Rate Limiting Helpers

| Entity | Purpose |
|--------|---------|
| `input_number.{room}_idle_recovery_count` | Recovery attempts in current window (0-10) |
| `input_datetime.{room}_idle_recovery_window_start` | When current 1-hour window started |

Rooms: `study`, `living_inner`, `living_outer`, `bedroom`

### Zombie Recovery Fix (Same Incident)

**Bug**: `temp < 17` guard in zombie recovery was masked when another TRV heated the same room.
**Fix**: Replaced with `last_changed > 60 min` — catches zombies regardless of room temperature.

---

## Outdoor Temperature-Based Setpoint Adjustment (Mar 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OUTDOOR TEMP SETPOINT RULES                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Outdoor > 10°C  →  TRV setpoint = 16°C                                     │
│  Outdoor 5-10°C  →  TRV setpoint = 17°C                                     │
│  Outdoor < 5°C   →  TRV setpoint = 18°C                                     │
│                                                                              │
│  SENSOR: sensor.balcony_temperature_humidity_temperature                     │
│                                                                              │
│  TRIGGER: Dual-trigger (threshold cross + /30 min poll + HA startup)         │
│                                                                              │
│  MANUAL OVERRIDE:                                                            │
│    Threshold crossings always enforce the new target.                         │
│    Periodic checks skip TRVs with setpoint > target (assumes manual raise). │
│    Override lasts until the next real threshold crossing event.               │
│                                                                              │
│  EXCLUSIONS:                                                                 │
│    - Window/CO2 guard active (heaters already off)                           │
│    - TRV in OFF mode                                                         │
│    - Bedroom night mode active                                               │
│    - Per-TRV or global boost active                                          │
│    - Setpoint already at or below target                                     │
│                                                                              │
│  SAVED TEMP SYNC:                                                            │
│    When setpoint is lowered, saved_temp helper is also updated.              │
│    This keeps resume automations (window close, CO2 low) consistent.         │
│    The save-floor in window/door/CO2 turn-off automations also uses          │
│    the same outdoor-temp-based thresholds instead of hardcoded 18°C.         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related Automations

| Automation | ID | Trigger | Action |
|------------|-----|---------|--------|
| Outdoor Temp Adjust | `outdoor_temp_adjust_setpoints` | Threshold cross + /30 min + startup | Lower setpoints based on outdoor temp |

### Interaction Matrix

| Automation | Interaction | Safe? |
|------------|-------------|-------|
| Energy cap (19°C) | Our max is 18°C < 19°C, cap never fires | Yes |
| Anomalous guard (<10°C) | Our min is 16°C > 10°C threshold | Yes |
| Boost (per-TRV + global) | Skipped during boost | Yes |
| Night mode (bedroom) | Bedroom skipped when night mode active | Yes |
| Window/CO2 resume | Saved temps updated, save floor is outdoor-based | Yes |
| Watchdog floor (18°C) | Conservative - outdoor auto corrects in 30 min | Acceptable |

---

## History

- **Mar 20, 2026**: Added outdoor temperature-based setpoint adjustment
  - Rule: >10°C=16°C, 5-10°C=17°C, <5°C=18°C
  - New: `outdoor_temp_adjust_setpoints` automation (threshold cross + /30 min poll)
  - Modified: Save floor in window/door/CO2 turn-off automations from hardcoded 18°C to outdoor-based
  - Manual overrides respected until next threshold crossing
  - Updates saved temp helpers to keep resume automations consistent

- **Feb 9, 2026**: Added anomalous setpoint guard (3-layer defense)
  - Incident: Living Inner TRV stuck at 4°C setpoint (heat mode) for 2+ hours
  - Root cause: set_temperature dropped during window resume (TRV was offline)
  - New: `anomalous_setpoint_guard` automation (instant + /10 min poll)
  - New: `anomalous_setpoint_guard_startup` companion automation
  - Enhanced: Window + CO2 resume automations with 30s verify-retry block
  - Enhanced: Heater watchdog with `check_anomalous_setpoints()` (Layer 3)
  - Threshold: 10°C (6°C below lowest legitimate 16°C schedule)
- **Feb 7, 2026**: Added stuck-idle TRV recovery + fixed zombie recovery masking
  - Incident: Living Inner TRV stuck idle 10+ hours, valve motor seized
  - Root cause: 10h in OFF mode → valve voltage degraded 1770→1145 mV
  - New: `thermostat_stuck_idle_recovery` automation (two-phase recovery)
  - New: `thermostat_stuck_idle_max_attempts` automation (escalation alert)
  - New: 8 HA helpers for rate limiting (4 counters + 4 datetime windows)
  - Fix: Zombie recovery `temp<17` → `last_changed>60min` (room masking bug)
  - Extended: Heater watchdog with backup stuck-idle detection (45min threshold)
- **Feb 6, 2026**: Added temperature-reached energy cap
  - Problem: Users set thermostats to 22°C and forget to lower them
  - Solution: When room temp reaches 21°C, auto-lower THAT room to 19°C (per-room, not all)
  - Dual-trigger pattern: numeric_state (crossing) + state/attribute (re-raise catch)
  - Loop prevention via `setpoint > 19` condition gate
  - Startup check companion catches HA restarts while room already warm
- **Feb 6, 2026**: Added bathroom auto-ON light when presence detected
  - Problem: AwoX bath light has no physical switch — unlike IKEA rooms with SONOFF relays
  - After auto-off, light stayed dark until manually turned on via dashboard
  - Solution: `bath_presence_light_on` automation with dual-trigger pattern
  - Circadian integration: `circadian_power_on` handles brightness/color_temp on turn-on
- **Feb 5, 2026**: Added email notifications via Gmail SMTP
  - Service: `notify.email` using `zoobave@gmail.com` → `siva@sivaa.net`
  - Credentials: `secrets.yaml` (gitignored) with Gmail App Password
  - Purpose: Paper trail for critical safety events (CO2, watchdog, device offline)
- **Feb 5, 2026**: Expanded router offline monitoring
  - Added: Bed + Living light switches, all 5 human presence sensors
  - Removed: IKEA lights + AwoX bath light (manually powered off, false positives)
  - Total: 12 routers monitored, 3 excluded
- **Jan 23, 2026**: Added CO2 episode tracking for accurate ventilation time announcements
  - Problem: `last_triggered` reset by 30-min reminders, showed wrong time in TTS
  - Solution: Sentinel-based `input_datetime` helpers + 3 new automations
  - Tracks: episode duration (CO2 > 1200 → < 500) + ventilation duration (window open → < 500)
  - Grammar: Singular/plural handling ("1 minute" vs "2 minutes")
- **Jan 17, 2026**: Fixed MQTT/InfluxDB hostname issue after network migration
  - Root cause: Using Docker hostnames with `--network host` causes DNS failures
  - Fix: Changed `"mosquitto"` → `"localhost"` in MQTT config
  - Fix: Changed `host: influxdb` → `host: localhost` in InfluxDB config
  - Impact: Heaters were stuck off for 2+ hours, CO2 resume automation couldn't fire
- **Jan 16, 2026**: Added Docker socket mount + shell_command for container control
  - Discovered: shell_commands run inside HA container, not host
  - Discovered: docker CLI not in HA image, must use curl + Docker API
  - Switched from `--network zigbee2mqtt_default` to `--network host`
  - **MISSED**: Updating MQTT/InfluxDB configs to use localhost (fixed Jan 17)
- **Dec 2024**: Initial setup with Zigbee2MQTT integration
