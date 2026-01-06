# Scripts Directory

Utility scripts for Pi maintenance and automation.

## Scripts

### router-reboot.sh
Gracefully reboots the Vodafone router using the arris-tg3442-reboot Python script.

```
+------------------------------------------------------------------------+
|  DAILY 4 AM ROUTER REBOOT                                              |
|                                                                        |
|   Cron ───> router-reboot.sh ───> arris_tg3442_reboot.py ───> Router   |
|                                                                        |
|   Phase 2 (Future): Smart plug fallback if Python script fails         |
+------------------------------------------------------------------------+
```

**Why?**
- Vodafone router occasionally enters degraded state
- Dec 17, 2025: Router rejected WiFi connections (status_code=16)
- Preventive daily reboot maintains stability

**Prerequisites:**
```bash
# Install Python dependencies
pip3 install beautifulsoup4 pycryptodome requests lxml --break-system-packages

# Clone reboot script
git clone https://github.com/diveflo/arris-tg3442-reboot.git ~/arris-tg3442-reboot

# Patch firmware.py to support 01.05.063.13.EURO.PC20
# Add this line to firmware_versions dict:
#   "01.05.063.13.EURO.PC20": FirmwareEnd2024
```

**Setup:**
```bash
cp .env.example .env
chmod 600 .env
# Edit .env with your router password
```

**Cron (daily 4 AM):**
```bash
0 4 * * * /home/pi/pi-setup/scripts/router-reboot.sh >> /var/log/router-reboot.log 2>&1
```

**Manual test:**
```bash
~/pi-setup/scripts/router-reboot.sh
# Or directly:
cd ~/arris-tg3442-reboot && python3 arris_tg3442_reboot.py -t http://192.168.0.1 -p "PASSWORD"
```

---

## Zigbee2MQTT Scripts

### safe-z2m-restart.sh
**ALWAYS use this script to restart Z2M** (never use docker restart directly).

```
+--------------------------------------------------------------------------+
|  SAFE Z2M RESTART                                                        |
+--------------------------------------------------------------------------+
|                                                                          |
|  Step 1: Backup              → Creates backup before restart             |
|  Step 2: Graceful Stop       → 30s timeout for clean shutdown            |
|  Step 3: USB Settle          → 5s wait for USB to stabilize              |
|  Step 4: Validation          → Checks database integrity                 |
|  Step 5: Start + Verify      → Confirms Z2M is operational               |
|                                                                          |
+--------------------------------------------------------------------------+
```

**Why this exists:**
On Jan 4, 2026, rapid docker restart commands caused complete network loss
(35 devices orphaned). This script prevents similar incidents.

**Usage:**
```bash
ssh pi@pi "sudo /opt/scripts/safe-z2m-restart.sh"
```

**DO NOT USE:**
```bash
# These bypass safety checks!
docker restart zigbee2mqtt    # DANGEROUS
docker stop/start zigbee2mqtt # DANGEROUS
```

---

### z2m-backup.sh
Creates hourly backups of Z2M database and coordinator state.

```
+--------------------------------------------------------------------------+
|  HOURLY BACKUP SYSTEM                                                    |
+--------------------------------------------------------------------------+
|                                                                          |
|  Cron:      Every hour at minute 0                                      |
|  Location:  /mnt/storage/backups/zigbee2mqtt/                           |
|  Retention: 7 days (~168 hourly backups)                                |
|                                                                          |
|  Files:                                                                  |
|    - database.db.<YYYYMMDD_HHMM>                                        |
|    - coordinator_backup.json.<YYYYMMDD_HHMM>                            |
|                                                                          |
+--------------------------------------------------------------------------+
```

**Manual backup:**
```bash
ssh pi@pi "sudo /opt/scripts/z2m-backup.sh"
```

**List backups:**
```bash
ssh pi@pi "ls -la /mnt/storage/backups/zigbee2mqtt/"
```

---

