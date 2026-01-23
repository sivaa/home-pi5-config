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

## History

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
