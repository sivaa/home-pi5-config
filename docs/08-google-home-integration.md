# Google Home Integration & External Access

> **Last Updated:** December 19, 2025
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

> **Source of truth:** `configs/homeassistant/configuration.yaml` - `google_assistant.entity_config`

### Voice Controllable - Lights

| Device | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study IKEA Light | `light.study_ikea_light` | "Study Light" | Study |
| Living IKEA Light | `light.living_ikea_light` | "Living Room Light" | Living Room |
| Bath Light | `light.bath_light` | "Bath Light" | Bathroom |

### Voice Controllable - Switches

| Device | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Smart Plug 1 | `switch.smart_plug_1` | "Smart Plug" | Living Room |
| Smart Plug 2 | `switch.smart_plug_2` | "Smart Plug 2" | Kitchen |
| Smart Plug 3 | `switch.smart_plug_3` | "Smart Plug 3" | Bedroom |
| Study Light Switch | `switch.study_light_switch` | "Study Switch" | Study |
| Bed Light Switch | `switch.bed_light_switch` | "Bedroom Switch" | Bedroom |
| Living Light Switch | `switch.living_light_switch` | "Living Room Switch" | Living Room |
| Fingerbot | `switch.fingerbot` | "Fingerbot" | Hallway |
| Living Room TV | `switch.living_room_tv_power` | "Living Room TV" | Living Room |

### Voice Controllable - Climate

| Device | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study Thermostat | `climate.study_thermostat` | "Study Thermostat" | Study |
| Living Inner | `climate.living_thermostat_inner` | "Living Inner" | Living Room |
| Living Outer | `climate.living_thermostat_outer` | "Living Outer" | Living Room |
| Bedroom Thermostat | `climate.bed_thermostat` | "Bedroom Thermostat" | Bedroom |

### Voice Queryable - Temperature

| Sensor | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study Temp | `sensor.study_temperature_humidity_temperature` | "Study Temperature" | Study |
| Living Temp | `sensor.living_temperature_humidity_temperature` | "Living Room Temperature" | Living Room |
| Bedroom Temp | `sensor.bed_temperature_humidity_sensor_temperature` | "Bedroom Temperature" | Bedroom |
| Kitchen Temp | `sensor.kitchen_temperature_humidity_temperature` | "Kitchen Temperature" | Kitchen |
| Bathroom Temp | `sensor.bath_temperature_humidity_temperature` | "Bathroom Temperature" | Bathroom |
| Balcony Temp | `sensor.balcony_temperature_humidity_temperature` | "Balcony Temperature" | Balcony |

### Voice Queryable - Humidity

| Sensor | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study Humidity | `sensor.study_temperature_humidity_humidity` | "Study Humidity" | Study |
| Living Humidity | `sensor.living_temperature_humidity_humidity` | "Living Room Humidity" | Living Room |
| Bedroom Humidity | `sensor.bed_temperature_humidity_sensor_humidity` | "Bedroom Humidity" | Bedroom |
| Kitchen Humidity | `sensor.kitchen_temperature_humidity_humidity` | "Kitchen Humidity" | Kitchen |
| Bathroom Humidity | `sensor.bath_temperature_humidity_humidity` | "Bathroom Humidity" | Bathroom |
| Balcony Humidity | `sensor.balcony_temperature_humidity_humidity` | "Balcony Humidity" | Balcony |

### Voice Queryable - Other Sensors

| Sensor | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| CO2 | `sensor.hallway_co2_co2` | "Air Quality" | Hallway |
| Mailbox | `binary_sensor.mailbox_motion_sensor_occupancy` | "Mailbox Sensor" | Entry |
| Human Presence | `binary_sensor.human_presence_occupancy` | "Human Presence" | Hallway |
| Hot Water | `binary_sensor.vibration_sensor_vibration` | "Hot Water Sensor" | Bathroom |

### Voice Queryable - Window/Door Contacts (8 sensors)

| Sensor | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Study Large Window | `binary_sensor.study_window_contact_sensor_large_contact` | "Study Large Window" | Study |
| Study Small Window | `binary_sensor.study_window_contact_sensor_small_contact` | "Study Small Window" | Study |
| Living Window | `binary_sensor.living_window_contact_sensor_window_contact` | "Living Room Window" | Living Room |
| Balcony Door | `binary_sensor.living_window_contact_sensor_balcony_door_contact` | "Balcony Door" | Living Room |
| Bedroom Window | `binary_sensor.bed_window_contact_sensor_contact` | "Bedroom Window" | Bedroom |
| Kitchen Window | `binary_sensor.kitchen_window_contact_sensor_contact` | "Kitchen Window" | Kitchen |
| Bathroom Window | `binary_sensor.bath_window_contact_sensor_contact` | "Bathroom Window" | Bathroom |
| Front Door | `binary_sensor.hallway_window_contact_sensor_main_door_contact` | "Front Door" | Entry |

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

## TTS Announcements (Automations)

Home Assistant announces events via Google Home speakers using Text-to-Speech.

### Google Home Speakers

| Speaker | Entity ID | Location |
|---------|-----------|----------|
| Kitchen Display | `media_player.kitchen_display` | Kitchen |
| Broken Display | `media_player.broken_display` | Living Room |
| Bedroom Clock | `media_player.master_bedroom_clock` | Bedroom |

### Active Automations

| Automation | Trigger | Message | Quiet Hours |
|------------|---------|---------|-------------|
| Mailbox Motion | PIR sensor detects motion | "Mailbox opened" | 23:00-06:00 |
| CO2 High Alert | CO2 > 1200 ppm (once when crossing) | "Please ventilate..." | 07:00-23:00 |
| CO2 Critical | CO2 > 1600 ppm (**every 5 min**) | "Warning! CO2 critical..." | **None (24/7)** |
| CO2 Good | CO2 < 500 ppm (after high/critical) | "Air quality good..." | 07:00-23:00 |
| Window Open | Any window open > 5-10 min | "Window open for X min" | None |

> **Note:** The separate "Bath Window Open" and "Bed Window Open" automations were consolidated into a single `window_open_too_long` automation that covers all 7 windows + balcony door. Alert timing is temperature-aware: 5 min when freezing, 10 min otherwise.

> **Note:** CO2 Critical alert is safety-critical and runs 24/7. It announces every 5 minutes
> while CO2 remains above 1600 ppm until you open windows to ventilate.

### Entity References

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAILBOX SENSORS                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  PIR Motion Sensor (SONOFF SNZB-03P)                                        │
│  └─ Entity: binary_sensor.mailbox_motion_sensor_occupancy                   │
│  └─ MQTT Topic: zigbee2mqtt/[Mailbox] Motion Sensor                        │
│  └─ Friendly Name: [Mailbox] Motion Sensor                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Configuration

**File:** `configs/homeassistant/automations.yaml`

All mailbox-related automations have:
- **Quiet Hours:** 23:00-06:00 (Europe/Berlin timezone)
- **Cooldown:** 30 seconds between announcements
- **Speakers:** All 3 Google Home devices

---

## Configuration Files

### Cloudflare Tunnel

**Location:** `configs/cloudflared/config.yml`

```yaml
tunnel: 6600ccff-747f-4b92-b6d8-26178c8a5112
credentials-file: /home/pi/.cloudflared/6600ccff-747f-4b92-b6d8-26178c8a5112.json

ingress:
  - hostname: ha.sivaa.in
    service: http://localhost:8123
  - service: http_status:404
```

**Pi locations:**
- Config: `~/.cloudflared/config.yml`
- Credentials: `/home/pi/.cloudflared/6600ccff-747f-4b92-b6d8-26178c8a5112.json`
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
