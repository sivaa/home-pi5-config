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
