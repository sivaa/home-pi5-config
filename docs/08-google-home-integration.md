# Google Home Integration & External Access

> **Last Updated:** December 17, 2025
> **Status:** Active
> **Purpose:** Voice control via Google Home/Nest speakers

---

## Overview

```
                          "Hey Google, turn on the study light"
                                         |
                                         v
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE HOME VOICE CONTROL                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────┐        ┌────────────────────┐        ┌──────────────────┐   │
│   │ Google Home  │───────>│   Google Cloud     │───────>│ ha.sivaa.in      │   │
│   │   Speaker    │        │   (HomeGraph API)  │ HTTPS  │ (Cloudflare)     │   │
│   └──────────────┘        └────────────────────┘        └────────┬─────────┘   │
│                                                                   │             │
│                                                          Tunnel   │             │
│                                                                   v             │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                         RASPBERRY PI 5                                  │   │
│   │  ┌─────────────────────────────────────────────────────────────────┐   │   │
│   │  │  cloudflared  ──>  Home Assistant  ──>  Zigbee2MQTT  ──>  Devices│   │   │
│   │  └─────────────────────────────────────────────────────────────────┘   │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Checklist

| Component | Status | Details |
|-----------|--------|---------|
| Cloudflare Tunnel | Active | Tunnel ID: `6600ccff-747f-4b92-b6d8-26178c8a5112` |
| Cloudflare SSL Mode | **Full** | Dashboard → SSL/TLS → Overview (CRITICAL!) |
| Local Access | Active | `http://pi:8123` |
| External URL | Active | `https://ha.sivaa.in` |
| GCP Project | Active | `siva-home-assistant-1` |
| HomeGraph API | Enabled | For device state sync |
| Service Account | Active | `id-home-assistant@siva-home-assistant-1.iam.gserviceaccount.com` |
| Google Home Link | Active | Account linked in Google Home app |

---

## Exposed Devices

### Voice Controllable (On/Off/Brightness)

| Device | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study IKEA Light | `light.study_ikea_light` | "Study Light" | Study |
| Living IKEA Light | `light.living_ikea_light` | "Living Room Light" | Living Room |
| Smart Plug | `switch.smart_plug_1` | "Smart Plug" | Living Room |

### Voice Queryable (Temperature/Humidity)

| Sensor | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study Temp | `sensor.study_temperature_humidity_temperature` | "Study Temperature" | Study |
| Living Temp | `sensor.living_temperature_humidity_temperature` | "Living Room Temperature" | Living Room |
| Bedroom Temp | `sensor.bed_temperature_humidity_sensor_temperature` | "Bedroom Temperature" | Bedroom |
| Kitchen Temp | `sensor.kitchen_temperature_humidity_temperature` | "Kitchen Temperature" | Kitchen |
| Bathroom Temp | `sensor.bath_temperature_humidity_temperature` | "Bathroom Temperature" | Bathroom |
| Balcony Temp | `sensor.balcony_temperature_humidity_temperature` | "Balcony Temperature" | Balcony |
| CO2 | `sensor.co2_co2` | "Air Quality" | Living Room |

---

## Voice Command Examples

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VOICE COMMAND REFERENCE                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  LIGHTS                                                                          │
│  "Hey Google, turn on the study light"                                          │
│  "Hey Google, turn off the living room light"                                   │
│  "Hey Google, dim the study light to 50%"                                       │
│  "Hey Google, set living room light to warm"                                    │
│  "Hey Google, turn off all lights"                                              │
│                                                                                  │
│  SMART PLUG                                                                      │
│  "Hey Google, turn on the smart plug"                                           │
│  "Hey Google, turn off the plug"                                                │
│                                                                                  │
│  TEMPERATURE QUERIES                                                             │
│  "Hey Google, what's the temperature in the bedroom?"                           │
│  "Hey Google, how hot is the living room?"                                      │
│  "Hey Google, what's the temperature?"                                          │
│  "Hey Google, is the balcony cold?"                                             │
│                                                                                  │
│  AIR QUALITY                                                                     │
│  "Hey Google, what's the air quality?"                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Files

