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
| `nginx/nginx.conf` | Server configuration |

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
