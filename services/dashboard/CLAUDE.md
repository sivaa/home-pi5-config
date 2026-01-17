# Dashboard Service

## Purpose

Browser-based home dashboard served by nginx. Displays temperature, humidity, CO2, heating controls, and floor plan visualization.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DASHBOARD STACK                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser (Kiosk)                                                │
│      │                                                          │
│      ├── Alpine.js (reactive state)                             │
│      ├── MQTT.js (live sensor data)                             │
│      └── InfluxDB queries (historical charts)                   │
│                                                                 │
│  nginx (static file server)                                     │
│      └── /opt/dashboard/www/                                    │
│                                                                 │
│  Data Sources:                                                  │
│      ├── MQTT: pi:1883 (real-time sensors)                      │
│      ├── InfluxDB: pi:8086 (historical data)                    │
│      └── Home Assistant: pi:8123 (automations)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

| Path | Purpose |
|------|---------|
| `www/index.html` | Main dashboard entry |
| `www/js/stores/*.js` | Alpine.js state stores |
| `www/components/*.js` | Reusable UI components |
| `www/styles/*.css` | CSS organized by feature |
| `nginx/dashboard.conf` | Nginx proxy configuration |

---

## 🚨 Nginx Proxy Configuration (Jan 17, 2026)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INCIDENT: Dashboard in restart loop after HA network change               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CAUSE: HA was switched to --network host, but nginx config still          │
│  used "homeassistant" as upstream. Docker hostnames only resolve            │
│  within bridge networks, not across to host network.                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  NETWORK TOPOLOGY:                                                          │
│                                                                             │
│  zigbee2mqtt_default (bridge)        Host Network                           │
│  ┌──────────────────────────┐        ┌────────────────────┐                │
│  │  dashboard (nginx)       │        │  homeassistant     │                │
│  │  influxdb                │◄──────►│  (ports on host)   │                │
│  │  mosquitto               │  via   │                    │                │
│  └──────────────────────────┘  172.18.0.1                 │                │
│                                      └────────────────────┘                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  RULE: Services on --network host must be reached via Docker gateway IP    │
│  (172.18.0.1), NOT via container name!                                      │
│                                                                             │
│  ✗ WRONG:  proxy_pass http://homeassistant:8123/api/;                       │
│  ✓ RIGHT:  proxy_pass http://172.18.0.1:8123/api/;                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Upstream Configuration

| Service | Network | Upstream Address | Notes |
|---------|---------|------------------|-------|
| InfluxDB | zigbee2mqtt_default | `influxdb:8086` | Docker DNS works |
| Mosquitto | zigbee2mqtt_default | `mosquitto:9001` | Docker DNS works |
| Home Assistant | host | `172.18.0.1:8123` | Must use gateway IP |

## Touch Device Optimizations (2025-12-29)

Dashboard runs on a touch kiosk. Key optimizations:

1. **44px minimum touch targets** - All buttons meet accessibility guidelines
2. **No 300ms tap delay** - `touch-action: manipulation` on interactive elements
3. **Scoped theme transitions** - Only animate during explicit theme changes (not every tap)
4. **Passive event listeners** - Click handlers don't block scrolling
5. **Early exit patterns** - Event handlers check state before DOM queries
6. **Hover states skipped on touch** - `@media (hover: hover)` for hover effects

## Development

```bash
# Local testing (connects to Pi services)
cd services/dashboard/www
python -m http.server 8888
# Open http://localhost:8888

# Deploy to Pi
scp -r www/* pi@pi:/opt/dashboard/www/
```

## Theming

Supports light/dark themes via CSS variables. Theme preference stored in localStorage.

```css
:root { /* light theme */ }
[data-theme="dark"] { /* dark overrides */ }
```

---

## CSS Performance Guidelines (2025-01-01)

> **Why this matters:** The Pi runs WebKit/Epiphany on Wayland. Expensive CSS properties cause Skia renderer CPU spikes (108%+), fan noise, and thermal throttling.

### The Incident

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  BEFORE FIX                           │  AFTER FIX                             │
├───────────────────────────────────────┼────────────────────────────────────────┤
│  CPU: 147%  (WebKitWebProcess)        │  CPU: 26%                              │
│  Temp: 59.5°C                         │  Temp: 54.5°C                          │
│  Fan: State 2 (loud)                  │  Fan: State 1 (quiet)                  │
│  Load: 5.0+                           │  Load: 1.72                            │
└───────────────────────────────────────┴────────────────────────────────────────┘
Root causes: 12+ infinite animations, multi-layer box-shadows, 120Hz display
```

### Banned CSS Properties

| Property | CPU Impact | Alternative |
|----------|------------|-------------|
| `backdrop-filter: blur()` | Extremely High | Solid semi-transparent background |
| `filter: blur()` | High | Pre-blurred images or solid colors |
| `filter: grayscale()` | High | `opacity: 0.5` for disabled states |
| `animation: * infinite` | High (constant) | Single-run animations or static styles |
| Multi-layer `box-shadow` | High (Skia) | Single shadow, max 10px blur |

### Box-Shadow Rules

```css
/* BAD - Causes 108%+ Skia CPU usage */
box-shadow: 0 0 25px rgba(239, 68, 68, 0.3),
            0 0 50px rgba(249, 115, 22, 0.15),
            inset 0 0 40px rgba(239, 68, 68, 0.04);

