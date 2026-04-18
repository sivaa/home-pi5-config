# Google Home Integration & External Access

> **Last Updated:** April 18, 2026
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

| Device | Entity ID | Voice Name | Room | Notes |
|--------|-----------|------------|------|-------|
| Study IKEA Light | `light.study_ikea_light` | "Study Light" | Study | CCT only |
| Living IKEA Light | `light.living_ikea_light` | "Living Room Light" | Living Room | CCT only |
| Bath Light | `light.bath_light` | "Bath Light" | Bathroom | CCT only |
| Bed Light | `light.bed_light` | "Bedroom Light" | Bedroom | CCT main + HS backlight (single entity) |
| Hallway Light | `light.hallway_light` | "Hallway Light" | Hallway | Aqara T1M white ring (CCT) |
| Hallway Side Light | `light.hallway_side_light` | "Hallway Side Light" | Hallway | Aqara T1M RGB strip (color accent) |

**How multi-LED lights map to voice commands:**

The Bed Light is a single `light.bed_light` entity that drives two physical LED elements (main CCT ring + RGB backlight on the EGLO Rovito-Z 900087). Verified end-to-end 2026-04-18 via MQTT capture + visual A/B with direct MQTT hue/sat:

```
┌───────────────────────────────────────────────────────────────────────────┐
│  "Set bedroom light to 4000K"       →  {"color_temp":250}                │
│                                     →  MAIN RING only                     │
│                                                                           │
│  "Set bedroom light to purple"      →  {"color":{"x":0.272,"y":0.103}}   │
│                                     →  BACKLIGHT only, main ring kept    │
│                                        (HA converts hs_color → xy, but   │
│                                        the EGLO firmware routes any      │
│                                        color payload to the backlight)   │
│                                                                           │
│  "Dim bedroom light to 30%"         →  {"brightness":76}                 │
│                                     →  both LEDs dim together            │
│                                                                           │
│  "Turn off the bedroom light"       →  {"state":"OFF"}                   │
│                                     →  both LEDs off                     │
│                                                                           │
│  "Turn on the bedroom backlight"    →  switch.bed_backlight ON →         │
│                                     {"color":{"hue":280,"saturation":80}}│
│                                     →  BACKLIGHT purple default          │
│                                                                           │
│  "Turn off the bedroom backlight"   →  switch.bed_backlight OFF →        │
│                                     {"color":{"x":0,"y":0}}              │
│                                     →  BACKLIGHT off, main ring kept     │
└───────────────────────────────────────────────────────────────────────────┘
```

⚠️ **Misleading HA state — don't trust it.** After a voice color command, HA reports `light.bed_light` with `color_mode: xy` and `color_temp_kelvin: None` — as if the main ring lost its CCT setting. That's only HA's state tracking (sourced from Z2M's device report), not physical reality. The EGLO firmware keeps the main ring on whatever CCT it was, regardless of what HA thinks. If you want to re-sync HA's view, say "Set bedroom light to 4000K" (or any CCT) and HA's color_mode flips back to `color_temp`.

The Hallway is split into two separate Zigbee endpoints, so each gets its own entity and voice name — no tricks needed. Color voice commands on `light.hallway_side_light` work cleanly since there's no main ring sharing the entity.

### Voice Controllable - Switches

| Device | Entity ID | Voice Name | Room |
|--------|-----------|------------|------|
| Bedroom Backlight | `switch.bed_backlight` | "Bedroom Backlight" | Bedroom |
| Smart Plug 1 | `switch.smart_plug_1` | "Smart Plug" | Living Room |
| Smart Plug 2 | `switch.smart_plug_2` | "Smart Plug 2" | Kitchen |
| Smart Plug 3 | `switch.smart_plug_3` | "Smart Plug 3" | Bedroom |
| Study Light Switch | `switch.study_light_switch` | "Study Switch" | Study |
| Bed Light Switch | `switch.bed_light_switch` | "Bedroom Switch" | Bedroom |
| Living Light Switch | `switch.living_light_switch` | "Living Room Switch" | Living Room |
| Fingerbot | `switch.fingerbot` | "Fingerbot" | Hallway |
| Living Room TV | `switch.living_room_tv_power` | "Living Room TV" | Living Room |

### Voice Controllable - Backlight Color Presets (Scripts)

