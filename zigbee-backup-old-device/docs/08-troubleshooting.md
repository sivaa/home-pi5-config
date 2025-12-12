# 🔧 Troubleshooting & Maintenance

> Common issues, solutions, and keeping your smart home running smoothly.

```
                    TROUBLESHOOTING FLOWCHART
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │                  Problem Detected                   │
    │                        │                            │
    │                        ▼                            │
    │              ┌─────────────────┐                   │
    │              │ Check Services  │                   │
    │              │  docker ps      │                   │
    │              └────────┬────────┘                   │
    │                       │                            │
    │         ┌─────────────┼─────────────┐             │
    │         │             │             │             │
    │         ▼             ▼             ▼             │
    │    Service       All Good      Network           │
    │     Down           │           Issue             │
    │       │            │             │               │
    │       ▼            ▼             ▼               │
    │   Restart     Check Logs    Check Tunnel        │
    │   Service                                        │
    │                                                   │
    └─────────────────────────────────────────────────────┘
```

---

## 🚨 Quick Diagnostics

### System Health Check

```bash
# All-in-one status
ssh root@dietpi.local "
  echo '=== SYSTEM ===' &&
  uptime &&
  free -h &&
  echo '' &&
  echo '=== DOCKER ===' &&
  docker ps --format 'table {{.Names}}\t{{.Status}}' &&
  echo '' &&
  echo '=== DISK ===' &&
  df -h / /mnt/usb
"
```

### Service Status

```bash
# Docker containers
docker ps -a

# Expected output:
# homeassistant    Up X hours
# zigbee2mqtt      Up X hours
# mosquitto        Up X hours
# remote-bridge    Up X hours
```

---

## 🐳 Docker Issues

### Container Won't Start

```bash
# Check logs
docker logs zigbee2mqtt 2>&1 | tail -50
docker logs homeassistant 2>&1 | tail -50

# Restart specific container
docker restart zigbee2mqtt

# Restart all containers
docker compose restart

# Full rebuild
docker compose down
docker compose up -d
```

### Out of Memory

```bash
# Check memory usage
docker stats --no-stream

# If homeassistant using too much:
docker restart homeassistant

# Clear Docker cache
docker system prune -f
```

### Container Keeps Restarting

```bash
# Check for crash loops
docker ps -a  # Look for "Restarting" status

# Get detailed logs
docker logs --tail 100 <container_name>

# Common causes:
# - Config file syntax error
# - Missing volume/file
# - Port conflict
```

---

## 📡 Zigbee Issues

### Device Not Pairing

```
┌─────────────────────────────────────────────────────┐
│  Checklist:                                         │
├─────────────────────────────────────────────────────┤
│  [ ] Permit join enabled?                          │
│      http://dietpi.local:8080 → Click "Permit"     │
│                                                     │
│  [ ] Device in pairing mode?                       │
│      See device-specific instructions              │
│                                                     │
│  [ ] Device close to coordinator?                  │
│      Move within 2 meters for pairing              │
│                                                     │
│  [ ] USB dongle detected?                          │
│      ls /dev/ttyUSB0                               │
│                                                     │
│  [ ] Z2M running?                                  │
│      docker logs zigbee2mqtt                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Device Disconnected

```bash
# Check if device shows in Z2M
docker exec mosquitto mosquitto_pub \
  -t 'zigbee2mqtt/bridge/request/device/list' -m ''

# Possible solutions:
# 1. Move device closer to a router
# 2. Add more router devices (mains-powered)
# 3. Check battery if battery-powered
# 4. Restart Z2M: docker restart zigbee2mqtt
```

### USB Dongle Not Detected

```bash
# Check USB
lsusb | grep -i "silicon\|cp210\|10c4"

# Check serial port
ls -la /dev/ttyUSB*

# Check kernel messages
dmesg | grep -i usb | tail -20

# Solutions:
# 1. Try different USB port
# 2. Reboot Pi
# 3. Check dongle with another computer
```

### Wrong Adapter Type Error

```
Error: SRSP - SYS - ping after 6000ms
```

**Solution:** Check adapter type in configuration:
```yaml
# zigbee2mqtt/data/configuration.yaml
serial:
  port: /dev/ttyUSB0
  adapter: ember    # For Sonoff ZBDongle-E (EFR32MG21)
```

---

## 🏠 Home Assistant Issues

### 400 Bad Request (via Tunnel)

```yaml
# Ensure trusted_proxies is set in configuration.yaml
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 172.18.0.0/16
    - 172.17.0.0/16
```

Then restart:
```bash
docker restart homeassistant
```

### MQTT Devices Not Appearing

```bash
# Check MQTT integration is installed
# Settings → Devices & Services → MQTT

# Verify connection to broker
docker exec mosquitto mosquitto_sub -t '#' -v

# Should see zigbee2mqtt messages
```

### Login Issues

```bash
# Check for IP bans
cat ~/zigbee/homeassistant/.storage/http.ip_bans

# Clear bans (delete the file)
rm ~/zigbee/homeassistant/.storage/http.ip_bans
docker restart homeassistant
```

### Configuration Error

```bash
# Check config before restart
docker exec homeassistant hass --script check_config

# View errors
docker logs homeassistant 2>&1 | grep -i error
```

---

## ☁️ Cloudflare Tunnel Issues

### Tunnel Offline

```bash
# Check service status
systemctl status cloudflared