### Cloudflare Tunnel

**Location:** `configs/cloudflared/config.yml`

```yaml
tunnel: 6600ccff-747f-4b92-b6d8-26178c8a5112
credentials-file: /etc/cloudflared/6600ccff-747f-4b92-b6d8-26178c8a5112.json

ingress:
  - hostname: ha.sivaa.in
    service: http://localhost:8123
  - service: http_status:404
```

**Pi locations:**
- Config: `/etc/cloudflared/config.yml`
- Credentials: `/etc/cloudflared/6600ccff-747f-4b92-b6d8-26178c8a5112.json`
- Service: `systemctl status cloudflared`

### Cloudflare Dashboard Settings

**CRITICAL:** SSL/TLS encryption mode must be set to **"Full"**

```
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Dashboard → SSL/TLS → Overview                      │
│                                                                 │
│  Encryption mode: Full  ← REQUIRED                              │
│                                                                 │
│  ❌ Off         - Breaks WebSocket, causes 301 redirects        │
│  ❌ Flexible    - May cause redirect loops                      │
│  ✅ Full        - Works with self-signed cert                   │
│  ✅ Full(strict)- Requires CA-signed cert                       │
└─────────────────────────────────────────────────────────────────┘
```

### Home Assistant Google Integration

**Location:** `configs/homeassistant/configuration.yaml`

```yaml
google_assistant:
  project_id: siva-home-assistant-1
  service_account: !include SERVICE_ACCOUNT.json
  report_state: true
  expose_by_default: false
  # ... entity_config ...
```

**SERVICE_ACCOUNT.json:** `configs/homeassistant/SERVICE_ACCOUNT.json` (gitignored)

---

## Disaster Recovery

### If Pi Dies - Full Rebuild Steps

1. **Reinstall OS and base services** (see docs 01-07)

2. **Restore Cloudflare Tunnel:**
   ```bash
   # Install cloudflared
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
   sudo dpkg -i cloudflared.deb

   # Login to Cloudflare
   cloudflared tunnel login

   # Create new tunnel (old one may be orphaned)
   cloudflared tunnel create homeassistant

   # Update config with new tunnel ID
   # Copy config to /etc/cloudflared/
   # Route DNS: cloudflared tunnel route dns homeassistant ha.sivaa.in

   # Install service
   sudo cloudflared service install
   sudo systemctl enable cloudflared
   sudo systemctl start cloudflared
   ```

3. **Restore Home Assistant config:**
   ```bash
   # Copy from this repo to Pi
   scp configs/homeassistant/configuration.yaml pi@pi:/opt/homeassistant/
   scp configs/homeassistant/SERVICE_ACCOUNT.json pi@pi:/opt/homeassistant/
   ssh pi@pi "docker restart homeassistant"
   ```

4. **Verify Cloudflare Dashboard Settings (CRITICAL):**
   - Go to Cloudflare Dashboard → SSL/TLS → Overview
   - Set encryption mode to **"Full"**
   - Without this, WebSocket connections will fail with 301 redirects

5. **Re-link Google Home:**
   - Unlink old integration in Google Home app
   - Re-link: Add device > Works with Google > [test] Home Assistant
   - Sync devices

### If Only Re-linking Needed

1. Open Google Home app
2. Go to Settings > Works with Google > Home Assistant
3. Unlink, then re-link
4. Say "Hey Google, sync my devices"

---

## Troubleshooting

### "Unable to connect to Home Assistant" (WebSocket Error)

**Symptoms:**
- Login page loads, authentication succeeds
- After redirect, shows "Unable to connect to Home Assistant. Retrying..."
- Browser console shows: `WebSocket connection to 'wss://ha.sivaa.in/api/websocket' failed: 301`

**Root Cause Analysis:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THE PROBLEM: Cloudflare SSL mode "Off" = broken WebSocket                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  When Cloudflare SSL mode is "Off":                                         │
│  1. Browser requests wss://ha.sivaa.in/api/websocket                       │
│  2. Cloudflare sends X-Forwarded-Proto: http  ← Problem!                   │
│  3. HA thinks request is HTTP, but external_url is HTTPS                    │
│  4. HA redirects to "correct" protocol → 301                               │
│  5. WebSocket upgrade fails                                                 │
│                                                                             │
│  THE FIX:                                                                   │
│  • Set Cloudflare SSL mode to "Full" in dashboard                          │
│  • That's it! No SSL needed on HA itself.                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Diagnosis Steps:**

