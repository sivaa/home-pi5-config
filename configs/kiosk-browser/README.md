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
|  Browser:    Epiphany (GNOME Web) private instance           |
|  Profile:    /tmp/kiosk-profile (ephemeral, wiped on boot)   |
|  URL:        http://localhost:8888 (dashboard)               |
|  Fullscreen: Via labwc window rule                           |
|  Recovery:   Auto-restart on crash (10s delay, max 5/5min)   |
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
   - Sets display to 60Hz + 180° rotation (logged if fails, continues)
   - Waits for dashboard to be ready (curl localhost:8888, up to 60s)
   - Wipes and recreates `/tmp/kiosk-profile` (ephemeral browser profile)

3. **Browser Launch:**
   - Epiphany opens with `--private-instance --profile=/tmp/kiosk-profile`
   - Isolated profile in `/tmp` — wiped on every reboot (tmpfs on Trixie)
   - labwc window rule triggers fullscreen

4. **Crash Recovery:**
   - If browser crashes, systemd restarts it after 10 seconds
   - Profile is wiped on each restart (prevents corrupted state loops)
   - Max 5 restarts per 5 minutes — then marked failed (prevents infinite loops)
   - Manual stop (`systemctl stop`) does not trigger restart
