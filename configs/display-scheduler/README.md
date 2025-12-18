# Display Scheduler

> **Purpose:** Automatic display power management for energy saving and night comfort

```
       DAY (06:00-22:00)                    NIGHT (22:00-06:00)
    +-------------------+                +-------------------+
    |  Display: ON      |                |  Display: OFF     |
    |  Idle: disabled   |    <---->      |  Idle: 5 min      |
    +-------------------+                +-------------------+
            │                                    │
            ▼                                    ▼
      No timeout                          Wake on touch/key
      Always visible                      Returns to OFF after 5min
```

## Files

| File | Pi Location | Purpose |
|------|-------------|---------|
| `display-scheduler.sh` | `~/.local/bin/` | Main control script |
| `input-wake-monitor.sh` | `~/.local/bin/` | Touch/input detection script |
| `display-on.service` | `~/.config/systemd/user/` | Day mode activation |
| `display-on.timer` | `~/.config/systemd/user/` | Fires at 06:00 |
| `display-off.service` | `~/.config/systemd/user/` | Night mode activation |
| `display-off.timer` | `~/.config/systemd/user/` | Fires at 22:00 |
| `swayidle-night.service` | `~/.config/systemd/user/` | 5-min idle daemon |
| `input-wake-monitor.service` | `~/.config/systemd/user/` | Touch wake daemon |

## Installation

```bash
# SSH to Pi
ssh pi@pi

# Create directories
mkdir -p ~/.local/bin ~/.config/systemd/user

# From this repo (on local machine), copy files to Pi:
scp configs/display-scheduler/display-scheduler.sh pi@pi:~/.local/bin/
scp configs/display-scheduler/input-wake-monitor.sh pi@pi:~/.local/bin/
scp configs/display-scheduler/*.service configs/display-scheduler/*.timer \
    pi@pi:~/.config/systemd/user/

# On Pi: Make scripts executable
chmod +x ~/.local/bin/display-scheduler.sh ~/.local/bin/input-wake-monitor.sh

# On Pi: Enable user services to start at boot (without login)
loginctl enable-linger pi

# On Pi: Reload and enable timers
systemctl --user daemon-reload
systemctl --user enable display-on.timer display-off.timer
systemctl --user start display-on.timer display-off.timer

# Verify timers are scheduled
systemctl --user list-timers 'display-*'
```

## Manual Control

```bash
# Check current status
~/.local/bin/display-scheduler.sh status

# Force day mode (display on, no idle)
systemctl --user start display-on.service

# Force night mode (display off, 5-min idle enabled)
systemctl --user start display-off.service

# Direct display control (bypass scheduler)
wlopm --on HDMI-A-1
wlopm --off HDMI-A-1
```

## Monitoring

```bash
# View scheduler logs
journalctl -t display-scheduler --since "1 hour ago"

# Check timer status
systemctl --user status display-on.timer display-off.timer

# Check if night idle is active
systemctl --user status swayidle-night.service

# See next scheduled runs
systemctl --user list-timers 'display-*'
```

## Troubleshooting

See [docs/09-display-scheduling.md](../../docs/09-display-scheduling.md) for full troubleshooting guide.