Exposed as Google Home scenes. Each publishes `{color:{hue,saturation}}` directly via MQTT (bypasses HA's hs_color→xy conversion so HA's `color_mode` stays consistent with the main CCT ring).

| Script | Voice Name | Payload |
|--------|------------|---------|
| `script.bed_backlight_red` | "Bedroom Backlight Red" | hue=0, sat=100 |
| `script.bed_backlight_orange` | "Bedroom Backlight Orange" | hue=30, sat=100 |
| `script.bed_backlight_green` | "Bedroom Backlight Green" | hue=120, sat=100 |
| `script.bed_backlight_blue` | "Bedroom Backlight Blue" | hue=240, sat=100 |
| `script.bed_backlight_purple` | "Bedroom Backlight Purple" | hue=280, sat=100 |
| `script.bed_backlight_pink` | "Bedroom Backlight Pink" | hue=320, sat=100 |

Voice invocation: "Hey Google, **activate** bedroom backlight red" (scenes use "activate", not "turn on").

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

> **Not exposed to Google:** motion/occupancy/vibration `binary_sensor`s have
> no Google smart-home trait. See the `device_class → trait` mapping table in
> `configs/homeassistant/CLAUDE.md` for the complete support matrix. The
> entities below still live in HA (dashboards, automations) but `expose: false`
> in `configuration.yaml`:
>
> - `binary_sensor.mailbox_motion_sensor_occupancy` (occupancy)
> - `binary_sensor.vibration_sensor_vibration` (vibration — hot water)
> - Per-room human presence sensors (`binary_sensor.{study,living,kitchen,bath,bed}_human_presence_occupancy`)

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
│  BED LIGHT (dual-LED, single entity)                                             │
│  "Hey Google, set bedroom light to 4000K"       → main CCT ring                │
│  "Hey Google, set bedroom light to purple"      → backlight color              │
│  "Hey Google, dim bedroom light to 30%"         → both LEDs                    │
│  "Hey Google, turn off the bedroom backlight"   → backlight-only off           │
│  "Hey Google, turn on the bedroom backlight"    → purple backlight (default)   │
│                                                                                  │
│  HALLWAY (dual-endpoint, two entities)                                           │
│  "Hey Google, turn on the hallway light"        → white ring                   │
│  "Hey Google, set hallway side light to orange" → RGB strip accent             │
│  "Hey Google, dim hallway side light to 20%"    → RGB strip only               │
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

### Entity ID Renames (Performed 2026-04-18)

Bed and Hallway lights were originally paired to Z2M before friendly_names were set, so HA's entity registry cached IEEE-based entity IDs. These were renamed directly in `/opt/homeassistant/.storage/core.entity_registry` while HA was stopped:

| Old entity_id | New entity_id |
|---------------|---------------|
| `light.0xa4c13861dca860a7` | `light.bed_light` |
| `light.0x54ef441001208726_white` | `light.hallway_light` |
| `light.0x54ef441001208726_rgb` | `light.hallway_side_light` |

**For disaster recovery (fresh Pi rebuild):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  AFTER RE-PAIRING THESE 3 DEVICES TO Z2M ON A FRESH HA INSTALL      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Z2M friendly_names '[Bed] Light' / '[Hallway] Light' let HA         │
│  auto-generate new entity_ids. For the Bed light this may be         │
│  light.bed_light directly (good), but for the dual-endpoint          │
│  Hallway it generates light.hallway_light_white / _rgb.              │
│                                                                      │
│  To match the repo config, rename via:                               │
│                                                                      │
│  Option A — HA UI:                                                   │
│    Settings → Devices & Services → Entities → search each →          │
│    edit Entity ID                                                    │
│                                                                      │
│  Option B — Direct registry edit (what we did):                      │
│    1. sudo docker stop homeassistant                                 │
│    2. sudo cp .storage/core.entity_registry{,.bak-\$(date +%s)}      │
│    3. sudo python3 script to rewrite entity_id fields                │
│    4. sudo docker start homeassistant                                │
│                                                                      │
│  After rename: verify new entity_ids resolve, then                   │
│  "Hey Google, sync my devices"                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Bed Backlight Switch Out-of-Sync with Dashboard

The dashboard's "🎨 OFF pill" sends `{color:{x:0,y:0}}` directly via MQTT, bypassing `input_boolean.bed_backlight_state`. So after pressing the dashboard OFF pill, `switch.bed_backlight` still reports ON.