/* GOOD - Simple, efficient */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

/* BETTER - No shadow, use border */
border: 2px solid var(--color-danger);
```

### Animation Rules

```css
/* BAD - Runs forever, constant GPU work */
@keyframes warmGlow {
  0%, 100% { box-shadow: 0 0 30px rgba(255, 100, 50, 0.4); }
  50% { box-shadow: 0 0 50px rgba(255, 100, 50, 0.6); }
}
.element { animation: warmGlow 3s ease-in-out infinite; }

/* GOOD - Finite animations */
.element { animation: fadeIn 0.3s ease-out; }

/* BETTER - CSS transitions (only animate on state change) */
.element { transition: opacity 0.2s ease; }
```

### Pre-Deployment Checklist

Before deploying CSS changes, run:

```bash
# 1. Scan for banned patterns
scripts/lint-css-performance.sh

# 2. After deploy, verify Pi health
ssh pi@pi 'cat /sys/class/thermal/thermal_zone0/temp && \
           cat /sys/class/thermal/cooling_device0/cur_state && \
           uptime && \
           ps aux | grep -E "epiphany|WebKit" | grep -v grep'
```

Expected healthy state:
- Temp: < 55000 (55°C)
- Fan: 0 or 1
- Load: < 2.0
- Browser CPU: < 50%

### Safe CSS Patterns

```css
/* Transforms are GPU-accelerated and cheap */
transform: translateY(-2px);
transform: scale(1.02);

/* Opacity is cheap */
opacity: 0.5;

/* Simple transitions are fine */
transition: transform 0.2s ease, opacity 0.2s ease;

/* Border colors are cheap */
border-color: var(--color-danger);
```

---

## Device Health View (2026-01-08)

Real-time monitoring of all 36 Zigbee devices with health status, battery levels, and signal strength.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  DEVICE HEALTH DATA FLOW                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Zigbee Device → Z2M → MQTT Broker                              │
│                          │                                      │
│                          ▼                                      │
│                     mqtt-store.js                               │
│                    (WebSocket via MQTT.js)                      │
│                          │                                      │
│                          ▼ _dispatchToHandlers()                │
│                          │                                      │
│                     device-health-store.js                      │
│                    updateDeviceHealth()                         │
│                          │                                      │
│                          ▼                                      │
│             ┌────────────┴────────────┐                         │
│             │                         │                         │
│        healthData[ieee]          viewActive?                    │
│        (always updated)               │                         │
│                              ┌────────┴────────┐                │
│                              │                 │                │
│                           YES: Queue        NO: Skip            │
│                           for 5s batch      UI work             │
│                              │                                  │
│                              ▼                                  │
│                     _flushUpdates()                             │
│                    (triggers Alpine reactivity)                 │
│                              │                                  │
│                              ▼                                  │
│                     device-health.js (View)                     │
│                    UI re-renders                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `js/stores/device-health-store.js` | Alpine store with MQTT handlers, health calculations |
| `views/device-health.js` | View controller with lifecycle management |
| `styles/views/device-health.css` | Responsive grid layout for device list |

### Performance Optimizations

1. **5-second batched updates** - Collects MQTT updates, flushes in single reactivity trigger
2. **View lifecycle gating** - UI work only when tab is active
3. **Data always fresh** - MQTT data stored even when view inactive
4. **Cleanup on tab switch** - Timers cleared, no memory leaks

### Health Status Thresholds

| Status | Last Seen | Color |
|--------|-----------|-------|
| OK | < 30 min | Green |
| Warning | 30 min - 2 hr | Yellow |
| Critical | 2 hr - 24 hr | Red |
| Dead | > 24 hr | Gray |

---

## Transport View (2026-01-12)

Real-time departure board for S-Bahn and Bus from nearby stops, styled like train station displays.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  TRANSPORT DATA FLOW                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dashboard View                                                 │
│       │                                                         │
│       ▼ HTTP fetch on view open                                 │
│  ┌─────────────────────────────────────────┐                   │
│  │  data-scraper (pi:8890)                 │                   │
│  │  Playwright → BVG + bahnhof.de          │                   │
│  └─────────────────────────────────────────┘                   │
│       │                                                         │
│       ▼ JSON response                                           │
│  ┌─────────────────────────────────────────┐                   │
│  │  transport-store.js                     │                   │
│  │  • Stores departures                    │                   │
│  │  • Filters cancelled trips              │                   │
│  │  • Calculates status classes            │                   │
│  └─────────────────────────────────────────┘                   │
│       │                                                         │
│       ▼ Alpine reactivity                                       │
│  ┌─────────────────────────────────────────┐                   │
│  │  index.html (transport section)         │                   │
│  │  • S-Bahn board (pink badges)           │                   │
│  │  • Bus board (purple/green badges)      │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Official Color Scheme (Verified Jan 2026)

Colors verified from official sources, not assumed:

```
┌─────────────────────────────────────────────────────────────────┐
│  🚇 S-BAHN COLORS                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  S1:  #E30078 (Pink/Magenta)  ← Used in dashboard               │
│                                                                 │
│  Source: https://sbahn.berlin/en/route-map/                     │
│  Note: Each S-Bahn line has its own color (S1=pink, S2=green,   │
│        S7=purple, etc.). The green "S" logo is the brand,       │
│        NOT the line color.                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  🚌 BUS COLORS (BVG Berlin)                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Regular (285):      #9B2589 (Purple)                           │
│  ExpressBus (X10):   #006F35 (Green)  ← JetExpressBus bar       │
│  MetroBus (M lines): #9B2589 (Purple)                           │
│                                                                 │
│  Source: Physical bus stop signage at Zoologischer Garten       │
│          showing X9/109/N9 lines with color coding              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cancelled Trip Detection

