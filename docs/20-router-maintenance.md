# Router Maintenance - Automated Daily Reboot

## Background

On **December 17, 2025**, the Pi experienced a network outage around 12:43 PM. Investigation revealed:

```
+------------------------------------------------------------------+
|  ROOT CAUSE: Vodafone Router Entered Degraded State              |
|                                                                  |
|  Timeline:                                                       |
|  12:43:33  Cloudflared: "timeout: no recent network activity"    |
|  12:43:33  wpa_supplicant: locally_generated=1 (Pi disconnected) |
|  12:43:36  wpa_supplicant: ASSOC-REJECT status_code=16           |
|            ^^^^ Router refusing new connections                  |
|  12:43:44  DNS to 192.168.0.1:53 timeout                         |
|            ^^^^ Router not responding locally                    |
+------------------------------------------------------------------+
```

**Status code 16** = "Association denied - AP unable to handle additional STAs"

The router was partially alive but refusing WiFi connections. This is a known issue with consumer routers that can be mitigated with periodic reboots.

---

## Solution: Daily 4 AM Router Reboot

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DAILY ROUTER REBOOT FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   4:00 AM  ──>  cron  ──>  router-reboot.sh                        │
│                                  │                                  │
│                                  v                                  │
│                       arris_tg3442_reboot.py                       │
│                           (Python script)                          │
│                                  │                                  │
│                                  v                                  │
│                       Vodafone Router API                          │
│                       (graceful restart)                           │
│                                  │                                  │
│                          (wait 2 min)                              │
│                                  │                                  │
│                                  v                                  │
│                       Verify connectivity                          │
│                          (ping 8.8.8.8)                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Router Information

| Property | Value |
|----------|-------|
| Model | Vodafone Station (ARRIS TG3442DE) |
| Firmware | 01.05.063.13.EURO.PC20 |
| IP Address | 192.168.0.1 |
| Admin URL | http://192.168.0.1 |
| ISP | Vodafone Kabel (Germany) |

---

## Setup

### 1. Install Dependencies on Pi

```bash
# Python dependencies
pip3 install beautifulsoup4 pycryptodome requests lxml --break-system-packages

# Clone reboot script
git clone https://github.com/diveflo/arris-tg3442-reboot.git ~/arris-tg3442-reboot
```

### 2. Patch Firmware Support

The stock script doesn't support firmware `01.05.063.13.EURO.PC20`. Add this line to `~/arris-tg3442-reboot/firmware.py`:

```python
firmware_versions = {
    # ... existing entries ...
    "01.05.063.13.EURO.PC20": FirmwareEnd2024  # <-- ADD THIS
}
```

### 3. Configure Password

```bash
# Copy template
cp ~/pi-setup/scripts/.env.example ~/pi-setup/scripts/.env
chmod 600 ~/pi-setup/scripts/.env

# Edit with your router password
nano ~/pi-setup/scripts/.env
```

### 4. Cron Job (Already Configured)

```bash
# View current crontab
crontab -l

# Should show:
# 0 4 * * * /home/pi/pi-setup/scripts/router-reboot.sh >> /var/log/router-reboot.log 2>&1
```

---

## Files

| Location | Purpose |
|----------|---------|
| `~/pi-setup/scripts/router-reboot.sh` | Main wrapper script |
| `~/pi-setup/scripts/.env` | Router password (not in git) |
| `~/arris-tg3442-reboot/` | Python reboot tool |
| `/var/log/router-reboot.log` | Execution logs |

---

## Manual Testing

```bash
# Full test (will reboot router!)
~/pi-setup/scripts/router-reboot.sh

# Direct Python call
cd ~/arris-tg3442-reboot
python3 arris_tg3442_reboot.py -t http://192.168.0.1 -p "YOUR_PASSWORD"

# Check logs
tail -f /var/log/router-reboot.log
```

---

## Troubleshooting

### Script fails with "firmware not detected"

Your router firmware may have been updated. Check the current version:

```bash
curl -s http://192.168.0.1/ | grep -oE '01\.[0-9]+\.[0-9]+\.[0-9]+\.EURO[^"]*'
```

Then add it to `~/arris-tg3442-reboot/firmware.py` mapping to the closest existing handler.

### Login failure

1. Verify password in `~/pi-setup/scripts/.env`
2. Test manually via router web interface at http://192.168.0.1
3. Check if router is accessible: `ping 192.168.0.1`

### Router doesn't come back online

Wait longer (some reboots take 3-5 minutes). If still down:
- Check router physically
- Power cycle router manually
- Phase 2 (future): Smart plug fallback

---

## Phase 2 (Future)

Add smart plug fallback using `switch.smart_plug_1` (Zigbee) for hard power cycle if graceful reboot fails.

---

## References

- [arris-tg3442-reboot GitHub](https://github.com/diveflo/arris-tg3442-reboot)
- [Vodafone Kabel Forum Discussion](https://www.vodafonekabelforum.de/viewtopic.php?t=41264)
- Investigation report: `~/.claude/plans/fancy-sparking-boole.md`