Saying "Hey Google, turn off the bedroom backlight" resyncs the state (idempotent - safe to repeat).

---

## Drift Detection & Monitoring (Apr 18, 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  THREE-LAYER DEFENSE AGAINST SILENT HOMEGRAPH DRIFT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Layer 1: Live alert                                                        │
│    automations.yaml → google_assistant_integration_error                    │
│    Fires email on any ERROR log from google_assistant.*                     │
│    Throttled to 1 email per 24h via input_datetime.google_assistant_alert_last │
│                                                                             │
│  Layer 2: On-demand audit                                                   │
│    ./scripts/google-home-audit.sh                                           │
│    Compares HA expose:true set against HomeGraph devices:query results.     │
│    Exit code 2 on drift so it can feed a cron monitor if desired.           │
│                                                                             │
│  Layer 3: CLAUDE.md device_class → trait mapping table                      │
│    configs/homeassistant/CLAUDE.md                                          │
│    Prevents the "cool, let me expose this new sensor" → 404-loop cycle.     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Running the audit

```bash
# From repo root on laptop
./scripts/google-home-audit.sh

# Expected clean output:
#   cloudflared tunnel       active / ha.sivaa.in HTTP 405
#   HA logs (24h)            google_assistant ERROR lines: 0
#   HomeGraph per-entity     Exposed=46 OK=46 MissingHA=0 MissingGoogle=0
#   === Audit clean. No drift. ===
```

The script auto-creates `/tmp/homegraph-venv/` on the Pi with `google-auth +
requests` on first run. Subsequent runs reuse the venv.

### How the alert automation works

```
┌──────────────────────────────────────────────────────────────────────┐
│  Any ERROR log line from homeassistant.components.google_assistant.* │
│                              │                                       │
│                              ▼                                       │
│       system_log_event fires with level=ERROR                        │
│                              │                                       │
│                              ▼                                       │
│     template: 'google_assistant' in event.data.name?                 │
│                              │                                       │
│                              ▼ yes                                   │
│     throttle: last-sent-datetime > 24h ago? (sentinel = never sent)  │
│                              │                                       │
│                              ▼ yes                                   │
│   stamp input_datetime.google_assistant_alert_last = now()           │
│                              │                                       │
│                              ▼                                       │
│   script.send_alert_email with severity=WARNING + log details        │
└──────────────────────────────────────────────────────────────────────┘
```

Rate-limit floor: if the helper ever resets to epoch (1970-01-01), the
first error post-reset triggers immediately. The condition template checks
`ts < 86400` as the sentinel.

---

## Service Account Key Rotation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WHEN:   Every 90 days (Google best practice)                               │
│  WHY:    Reduces blast radius of leaked keys. Service accounts with long-   │
│          lived keys are a common cloud security finding.                    │
│  RISK:   Wrong key = HomeGraph report_state breaks → voice control keeps    │
│          working (SYNC uses OAuth) but state staleness in Google Home app.  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Procedure

