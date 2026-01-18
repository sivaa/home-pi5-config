# Cast IP Monitor

> **Purpose:** Detect Google Cast device IP changes and update Home Assistant config
> **Runtime:** Docker container (Python 3)
> **Port:** None (network scanner)

---

## Why This Exists

Google Cast devices (Nest Hub, Google Home) get IP addresses via DHCP. When the router assigns a new IP, Home Assistant loses connection to the device because it caches the old IP in `known_hosts`.

This service:
1. Scans the network for Cast devices every 5 minutes
2. Compares found IPs to HA's `known_hosts`
3. Updates HA config if IPs changed
4. Restarts Home Assistant to apply changes

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    NETWORK SCAN FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Every 5 minutes:                                                   │
│                                                                     │
│  1. Scan 192.168.0.1-254 for port 8008 (Cast API)                  │
│  2. Query /setup/eureka_info for device UUID                       │
│  3. Match UUIDs to known devices                                   │
│  4. If IPs changed:                                                │
│     a. Update /ha-config/.storage/core.config_entries              │
│     b. docker restart homeassistant                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Known Devices

**Device UUIDs are permanent identifiers** - they never change.

| UUID | Device Name | Location |
|------|-------------|----------|
| `ee8aaf6c-5550-7296-d932-36e9cc16255a` | Kitchen Display | Kitchen |
| `3a1930f7-5fb6-b4e6-693e-df51f16effb4` | Broken Display | (Broken) |
| `3ecad949-3512-a3a9-0dda-672859997fc9` | Master Bedroom clock | Bedroom |

---

## Adding New Cast Devices

1. **Find the device UUID:**
   ```bash
   # Scan network manually
   for i in {1..254}; do
     curl -s --connect-timeout 0.5 http://192.168.0.$i:8008/setup/eureka_info 2>/dev/null | jq -r '.ssdp_udn // empty' && echo " -> 192.168.0.$i"
   done
   ```

2. **Edit cast-ip-monitor.py:**
   ```python
   DEVICES = {
       "ee8aaf6c-5550-...": "Kitchen Display",
       "NEW-UUID-HERE": "New Device Name",  # Add this line
   }
   ```

3. **Rebuild container:**
   ```bash
   cd ~/pi-setup/configs/zigbee2mqtt
   docker compose build cast-ip-monitor
   docker compose up -d cast-ip-monitor
   ```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCAN_INTERVAL` | No | 300 | Seconds between scans |
| `TZ` | No | UTC | Timezone for logs |

---

## Volume Mounts

| Container Path | Host Path | Purpose |
|----------------|-----------|---------|
| `/var/run/docker.sock` | `/var/run/docker.sock` | Restart HA container |
| `/ha-config` | `/opt/homeassistant` | Modify HA config |

---

## Files

```
services/cast-ip-monitor/
├── CLAUDE.md           <- This file
├── Dockerfile          <- Python 3 Alpine image
└── cast-ip-monitor.py  <- Main script (single file)
```

---

## Deployment

Defined in `configs/zigbee2mqtt/docker-compose.yml`:

```yaml
cast-ip-monitor:
  build:
    context: ../../services/cast-ip-monitor
  container_name: cast-ip-monitor
  restart: unless-stopped
  network_mode: host  # Required for network scanning
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock  # To restart HA
    - /opt/homeassistant:/ha-config              # To modify config
  environment:
    - SCAN_INTERVAL=300
    - TZ=Europe/Berlin
```

**Note:** `network_mode: host` is required because the container needs to scan the local network.

---

## HA Config File Modified

**Path:** `/opt/homeassistant/.storage/core.config_entries`

The service updates the `known_hosts` array in the Cast integration entry:

```json
{
  "data": {
    "entries": [
      {
        "domain": "cast",
        "data": {
          "known_hosts": ["192.168.0.10", "192.168.0.15"]
        }
      }
    ]
  }
}
```

---

## Troubleshooting

### Devices Not Being Found

1. Check container logs: `docker logs cast-ip-monitor`
2. Verify devices are on same subnet (192.168.0.x)
3. Test Cast API manually:
   ```bash
   curl http://192.168.0.X:8008/setup/eureka_info
   ```

### HA Not Restarting

1. Check docker socket mount: `docker exec cast-ip-monitor ls -la /var/run/docker.sock`
2. Verify container can run docker: `docker exec cast-ip-monitor docker ps`

### IP Changes Not Applied

1. Check if config was updated: `cat /opt/homeassistant/.storage/core.config_entries | jq '.data.entries[] | select(.domain=="cast")'`
2. Restart HA manually: `docker restart homeassistant`
