# Zigbee2MQTT Watchdog

## Overview

The Zigbee2MQTT Watchdog is a systemd timer service that monitors the zigbee2mqtt container and automatically restarts it when it crashes. It handles the Docker restart race condition that occurs when the USB Zigbee dongle temporarily disconnects.

```
┌─────────────────────────────────────────────────────────────────┐
│  THE PROBLEM: Docker Restart Race Condition                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  19:42:05.952 - USB dongle disconnects                          │
│  19:42:05.962 - zigbee2mqtt crashes                             │
│  19:42:06.251 - Docker tries restart → FAILS (device not ready) │
│  19:42:06.401 - USB dongle reconnects (too late!)               │
│              → Container stays dead, Docker gave up             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  THE SOLUTION: Systemd Timer Watchdog                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Every 60 seconds:                                              │
│    1. Is zigbee2mqtt running? YES → exit (all good)             │
│    2. Is USB dongle available? NO → wait, try again later       │
│    3. Restart container + send notification                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why It Exists

Docker's `restart: unless-stopped` policy fails when USB devices temporarily disconnect:

- USB disconnects trigger immediate container crash
- Docker attempts restart within milliseconds
- USB takes ~300-500ms to re-enumerate
- Docker's restart fails because device isn't ready
- Docker gives up after single failed attempt

The watchdog provides a retry mechanism with proper timing.

## Components

### 1. Watchdog Script

Checks container status and restarts if needed.

**Location:** `/opt/zigbee-watchdog/zigbee-watchdog.sh`

### 2. Systemd Timer

Triggers watchdog every 60 seconds.

**Location:** `/etc/systemd/system/zigbee-watchdog.timer`

### 3. USB Autosuspend Rule

Prevents kernel from putting USB dongle to sleep.

**Location:** `/etc/udev/rules.d/99-zigbee-usb.rules`

## Files

| File | Location on Pi | Purpose |
|------|----------------|---------|
| `zigbee-watchdog.sh` | `/opt/zigbee-watchdog/` | Main watchdog script |
| `zigbee-watchdog.service` | `/etc/systemd/system/` | Systemd oneshot service |
| `zigbee-watchdog.timer` | `/etc/systemd/system/` | Systemd timer (60s) |
| `99-zigbee-usb.rules` | `/etc/udev/rules.d/` | USB autosuspend disable |
| `.env` | `/opt/zigbee-watchdog/` | HA token for notifications |

**Source files in repo:**
- `services/zigbee-watchdog/zigbee-watchdog.sh`
- `services/zigbee-watchdog/CLAUDE.md`
- `configs/zigbee-watchdog/zigbee-watchdog.service`
- `configs/zigbee-watchdog/zigbee-watchdog.timer`
- `configs/zigbee-watchdog/99-zigbee-usb.rules`

## Installation

### Step 1: Create Directory on Pi

```bash
ssh pi@pi "sudo mkdir -p /opt/zigbee-watchdog && sudo chown pi:pi /opt/zigbee-watchdog"
```

### Step 2: Copy Files

```bash
# Copy watchdog script
scp services/zigbee-watchdog/zigbee-watchdog.sh pi@pi:/opt/zigbee-watchdog/

# Copy systemd files
scp configs/zigbee-watchdog/zigbee-watchdog.service pi@pi:/tmp/
scp configs/zigbee-watchdog/zigbee-watchdog.timer pi@pi:/tmp/
ssh pi@pi "sudo mv /tmp/zigbee-watchdog.* /etc/systemd/system/"

# Copy udev rule
scp configs/zigbee-watchdog/99-zigbee-usb.rules pi@pi:/tmp/
ssh pi@pi "sudo cp /tmp/99-zigbee-usb.rules /etc/udev/rules.d/"
```

### Step 3: Configure HA Token (Optional, for notifications)

```bash
# Use same token as heater-watchdog
ssh pi@pi "echo 'ZIGBEE_WATCHDOG_HA_TOKEN=your_ha_token_here' | sudo tee /opt/zigbee-watchdog/.env"
ssh pi@pi "sudo chmod 600 /opt/zigbee-watchdog/.env"
```

### Step 4: Enable and Start

```bash
ssh pi@pi "sudo chmod +x /opt/zigbee-watchdog/zigbee-watchdog.sh"
ssh pi@pi "sudo systemctl daemon-reload"
ssh pi@pi "sudo systemctl enable zigbee-watchdog.timer"
ssh pi@pi "sudo systemctl start zigbee-watchdog.timer"
ssh pi@pi "sudo udevadm control --reload-rules && sudo udevadm trigger"
```

### Step 5: Verify

```bash
# Check timer is active
ssh pi@pi "systemctl status zigbee-watchdog.timer"

