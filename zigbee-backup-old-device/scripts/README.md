# Zigbee Scripts

Automation scripts for maintaining Zigbee device health.

## binding-watchdog.py

Auto-detects and fixes stale Zigbee light bindings.

### Problem Solved

IKEA FLOALT lights can develop "stale bindings" where:
- The physical remote controls the light correctly
- But the light stops reporting state changes to Zigbee2MQTT
- Dashboard and Home Assistant show stale/wrong values

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  WATCHDOG FLOW                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Remote sends brightness action to MQTT                      │
│     {"action": "brightness_up_hold"}                            │
│                                                                 │
│  2. Watchdog starts 15-second timer                             │
│                                                                 │
│  3. If light reports brightness → HEALTHY (cancel timer)        │
│                                                                 │
│  4. If 15 seconds pass with no report → STALE DETECTED          │
│                                                                 │
│  5. Auto-fix: Unbind + Rebind genLevelCtrl to Coordinator       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Installation on DietPi

```bash
# 1. Install dependency
pip3 install paho-mqtt

# 2. Copy script to server
scp binding-watchdog.py root@dietpi.local:/root/zigbee/scripts/

# 3. Copy service file
sudo cp binding-watchdog.service /etc/systemd/system/

# 4. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable binding-watchdog
sudo systemctl start binding-watchdog
```

### Monitoring

```bash
# Check status
sudo systemctl status binding-watchdog

# View logs
journalctl -u binding-watchdog -f

# View recent fixes
journalctl -u binding-watchdog | grep "AUTO-FIX"
```

### Configuration

Edit the script to modify:

| Setting | Default | Description |
|---------|---------|-------------|
| `REPORT_TIMEOUT` | 15s | Time to wait for light report |
| `REBIND_COOLDOWN` | 60s | Minimum time between rebinds |
| `MONITORED_PAIRS` | 2 lights | Light/remote pairs to watch |

### Adding More Lights

Edit `MONITORED_PAIRS` in the script:

```python
MONITORED_PAIRS = [
    {
        "light": "Living Room Light",
        "remote": "Living Room Light Remote",
        "cluster": "genLevelCtrl"
    },
    # Add more pairs here
]
```
