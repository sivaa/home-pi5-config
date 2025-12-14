# Google Home Integration

> **Last Updated:** December 14, 2025
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
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

**Pi locations:**
- Config: `/etc/cloudflared/config.yml`
- Credentials: `/etc/cloudflared/6600ccff-747f-4b92-b6d8-26178c8a5112.json`
- Service: `systemctl status cloudflared`

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
   docker restart homeassistant
   ```

4. **Re-link Google Home:**
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

### "Could not reach device"

```bash
# Check cloudflared tunnel
ssh pi@pi "sudo systemctl status cloudflared"

# Check Home Assistant
curl -I https://ha.sivaa.in

# Check HA logs
ssh pi@pi "docker logs homeassistant --tail 50 | grep -i google"
```

### Devices Not Appearing

1. Verify entity IDs in Home Assistant match config
2. Check entities have `expose: true`
3. Restart Home Assistant
4. Re-sync: "Hey Google, sync my devices"

### Authentication Errors

```bash
# Check SERVICE_ACCOUNT.json exists
ssh pi@pi "ls -la /opt/homeassistant/SERVICE_ACCOUNT.json"

# Verify trusted_proxies includes Cloudflare IPs
ssh pi@pi "grep -A20 trusted_proxies /opt/homeassistant/configuration.yaml"
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
