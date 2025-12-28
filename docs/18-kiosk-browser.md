# Kiosk Browser: Auto-Launch Dashboard on Boot

> **Date:** December 28, 2025
> **Updated:** December 28, 2025 (Added standalone kiosk toggle overlay)
> **Purpose:** Automatically open dashboard in fullscreen browser when Pi restarts

---

## The Story

Every night at 4:30 AM, the Pi reboots for maintenance. When it comes back up, we want the dashboard to be immediately visible in fullscreen mode, ready for touch interaction. No manual clicking required.

```
+---------------------------------------------------------------+
|                    BEFORE vs AFTER                            |
+---------------------------------------------------------------+
|                                                               |
|  BEFORE:                                                      |
|    Pi reboots -> Desktop loads -> User clicks browser icon   |
|                                   -> Opens dashboard manually |
|                                                               |
|  AFTER:                                                       |
|    Pi reboots -> Dashboard auto-opens in fullscreen          |
|              -> Touch-ready immediately                       |
|                                                               |
+---------------------------------------------------------------+
```

---

## Solution Overview

```
BOOT SEQUENCE TIMELINE
======================

0s    Pi boots, systemd starts
      |
5s    labwc (Wayland compositor) starts
      |
10s   display-boot-check.service runs
      |-> Sets day/night mode based on time
      |
15s   kiosk-browser.service starts
      |-> Waits for dashboard (nginx) to be ready
      |-> Launches Epiphany in application mode
      |
17s   labwc window rule triggers fullscreen
      |
20s   Dashboard visible, touch-ready!
```

---

## Kiosk Toggle Overlay

A standalone GTK4 floating button that allows toggling between fullscreen and windowed mode **without a physical keyboard**.

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (fullscreen)                                           │
│                                                                 │
│   Dashboard content...                                          │
│                                                                 │
│  ┌────┐                                                         │
│  │ ⛶  │  ← Floating overlay button (always on top)              │
│  └────┘    Tap to toggle kiosk mode                             │
└─────────────────────────────────────────────────────────────────┘
```

### Why Standalone?

| Approach | Problem |
|----------|---------|
| Browser JS Fullscreen API | Doesn't work with compositor-level fullscreen |
| wtype F11 | Sends to focused app, not intercepted by labwc |
| wlrctl | Can enter fullscreen, but cannot exit |

**Solution:** A separate GTK4 app using Wayland layer-shell protocol that floats above everything and controls the compositor directly.

### Toggle Mechanism

```
┌─────────────────────────────────────────────────────────────────┐
│  ENTER FULLSCREEN                │  EXIT FULLSCREEN             │
├──────────────────────────────────┼──────────────────────────────┤
│  wlrctl toplevel fullscreen      │  1. Kill browser (pkill)     │
│                                  │  2. Clear session state      │
│  (compositor-level control)      │  3. Restart browser service  │
│                                  │  4. Focus & maximize window  │
└─────────────────────────────────────────────────────────────────┘
```

### Files

| File | Location (Repo) | Location (Pi) |
|------|-----------------|---------------|
| Overlay App | `configs/kiosk-toggle/kiosk-toggle.py` | `/opt/kiosk-toggle/kiosk-toggle.py` |
| Service | `configs/kiosk-toggle/kiosk-toggle.service` | `~/.config/systemd/user/kiosk-toggle.service` |

### Installation

```bash
# Install dependencies
sudo apt install gir1.2-gtk-4.0 gir1.2-gtk4layershell-1.0 libgtk4-layer-shell0

# Deploy overlay app
sudo mkdir -p /opt/kiosk-toggle
sudo cp configs/kiosk-toggle/kiosk-toggle.py /opt/kiosk-toggle/
sudo chmod 755 /opt/kiosk-toggle/kiosk-toggle.py

# Deploy and enable service
cp configs/kiosk-toggle/kiosk-toggle.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now kiosk-toggle.service
```

### Service Control

```bash
# Check status
systemctl --user status kiosk-toggle.service

# View logs
journalctl --user -u kiosk-toggle -f

# Restart overlay
systemctl --user restart kiosk-toggle.service
```

---

## Components

### 1. Systemd Service: `kiosk-browser.service`

**Location (repo):** `configs/kiosk-browser/kiosk-browser.service`
**Location (Pi):** `~/.config/systemd/user/kiosk-browser.service`

```ini
[Unit]
Description=Kiosk Browser - Dashboard Display
After=default.target display-boot-check.service
Wants=display-boot-check.service

[Service]
Type=simple
ExecStartPre=/bin/sleep 5
ExecStartPre=/bin/sh -c 'for i in $(seq 1 30); do curl -sf http://localhost:8888 > /dev/null && exit 0; sleep 2; done; exit 1'
Environment=WAYLAND_DISPLAY=wayland-0
# Launch browser (labwc window rule handles fullscreen)
ExecStart=/usr/bin/epiphany --new-window http://localhost:8888
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

**Key Features:**
- Starts 5 seconds after display-boot-check
- Waits up to 60 seconds for nginx dashboard to respond
- Uses `--application-mode` for minimal browser chrome
- Auto-restarts if browser crashes (10s delay)