### z2m-validate.sh
Pre-start validation that prevents Z2M from starting with corrupted database.

```
+--------------------------------------------------------------------------+
|  VALIDATION CHECKS                                                       |
+--------------------------------------------------------------------------+
|                                                                          |
|  1. Fresh install detection (allows first-time start)                   |
|  2. coordinator_backup.json presence                                    |
|  3. database.db.backup presence                                         |
|  4. database.db size >= 30% of backup (corruption detection)            |
|                                                                          |
|  EXIT CODES:                                                             |
|    0 = OK to start                                                      |
|    1 = BLOCKED (corruption detected, DO NOT START)                      |
|                                                                          |
+--------------------------------------------------------------------------+
```

**If blocked:**
```bash
# Check why
ssh pi@pi "sudo journalctl -u zigbee2mqtt -n 50"

# Restore from backup (replace TIMESTAMP)
ssh pi@pi "sudo cp /mnt/storage/backups/zigbee2mqtt/database.db.TIMESTAMP \
    /opt/zigbee2mqtt/data/database.db"
ssh pi@pi "sudo cp /mnt/storage/backups/zigbee2mqtt/coordinator_backup.json.TIMESTAMP \
    /opt/zigbee2mqtt/data/coordinator_backup.json"

# Retry
ssh pi@pi "sudo systemctl start zigbee2mqtt"
```

---

### lint-css-performance.sh
Scans dashboard CSS files for expensive properties that cause high CPU on Raspberry Pi.

```
┌────────────────────────────────────────────────────────────────────┐
│  CSS PERFORMANCE LINTER                                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  BANNED (errors):                                                  │
│    backdrop-filter: blur()    → Extremely CPU intensive            │
│    filter: blur()             → Causes Skia CPU spikes             │
│                                                                    │
│  WARNINGS (review needed):                                         │
│    filter: grayscale()        → Use opacity instead                │
│    animation: * infinite      → Constant rendering work            │
│    Multi-layer box-shadow     → Skia repaints 108%+ CPU            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Usage:**
```bash
./scripts/lint-css-performance.sh              # Scan all dashboard CSS
./scripts/lint-css-performance.sh path/to.css  # Scan specific file
```

**Exit codes:**
- `0` = All checks passed
- `1` = Errors found (must fix before deploy)
- `2` = Warnings found (review needed)

---

### check-pi-health.sh
Verifies Pi kiosk is running efficiently after CSS/dashboard changes.

```
┌────────────────────────────────────────────────┐
│  METRIC              │  WARNING   │  CRITICAL  │
├──────────────────────┼────────────┼────────────┤
│  CPU Temperature     │  > 55°C    │  > 60°C    │
│  Fan State           │  > 1       │  = 2       │
│  System Load (1m)    │  > 3.0     │  > 4.0     │
│  Browser CPU %       │  > 100%    │  > 150%    │
│  Display Refresh Hz  │  != 60     │  > 60      │
└────────────────────────────────────────────────┘
```

**Usage:**
```bash
./scripts/check-pi-health.sh          # Quick check
./scripts/check-pi-health.sh --wait   # Wait 60s for metrics to stabilize
```

**When to run:**
- After deploying CSS changes to Pi
- When fan noise is audible
- Before/after adding new animations

---

## Git Hooks

### hooks/pre-commit
Runs CSS linter when dashboard CSS files are staged.

**Installation:**
```bash
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Behavior:**
- Only runs when `services/dashboard/**/*.css` files are staged
- Blocks commit if banned CSS properties are found
- Bypass with: `git commit --no-verify` (use sparingly)

---

## Configuration Files

| File | Purpose | Git |
|------|---------|-----|
| `.env` | Actual credentials | IGNORED |
| `.env.example` | Template for setup | Tracked |

## External Dependencies

| Location | Purpose |
|----------|---------|
| `~/arris-tg3442-reboot/` | Python router reboot script (patched for firmware 01.05.x) |
