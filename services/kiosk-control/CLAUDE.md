# Kiosk Control Service

> **Purpose:** HTTP API for remote control of kiosk display via keyboard simulation
> **Runtime:** Python 3 (standalone, no Docker)
> **Port:** 8889 (localhost only)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KIOSK CONTROL FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Dashboard ──► GET /api/kiosk/toggle ──► wtype -k F11 ──► labwc    │
│            ──► GET /api/kiosk/refresh ──► wtype -k F5 ──► Browser  │
│                                                                     │
│  Simulates keyboard input to control Wayland compositor/browser    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why This Exists

The kiosk runs in fullscreen mode via labwc (Wayland compositor). Standard browser JavaScript APIs cannot control compositor-level fullscreen. This service provides an HTTP endpoint that simulates keyboard presses to:

1. **Toggle fullscreen** (F11) - Enter/exit kiosk mode
2. **Refresh browser** (F5) - Reload dashboard after updates

---

## API Endpoints

### GET /api/kiosk/toggle

Sends F11 keypress to toggle fullscreen mode.

**Response:**
```json
{
  "success": true,
  "action": "toggle_fullscreen"
}
```

### GET /api/kiosk/refresh

Sends F5 keypress to refresh the browser.

**Response:**
```json
{
  "success": true,
  "action": "refresh"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{"status": "ok"}
```

---

## Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| `wtype` | Wayland keyboard input simulator | `sudo apt install wtype` |
| `labwc` | Wayland compositor (receives F11) | Pre-installed |
| Python 3 | Runtime | Pre-installed |

---

## Critical Environment Variables

The service **requires** these environment variables to communicate with labwc:

| Variable | Value | Purpose |
|----------|-------|---------|
| `WAYLAND_DISPLAY` | `wayland-0` | Connect to Wayland compositor |
| `XDG_RUNTIME_DIR` | `/run/user/1000` | Wayland socket directory |

**Without these, wtype cannot send keypresses and the service will fail silently.**

---

## Files

```
Source files:
├── services/kiosk-control/
│   ├── CLAUDE.md              <- This file
│   └── kiosk-control.py       <- Main script (109 lines)
│
├── configs/kiosk-control/
│   └── kiosk-control.service  <- Systemd service file (source of truth)

Pi deployment:
├── /opt/kiosk-control/
│   └── kiosk-control.py       <- Deployed script location
│
└── ~/.config/systemd/user/
    └── kiosk-control.service  <- Installed service
```

---

## Deployment

**Systemd user service** - not containerized.

**Source service file:** `configs/kiosk-control/kiosk-control.service`

```ini
[Unit]
Description=Kiosk Control Service - HTTP API for display control
# Start after labwc is running
After=default.target

[Service]
Type=simple

# wtype needs WAYLAND_DISPLAY and XDG_RUNTIME_DIR to communicate with labwc
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000

# Run the Python HTTP server
ExecStart=/usr/bin/python3 /opt/kiosk-control/kiosk-control.py

# Auto-restart on failure
Restart=on-failure
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

**Installation:**
```bash
# Copy script to Pi
sudo mkdir -p /opt/kiosk-control
sudo cp services/kiosk-control/kiosk-control.py /opt/kiosk-control/

# Copy service file
cp configs/kiosk-control/kiosk-control.service ~/.config/systemd/user/

# Enable and start
systemctl --user daemon-reload
systemctl --user enable kiosk-control
systemctl --user start kiosk-control
```

**Commands:**
```bash
# Check status
systemctl --user status kiosk-control

# View logs
journalctl --user -u kiosk-control -f

# Restart
systemctl --user restart kiosk-control
```

---

## Security

- **Localhost only:** Binds to `127.0.0.1:8889` (not accessible from network)
- **No authentication:** Only local processes can access
- **CORS enabled:** Allows dashboard JavaScript to call endpoints

---

## Integration

### Dashboard Usage

```javascript
// Toggle fullscreen from dashboard
fetch('http://localhost:8889/api/kiosk/toggle')
  .then(r => r.json())
  .then(data => console.log('Toggled:', data.success));

// Refresh after deploy
fetch('http://localhost:8889/api/kiosk/refresh')
  .then(r => r.json())
  .then(data => console.log('Refreshed:', data.success));
```

### Related Services

| Service | Relationship |
|---------|--------------|
| `kiosk-browser.service` | Browser that receives the key presses |
| `kiosk-toggle.service` | GTK4 floating button that calls this API |
| `labwc` | Compositor that handles F11 fullscreen |

---

## Troubleshooting

### wtype not found

```bash
sudo apt install wtype
```

### Key press not working

1. Check environment variables are set in service:
   ```bash
   systemctl --user show kiosk-control | grep Environment
   # Should show WAYLAND_DISPLAY and XDG_RUNTIME_DIR
   ```

2. Test wtype manually:
   ```bash
   WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 wtype -k F5
   ```

3. Verify service is running:
   ```bash
   curl http://localhost:8889/health
   ```

### Service not starting

Check logs:
```bash
journalctl --user -u kiosk-control --since "5 min ago"
```

Common issues:
- Missing environment variables (check service file)
- Wrong path to script (should be `/opt/kiosk-control/kiosk-control.py`)
- wtype not installed

---

## Related Documentation

- [Kiosk Browser Setup](../../docs/18-kiosk-browser.md) - Full kiosk system documentation
- [Display Scheduling](../../docs/10-display-scheduling.md) - Auto on/off timers
