# Adaptive Brightness Control

Energy-saving monitor brightness system using DDC/CI.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                  Adaptive Brightness Timeline                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Touch ──► 80% ──► 70% ──► 60% ──► 50% ──► 40% ──► 30% ──► 25% │
│            0min    1min    2min    3min    4min    5min    6min │
│                                                                 │
│   Any touch during dimming → Reset to 80%                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- On touch/input: Brightness sets to **80%**
- Every minute of idle: Brightness decreases by **10%**
- Minimum brightness: **25%** (energy saving mode)
- Any touch resets back to 80%

---

## Components

| Component | Purpose |
|-----------|---------|
| `ddcutil` | DDC/CI control (sends brightness commands via HDMI) |
| `brightness-dimmer.sh` | Main dimmer loop (runs every 60s) |
| `input-wake-monitor.sh` | Detects touch/input and triggers wake |
| `brightness-dimmer.service` | Systemd service for dimmer |
| `input-wake-monitor.service` | Systemd service for input monitor |

---

## Installation

### 1. Install ddcutil
```bash
sudo apt install ddcutil -y
```

### 2. Test DDC/CI Support
```bash
# Detect displays
sudo ddcutil detect

# Check current brightness
sudo ddcutil getvcp 10

# Test setting brightness
sudo ddcutil setvcp 10 50
```

### 3. Deploy Scripts
```bash
# Copy scripts
scp configs/display-scheduler/brightness-dimmer.sh pi@pi:~/.local/bin/
scp configs/display-scheduler/input-wake-monitor.sh pi@pi:~/.local/bin/

# Make executable
ssh pi@pi "chmod +x ~/.local/bin/brightness-dimmer.sh ~/.local/bin/input-wake-monitor.sh"
```

### 4. Deploy Services
```bash
scp configs/display-scheduler/brightness-dimmer.service pi@pi:~/.config/systemd/user/
```

### 5. Enable Services
```bash
ssh pi@pi "systemctl --user daemon-reload"
ssh pi@pi "systemctl --user enable brightness-dimmer.service input-wake-monitor.service"
ssh pi@pi "systemctl --user start brightness-dimmer.service input-wake-monitor.service"
```

---

## Manual Commands

### Check Status
```bash
~/.local/bin/brightness-dimmer.sh status
```

Output:
```
=== Brightness Dimmer Status ===
Current brightness: 70%
Target brightness:  70%
Idle time:          103s
Activity file:      /tmp/display-activity
Last activity:      2025-12-19 10:10:24
```

### Trigger Wake (Set to 80%)
```bash
~/.local/bin/brightness-dimmer.sh wake
```

### Set Specific Brightness
```bash
sudo ddcutil setvcp 10 50  # Set to 50%
```

---

## Service Management

```bash
# Check service status
systemctl --user status brightness-dimmer.service

# Restart services
systemctl --user restart brightness-dimmer.service input-wake-monitor.service

# View logs
journalctl --user -u brightness-dimmer.service -f
```

---

## Configuration

Settings in `brightness-dimmer.sh`:

```bash
WAKE_BRIGHTNESS=80      # Brightness on touch/wake
MIN_BRIGHTNESS=25       # Minimum brightness (idle state)
DIM_STEP=10             # Decrease per interval
DIM_INTERVAL=60         # Seconds between dim steps
```

---

## Energy Savings Estimate

```
┌─────────────────────────────────────────────────────────────┐
│         Typical 24" Monitor Power Consumption               │
├─────────────────────────────────────────────────────────────┤
│  Brightness 100%  →  ~25-35W                                │
│  Brightness 80%   →  ~20-28W  (wake state)                  │
│  Brightness 50%   →  ~15-22W                                │
│  Brightness 25%   →  ~8-12W   (idle state, ~65% savings)    │
└─────────────────────────────────────────────────────────────┘
```

If the display is idle most of the time at 25%, you save **~65%** of monitor power consumption compared to 100% brightness.

---

## Troubleshooting

### DDC/CI Not Working
```bash
# Check if i2c-dev is loaded
lsmod | grep i2c

# Load i2c-dev if needed
sudo modprobe i2c-dev

# Check for displays
sudo ddcutil detect
```

### Monitor Not Responding
Some monitors don't support DDC/CI. Check monitor OSD settings for "DDC/CI" option.

### Service Not Starting
```bash
# Check logs
journalctl --user -u brightness-dimmer.service --no-pager

# Ensure Wayland is running
echo $WAYLAND_DISPLAY  # Should show "wayland-0"
```

---

## Files

| Location | File |
|----------|------|
| Source (repo) | `configs/display-scheduler/brightness-dimmer.sh` |
| Source (repo) | `configs/display-scheduler/brightness-dimmer.service` |
| Pi script | `~/.local/bin/brightness-dimmer.sh` |
| Pi service | `~/.config/systemd/user/brightness-dimmer.service` |
| Activity tracker | `/tmp/display-activity` |
