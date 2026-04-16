# Project: Raspberry Pi 5 Setup & Configuration

## Purpose

This repository documents the complete setup of a Raspberry Pi 5, designed for **disaster recovery**.
If the Pi dies, we should be able to rebuild it exactly as it was using this documentation.

---

## Core Principles

1. **Document Everything**
   - WHY we made each change
   - HOW we made it (exact commands)
   - WHAT the result looks like (verification)

2. **Backup All Configs**
   - Store copies of critical config files in `backups/configs/`
   - Update backups after every change

3. **Honest Documentation**
   - No assumptions - only document what was actually done
   - Include error messages and troubleshooting steps
   - Evidence-based: show actual outputs, not expected outputs

4. **Organized Structure**
   - Each topic gets its own numbered doc in `docs/`
   - Main README.md serves as the index
   - Update CLAUDE.md after significant changes

---

## Project Structure

```
pi-setup/
├── README.md           # Main index and quick reference
├── CLAUDE.md           # This file - AI instructions
├── AGENTS.md           # Agent guidelines
├── docs/               # Detailed documentation
│   ├── 01-*.md         # Numbered for reading order
│   └── ...
├── configs/            # Source configs (source of truth)
│   ├── zigbee2mqtt/    # Docker stack configs
│   ├── homeassistant/  # HA configs & automations
│   ├── cloudflared/    # Cloudflare tunnel
│   ├── display-scheduler/
│   ├── kiosk-browser/
│   ├── kiosk-control/
│   ├── kiosk-toggle/
│   ├── labwc/
│   ├── pi-reboot/
│   ├── scraper-cleanup/
│   ├── squeekboard/
│   ├── systemd/
│   ├── touch-udev/
│   ├── where-is-siva/
│   ├── wifi-watchdog/
│   └── zigbee-watchdog/
├── services/           # Docker service code
│   ├── dashboard/      # Custom web dashboard
│   ├── cast-ip-monitor/
│   ├── data-scraper/
│   ├── heater-watchdog/
│   ├── kiosk-control/
│   ├── mqtt-influx-bridge/
│   ├── pi-metrics-collector/
│   ├── scraper-cleanup/
│   ├── where-is-siva/
│   └── zigbee-watchdog/
├── scripts/            # Maintenance scripts
└── backups/
    └── configs/        # Backed up Pi config files
```

---

## Quick Navigation (AI Agents)

Working on a service? Read its CLAUDE.md first:
- `services/*/CLAUDE.md` - Service-specific context (dashboard, zigbee-watchdog, heater-watchdog, etc.)
- `scripts/CLAUDE.md` - Maintenance script rules and safety guidelines

Don't know which service? Use: `find . -name CLAUDE.md`

---

## Current Pi Configuration

- **Location:** Berlin, Germany
- **Timezone:** Europe/Berlin
- **Device:** Raspberry Pi 5 Model B Rev 1.1
- **OS:** Debian GNU/Linux 13 (trixie)
- **Access:** `ssh pi@pi`
- **Boot:** NVMe primary (BOOT_ORDER=0xf416)
- **Storage:**
  - NVMe: `/` and `/boot/firmware`
  - SD Card: `/mnt/storage` (extra storage)
- **Hardware:**
  - Zigbee: Sonoff Zigbee 3.0 USB Dongle Plus V2
  - Path: `/dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_...-if00-port0`
- **Zigbee Devices:** 49 total (including coordinator)
  - 12x Temperature sensors (SNZB-02P, SNZB-02WD)
  - 8x Window/door contact sensors (SNZB-04P)
  - 5x Human presence sensors (SNZB-06P) - Study, Living, Kitchen, Bath, Bed
  - 4x Thermostats (TRVZB radiator valves)
  - 3x Light switches (SONOFF ZBM5-1C-80/86) - Study, Bed, Living
  - 3x Smart plugs (S60ZBTPF)
  - 2x IKEA FLOALT lights + 2x remotes
  - 2x AwoX LED lights - Bath (33955), Bed (EGLO Rovito-Z 900087)
  - 1x Aqara T1M ceiling light - Hallway (lumi.light.acn032, CCT+RGB dual-endpoint)
  - 1x EGLO remote controller (99099) - Bath
  - 1x CO2 sensor (NOUS E10)
  - 1x Light sensor (Moes ZSS-QT-LS-C) - Kitchen
  - 1x Motion sensor (SNZB-03P) - Mailbox
  - 1x Vibration sensor (Hot Water tracking)
  - 1x Fingerbot (Tuya TS0001_fingerbot)
