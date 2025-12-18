# Display Scheduling

> **Created:** December 2025
> **Purpose:** Automatic display power management for Pi dashboard

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DISPLAY SCHEDULE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   DAY MODE (06:00 - 22:00)          NIGHT MODE (22:00 - 06:00)          │
│   ════════════════════════          ══════════════════════════          │
│                                                                         │
│   Display: ALWAYS ON                Display: OFF by default             │
│   Idle timeout: NONE                Idle timeout: 5 min after wake      │
│                                                                         │
│        ┌──────────┐                      ┌──────────┐                   │
│        │  06:00   │──▶ Turn ON           │  22:00   │──▶ Turn OFF       │
│        │  timer   │   Stop idle          │  timer   │   Start idle      │
│        └──────────┘                      └──────────┘                   │
│                                                                         │
│   Touch/Key during night:                                               │
│     Wake display → 5-min countdown → OFF again                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Problem

The Pi 5 dashboard display should:

1. **Turn OFF at night (22:00)** - save energy, reduce light pollution
2. **Turn ON in the morning (06:00)** - ready for daytime use
3. **Allow temporary wake during night** - touch/key/mouse wakes it, but returns to OFF after 5 minutes of inactivity

---

## Solution

systemd user timers control display power via `wlopm` (Wayland output power management), with `swayidle` providing conditional idle timeout during night hours only.

### Components

| Component | Purpose |
|-----------|---------|
| `display-scheduler.sh` | Main control script (on/off/status) |
| `display-on.timer` | Fires at 06:00 daily |
| `display-off.timer` | Fires at 22:00 daily |
| `swayidle-night.service` | 5-min idle timeout (night mode only) |
| `input-wake-monitor.service` | Monitors touch/input to wake display |
| `input-wake-monitor.sh` | Uses libinput to detect touch events |

### Display Output

- **Output:** `HDMI-A-1`
- **Resolution:** 1920x1080 @ 120Hz
- **Compositor:** labwc (Wayland)

---

## Files

### Source (this repo)

```
configs/display-scheduler/
├── display-scheduler.sh        # Main control script
├── input-wake-monitor.sh       # Touch/input detection script
├── display-on.service          # Day mode activation
├── display-on.timer            # Fires at 06:00
├── display-off.service         # Night mode activation
├── display-off.timer           # Fires at 22:00
├── swayidle-night.service      # 5-min idle daemon
└── input-wake-monitor.service  # Touch wake daemon
```

### Pi Destination

```
~/.local/bin/
├── display-scheduler.sh
└── input-wake-monitor.sh

~/.config/systemd/user/
├── display-on.service
├── display-on.timer
├── display-off.service
├── display-off.timer
├── swayidle-night.service
└── input-wake-monitor.service
```

---

## Installation

Already installed. If reinstalling:

```bash
# From this repo - copy scripts
scp configs/display-scheduler/display-scheduler.sh pi@pi:~/.local/bin/
scp configs/display-scheduler/input-wake-monitor.sh pi@pi:~/.local/bin/
scp configs/display-scheduler/*.service configs/display-scheduler/*.timer \
    pi@pi:~/.config/systemd/user/

# On Pi
ssh pi@pi
chmod +x ~/.local/bin/display-scheduler.sh ~/.local/bin/input-wake-monitor.sh
loginctl enable-linger pi
systemctl --user daemon-reload
systemctl --user enable display-on.timer display-off.timer
systemctl --user start display-on.timer display-off.timer
```

---

## Usage

### Check Status

```bash
ssh pi@pi "~/.local/bin/display-scheduler.sh status"

# Or check timers directly
ssh pi@pi "systemctl --user list-timers 'display-*'"
```

### Manual Control

```bash
# Force day mode (display on, no idle timeout)
ssh pi@pi "systemctl --user start display-on.service"

# Force night mode (display off, 5-min idle enabled)
ssh pi@pi "systemctl --user start display-off.service"

# Direct display control (bypass scheduler)
ssh pi@pi "wlopm --on HDMI-A-1"   # Turn on
ssh pi@pi "wlopm --off HDMI-A-1"  # Turn off
```

### View Logs

```bash
# Display scheduler logs
ssh pi@pi "journalctl -t display-scheduler --no-pager -n 20"

# Service logs
ssh pi@pi "journalctl --user -u display-off.service -n 10"
```

---

## How It Works

### Day → Night Transition (22:00)

```
display-off.timer fires
        │
        ▼
display-off.service runs
        │
        ├──▶ wlopm --off HDMI-A-1
        │
        ├──▶ systemctl --user start swayidle-night.service
        │
        └──▶ systemctl --user start input-wake-monitor.service
                    │
      ┌─────────────┴─────────────┐
      │                           │
 swayidle                   input-wake-monitor
 (idle timeout)             (touch detection)
      │                           │
      ▼                           ▼
 After 5 min idle:          On touch/input:
 wlopm --off                wlopm --on
 (back to sleep)            (wake display)
```

### Night → Day Transition (06:00)

```
display-on.timer fires
        │
        ▼
display-on.service runs
        │
        ├──▶ wlopm --on HDMI-A-1
        │
        ├──▶ systemctl --user stop swayidle-night.service
        │
        └──▶ systemctl --user stop input-wake-monitor.service
                    │
                    ▼
            Display stays ON all day
            (no idle timeout, no input monitoring)
```

---

## Troubleshooting

### Display doesn't turn off at 22:00

```bash
# Check timer is enabled
systemctl --user is-enabled display-off.timer

# Check for errors
journalctl --user -u display-off.service --since "1 hour ago"

# Verify wlopm works
wlopm  # Should list HDMI-A-1
```

### Idle timeout not working

```bash
# Check swayidle is running
systemctl --user status swayidle-night.service

# Test swayidle manually (10-sec timeout)
swayidle -w timeout 10 'echo IDLE' resume 'echo RESUME'
```

### Touch wake not working

```bash
# Check input-wake-monitor is running
systemctl --user status input-wake-monitor.service

# View input wake logs
journalctl -t input-wake-monitor --no-pager -n 20

# Test if touch events are detected
evtest /dev/input/event5  # Touch the screen, should show events
```

### Services fail with "Can not connect to wayland display"

The systemd user services inherit `WAYLAND_DISPLAY=wayland-0` from the user session. If this fails:

```bash
# Check user session environment
systemctl --user show-environment | grep WAYLAND
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **User-level systemd** | Wayland tools need `$WAYLAND_DISPLAY` - only available in user session |
| **Separate swayidle service** | Only runs during night mode - cleaner than 24/7 with time checks |
| **`Persistent=true` timers** | Catches up if Pi was off during scheduled time |
| **Script wraps wlopm** | Centralizes logic, easier to debug and extend |
| **input-wake-monitor** | swayidle resume doesn't work with wlopm-blanked display; libinput monitors touch directly |

---

## Related

- [WiFi Watchdog](../backups/configs/wifi-watchdog/README.md) - Similar systemd timer pattern
- [Router Reboot](../scripts/router-reboot.sh) - Cron-based scheduling example
