# WiFi Troubleshooting

> **Last Updated:** December 12, 2025
> **Status:** Power save disabled, monitoring for stability

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
After investigation, we found **two contributing factors**:

1. **Metal case blocking WiFi** - Joy-IT aluminum case acts as a Faraday cage
2. **WiFi power management** - Linux enables power save by default, causing drops

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

1. **Re-create power save config:**
   ```bash
   sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf << 'EOF'
   [connection]
   wifi.powersave = 2
   EOF
   sudo systemctl restart NetworkManager
   ```

2. **If metal case issue:** Keep case open or use external WiFi adapter

3. **Verify fix applied:**
   ```bash
   dmesg | grep -i power_mgmt
   # Should show "power save disabled"
   ```

---

## References

- [Raspberry Pi Forums - Metal case & WiFi](https://forums.raspberrypi.com/viewtopic.php?t=287166)
- [Raspberry Pi Forums - Aluminium case issues](https://forums.raspberrypi.com/viewtopic.php?t=369160)
- [Joy-IT RB-AlucaseP5-M2](https://joy-it.net/en/products/RB-AlucaseP5-M2)