Trips marked as cancelled on bahnhof.de are detected and displayed:

```
┌─────────────────────────────────────────────────────────────────┐
│  CANCELLED TRIP HANDLING                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Detection (scraper.py):                                        │
│  • Regex: /trip cancelled|fällt aus|ausfall/i                   │
│  • Returns: { "cancelled": true } in departure object           │
│                                                                 │
│  Display (index.html):                                          │
│  • Shows "✕ Trip cancelled" instead of time                     │
│  • Row has reduced opacity and red background tint              │
│  • Direction text has strikethrough                             │
│                                                                 │
│  Store (transport-store.js):                                    │
│  • getNextDeparture() excludes cancelled trips                  │
│  • Badge countdown only shows valid departures                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Status Classes

Row styling based on time until departure vs 5-min walk time:

| Class | Condition | Styling |
|-------|-----------|---------|
| `status-missed` | < 5 min | Faded, strikethrough time |
| `status-urgent` | 5-7 min | Orange background, urgent color |
| `status-soon` | 7-10 min | Yellow tint, warning color |
| `status-ok` | > 10 min | Green time |
| `status-cancelled` | Trip cancelled | Red tint, strikethrough direction |

### Key Files

| File | Purpose |
|------|---------|
| `js/stores/transport-store.js` | Alpine store, fetches from scraper API |
| `views/transport.js` | View lifecycle, helper functions |
| `styles/views/transport.css` | Station board styling, color tokens |
| `index.html` (transport section) | Alpine templates for departure rows |

### Auto-Restart via Home Assistant (Jan 16, 2026)

When the scraper container is stopped (by cleanup service after 30 min idle), the dashboard automatically restarts it:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TRANSPORT AUTO-RESTART                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  transport-store.js fetchDepartures() fails (network error)                 │
│       │                                                                     │
│       ▼                                                                     │
│  triggerContainerRestart()                                                  │
│       │                                                                     │
│       ├── Show "Starting transport service..."                              │
│       │                                                                     │
│       ▼  POST to HA API                                                     │
│  http://pi:8123/api/services/shell_command/start_data_scraper               │
│       │  Headers: Authorization: Bearer ${this.haToken}                     │
│       │                                                                     │
│       ▼  HA executes shell_command                                          │
│  curl --unix-socket /var/run/docker.sock → Docker API                       │
│       │                                                                     │
│       ▼  Container starts                                                   │
│  Wait 20 seconds for browser launch                                         │
│       │                                                                     │
│       ▼                                                                     │
│  Retry fetchDepartures() → Success                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Properties in transport-store.js:**
- `haToken` - Long-lived access token (same as weather-store, thermostat-store)
- `HA_URL` - Home Assistant URL (http://pi:8123)
- `containerStopped` - Tracks if container was detected as stopped
- `retrying` - Prevents multiple restart attempts

**Requirements:**
- HA must have Docker socket mounted (see configs/homeassistant/CLAUDE.md)
- HA API requires authentication (token in `haToken`)
- shell_command in HA config must use `curl` (docker CLI not in HA image)
