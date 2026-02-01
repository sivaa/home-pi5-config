# Kiosk Browser: Auto-Launch Dashboard on Boot

> **Date:** December 28, 2025
> **Updated:** February 1, 2026 (Fixed session accumulation: private instance + ephemeral profile)
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
      |-> Wipes /tmp/kiosk-profile (ephemeral browser data)
      |-> Waits for dashboard (nginx) to be ready
      |-> Launches Epiphany in private instance mode
      |
17s   labwc window rule triggers fullscreen
      |
18s   kiosk-toggle.service starts (8s delay after display-boot-check)
      |-> Floating toggle button appears
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

### Service Configuration

```ini
[Unit]
Description=Kiosk Toggle Overlay - Floating button to toggle kiosk mode
After=default.target display-boot-check.service
Wants=display-boot-check.service

[Service]
Type=simple
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=LD_PRELOAD=/usr/lib/aarch64-linux-gnu/libgtk4-layer-shell.so.0
Environment=GTK_A11Y=none
ExecStartPre=/bin/sleep 8
ExecStart=/usr/bin/python3 /opt/kiosk-toggle/kiosk-toggle.py
Restart=always
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=5

[Install]
WantedBy=default.target
```

**Key Features:**
- Waits for `display-boot-check.service` (same as kiosk-browser)
- 8-second delay ensures Wayland compositor is fully ready
- `Restart=always` handles GTK exiting cleanly on failure
- Restart limits: max 5 restarts per 5 minutes (prevents infinite loops)
- `LD_PRELOAD` fixes GTK4 layer-shell library linking order

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
StartLimitBurst=5
StartLimitIntervalSec=300

[Service]
Type=simple
ExecStartPre=/bin/sleep 5
ExecStartPre=/bin/sh -c 'for i in $(seq 1 30); do curl -sf http://localhost:8888 > /dev/null && exit 0; sleep 2; done; echo "ERROR: Dashboard not responding" >&2; exit 1'
Environment=WAYLAND_DISPLAY=wayland-0
ExecStartPre=-/bin/sh -c 'WAYLAND_DISPLAY=wayland-0 /usr/bin/wlr-randr --output HDMI-A-1 --mode 1920x1080@60 --transform 180'
ExecStartPre=/bin/sh -c 'rm -rf /tmp/kiosk-profile && mkdir -p /tmp/kiosk-profile'
ExecStart=/usr/bin/epiphany --private-instance --profile=/tmp/kiosk-profile http://localhost:8888
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

**Key Features:**
- Starts 5 seconds after display-boot-check
- Waits up to 60 seconds for nginx dashboard to respond
- Display config logged on failure (systemd `-` prefix), doesn't block startup
- Uses `--private-instance` with ephemeral `/tmp/kiosk-profile` (wiped each boot/restart)
- Auto-restarts on crash (10s delay), max 5 per 5 minutes (prevents infinite loops)

> **Why private instance?** See [Session Accumulation Incident](#session-accumulation-incident-feb-2026) below.

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
| Mode | `--private-instance --profile=/tmp/kiosk-profile` |
| Fullscreen | labwc window rule auto-fullscreens on launch |
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

### Kiosk toggle button not visible

```bash
# 1. Check service status
systemctl --user status kiosk-toggle.service

# 2. Check for GTK initialization errors
journalctl --user -u kiosk-toggle --since "5 min ago" | grep -i "gtk\|display"

# 3. Verify Wayland display is available
echo $WAYLAND_DISPLAY
ls -la /run/user/1000/wayland-0

# 4. Restart the service
systemctl --user restart kiosk-toggle.service

# 5. If still failing, check if display-boot-check ran
systemctl --user status display-boot-check.service
```

**Common cause:** Service starts before Wayland compositor is ready. The 8-second delay should handle this, but if issues persist, increase the delay in the service file.

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

## Session Accumulation Incident (Feb 2026)

### What Happened

The Pi was running hot (54-59°C) with periodic CPU spikes every ~90 seconds. Investigation revealed **84 WebKit processes** consuming 27% CPU and 50% RAM (4GB).

### Root Cause

Epiphany's session restore combined with `--new-window` created **1 extra window per daily reboot**:

```
┌──────────────────────────────────────────────────────┐
│  Day 1:  Reboot → 1 window                          │
│  Day 2:  Reboot → restore 1 + new 1 = 2 windows     │
│  Day 3:  Reboot → restore 2 + new 1 = 3 windows     │
│  ...                                                 │
│  Day 28: Reboot → restore 27 + new 1 = 28 windows   │
│          28 windows × ~3 processes each = 84 procs   │
│          27% CPU, 50% RAM, 59°C                      │
└──────────────────────────────────────────────────────┘
```

Each window spawned ~3 processes (WebKit renderer + 2 bwrap sandbox wrappers). The `daily-reboot.timer` (4:30 AM) triggered the accumulation every day.

### Fix: Private Instance with Ephemeral Profile

```
Old (fragile):      epiphany --new-window → persistent profile dir
                    ↑ session_state.xml survives reboot, accumulates

New (structural):   epiphany --private-instance --profile=/tmp/kiosk-profile
                    ↑ /tmp wiped on reboot (tmpfs on Debian Trixie)
                    ↑ rm -rf + mkdir -p on every start (catches crash loops)
                    ↑ isolated data, no cross-pollution with main profile
                    ↑ accumulation is structurally impossible
```

### Prevention

Three independent barriers prevent recurrence:
1. **`/tmp` is tmpfs** — kernel wipes it on every reboot
2. **`rm -rf && mkdir -p`** — ExecStartPre wipes profile on every start (including crash restarts)
3. **`--private-instance`** — isolated profile, no shared state with default Epiphany data

### Results

| Metric | Before (Day 28) | After |
|--------|-----------------|-------|
| WebKit processes | 84 | 3 |
| CPU (browser) | 27% | ~3% |
| RAM (browser) | 50% (4GB) | 2.1% (~170MB) |
| Temperature | 54-59°C | 49-51°C |
| Load average | 2.14 | 0.24-0.52 |

---

## Related Documentation

- [10-display-scheduling.md](10-display-scheduling.md) - Day/night display modes
- [13-browser-setup.md](13-browser-setup.md) - Browser choice (Epiphany)
- [16-touch-monitor.md](16-touch-monitor.md) - Touch gesture configuration
- [12-pi-maintenance.md](12-pi-maintenance.md) - Daily reboot schedule
