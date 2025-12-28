# Kiosk Browser Configuration

> Auto-launch dashboard in fullscreen browser on Pi boot

---

## Overview

```
+---------------------------------------------------------------+
|                    KIOSK BROWSER SERVICE                      |
+---------------------------------------------------------------+
|                                                               |
|  Trigger:    Pi boot (after display-boot-check)              |
|  Browser:    Epiphany (GNOME Web) in application mode        |
|  URL:        http://localhost:8888 (dashboard)               |
|  Fullscreen: Via labwc window rule                           |
|  Recovery:   Auto-restart on crash (10s delay)               |
|                                                               |
+---------------------------------------------------------------+
```

---

## Files

| File | Pi Location | Purpose |
|------|-------------|---------|
| `kiosk-browser.service` | `~/.config/systemd/user/` | Systemd service |
| `../labwc/rc.xml` | `~/.config/labwc/` | Window rules for fullscreen |

---

## Installation

```bash
# From local machine (this repo):
scp configs/kiosk-browser/kiosk-browser.service pi@pi:~/.config/systemd/user/
scp configs/labwc/rc.xml pi@pi:~/.config/labwc/

# On Pi (via SSH):
ssh pi@pi "systemctl --user daemon-reload && \
           systemctl --user enable kiosk-browser.service && \
           killall -SIGHUP labwc"
```

---

## Manual Control

```bash
# Check status
systemctl --user status kiosk-browser.service

# Stop browser
systemctl --user stop kiosk-browser.service

# Start browser
systemctl --user start kiosk-browser.service

# View logs
journalctl --user -u kiosk-browser.service -f
```

---

## Troubleshooting

### Browser doesn't start

```bash
# Check service status
systemctl --user status kiosk-browser.service

# Check if dashboard is accessible
curl -I http://localhost:8888

# Check if Epiphany is installed
which epiphany
```

### Browser not fullscreen

```bash
# Verify window rules in labwc config
cat ~/.config/labwc/rc.xml

# Reload labwc config
killall -SIGHUP labwc

# Manual fullscreen: Press F11 in browser
```

### Browser keeps restarting

```bash
# Check for errors
journalctl --user -u kiosk-browser.service --since "10 min ago"

# Disable auto-restart temporarily
systemctl --user stop kiosk-browser.service
```

---

## How It Works

1. **Boot Sequence:**
   - Pi boots, systemd starts
   - `display-boot-check.service` runs (10s after boot)
   - `kiosk-browser.service` starts (5s after boot-check)

2. **Startup Checks:**
   - Waits for dashboard to be ready (curl localhost:8888)
   - Up to 60 seconds timeout

3. **Browser Launch:**
   - Epiphany opens with `--application-mode` (no browser chrome)
   - labwc window rule triggers fullscreen

4. **Crash Recovery:**
   - If browser crashes, systemd restarts it after 10 seconds
   - Manual stop (`systemctl stop`) does not trigger restart