```bash
# 1. Verify gcloud is authenticated as the project owner
gcloud config set account sivasubramaniam.a@gmail.com
gcloud projects describe siva-home-assistant-1

# 2. List existing keys (note the oldest one's KEY_ID)
gcloud iam service-accounts keys list \
  --iam-account=id-home-assistant@siva-home-assistant-1.iam.gserviceaccount.com \
  --project=siva-home-assistant-1

# 3. Create new key
mkdir -p /tmp/sa-rotation
gcloud iam service-accounts keys create /tmp/sa-rotation/SERVICE_ACCOUNT.new.json \
  --iam-account=id-home-assistant@siva-home-assistant-1.iam.gserviceaccount.com \
  --project=siva-home-assistant-1

# 4. Smoke-test the new key from the Pi (proves HomeGraph accepts it)
scp /tmp/sa-rotation/SERVICE_ACCOUNT.new.json pi@pi:/tmp/
ssh pi@pi '/tmp/homegraph-venv/bin/python3 -c "
from google.oauth2 import service_account
from google.auth.transport.requests import Request
import requests
c = service_account.Credentials.from_service_account_file(\"/tmp/SERVICE_ACCOUNT.new.json\", scopes=[\"https://www.googleapis.com/auth/homegraph\"])
c.refresh(Request())
r = requests.post(\"https://homegraph.googleapis.com/v1/devices:query\",
  headers={\"Authorization\": f\"Bearer {c.token}\"},
  json={\"requestId\":\"test\",\"agentUserId\":\"352c46b91d924bc8940435a5cb73c9bb\",
        \"inputs\":[{\"payload\":{\"devices\":[{\"id\":\"light.study_ikea_light\"}]}}]}, timeout=10)
print(\"new key devices:query:\", r.status_code)
"'

# 5. Atomic swap on Pi (keeps timestamped backup as rollback)
ssh pi@pi "sudo cp /opt/homeassistant/SERVICE_ACCOUNT.json /opt/homeassistant/SERVICE_ACCOUNT.json.bak.\$(date +%Y%m%d-%H%M%S) \
  && sudo cp /tmp/SERVICE_ACCOUNT.new.json /opt/homeassistant/SERVICE_ACCOUNT.json \
  && sudo chown root:root /opt/homeassistant/SERVICE_ACCOUNT.json \
  && sudo chmod 644 /opt/homeassistant/SERVICE_ACCOUNT.json \
  && rm /tmp/SERVICE_ACCOUNT.new.json"

# 6. Restart HA and verify
ssh pi@pi "docker restart homeassistant"
# Wait for HA to come back (~10s)
./scripts/google-home-audit.sh

# 7. After a day or two of clean operation, delete old keys
#    (requires user confirmation per CLAUDE.md rule 1b)
gcloud iam service-accounts keys delete OLD_KEY_ID \
  --iam-account=id-home-assistant@siva-home-assistant-1.iam.gserviceaccount.com \
  --project=siva-home-assistant-1

# 8. Clean up local temp
rm -rf /tmp/sa-rotation
```

### Rotation history

| Date | Action | Key ID |
|------|--------|--------|
| 2025-12-14 12:03 | Initial creation | `431e59954e84b45007106335cd2995d6aac5a099` |
| 2025-12-14 12:04 | Second key (live until 2026-04-18) | `19f866dbeb8b32bdb1af712981acb4ba78ce8d1c` |
| 2026-04-18 22:05 | Rotation — new key now live | `42ba10ee02a7f7efd93fd977767e34bb6bb4f25e` |

Old keys are retained in GCP until manually deleted (rollback window).
Pi-local backup: `/opt/homeassistant/SERVICE_ACCOUNT.json.bak.<timestamp>`.

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
# Check file exists + age
ssh pi@pi "ls -la /opt/homeassistant/SERVICE_ACCOUNT.json"

# Verify file is valid JSON
ssh pi@pi "python3 -m json.tool /opt/homeassistant/SERVICE_ACCOUNT.json > /dev/null && echo 'Valid JSON'"

# Print private_key_id to cross-check against GCP console
ssh pi@pi "sudo cat /opt/homeassistant/SERVICE_ACCOUNT.json | python3 -c \
  'import json,sys; print(json.load(sys.stdin)[\"private_key_id\"])'"

# If key is > 90 days old, rotate (see "Service Account Key Rotation" above)
```

### Silent reportStateAndNotification 404 Loop

**Symptom:** `docker logs homeassistant | grep google_assistant` shows many
entries like:
```
ERROR Request for https://homegraph.googleapis.com/v1/devices:reportStateAndNotification failed: 404
```
but voice control still works and devices show up in Google Home.

**Root cause:** An entity has `expose: true` in `configuration.yaml`, but
Google has no smart-home trait for its domain/device_class combo. HA's
`google_assistant` component silently drops it at SYNC time, but the
`report_state: true` setting keeps pushing every state change → 404 on
each one.

**Fix:**
1. Run `./scripts/google-home-audit.sh` — it identifies the offenders
2. For each entity it flags, either:
   - Set `expose: false` in `configuration.yaml` entity_config, OR
   - Remove the entity_config block entirely (if the entity doesn't exist
     in HA either, it's just stale config)
3. Restart HA: `ssh pi@pi "docker restart homeassistant"`
4. Re-run the audit to confirm zero drift

The 404 loop is functionally harmless (voice control still works) but
pollutes logs and makes real errors harder to spot. The
`google_assistant_integration_error` automation now catches the first
occurrence and emails within 24h.

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
