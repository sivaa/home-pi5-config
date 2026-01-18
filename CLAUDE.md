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
│   ├── display-scheduler/
│   ├── kiosk-browser/
│   └── cloudflared/
├── services/           # Docker service code
│   ├── dashboard/      # Custom web dashboard
│   ├── heater-watchdog/
│   ├── mqtt-influx-bridge/
│   └── cast-ip-monitor/
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
- **Zigbee Devices:** 39 total (including coordinator)
  - 12x Temperature sensors (SNZB-02P, SNZB-02WD)
  - 8x Window/door contact sensors (SNZB-04P)
  - 4x Thermostats (TRVZB radiator valves)
  - 4x Light switches (SONOFF ZBM5-1C-80/86) - Study, Bed, Living
  - 3x Smart plugs (S60ZBTPF)
  - 2x IKEA FLOALT lights + 2x remotes
  - 1x CO2 sensor (NOUS E10)
  - 1x Motion sensor (SNZB-03P) - Mailbox
  - 1x Vibration sensor (Hot Water tracking)
  - 1x Fingerbot (Tuya TS0001_fingerbot)
- **Docker Services:** 8 containers
  - mosquitto (MQTT), zigbee2mqtt, homeassistant, influxdb
  - dashboard (nginx), mqtt-influx-bridge, cast-ip-monitor, heater-watchdog

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
│     - scp files to /opt/dashboard/www/                          │
│     - Fix permissions: sudo chmod -R 755 /opt/dashboard/www     │
│                                                                 │
│  WHY: Faster testing & iteration cycles!                        │
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

### 6. Zigbee2MQTT Operations (CRITICAL - 35 DEVICES AT RISK)

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

### Dashboard Network View - Wall Index Tracing (2024-12-14)

**Mistake Made:** When tracing wall indices in `services/dashboard/www/index.html`, incorrectly assumed interior divider walls (wall1, wall2) were created BEFORE room walls. This led to wrong wall identification (claimed wall 17 was bathroom's exterior wall when it's actually the Kitchen↔Bedroom interior divider).

**Root Cause:** Did not carefully read the execution order in `buildFloorPlan()`:
```javascript
buildFloorPlan() {
  // FIRST: Room walls created (walls 0-15)
  FLOOR_PLAN_CONFIG.rooms.forEach(config => this.createRoom(config));

  // THEN: Interior walls created (walls 16-17)
  // wall1 → index 16
  // wall2 → index 17
}
```

**Correct Wall Index Map:**
```
0-2:   Study (back, left, right)
3-5:   Living (front, left, right)
6-8:   Bedroom (front, left, right)
9-11:  Kitchen (back, left, right)
12-15: Bathroom (back, front, left, right)
16:    Interior - Study↔Living horizontal divider
17:    Interior - Kitchen↔Bedroom horizontal divider
```

**Prevention:** Always verify execution order by reading the actual code flow. Don't assume based on code comments or naming. When debugging visual elements, cross-reference with the actual rendered output (screenshots) rather than relying solely on code tracing.