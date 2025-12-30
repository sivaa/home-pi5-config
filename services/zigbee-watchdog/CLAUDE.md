# Zigbee2MQTT Watchdog

## Purpose

Monitors zigbee2mqtt container and automatically restarts it when:
1. Container is not running
2. USB Zigbee dongle is available

This handles the Docker restart race condition where the container fails to restart
because the USB device is temporarily unavailable during re-enumeration (~300ms window).

## Why This Exists

Docker's `restart: unless-stopped` policy fails when USB devices temporarily disconnect:

```
19:42:05.952 - USB disconnect
19:42:06.251 - Docker restart FAILED (device not ready yet)
19:42:06.401 - USB reconnected (too late, Docker gave up)
```

This watchdog runs every 60 seconds to catch these cases.

## How It Works

```
Every 60 seconds (via systemd timer):
  1. Is zigbee2mqtt container running?
     YES -> exit (nothing to do)
     NO  -> continue

  2. Is USB Zigbee dongle available?
     NO  -> log warning, exit (wait for USB)
     YES -> restart container, send notification
```

## Files

| File | Location on Pi | Purpose |
|------|----------------|---------|
| `zigbee-watchdog.sh` | `/opt/zigbee-watchdog/` | Main script |
| `zigbee-watchdog.service` | `/etc/systemd/system/` | Systemd service |
| `zigbee-watchdog.timer` | `/etc/systemd/system/` | Systemd timer (every 60s) |
| `99-zigbee-usb.rules` | `/etc/udev/rules.d/` | Disable USB autosuspend |
| `.env` | `/opt/zigbee-watchdog/` | HA token (not in repo) |

## Configuration

Environment variables (set in `/opt/zigbee-watchdog/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `ZIGBEE_WATCHDOG_HA_TOKEN` | No | HA long-lived access token for notifications |

If no token is provided, the watchdog still works but won't send mobile notifications.

## Installation

```bash
# Copy files
scp services/zigbee-watchdog/zigbee-watchdog.sh pi@pi:/opt/zigbee-watchdog/
scp configs/zigbee-watchdog/*.service configs/zigbee-watchdog/*.timer pi@pi:/etc/systemd/system/
scp configs/zigbee-watchdog/99-zigbee-usb.rules pi@pi:/tmp/

# On Pi
sudo chmod +x /opt/zigbee-watchdog/zigbee-watchdog.sh
sudo systemctl daemon-reload
sudo systemctl enable zigbee-watchdog.timer
sudo systemctl start zigbee-watchdog.timer

# Install udev rule for USB autosuspend
sudo cp /tmp/99-zigbee-usb.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
```

## Logs

```bash
# View watchdog logs
journalctl -t zigbee-watchdog -f

# Check timer status
systemctl status zigbee-watchdog.timer

# Check last runs
systemctl list-timers zigbee-watchdog.timer
```

## Testing

```bash
# Manually stop zigbee2mqtt
docker stop zigbee2mqtt

# Wait up to 60 seconds, then check
docker ps | grep zigbee2mqtt

# Or manually trigger the watchdog
sudo systemctl start zigbee-watchdog.service
```

## Troubleshooting

### "USB device not available, waiting..."
- USB dongle is disconnected or not detected
- Check: `ls /dev/serial/by-id/usb-Itead*`
- May need physical intervention (replug USB)

### No notifications received
- Check HA token is set: `cat /opt/zigbee-watchdog/.env`
- Verify token is valid in Home Assistant
- Check HA is running: `docker ps | grep homeassistant`

### Timer not running
- Check timer status: `systemctl status zigbee-watchdog.timer`
- Enable if needed: `sudo systemctl enable --now zigbee-watchdog.timer`

## USB Autosuspend

Linux's USB autosuspend feature can cause stability issues with the Zigbee dongle.
The `99-zigbee-usb.rules` udev rule disables autosuspend for the Sonoff dongle.

### What It Does

```
Default:  autosuspend = 2   (sleep after 2 seconds of inactivity)
With rule: autosuspend = -1  (never sleep)
```

### Why Disable It

- Zigbee dongle needs to be always responsive (sensors report any time)
- Power savings are negligible (~0.1W, ~$0.01/year)
- Autosuspend can cause brief communication glitches and disconnection events

### Installation

```bash
# Copy rule
sudo cp configs/zigbee-watchdog/99-zigbee-usb.rules /etc/udev/rules.d/

# Reload rules
sudo udevadm control --reload-rules && sudo udevadm trigger

# For immediate effect (without replug/reboot):
echo -1 | sudo tee /sys/bus/usb/devices/1-1/power/autosuspend
```

### Verify

```bash
# Should show -1 (never suspend)
cat /sys/bus/usb/devices/1-1/power/autosuspend
```
