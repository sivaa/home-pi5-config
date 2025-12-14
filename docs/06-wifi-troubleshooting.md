# WiFi Troubleshooting

> **Last Updated:** December 13, 2025
> **Status:** Power save disabled, watchdog active, case partially open

---

## The Story

```
    ┌──────────────────────────────────────────────────────────────┐
    │                                                              │
    │    ┌─────────┐    ~~~~     ┌─────────┐                      │
    │    │   Pi    │   ~WiFi~   │ Router  │                       │
    │    │  📡     │    ~~~~    │   🌐    │                       │
    │    └─────────┘            └─────────┘                       │
    │                                                              │
    │    Problem: Pi disconnects after hours of idle time         │
    │    Solution: Disable WiFi power management                  │
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
```

Our Pi 5 was randomly disconnecting from WiFi after ~3 hours of idle time.
After investigation, we found **three contributing factors**:

1. **Metal case blocking WiFi** - Joy-IT aluminum case acts as a Faraday cage
2. **WiFi power management** - Linux enables power save by default, causing drops
3. **Weak 5GHz signal + wpa_supplicant backoff** - Signal drops cause reconnection failures

---

## Issue #1: Metal Case Blocking WiFi

### Symptoms
- WiFi works when case is open
- No connection when case is fully closed
- Pi stays powered (lights on) but unreachable

### Root Cause

```
┌─────────────────────────────────────────┐
│         METAL CASE (CLOSED)             │
│  ┌─────────────────────────────────┐    │
│  │     Raspberry Pi 5              │    │
│  │  ┌──────────┐                   │    │
│  │  │ Internal │  ~~~~~ WiFi      │    │  <- Signals trapped
│  │  │ Antenna  │  waves ~~~~~     │    │
│  │  └──────────┘                   │    │
│  └─────────────────────────────────┘    │
│   Metal blocks 2.4GHz/5GHz signals!     │
└─────────────────────────────────────────┘
```

**Our Case:** Joy-IT RB-AlucaseP5-M2 (aluminum with M.2 support)

### Current Workaround
Keep case partially open to allow WiFi signals to escape.

### Long-term Solutions
| Option | Cost | Notes |
|--------|------|-------|
| USB WiFi adapter with external antenna | ~20 EUR | Most reliable |
| Mesh WiFi extender + short Ethernet | ~40 EUR | Best performance |
| Drill antenna hole in case | Free | Route antenna wire out |

---

## Issue #2: WiFi Power Management

### Symptoms
- Pi works for hours, then suddenly disconnects
- Happens during idle periods (no active SSH)
- Requires power cycle to reconnect