---

### 2. Window Rule: Auto-Fullscreen

**Location (repo):** `configs/labwc/rc.xml`
**Location (Pi):** `~/.config/labwc/rc.xml`

```xml
<windowRules>
  <windowRule identifier="org.gnome.Epiphany*">
    <action name="ToggleFullscreen"/>
  </windowRule>
</windowRules>
```

This makes labwc automatically fullscreen any Epiphany window when it opens.

---

### 3. Browser Choice: Epiphany

| Factor | Value |
|--------|-------|
| Browser | Epiphany (GNOME Web) |
| Engine | WebKit (same as Safari) |
| Size | ~2.5 MB (vs 440 MB Chromium) |
| Mode | `--new-window` (fullscreen via window rule) |
| Why | Lightweight, already default browser |

**Alternative (if issues):** Firefox with `--kiosk` flag

---

## Integration with Display Modes

The kiosk browser works seamlessly with the existing display scheduler:

| Time | Display State | Browser |
|------|--------------|---------|
| 06:00-22:00 | ON, 50% brightness | Visible fullscreen |
| 22:00-06:00 | OFF | Running (hidden) |
| Night wake | ON temporarily | Instantly visible |

**The browser always runs.** Display power state controls whether it's visible.

---

## Installation

### Deploy from Local Machine

```bash
# Copy service file
scp configs/kiosk-browser/kiosk-browser.service pi@pi:~/.config/systemd/user/

# Copy updated labwc config
scp configs/labwc/rc.xml pi@pi:~/.config/labwc/

# Enable and reload
ssh pi@pi "systemctl --user daemon-reload && \
           systemctl --user enable kiosk-browser.service && \
           killall -SIGHUP labwc"
```

### Verify Installation

```bash
# Check service is enabled
ssh pi@pi "systemctl --user is-enabled kiosk-browser.service"
# Output: enabled

# Check labwc config has window rules
ssh pi@pi "grep -A 5 windowRules ~/.config/labwc/rc.xml"
```

---

## Manual Control

```bash
# Check status
systemctl --user status kiosk-browser.service

# Stop browser (for debugging)
systemctl --user stop kiosk-browser.service

# Start browser manually
systemctl --user start kiosk-browser.service

# View logs
journalctl --user -u kiosk-browser.service -f

# Restart browser
systemctl --user restart kiosk-browser.service
```

---

## Troubleshooting

### Browser doesn't start

```bash
# 1. Check service status
systemctl --user status kiosk-browser.service

# 2. Check if dashboard is accessible
curl -I http://localhost:8888

# 3. Check if Epiphany is installed
which epiphany

# 4. Check logs
journalctl --user -u kiosk-browser.service --since "5 min ago"
```

### Browser not fullscreen

```bash
# 1. Check window rules are in config
cat ~/.config/labwc/rc.xml | grep -A 5 windowRules

# 2. Reload labwc config
killall -SIGHUP labwc

# 3. Manual fullscreen: Press F11 in browser
```

### Browser keeps crashing/restarting

```bash
# Check error logs
journalctl --user -u kiosk-browser.service --since "10 min ago" | grep -i error

# Try Firefox as alternative
# Edit service: ExecStart=/usr/bin/firefox --kiosk http://localhost:8888
```

### Dashboard not loading

```bash
# Check if nginx container is running
docker ps | grep dashboard

# Check dashboard health
curl -v http://localhost:8888

# Check Docker logs
docker logs dashboard --tail 50
```

---

## Recovery (Disaster Recovery)

If rebuilding the Pi, install kiosk browser with:

```bash
# Create directories
mkdir -p ~/.config/systemd/user ~/.config/labwc

# Copy files from this repo
scp configs/kiosk-browser/kiosk-browser.service pi@pi:~/.config/systemd/user/
scp configs/labwc/rc.xml pi@pi:~/.config/labwc/

# Enable service
systemctl --user daemon-reload
systemctl --user enable kiosk-browser.service

# Reload labwc
killall -SIGHUP labwc

# Test (reboot to verify full boot sequence)
sudo reboot
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `configs/kiosk-browser/kiosk-browser.service` | Browser auto-start service |
| `configs/kiosk-toggle/kiosk-toggle.py` | GTK4 floating toggle overlay |
| `configs/kiosk-toggle/kiosk-toggle.service` | Overlay systemd service |
| `configs/kiosk-control/kiosk-control.py` | HTTP API for kiosk control |
| `configs/labwc/rc.xml` | Window rules for auto-fullscreen |
| `docs/18-kiosk-browser.md` | This documentation |

---

## Related Documentation

- [10-display-scheduling.md](10-display-scheduling.md) - Day/night display modes
- [13-browser-setup.md](13-browser-setup.md) - Browser choice (Epiphany)
- [16-touch-monitor.md](16-touch-monitor.md) - Touch gesture configuration
- [12-pi-maintenance.md](12-pi-maintenance.md) - Daily reboot schedule