- **Docker Services:** 9 containers
  - mosquitto (MQTT), zigbee2mqtt, homeassistant, influxdb
  - dashboard (nginx), mqtt-influx-bridge, cast-ip-monitor, heater-watchdog
  - data-scraper

---

## When Making Changes

1. **Before:** Read relevant existing docs
2. **During:** Note exact commands and outputs
3. **After:**
   - Backup changed config files to `backups/configs/`
   - Document in appropriate `docs/*.md` file
   - Update README.md index if new doc created
   - Update this CLAUDE.md if project structure changes

---

## When Adding a New Service

Checklist to prevent documentation debt:

1. [ ] Create `services/<name>/CLAUDE.md` with purpose, architecture, key files
2. [ ] If config files needed, add to `configs/<name>/`
3. [ ] If numbered doc needed, add `docs/NN-<topic>.md`
4. [ ] Update README.md service list if user-facing

---

## Recovery Philosophy

> *"We are preparing for the worst day and we need to recover and get it up exactly the same as before."*

All documentation should enable complete system restoration from scratch.

---

## 🚨 Golden Rules (MUST FOLLOW)

### 0. No PRs or Branches
```
┌─────────────────────────────────────────────────────────────────┐
│  🚫 NEVER CREATE PULL REQUESTS OR FEATURE BRANCHES              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  This is a solo, one-person home automation project.            │
│  Commit directly to main. No PRs, no branches, no reviews.     │
│                                                                 │
│  WHY: PRs add overhead with zero benefit for a solo project.    │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Dashboard Development Workflow
```
┌─────────────────────────────────────────────────────────────────┐
│  🔄 LOCAL FIRST → THEN DEPLOY TO PI                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ALWAYS test dashboard changes LOCALLY first                 │
│     - Run: python -m http.server 8888                           │
│       (from services/dashboard/www/)                            │
│     - Open: http://localhost:8888                               │
│                                                                 │
│  2. Connect to Pi services FROM local laptop:                   │
│     - MQTT: pi:1883 (mosquitto)                                 │
│     - InfluxDB: pi:8086                                         │
│     - Home Assistant: pi:8123                                   │
│     - Zigbee2MQTT: pi:8080                                      │
│                                                                 │
│  3. Deploy to Pi after local testing passes:                    │
│     - MUST be on `main` branch before deploying!                │
│     - scp files to /opt/dashboard/www/                          │
│     - Fix permissions: sudo chmod -R 755 /opt/dashboard/www     │
│     - VERIFY: ssh pi@pi to confirm files are correct            │
│                                                                 │
│  WHY: Faster testing & iteration cycles!                        │
│  WHY main-only: Ensures Pi always runs production code.         │
└─────────────────────────────────────────────────────────────────┘
```

### 1a. Auto-Serve After Dashboard Changes (MANDATORY)
```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 ALWAYS START LOCAL SERVER AFTER DASHBOARD CODE CHANGES       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  After ANY change to files under services/dashboard/www/:       │
│                                                                 │
│  1. Start local server (if not already running):                │
│     cd services/dashboard/www && python -m http.server 8888     │
│     (run in background)                                         │
│                                                                 │
│  2. Notify user: "Local server running at http://localhost:8888" │
│                                                                 │
│  WHY: The user expects to immediately test every change in      │
│  their browser. Don't wait for them to ask — just serve it.     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1b. Operations Requiring User Confirmation (IRREVOCABLE)
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  ALWAYS ASK USER BEFORE THESE OPERATIONS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  • Deleting files or data (rm, DROP TABLE, etc.)               │
│  • Git force push or rebase on shared branches                  │
│  • Modifying Zigbee2MQTT database or network keys               │
│  • Removing Docker volumes or persistent data                   │
│  • Changing system configs (/etc/*, systemd units)              │
│  • Revoking API keys, tokens, or credentials                    │
│  • Database migrations that drop columns/tables                 │
│  • Any operation that cannot be easily undone                   │
│                                                                 │
│  WHY: These operations can cause data loss or system breakage   │
│       that requires significant effort to recover from.         │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Source Files First
- Every source and config file should be first in THIS REPO
- Then moved to Pi - EVERY SINGLE TIME

### 3. No Local Services
- No services should run locally (Mac) unless user explicitly asks
- Dashboard testing is the EXCEPTION (connects to Pi services)

### 4. Agent Documentation
- All coding agents should refer to proper documents
- Create agents.md for high-level instructions

### 5. SSH Connection to Pi
- **ALWAYS use `pi@pi`** for SSH/SCP connections (not just `pi`)
- Example: `ssh pi@pi "command"` or `scp file pi@pi:/path/`
- The hostname `pi` alone may resolve to wrong user

### 6. Zigbee2MQTT Operations (CRITICAL - 49 DEVICES AT RISK)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  INCIDENT HISTORY                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  On Jan 4, 2026, rapid restart commands caused complete         │
│  Zigbee network loss. Root cause: AI issued 4 docker commands   │
│  in 21 seconds, causing USB timeout and database corruption.    │
│                                                                 │
│  ALL 35 DEVICES WERE ORPHANED!                                  │
│  (Current device count: 49)                                     │
│                                                                 │
│  Z2M is now managed by SYSTEMD with pre-start validation.       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**COMMANDS (MUST use systemctl, NOT docker):**
```bash
# Restart Z2M (validation runs automatically)
ssh pi@pi "sudo systemctl restart zigbee2mqtt"

# Check status
ssh pi@pi "sudo systemctl status zigbee2mqtt"

# View logs
ssh pi@pi "docker logs zigbee2mqtt --tail 100"

# If validation blocks startup, check why:
ssh pi@pi "sudo journalctl -u zigbee2mqtt -n 50"
```

**RULES:**
1. **NEVER** use `docker restart zigbee2mqtt` (bypasses validation!)
2. **NEVER** use `docker stop` + `docker start` (bypasses validation!)
3. **ALWAYS** use `systemctl` commands for Z2M
4. **WAIT 60 seconds** between Z2M operations
5. If restart fails, check validation output in journalctl

**Recovery if validation blocks:**
```bash
# 1. Check available backups
ssh pi@pi "ls -la /mnt/storage/backups/zigbee2mqtt/"

# 2. Restore from backup (replace TIMESTAMP)
ssh pi@pi "sudo cp /mnt/storage/backups/zigbee2mqtt/database.db.TIMESTAMP /opt/zigbee2mqtt/data/database.db"
ssh pi@pi "sudo cp /mnt/storage/backups/zigbee2mqtt/coordinator_backup.json.TIMESTAMP /opt/zigbee2mqtt/data/coordinator_backup.json"

# 3. Retry
ssh pi@pi "sudo systemctl start zigbee2mqtt"
```

**See also:** `configs/zigbee2mqtt/NETWORK_KEYS.md` for disaster recovery keys.

### 7. Home Assistant Container Requirements (Jan 16, 2026)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  HA RUNS ISOLATED - SHELL_COMMANDS EXECUTE INSIDE CONTAINER  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROBLEM: shell_command runs INSIDE HA container, not host.     │
│  Docker CLI (`docker start`) isn't in the HA image.             │
│                                                                 │
│  REQUIREMENTS for HA to control Docker:                         │
│  1. Mount Docker socket: -v /var/run/docker.sock:...            │
│  2. Use curl + Docker API (not docker CLI)                      │
│  3. Use --network host for localhost access                     │
│                                                                 │
│  See: configs/homeassistant/CLAUDE.md for full details          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Correct HA container startup:**
```bash
docker run -d --name homeassistant --restart unless-stopped \
  -v /opt/homeassistant:/config \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --network host \
  -e TZ=Europe/Berlin \
  ghcr.io/home-assistant/home-assistant:stable
```

**shell_command must use curl, not docker:**
```yaml
# WRONG (docker CLI not in HA image)
shell_command:
  start_container: "docker start my-container"

# CORRECT (use Docker API via socket)
shell_command:
  start_container: "curl -s --unix-socket /var/run/docker.sock -X POST http://localhost/v1.44/containers/my-container/start"
```

---

## Lessons Learned (AI Memory)

### EGLO Rovito-Z `color_mode` is Misleading; Main Ring and Backlight are Independent (2026-04-15)

**Observation:** The EGLO Rovito-Z (AwoX EBF_RGB_Zm, model 900087) has two physical LED elements — a CCT main ring and an RGB backlight strip. Z2M reports a single `color_mode` attribute (`color_temp` or `hs`), which led me to assume the two elements are mutually exclusive. **That is wrong.** Both LEDs run simultaneously by default.

**Verified behavior:**
```
┌──────────────────────────────────────────────────────────────┐
│  COMMAND                    → PHYSICAL EFFECT                │
├──────────────────────────────────────────────────────────────┤
│  {"color_temp": 300}        → main ring only (backlight     │
│                                unchanged)                    │
│  {"color":{"hue":X,"sat":Y}}→ backlight only (main          │
│                                unchanged)                    │
│  {"color":{"x":0,"y":0}}    → backlight OFF only (main      │
│                                ring preserved) [see below]   │
│  {"state":"ON"/"OFF"}       → both                           │
│  {"brightness": N}          → both (coupled at endpoint      │
│                                level)                        │
└──────────────────────────────────────────────────────────────┘
```

**Implication for Z2M / dashboard UX:**
- Z2M's `color_mode` field on this lamp only reflects the *last command type*, not the active output state. Don't trust it.
- Exposing CCT slider + color picker gives genuinely independent main/backlight control via standard Zigbee. No external converter needed.
- `saturation: 0` on HS does NOT turn the backlight off - it desaturates to white AND appears to drag main ring CCT toward cool white (~167 mired). Treat it as "backlight white", not "backlight off".

**Breakthrough (2026-04-15 evening, commit a324145): real backlight OFF via xy(0,0).** An earlier version of this lesson claimed "there is no standard Zigbee way to turn off ONLY the backlight while keeping main ring on." That was wrong. Sending `{"color":{"x":0,"y":0}}` on the main endpoint truly turns off the RGB backlight LEDs without affecting the main CCT ring - and without dragging main-ring color_temp (unlike sat=0, which pulls it toward cool white). This is implemented in `services/dashboard/www/index.html` via `_applyBacklightBlend` / `setBacklightOn(light, false)`. It is the cleanest standard-Zigbee path we have for backlight-only power control; no external converter, no proprietary cluster required. The physical EGLO 99099 remote still can't do this - its power button toggles both elements together, but that's a remote-UX limitation, not a network-protocol one.

**Proprietary-cluster dead end (2026-04-15):** We probed cluster 0xFC57 (64599) on endpoint 1 and cluster 0xFF50/0xFF51 (65360/65361) on endpoint 3 with manufacturer code 0x1135. Findings:
- **0xFC57 is NOT proprietary AwoX.** It's the Amazon WWAH (Works With All Hubs) cluster. Z2M logs it as `manuSpecificAmazonWWAH.read`. Readable attributes are all standard WWAH fields (`disableOTADowngrades`, `mgmtLeaveWithoutRejoinEnabled`, `nwkRetryCount`, `touchlinkInterpanEnabled`, etc). Zero backlight content.
- **0xFF50 / 0xFF51 on endpoint 3** — all attribute reads time out at 10s. These clusters are likely pure command-driven (no readable attributes) or only respond to multicast/group addressing. Without sniffing the AwoX phone app's traffic (which may be BLE, not Zigbee), we can't discover the commands.
- GitHub issues #1927 (PADROGIANO-Z) and z2m #18366 document other users hitting the same wall with no public resolution. zigbee-herdsman-converters has fingerprints for these clusters but zero parsing code.
- **Do NOT re-attempt** unless someone publicly posts decoded AwoX command payloads.

The exploratory probe converter is kept at `configs/zigbee2mqtt/external_converters/eglo-rovito-probe.js` for reference only — it was deployed, run once, then removed from the Pi.

**Software pseudo-dim:** the Bed Light dashboard card has an 🔅 Intensity slider (`setBacklightIntensity` in `services/dashboard/www/index.html`) that linearly interpolates between the user's vivid color (at 100%) and a neutral hue/sat blend (at 0%). At 0% the slider sends `{color:{hue,sat}, color_temp}` to match the main ring - this is *visual fade*, not a power-off. The 🎨 OFF pill is different: it sends `{color:{x:0,y:0}}` to truly power down the backlight LEDs (see breakthrough note above). Intensity=0 and OFF pill are NOT equivalent - one blends, one powers off. Keep them as two distinct UI affordances.

**Dashboard label convention (services/dashboard/www/index.html):**
- For lights with `supportsColor: true`, the CCT slider is labeled "🌡️ Main Ring" and the color picker is labeled "🎨 Backlight Color".
- For CCT-only lights (IKEA FLOALT, AwoX 33955), labels remain the generic "Color Temp" with no color picker section.

---

### EGLO connect.z Lamps Need BLE Firmware Update Before Z2M Pairing (2026-04-15)

**Incident:** Paired new EGLO Rovito-Z (model 900087, AwoX firmware). Device joined the Zigbee network but every interview failed at the first ZDO step with "Interview failed because can not get node descriptor". 10+ retries, different routers, touchlink scans - all failed identically. Matches GitHub issues #16431 and #18322.

**Root cause:** Shipped firmware reports old Zigbee spec revision (21 vs current 23) and the AwoX ZDO handler doesn't respond to NodeDescriptor unicasts. Z2M's interview state machine requires NodeDescriptor as the first step before any fingerprint matching can occur, so no data can be captured and no external_converter can rescue it.

**Fix:** BLE-side firmware update via the "AwoX HomeControl" phone app. Install the app, pair the lamp over Bluetooth, trigger the firmware update - changelog literally says "Improved compatibility with third-party hubs". Post-update version: `3.0.1_1593`. After update, removed from AwoX app, factory-reset, re-paired to Z2M. Interview succeeded on first try, identified as `AwoX EBF_RGB_Zm` (matches Z2M's built-in converter).

**Prevention for future AwoX / EGLO connect.z lamps:**
```
┌──────────────────────────────────────────────────────────────┐
│  BEFORE pairing a new EGLO connect.z / AwoX lamp to Z2M:     │
│  1. Install "AwoX HomeControl" app on phone                  │
│  2. Pair lamp via Bluetooth                                  │
│  3. Check & apply firmware update (usually ≥ 3.0.x)          │
│  4. Remove from AwoX app, factory reset                      │
│  5. THEN pair to Z2M                                         │
│                                                              │
│  Symptoms to recognize:                                      │
│  • Device joins (gets nwkAddr) but interview stalls          │
│  • Log: "Interview failed because can not get node           │
│    descriptor"                                               │
│  • Log: "Device is only compliant to revision '21' of the    │
│    Zigbee specification"                                     │
└──────────────────────────────────────────────────────────────┘
```

**Important:** AwoX / EGLO connect.z lamps are dual-protocol (Zigbee + Bluetooth). The Bluetooth side is the only way to update firmware. There is no Zigbee OTA path.

---

### Dashboard Network View - Wall Index Tracing

**Rule:** Do not cache wall indices in memory or documentation. They change when the floor plan is refactored.

**History:** An earlier version of this lesson documented an 18-wall layout (indices 0-17 across room walls 0-15 and interior dividers 16-17). That map is obsolete. The floor plan was consolidated (most exterior room walls merged into shared north/south/east/west walls, Kitchen↔Bedroom interior divider removed entirely) and the wall count is now 10 (indices 0-9).

**Authoritative source:** the docblock at the top of `buildFloorPlan()` in `services/dashboard/www/views/network.js` (search for `WALL INDEX REFERENCE`). When debugging wall rendering, read it there - not from this file. If you refactor the floor plan again, update the docblock in one place and leave this lesson intact.

**Prevention:** Always verify execution order by reading the actual code flow. When debugging visual elements, cross-reference with the rendered output (screenshot via Playwright) rather than relying solely on code tracing.