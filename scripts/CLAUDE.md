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

## Configuration Files

| File | Purpose | Git |
|------|---------|-----|
| `.env` | Actual credentials | IGNORED |
| `.env.example` | Template for setup | Tracked |

## External Dependencies

| Location | Purpose |
|----------|---------|
| `~/arris-tg3442-reboot/` | Python router reboot script (patched for firmware 01.05.x) |