### Root Cause
Linux enables WiFi power saving by default. The brcmfmac driver (Pi 5's WiFi chip)
goes into low-power mode during inactivity and sometimes fails to wake up properly.

**Evidence from boot logs:**
```
dmesg | grep -i power_mgmt
  brcmfmac: brcmf_cfg80211_set_power_mgmt: power save enabled
```

### The Fix

We created a NetworkManager config to permanently disable WiFi power saving:

**File:** `/etc/NetworkManager/conf.d/wifi-powersave-off.conf`
```ini
[connection]
wifi.powersave = 2
```

**Power save values:**
- `0` = Default (uses system setting, which is ON)
- `1` = Ignore
- `2` = Disable (what we want!)
- `3` = Enable

### Commands Used

```bash
# Create the config file
sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf << 'EOF'
[connection]
wifi.powersave = 2
EOF

# Restart NetworkManager to apply
sudo systemctl restart NetworkManager

# Verify it's disabled
dmesg | grep -i power_mgmt
# Should show: "power save disabled"
```

### Verification

After applying the fix:
```
[  5.78s] power save enabled    <- Boot (before NM reads config)
[847.63s] power save enabled    <- NM restart (brief moment)
[850.31s] power save disabled   <- Config applied! SUCCESS
```

---

## Issue #3: Signal Dropout & wpa_supplicant Backoff

### Symptoms
- WiFi drops even with case open and power save disabled
- Pi doesn't auto-reconnect even after signal returns
- Logs show "ssid-not-found" and "SSID-TEMP-DISABLED"

### Root Cause

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROBLEM: Signal drops → SSID invisible → wpa_supplicant gives up  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  The 5GHz signal at ~55% is MARGINAL. When it drops temporarily:   │
│                                                                      │
│  1. Pi loses connection to router                                   │
│  2. Router's SSID becomes invisible to Pi                           │
│  3. wpa_supplicant tries to reconnect but can't find SSID          │
│  4. After multiple failures, wpa_supplicant DISABLES the SSID      │
│  5. Even when signal returns, Pi has given up trying               │
│                                                                      │
│  NetworkManager has infinite retries configured, BUT wpa_supplicant │
│  has its own backoff mechanism that overrides this behavior!       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Evidence from logs (Dec 13, 2025):**
```
17:54:15  WiFi dropped: completed → disconnected
17:54:30  "ssid-not-found" + "link timed out" - SSID invisible!
17:55:42  "CTRL-EVENT-SSID-TEMP-DISABLED" - backoff started
17:55:52  "SSID-TEMP-DISABLED auth_failures=2" - more failures
17:56:51  "Activation: FAILED" - gave up entirely
17:56:56  Interface went INACTIVE - stopped trying
```

### Why NetworkManager's Infinite Retries Don't Help

```
┌────────────────────────────────────────────────────────────────┐
│  NetworkManager says: "Retry forever!"                         │
│  wpa_supplicant says: "But I'll disable SSID after failures"  │
│                                                                │
│  wpa_supplicant's backoff:                                     │
│  • 1st failure: wait 10 seconds                               │
│  • 2nd failure: wait 20 seconds                               │
│  • 3rd+ failure: SSID temporarily disabled                    │
│  • Too many failures: interface goes INACTIVE                 │
└────────────────────────────────────────────────────────────────┘
```

### The Fix: WiFi Watchdog

Since we can't easily modify wpa_supplicant's behavior, we implemented a watchdog
that monitors WiFi and restarts NetworkManager if the connection is down.

See: [WiFi Watchdog](#wifi-watchdog) section below.

---

## Diagnostic Commands

Use these to troubleshoot WiFi issues:

```bash
# Check WiFi interface status
ip link show wlan0

# Check WiFi signal strength
nmcli device wifi list

# Check power save status (if iw is installed)
iw dev wlan0 get power_save

# Check NetworkManager connection details
nmcli connection show 'netplan-wlan0-Vodafone-88D2-5' | grep powersave

# Check kernel messages for WiFi events
dmesg | grep -iE 'brcm|wifi|wlan|power'

# Check temperature (rule out thermal issues)
vcgencmd measure_temp
```

---

## Network Configuration

### Current Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                    WIFI CONFIGURATION                           │
├─────────────────────────────────────────────────────────────────┤
│  Interface:    wlan0                                            │
│  SSID:         Vodafone-88D2-5 (5GHz, channel 140)             │
│  Connection:   netplan-wlan0-Vodafone-88D2-5                   │
│  IP:           192.168.0.174 (DHCP)                            │
│  Signal:       ~58% (reduced by metal case)                    │
│  Chip:         BCM4345/6 (brcmfmac driver)                     │
│  Power Save:   DISABLED                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Backup Location
Config backup: `backups/configs/wifi-powersave-off.conf`

---

## Disaster Recovery

If WiFi stops working after a fresh Pi installation:

### 1. Disable Power Save
```bash
sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf << 'EOF'
[connection]
wifi.powersave = 2
EOF
sudo systemctl restart NetworkManager

# Verify
dmesg | grep -i power_mgmt
# Should show "power save disabled"
```

### 2. Enable Persistent Journaling
```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/persistent.conf << 'EOF'
[Journal]
Storage=persistent
EOF
sudo mkdir -p /var/log/journal/$(cat /etc/machine-id)
sudo systemctl restart systemd-journald
sudo journalctl --flush
```

### 3. Install WiFi Watchdog
```bash
# Copy from repo backups/configs/wifi-watchdog/
sudo cp wifi-watchdog.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/wifi-watchdog.sh
sudo cp wifi-watchdog.service /etc/systemd/system/
sudo cp wifi-watchdog.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wifi-watchdog.timer
sudo systemctl start wifi-watchdog.timer
```

### 4. Physical Setup
- Keep metal case **partially open**
- Consider USB WiFi adapter for better signal
- Or switch to 2.4GHz band for better wall penetration

---

## Persistent Journaling for Debugging

By default, systemd-journald doesn't persist logs across reboots. This makes debugging WiFi issues
harder because logs are lost after a power cycle. Enable persistent journaling to preserve evidence:

### Setup Commands

```bash
# Create journal directory for persistent storage
sudo mkdir -p /var/log/journal

# Apply proper permissions
sudo systemd-tmpfiles --create --prefix /var/log/journal

# Restart journald to start using persistent storage
sudo systemctl restart systemd-journald

# Verify it's working
journalctl --disk-usage
```

### Why This Matters

When WiFi drops and you have to reboot:
- **Without persistent journaling:** All logs from before the reboot are lost
- **With persistent journaling:** You can see exactly what happened with `journalctl --boot=-1`

---

## Incident Log

Track WiFi issues here for pattern recognition and troubleshooting reference.

### 2025-12-13: Case Closure WiFi Dropout

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INCIDENT REPORT                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Date:        December 12-13, 2025 (overnight)                      │
│  Symptom:     SSH unreachable, Pi lights ON                         │
│  Duration:    Unknown (discovered in morning)                       │
│  Resolution:  Manual power cycle + case opened                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  EVIDENCE GATHERED:                                                  │
│  • Pi had power (lights on)                                         │
│  • SSH connection timed out                                         │
│  • Metal case was FULLY CLOSED                                      │
│  • WiFi signal after reboot: 54% (weak)                            │
│  • No crash/panic in dmesg                                          │
│  • Pre-reboot logs lost (journald not persistent)                  │
│                                                                      │
│  ROOT CAUSE: Metal case fully closed (Faraday cage effect)         │
│                                                                      │
│  PREVENTION: Keep case partially open until permanent fix           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Lessons Learned:**
- Metal case MUST remain partially open for reliable WiFi
- Enabled persistent journaling for future debugging
- Signal strength alone (54%) is marginal - case closure pushed it over the edge

### 2025-12-13 (Evening): Signal Dropout with Case Open

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INCIDENT REPORT #2                                │
├─────────────────────────────────────────────────────────────────────┤
│  Date:        December 13, 2025 (~17:54)                            │
│  Symptom:     SSH unreachable, Pi lights ON                         │
│  Case:        PARTIALLY OPEN (not fully closed!)                    │
│  Resolution:  Manual power cycle                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  EVIDENCE FROM PERSISTENT LOGS (journalctl --boot=-1):              │
│                                                                      │
│  17:54:15  WiFi state: completed → disconnected                     │
│  17:54:30  "ssid-not-found" - router SSID invisible                │
│  17:55:35  Auto-activation attempted                                │
│  17:55:42  "SSID-TEMP-DISABLED" - wpa_supplicant backoff            │
│  17:56:51  "Activation: FAILED" - gave up                           │
│  17:56:56  Interface went INACTIVE                                  │
│                                                                      │
│  ROOT CAUSE: 5GHz signal (~55%) dropped temporarily                 │
│  wpa_supplicant couldn't find SSID and gave up after retries       │
│                                                                      │
│  FIX APPLIED: WiFi Watchdog service installed                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Lessons Learned:**
- 5GHz signal at 55% is too weak for reliable operation
- wpa_supplicant has its own backoff that overrides NetworkManager
- Need a watchdog to detect and recover from these failures
- Consider switching to 2.4GHz for better wall penetration

---

## WiFi Watchdog

A systemd timer that monitors WiFi connectivity and restarts NetworkManager if the connection fails.

### Why We Need This

```
┌─────────────────────────────────────────────────────────────────────┐
│  When wpa_supplicant gives up, only a NetworkManager restart helps │
│                                                                      │
│  The watchdog runs every 2 minutes:                                 │
│  1. Ping the default gateway                                        │
│  2. If unreachable AND WiFi is disconnected                         │
│  3. Restart NetworkManager                                          │
│  4. Wait 15 seconds for reconnection                                │
│  5. Log the result                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Files on Pi

| File | Purpose |
|------|---------|
| `/usr/local/bin/wifi-watchdog.sh` | The watchdog script |
| `/etc/systemd/system/wifi-watchdog.service` | Systemd service unit |
| `/etc/systemd/system/wifi-watchdog.timer` | Timer (runs every 2 min) |

### Installation

```bash
# Copy script (from repo backup)
sudo cp backups/configs/wifi-watchdog/wifi-watchdog.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/wifi-watchdog.sh

# Copy systemd units
sudo cp backups/configs/wifi-watchdog/wifi-watchdog.service /etc/systemd/system/
sudo cp backups/configs/wifi-watchdog/wifi-watchdog.timer /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable wifi-watchdog.timer
sudo systemctl start wifi-watchdog.timer
```

### Monitoring

```bash
# Check timer status
systemctl status wifi-watchdog.timer

# View watchdog logs
journalctl -t wifi-watchdog --since "1 hour ago"

# Check next scheduled run
systemctl list-timers | grep wifi

# Live log monitoring
journalctl -t wifi-watchdog -f
```

### Backup Location

All watchdog files are backed up in: `backups/configs/wifi-watchdog/`

---

## References

- [Raspberry Pi Forums - Metal case & WiFi](https://forums.raspberrypi.com/viewtopic.php?t=287166)
- [Raspberry Pi Forums - Aluminium case issues](https://forums.raspberrypi.com/viewtopic.php?t=369160)
- [Joy-IT RB-AlucaseP5-M2](https://joy-it.net/en/products/RB-AlucaseP5-M2)