```bash
# 1. Test WebSocket through tunnel
curl -v --http1.1 \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "https://ha.sivaa.in/api/websocket" 2>&1 | grep -E "(HTTP|101|301)"

# Expected (working):  HTTP/1.1 101 Switching Protocols
# Broken:              HTTP/1.1 301 Moved Permanently

# 2. Test local access
curl -s -o /dev/null -w "%{http_code}" http://pi:8123

# 3. Check HA logs for auth warnings
ssh pi@pi "docker logs homeassistant --tail 50 2>&1 | grep -i auth"
```

**Fix Checklist:**

| Check | Command/Action | Expected |
|-------|----------------|----------|
| Cloudflare SSL mode | Dashboard → SSL/TLS → Overview | **"Full"** |
| cloudflared service | `ssh pi@pi "sudo grep service /etc/cloudflared/config.yml"` | `http://localhost:8123` |
| Local access | `curl http://pi:8123` | 200 OK |
| External access | `curl https://ha.sivaa.in` | 200 OK |

### "Could not reach device" (Google Home)

```bash
# Check cloudflared tunnel
ssh pi@pi "sudo systemctl status cloudflared"

# Check Home Assistant accessible
curl -I https://ha.sivaa.in

# Check HA logs for Google errors
ssh pi@pi "docker logs homeassistant --tail 50 | grep -i google"
```

### Devices Not Appearing in Google Home

1. Verify entity IDs in Home Assistant match config
2. Check entities have `expose: true`
3. Restart Home Assistant
4. Re-sync: "Hey Google, sync my devices"

### "Login attempt with invalid authentication" in HA logs

**Cause:** Missing Cloudflare IP ranges in `trusted_proxies`

```bash
# Check trusted_proxies config
ssh pi@pi "grep -A30 trusted_proxies /opt/homeassistant/configuration.yaml"
```

**Required ranges (in configuration.yaml):**
```yaml
trusted_proxies:
  # Local/Docker
  - 127.0.0.1
  - ::1
  - 172.16.0.0/12
  # Cloudflare IPv4
  - 173.245.48.0/20
  - 103.21.244.0/22
  - 103.22.200.0/22
  - 103.31.4.0/22
  - 141.101.64.0/18
  - 108.162.192.0/18
  - 190.93.240.0/20
  - 188.114.96.0/20
  - 197.234.240.0/22
  - 198.41.128.0/17
  - 162.158.0.0/15
  - 104.16.0.0/13
  - 104.24.0.0/14
  - 172.64.0.0/13
  - 131.0.72.0/22
  # Cloudflare IPv6 (REQUIRED for IPv6 users!)
  - 2400:cb00::/32
  - 2606:4700::/32
  - 2803:f800::/32
  - 2405:b500::/32
  - 2405:8100::/32
  - 2a06:98c0::/29
  - 2c0f:f248::/32
```

### SERVICE_ACCOUNT.json Errors

```bash
# Check file exists
ssh pi@pi "ls -la /opt/homeassistant/SERVICE_ACCOUNT.json"

# Verify file is valid JSON
ssh pi@pi "python3 -m json.tool /opt/homeassistant/SERVICE_ACCOUNT.json > /dev/null && echo 'Valid JSON'"
```

---

## Security Notes

- SERVICE_ACCOUNT.json is **gitignored** - contains private key
- Cloudflare Tunnel: No open ports on router
- All traffic is HTTPS encrypted
- OAuth authentication required for account linking

---

## Related Docs

- [01-nvme-boot-setup.md](01-nvme-boot-setup.md) - Base system setup
- [04-zigbee2mqtt-setup.md](04-zigbee2mqtt-setup.md) - Zigbee device management
- [05-zigbee-devices.md](05-zigbee-devices.md) - Device inventory
