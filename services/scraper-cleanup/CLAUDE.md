# Scraper Cleanup Service

## Purpose

Automatically stops the `data-scraper` container after 30 minutes of inactivity to reduce CPU usage and fan noise on the Raspberry Pi.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CLEANUP FLOW                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Every 5 minutes (systemd timer):                               │
│                                                                 │
│  1. Check if data-scraper container is running                  │
│     └── If not running: exit (nothing to do)                    │
│                                                                 │
│  2. Read /tmp/scraper-last-activity timestamp                   │
│     └── If file missing: exit (no activity to track)            │
│                                                                 │
│  3. Calculate idle time (now - last_activity)                   │
│                                                                 │
│  4. If idle > 30 minutes:                                       │
│     ├── docker stop data-scraper                                │
│     └── Remove activity file                                    │
│                                                                 │
│  Result: Container stopped, CPU freed, fan quiet                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Files

| File | Location on Pi | Purpose |
|------|----------------|---------|
| `scraper-cleanup.sh` | `/opt/scraper-cleanup/` | Main cleanup script |
| `scraper-cleanup.service` | `/etc/systemd/system/` | Systemd oneshot service |
| `scraper-cleanup.timer` | `/etc/systemd/system/` | Runs service every 5 min |

## Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `ACTIVITY_FILE` | `/tmp/scraper-last-activity` | Timestamp file from scraper |
| `INACTIVITY_THRESHOLD` | 1800 (30 min) | Seconds before stopping |
| `CONTAINER_NAME` | `data-scraper` | Docker container to stop |

## Integration

### With data-scraper (scraper.py)
- Scraper writes timestamp to `ACTIVITY_FILE` on each `/api/transport` request
- Cleanup service reads this timestamp to determine idle time

### With dashboard (transport-store.js)
- When container is stopped, API requests fail
- Dashboard detects network error and triggers container restart via Home Assistant
- User sees "Starting transport service..." then data loads after ~20s

## Deployment

```bash
# Copy files to Pi
ssh pi@pi "sudo mkdir -p /opt/scraper-cleanup"
scp services/scraper-cleanup/scraper-cleanup.sh pi@pi:/opt/scraper-cleanup/
ssh pi@pi "sudo chmod +x /opt/scraper-cleanup/scraper-cleanup.sh"
scp configs/scraper-cleanup/scraper-cleanup.service pi@pi:/etc/systemd/system/
scp configs/scraper-cleanup/scraper-cleanup.timer pi@pi:/etc/systemd/system/

# Enable and start timer
ssh pi@pi "sudo systemctl daemon-reload"
ssh pi@pi "sudo systemctl enable --now scraper-cleanup.timer"
```

## Monitoring

```bash
# Check timer status
ssh pi@pi "systemctl status scraper-cleanup.timer"

# Check when timer will fire next
ssh pi@pi "systemctl list-timers scraper-cleanup.timer"

# View cleanup logs
ssh pi@pi "sudo journalctl -u scraper-cleanup -n 20"

# Check activity timestamp
ssh pi@pi "cat /tmp/scraper-last-activity; echo; date +%s"
```

## Manual Testing

```bash
# Trigger cleanup manually
ssh pi@pi "sudo systemctl start scraper-cleanup"

# Force container stop (simulates 30+ min idle)
ssh pi@pi "sudo rm /tmp/scraper-last-activity"
ssh pi@pi "sudo systemctl start scraper-cleanup"
```

## Troubleshooting

### Container not stopping
1. Check if activity file exists: `cat /tmp/scraper-last-activity`
2. Check idle time calculation in logs: `journalctl -u scraper-cleanup -n 10`
3. Verify container is running: `docker ps | grep data-scraper`

### Container stopping too early
1. Check dashboard is sending requests (console logs)
2. Verify scraper is writing activity file: `ls -la /tmp/scraper-last-activity`
3. Check for clock skew between systems

## History

- **Jan 2026**: Created to reduce CPU usage from transport scraper
  - Root cause: Browser kept warm forever due to timer reset bug
  - Solution: Launch→Scrape→Kill + cleanup after 30 min idle
