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
│  secrets.yaml is NOT in git (gitignored by configs/**/secrets.yaml).         │
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
│  │  z2m_bridge_state_alert      │ CRITICAL │   ✓     │   ✓   │ bridge LWT │ │
│  │  zigbee_any_device_offline   │ branched │         │   ✓   │ +/avail    │ │
│  │  zigbee_any_device_back_online│INFO     │         │   ✓   │ +/avail    │ │
│  │  zigbee-ghost-sweep (script) │ CRITICAL │         │   ✓   │ 03:30+15:30│ │
│  │  contact_sensor_offline_alert│ WARNING  │   ✓     │   ✓   │ Unavail    │ │
│  │  zigbee_router_offline_alert │ CRITICAL │         │   ✓   │ Unavail 2m │ │
│  │  thermostat_low_battery_alert│ WARNING  │         │   ✓   │ Batt < 30% │ │
│  │  zigbee_router_online_alert  │ INFO     │         │   ✓   │ Recovery   │ │
│  │  email_delivery_failure      │ CRITICAL │   ✓     │       │ SMTP error │ │
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

## Google Assistant — device_class → Trait Mapping (Apr 18, 2026)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  DO NOT expose binary_sensors to Google unless their device_class maps      │
│  to a Google smart-home trait. HA's google_assistant component silently     │
│  drops untyped entities at SYNC, but report_state keeps pushing → 404s.    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Mapping table

| device_class                    | Google trait           | Supported? | Notes                          |
|---------------------------------|------------------------|------------|--------------------------------|
| `door` / `window` / `garage_door` / `opening` | `OpenClose` | ✓ Yes  | Maps to `SENSOR` with open percent |
| `smoke` / `gas` / `co` / `co2`  | `SensorState`          | ✓ Yes      | Reports hazard on/off           |
| `moisture` / `leak`             | `SensorState`          | ✓ Yes      | Water leak detection            |
| `lock`                          | `LockUnlock`           | ✓ Yes      | Bi-directional lock control     |
| `battery` (numeric sensor)      | `EnergyStorage`        | ✓ Yes      | Sensor domain only              |
| `temperature` / `humidity`      | `TemperatureSetting` / `HumiditySetting` | ✓ Yes | Query-only sensors     |
| `occupancy`                     | — **no trait**         | ✗ NO       | → 404 loop in report_state      |
| `motion`                        | — **no trait**         | ✗ NO       | → 404 loop in report_state      |
| `vibration`                     | — **no trait**         | ✗ NO       | → 404 loop in report_state      |
| `presence`                      | — **no trait**         | ✗ NO       | → 404 loop in report_state      |
| `sound`                         | — **no trait**         | ✗ NO       |                                |
| `tamper`                        | — **no trait**         | ✗ NO       |                                |
| `running` / `update` / `plug`   | — **no trait**         | ✗ NO       |                                |

### Rule

- **Before** adding `expose: true` for a `binary_sensor` in `configuration.yaml`, check its
  `device_class` against the table above.
- If the class is in the "no trait" rows, set `expose: false` — keep it in the
  entity_config block for aliases/documentation, but HA won't try to push it.
- The "good" classes generally get `action.devices.types.SENSOR` with the listed
  trait. Sensor domain entities (`sensor.*`) follow a similar table but are
  trait-richer (temperature, humidity, CO2, air quality all work).

### Detecting silent drift

If the 404s ever resurface, the automation `google_assistant_integration_error`
(in `automations.yaml`) fires an email within seconds of the first error and
then throttles itself for 24h. The email lists the offending log line so you
can trace it back to a specific entity.

### Incident history

On 2026-04-18 an audit found 3 entities stuck in this trap:
- `binary_sensor.mailbox_motion_sensor_occupancy` (occupancy — no trait)
- `binary_sensor.vibration_sensor_vibration` (vibration — no trait)
- `binary_sensor.human_presence_occupancy` (stale entity_id, didn't even exist
  in HA; legacy config from before per-room presence sensor rename)