# Check USB autosuspend is disabled (-1 = never suspend)
ssh pi@pi "cat /sys/bus/usb/devices/1-1/power/autosuspend"
```

## Configuration

### Environment Variables

Set in `/opt/zigbee-watchdog/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ZIGBEE_WATCHDOG_HA_TOKEN` | No | HA long-lived access token for mobile notifications |

If no token is provided, the watchdog still restarts containers but won't send notifications.

### USB Autosuspend

The udev rule disables USB power management for the Zigbee dongle:

```
Default:  autosuspend = 2   (sleep after 2 seconds of inactivity)
With rule: autosuspend = -1  (never sleep)
```

**Why disable it:**
- Zigbee dongle needs to be always responsive
- Power savings are negligible (~$0.01/year)
- Autosuspend can cause communication glitches

## Logs

```bash
# View watchdog logs
ssh pi@pi "journalctl -t zigbee-watchdog -f"

# Check recent activity
ssh pi@pi "journalctl -t zigbee-watchdog --since '1 hour ago'"

# Check timer status
ssh pi@pi "systemctl status zigbee-watchdog.timer"

# List timer schedule
ssh pi@pi "systemctl list-timers zigbee-watchdog.timer"
```

### Log Output Example

```
Dec 30 20:14:18 pi zigbee-watchdog[87426]: USB device available, restarting zigbee2mqtt
Dec 30 20:14:19 pi zigbee-watchdog[87427]: zigbee2mqtt
Dec 30 20:14:19 pi zigbee-watchdog[87528]: Successfully restarted zigbee2mqtt
```

## Testing

### Test Watchdog Recovery

```bash
# Stop zigbee2mqtt manually
ssh pi@pi "docker stop zigbee2mqtt"

# Wait up to 60 seconds
sleep 70

# Verify it restarted
ssh pi@pi "docker ps | grep zigbee2mqtt"
# Should show: zigbee2mqtt: Up X seconds
```

### Manual Trigger

```bash
# Run watchdog immediately (without waiting for timer)
ssh pi@pi "sudo systemctl start zigbee-watchdog.service"

# Check result
ssh pi@pi "journalctl -t zigbee-watchdog --since '1 minute ago'"
```

### Verify USB Autosuspend

```bash
# Should show -1 (never suspend)
ssh pi@pi "cat /sys/bus/usb/devices/1-1/power/autosuspend"

# If still showing 2, manually set it:
ssh pi@pi "echo -1 | sudo tee /sys/bus/usb/devices/1-1/power/autosuspend"
```

## Troubleshooting

### "USB device not available, waiting..."

- USB dongle is physically disconnected
- Check: `ssh pi@pi "ls /dev/serial/by-id/usb-Itead*"`
- May need to replug the USB dongle

### Timer Not Running

```bash
# Check status
ssh pi@pi "systemctl status zigbee-watchdog.timer"

# Enable if disabled
ssh pi@pi "sudo systemctl enable --now zigbee-watchdog.timer"
```

### No Notifications Received

1. Check token is set: `ssh pi@pi "cat /opt/zigbee-watchdog/.env"`
2. Verify token is valid in Home Assistant
3. Check HA is running: `ssh pi@pi "docker ps | grep homeassistant"`

### Container Still Not Restarting

```bash
# Check watchdog logs for errors
ssh pi@pi "journalctl -t zigbee-watchdog --since '10 minutes ago'"

# Verify script is executable
ssh pi@pi "ls -la /opt/zigbee-watchdog/zigbee-watchdog.sh"

# Test script manually
ssh pi@pi "sudo /opt/zigbee-watchdog/zigbee-watchdog.sh"
```

## Recovery After Pi Rebuild

1. Follow Installation steps above
2. Create new HA token if needed
3. Verify timer is running: `systemctl status zigbee-watchdog.timer`

## USB Disconnect History

To check historical USB disconnects (useful for diagnosing hardware issues):

```bash
# Count disconnects in last 7 days
ssh pi@pi "journalctl --since '7 days ago' | grep -c 'usb 1-1: USB disconnect'"

# View disconnect timestamps
ssh pi@pi "journalctl --since '7 days ago' | grep 'usb 1-1: USB disconnect'"
```

**Note:** Most disconnects are from the daily 4:30 AM reboot (`daily-reboot.timer`) and are expected. Random disconnects during normal operation may indicate:
- Loose USB connection
- Power supply issues
- Faulty USB cable or hub
