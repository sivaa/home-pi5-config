# Pi Maintenance - Daily Reboot

> **Created:** December 2025
> **Purpose:** Automatic daily Pi reboot for unattended reliability

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DAILY MAINTENANCE WINDOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   4:00 AM  ──────────────────────────────────────────────  4:31 AM      │
│      │                                                        │         │
│      ▼                                                        ▼         │
│   Router                                                    Pi back     │
│   reboots                                                   online      │
│      │                                                        ▲         │
│      │     4:02 AM           4:30 AM                         │         │
│      │        │                 │                            │         │
│      └────────┴─────────────────┴────────────────────────────┘         │
│           Router              Pi                                        │
│           online            reboots                                     │
│                                                                         │
│   Total disruption: ~1 minute (Pi reboot only)                         │
│   All Docker containers auto-restart on boot                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Why Daily Reboot?

| Reason | Explanation |
|--------|-------------|
| **Unattended operation** | Owner travels frequently, cannot manually restart |
| **Preventive maintenance** | Clear any memory leaks, zombie processes |
| **Fresh state** | Docker containers get clean restart |
| **Peace of mind** | Know the Pi resets itself daily |

---

## Configuration

### Systemd Timer (4:30 AM daily)

**Source files:**
```
configs/pi-reboot/
├── daily-reboot.timer    # When to reboot
└── daily-reboot.service  # What to run
```

**Installed at:**
```
/etc/systemd/system/daily-reboot.timer
/etc/systemd/system/daily-reboot.service
```

### Timer Details

```ini
# daily-reboot.timer
[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true          # Runs if Pi missed scheduled time
```

---

## Management Commands

### Check Timer Status

```bash
# See next scheduled reboot
sudo systemctl list-timers daily-reboot.timer

# Check if timer is enabled
sudo systemctl is-enabled daily-reboot.timer
```

### Disable Temporarily

```bash
# Stop timer (until next boot)
sudo systemctl stop daily-reboot.timer

# Disable permanently
sudo systemctl disable daily-reboot.timer
```

### Re-enable

```bash
sudo systemctl enable daily-reboot.timer
sudo systemctl start daily-reboot.timer
```

### View Logs

```bash
# See reboot history
journalctl -u daily-reboot.service --no-pager

# See boot times
journalctl --list-boots | head -10
```

---

## Coordination with Router Reboot

```
┌─────────────────────────────────────────────────────────────────┐
│  WHY 30-MINUTE GAP?                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Router at 4:00 AM                                             │
│      │                                                          │
│      ├──▶ Takes ~2 min to reboot                               │
│      ├──▶ Sometimes takes longer (up to 5 min)                 │
│      └──▶ Need network stable before Pi reboots                │
│                                                                 │
│   Pi at 4:30 AM                                                 │
│      │                                                          │
│      ├──▶ 30 min buffer = router definitely stable             │
│      ├──▶ Pi comes back to working network                     │
│      └──▶ SSH/remote access available immediately              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Pi not rebooting at 4:30 AM

```bash
# Check timer is active
sudo systemctl status daily-reboot.timer

# Check for errors
journalctl -u daily-reboot.timer -u daily-reboot.service --since "1 day ago"
```

### Need to skip tonight's reboot

```bash
# Stop timer temporarily
sudo systemctl stop daily-reboot.timer

# Re-enable tomorrow
sudo systemctl start daily-reboot.timer
```

### Check last reboot time

```bash
uptime -s
# or
who -b
```

---

## Related

- [Router Maintenance](09-router-maintenance.md) - Daily 4:00 AM router reboot
- [Display Scheduling](10-display-scheduling.md) - Display on/off timers