All three had been silently 404-ing for days. Fixed by flipping `expose: false`
(first two) and removing the stale block (third). Zero 404s in the 5 min after
the HA restart that applied the config.

---

## Smart Plug Network LED Management (Apr 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SMART PLUG BLUE LED: DISABLE + RECONNECT SAFETY NET                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROBLEM: SONOFF S60ZBTPF smart plugs have a bright blue network-status      │
│  LED that disturbs sleep in the bedroom at night. The built-in Z2M           │
│  converter does not expose a control for it.                                 │
│                                                                              │
│  FIX (two parts):                                                            │
│                                                                              │
│  1. Z2M external converter at configs/zigbee2mqtt/external_converters/       │
│     sonoff-s60zbtpf-network-indicator.js wraps the built-in definition       │
│     and appends a `network_indicator` binary toggle that writes the          │
│     `networkLed` attribute (cluster 0xFC11, ID 0x0001). Setting OFF          │
│     persists in firmware.                                                    │
│                                                                              │
│  2. HA automation `smart_plug_disable_network_led_on_reconnect` triggers     │
│     when any of switch.smart_plug_1/2/3 transitions from `unavailable`       │
│     back to a real state. After a 5s settle delay it re-writes               │
│     `{"network_indicator": false}` over MQTT. This guards against the        │
│     unverified risk of firmware defaulting to ON after a power cycle.        │
│                                                                              │
│  TRADE-OFF: also fires on every Z2M restart. Harmless - it just re-writes    │
│  the same value the firmware already holds.                                  │
│                                                                              │
│  Template trick: plug_num is derived from trigger.entity_id.split('_')|last │
│  to build the Z2M topic `zigbee2mqtt/Smart Plug [{{plug_num}}]/set` without  │
│  hard-coding three per-plug copies of the same action.                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Related Files

| File | Purpose |
|------|---------|
| `configs/zigbee2mqtt/external_converters/sonoff-s60zbtpf-network-indicator.js` | Exposes `network_indicator` on S60ZBTPF |
| `automations.yaml` - `smart_plug_disable_network_led_on_reconnect` | Re-writes OFF on reconnect |
| `docs/15-ha-automations.md` - Smart Plug LED Management | User-facing reference |

---

## History

- **Apr 20, 2026** (commit 2713492): Code-review fixes on the offline coverage
  - **Storm-guard race fix**: L1a captured `storm_count` in a `variables:`
    snapshot at trigger-queue time, so 6+ rapid offlines all saw count=0
    pre-increment and none hit threshold. Fixed by reading counter via
    `states('counter.zigbee_offline_storm_count')` AFTER `counter.increment`.
    Verified live: 7 rapid MQTT offlines now produce exactly 5 per-device +
    1 summary + 1 silent suppression.
  - **L1b recovery storm guard**: previously had no guard, so a Z2M restart
    recovering 48 devices = 48 INFO emails. Mirrored L1a's pattern with new
    helpers `counter.zigbee_recovery_storm_count` + `input_datetime.zigbee_
    recovery_storm_{window_start,summary_last}`.
  - **Ghost-sweep re-pair detection**: re-pairing a device gives it a new
    IEEE while the friendly_name persists in Z2M config. The diff was
    flagging old IEEE as a ghost. Now: if a ghost's friendly_name matches
    any newcomer's friendly_name in the same sweep, log INFO "RE-PAIR"
    and skip the alert + self-heal.
  - **HTML escape on email template**: added `| e` filter to
    `subtitle`/`description`/`details`/`actions`/`title` in
    `script.send_alert_email`. Closes a low-impact HTML-injection vector
    via attacker-controlled friendly_names.
  - **Tightened L4 trigger**: was matching any log entry containing 'smtp'
    + 'auth|fail|connect'. Now matches only the specific HA SMTP notify
    logger names. Avoids false-positive phone pushes.
  - User-facing reference doc added: `docs/22-zigbee-offline-monitoring.md`.