# Restart tunnel
systemctl restart cloudflared

# View logs
journalctl -u cloudflared -f
```

### 502 Bad Gateway

```bash
# HA not running or not accessible
# Test local connection:
curl -v http://localhost:8123/

# If HA is running but not responding:
docker restart homeassistant
```

### DNS Not Resolving

1. Check Cloudflare Dashboard → DNS
2. Verify CNAME record exists
3. Check it points to `<tunnel-id>.cfargotunnel.com`

### Test Tunnel Manually

```bash
# Stop service first
systemctl stop cloudflared

# Run manually to see output
cloudflared tunnel run ha-tunnel
```

---

## 🎤 Google Assistant Issues

### "Device Not Found"

```bash
# Say: "Hey Google, sync my devices"

# Or force sync via HA:
# Developer Tools → Services → google_assistant.request_sync
```

### "Something Went Wrong"

```bash
# Check HA logs
docker logs homeassistant 2>&1 | grep -i google

# Enable debug logging
# configuration.yaml:
logger:
  logs:
    homeassistant.components.google_assistant: debug
```

### Account Won't Link

1. Verify URLs in Google Home Developer Console:
   - Authorization: `https://ha.sivaa.in/auth/authorize`
   - Token: `https://ha.sivaa.in/auth/token`
2. Test external access works: `https://ha.sivaa.in`
3. Check Cloudflare tunnel is running

---

## 💾 Maintenance Tasks

### Daily (Automatic)

Nothing required - all services have `restart: unless-stopped`

### Weekly

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Review logs for errors
docker logs homeassistant 2>&1 | grep -i error | tail -20
```

### Monthly

```bash
# Update Docker images
docker compose pull
docker compose up -d

# Clean up unused images
docker image prune -f

# Update system
apt-get update && apt-get upgrade -y
```

### Backup

```bash
# Backup configuration
tar -czvf zigbee-backup-$(date +%Y%m%d).tar.gz \
  ~/zigbee/docker-compose.yml \
  ~/zigbee/mosquitto/ \
  ~/zigbee/zigbee2mqtt/data/configuration.yaml \
  ~/zigbee/homeassistant/configuration.yaml \
  /root/.cloudflared/config.yml

# Copy to local machine
scp root@dietpi.local:~/zigbee-backup-*.tar.gz ./
```

---

## 📊 Performance Monitoring

### Memory Usage

```bash
# Container memory
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'

# Expected:
# mosquitto        ~15MB (3%)
# zigbee2mqtt      ~80MB (8%)
# homeassistant    ~180MB (18%)
# remote-bridge    ~30MB (3%)
```

### CPU Temperature

```bash
# Read temperature (divide by 1000 for °C)
cat /sys/class/thermal/thermal_zone0/temp

# e.g., 45000 = 45°C
```

### Uptime

```bash
uptime
# Expected: high load average is fine on Pi 3B+
# load average: 0.50, 0.40, 0.35 is typical
```

---

## 🔄 Recovery Procedures

### Full System Restore

```bash
# 1. Flash fresh DietPi to SD card
# 2. Install Docker
# 3. Copy backup files
# 4. Start services:
cd ~/zigbee
docker compose up -d

# 5. Restore cloudflared config
mkdir -p /root/.cloudflared
# Copy config.yml and credentials JSON
cloudflared service install
systemctl start cloudflared
```

### Reset Single Service

```bash
# Zigbee2MQTT (removes all paired devices!)
rm ~/zigbee/zigbee2mqtt/data/database.db
rm ~/zigbee/zigbee2mqtt/data/state.json
docker restart zigbee2mqtt

# Home Assistant (keeps devices, resets UI)
rm -rf ~/zigbee/homeassistant/.storage/
docker restart homeassistant
```

---

## 📞 Getting Help

### Log Collection

```bash
# Collect all logs for support
mkdir -p /tmp/logs
docker logs zigbee2mqtt > /tmp/logs/z2m.log 2>&1
docker logs homeassistant > /tmp/logs/ha.log 2>&1
docker logs mosquitto > /tmp/logs/mqtt.log 2>&1
journalctl -u cloudflared > /tmp/logs/tunnel.log 2>&1
tar -czvf /tmp/smart-home-logs.tar.gz /tmp/logs/
```

### Resources

| Resource | URL |
|----------|-----|
| Zigbee2MQTT Docs | https://www.zigbee2mqtt.io |
| Home Assistant Docs | https://www.home-assistant.io/docs |
| Cloudflare Tunnel | https://developers.cloudflare.com/cloudflare-one/connections/connect-apps |
| Z2M Supported Devices | https://www.zigbee2mqtt.io/supported-devices |

---

## ⚡ Performance Optimizations (Pi 3B+)

### Already Applied

| Optimization | Effect |
|--------------|--------|
| zram swap | Compressed RAM swap |
| Docker memory limits | Prevents OOM |
| Kernel tuning | Better memory management |
| Disabled Samba | +20MB RAM |

### If Memory Still Low

```bash
# Reduce HA recorder retention
# configuration.yaml:
recorder:
  purge_keep_days: 3

# Disable unused HA integrations
# Settings → Devices & Services → Remove unused
```

---

*Last updated: December 2025*
