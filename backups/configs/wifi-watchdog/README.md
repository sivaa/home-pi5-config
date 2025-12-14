# WiFi Watchdog

> **Purpose:** Auto-recover WiFi connection when it drops
> **Created:** December 13, 2025

## Problem

The Pi's WiFi (brcmfmac driver) sometimes fails to reconnect after signal drops. The wpa_supplicant has a backoff mechanism that gives up after multiple failures, even though NetworkManager is configured for infinite retries.

## Solution

A systemd timer that runs every 2 minutes to check connectivity and restart NetworkManager if needed.

## Files

| File | Pi Location |
|------|-------------|
| `wifi-watchdog.sh` | `/usr/local/bin/wifi-watchdog.sh` |
| `wifi-watchdog.service` | `/etc/systemd/system/wifi-watchdog.service` |
| `wifi-watchdog.timer` | `/etc/systemd/system/wifi-watchdog.timer` |

## Installation

```bash
# Copy files to Pi
sudo cp wifi-watchdog.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/wifi-watchdog.sh
sudo cp wifi-watchdog.service /etc/systemd/system/
sudo cp wifi-watchdog.timer /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable wifi-watchdog.timer
sudo systemctl start wifi-watchdog.timer
```

## Monitoring

```bash
# Check timer status
systemctl status wifi-watchdog.timer

# View logs
journalctl -t wifi-watchdog --since "1 hour ago"

# Check next scheduled run
systemctl list-timers | grep wifi
```

## How It Works

```
Every 2 minutes:
  1. Ping the default gateway
  2. If unreachable:
     a. Check if WiFi is disconnected
     b. If disconnected → Restart NetworkManager
     c. Wait 15 seconds
     d. Verify recovery
  3. Log all actions to journal
```
