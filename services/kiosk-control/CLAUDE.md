# Kiosk Control Service

> **Purpose:** HTTP API for remote control of kiosk display via wlrctl compositor commands
> **Runtime:** Python 3 (standalone, no Docker)
> **Port:** 8889 (localhost only)

---

## Canonical Source

```
┌─────────────────────────────────────────────────────────────────────┐
│  The CURRENT version of the script lives in:                        │
│                                                                     │
│    configs/kiosk-control/kiosk-control.py   <-- SOURCE OF TRUTH     │
│                                                                     │
│  The copy at services/kiosk-control/kiosk-control.py is OUTDATED.   │
│  It uses the old wtype + F11 approach. Do not rely on it.           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    KIOSK CONTROL FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Enter fullscreen:                                                  │
│    Dashboard ──► GET /api/kiosk/toggle ──► wlrctl toplevel          │
│                                            fullscreen ──► labwc     │
│                                                                     │
│  Exit fullscreen:                                                   │
│    Dashboard ──► GET /api/kiosk/toggle ──► pkill epiphany +         │
│                                            clear session +          │
│                                            restart kiosk-browser    │
│                                                                     │
│  Refresh:                                                           │
│    Dashboard ──► GET /api/kiosk/refresh ──► wtype -k F5 ──► Browser │
│                                                                     │
│  Status:                                                            │
│    Dashboard ──► GET /api/kiosk/status ──► wlrctl toplevel find     │
│                                            state:fullscreen         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why This Exists

The kiosk runs in fullscreen mode via labwc (Wayland compositor). Standard browser JavaScript APIs cannot control compositor-level fullscreen. This service provides HTTP endpoints that use Wayland tools to:

1. **Enter fullscreen** - `wlrctl toplevel fullscreen` (compositor-level command)
2. **Exit fullscreen** - Kill browser, clear session state, restart service (browser restart clears fullscreen memory)
3. **Refresh browser** (F5 via wtype) - Reload dashboard after updates
4. **Query fullscreen status** - `wlrctl toplevel find state:fullscreen`

---

## API Endpoints

### GET /api/kiosk/toggle

Toggles fullscreen mode. Uses `wlrctl toplevel fullscreen` to enter, browser restart to exit.

**Response (entering fullscreen):**
```json
{
  "success": true,
  "action": "enter_fullscreen",
  "fullscreen": true
}
```

**Response (exiting fullscreen):**
```json
{
  "success": true,
  "action": "exit_fullscreen",
  "fullscreen": false
}
```

### GET /api/kiosk/refresh

Sends F5 keypress via wtype to refresh the browser.

**Response:**
```json
{
  "success": true,
  "action": "refresh"
}
```

### GET /api/kiosk/status

Returns the current fullscreen state by querying wlrctl.

**Response:**
```json
{
  "fullscreen": true
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
| `wlrctl` | Wayland compositor window control (fullscreen enter/exit/query) | `sudo apt install wlrctl` |
| `wtype` | Wayland keyboard input simulator (F5 refresh) | `sudo apt install wtype` |
| `labwc` | Wayland compositor (receives fullscreen commands) | Pre-installed |
| Python 3 | Runtime | Pre-installed |

---

## Critical Environment Variables

The service **requires** these environment variables to communicate with labwc:

| Variable | Value | Purpose |
|----------|-------|---------|
| `WAYLAND_DISPLAY` | `wayland-0` | Connect to Wayland compositor |
| `XDG_RUNTIME_DIR` | `/run/user/1000` | Wayland socket directory |

**Without these, wlrctl/wtype cannot communicate with the compositor and the service will fail silently.**

---

## Files

```
Source files (canonical):
├── configs/kiosk-control/
│   ├── kiosk-control.py       <- CURRENT script (source of truth, ~158 lines)
│   └── kiosk-control.service  <- Systemd service file (source of truth)

Outdated copy (do not use):
├── services/kiosk-control/
│   ├── CLAUDE.md              <- This file
│   └── kiosk-control.py       <- OLD script (wtype F11 approach, ~131 lines)

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
# Copy script to Pi (use canonical source from configs/)
sudo mkdir -p /opt/kiosk-control
sudo cp configs/kiosk-control/kiosk-control.py /opt/kiosk-control/

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
  .then(data => console.log('Fullscreen:', data.fullscreen));

// Check current fullscreen status
fetch('http://localhost:8889/api/kiosk/status')
  .then(r => r.json())
  .then(data => console.log('Is fullscreen:', data.fullscreen));

// Refresh after deploy
fetch('http://localhost:8889/api/kiosk/refresh')
  .then(r => r.json())
  .then(data => console.log('Refreshed:', data.success));
```

### Related Services

| Service | Relationship |
|---------|--------------|
| `kiosk-browser.service` | Browser controlled by this service (restart for fullscreen exit) |
| `kiosk-toggle.service` | GTK4 floating button that calls this API |
| `labwc` | Compositor that handles wlrctl fullscreen commands |

---

## Troubleshooting

### wlrctl or wtype not found

```bash
sudo apt install wlrctl wtype
```

### Fullscreen toggle not working

1. Check environment variables are set in service:
   ```bash
   systemctl --user show kiosk-control | grep Environment
   # Should show WAYLAND_DISPLAY and XDG_RUNTIME_DIR
   ```

2. Test wlrctl manually:
   ```bash
   WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 wlrctl toplevel find state:fullscreen
   ```

3. Test wtype manually:
   ```bash
   WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/1000 wtype -k F5
   ```

4. Verify service is running:
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
- wlrctl or wtype not installed

---

## Related Documentation

- [Kiosk Browser Setup](../../docs/18-kiosk-browser.md) - Full kiosk system documentation
- [Display Scheduling](../../docs/10-display-scheduling.md) - Auto on/off timers
