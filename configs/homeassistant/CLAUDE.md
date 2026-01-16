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

## History

- **Jan 16, 2026**: Added Docker socket mount + shell_command for container control
  - Discovered: shell_commands run inside HA container, not host
  - Discovered: docker CLI not in HA image, must use curl + Docker API
  - Switched from `--network zigbee2mqtt_default` to `--network host`
- **Dec 2024**: Initial setup with Zigbee2MQTT integration