- **Apr 20, 2026**: Universal Zigbee offline email coverage (4 new layers)
  - Triggered by `[Living] Light Switch` silently vanishing from `bridge/devices`
    ~22 days before discovery — neither retained `availability=offline` was
    ever published nor a `device_leave` event fired. Existing per-entity
    automations couldn't catch the class.
  - **L0** `z2m_bridge_state_alert` — watches `zigbee2mqtt/bridge/state` LWT,
    flips `input_boolean.z2m_online`, sends critical email on Z2M down +
    recovery on bridge return. Used as condition gate for L1 + L3.
  - **L1a** `zigbee_any_device_offline_alert_wildcard` — MQTT wildcard
    `+/availability` covers ALL current + future devices. Has storm guard
    (6+ offline within 5 min → ONE summary email instead of N), 30-min
    startup grace via `input_boolean.ha_startup_complete`, severity
    branching by `friendly_name` pattern (contact=WARN, plug/switch/
    presence=CRIT, others=INFO), and `input_text.zigbee_offline_exclusions`
    for wall-switch-controlled lights.
  - **L1b** `zigbee_any_device_back_online_wildcard` — INFO recovery email.
  - **L4** `email_delivery_failure_fallback` — phone-push fallback if SMTP
    itself fails (same throttled pattern as `google_assistant_integration_error`).
  - **L3** standalone systemd timer `zigbee-ghost-sweep.timer` (03:30 + 15:30
    daily) runs `services/zigbee-ghost-sweep/` Python script that diffs
    `bridge/devices` against `/var/lib/zigbee-ghost-sweep/snapshot.json`.
    On silent removal: CRITICAL email + publishes retained
    `availability={"state":"offline"}` to fix the lying state. Catches the
    Living-Switch incident class.
  - **NEW helpers**: input_boolean.z2m_online (initial:on),
    input_boolean.ha_startup_complete, input_text.zigbee_offline_exclusions,
    counter.zigbee_offline_storm_count, input_datetime.{zigbee_offline_storm_window_start,
    zigbee_offline_storm_summary_last, email_delivery_alert_last}.
  - **Defense-in-depth**: existing `contact_sensor_offline_alert`,
    `zigbee_router_offline_alert`, `thermostat_low_battery_alert`,
    `zigbee_router_online_alert` are kept. Some devices now get redundant
    alerts (~20 of 48); accepted per the project's documented defense-in-depth
    ethos. The wildcard fills gaps for the 27 previously uncovered devices
    AND any device added in the future.
  - Total automations: 78 -> 83.
  - Verified live: fake `[Test] Fake Device` offline payload triggered the
    wildcard automation cleanly (counter increment + send_alert_email path).
    Ghost-sweep service deployed; first-run snapshot saved 47 devices.

- **Apr 19, 2026**: Smart plug blue network LED disable + reconnect safety net
  - New Z2M external converter exposes `network_indicator` on SONOFF S60ZBTPF
    (the built-in converter omits it; sibling ZBMINIR2 has it natively)
  - Wraps built-in definition via `require(...).definitions` + spread pattern
    so all existing features (metering, inching control, overload protection)
    are preserved
  - New automation `smart_plug_disable_network_led_on_reconnect` (parallel,
    max: 10) re-writes OFF after 5s settle whenever a plug transitions from
    `unavailable` → real state
  - All 3 plugs verified: device read-back returns `network_indicator=false`
    from firmware; blue LEDs physically off
  - Total automations: 77 -> 78

- **Apr 18, 2026**: Google Home integration audit + drift fix
  - Found 3 entities (mailbox occupancy, hot-water vibration, stale presence)
    causing ~11 silent `reportStateAndNotification` 404s/day
  - Flipped `expose: false` for the 2 unsupported device_classes, removed
    the 1 stale entity_config block
  - New automation: `google_assistant_integration_error` (email on any
    google_assistant ERROR log, throttled 1/day)
  - New helper: `input_datetime.google_assistant_alert_last`
  - New doc: device_class → Google trait mapping table (this file)
  - New tool: `scripts/google-home-audit.sh` for repeat audits

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
