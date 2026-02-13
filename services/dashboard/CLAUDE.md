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

Real-time monitoring of all 39 Zigbee devices with health status, battery levels, and signal strength.

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

---

## SONOFF TRVZB Thermostat Control (2026-01-18)

> **Rule:** Only send `occupied_heating_setpoint`. Never use TRV internal modes.

### The Incident

Study thermostat heated to 19.5°C when setpoint was 18°C for 60+ minutes.

```
Dashboard showed:     TRV was actually using:
  Target: 18°C   →    timer_mode_target_temp: 23°C (stale!)
```

### Root Cause

The dashboard code was sending `temporary_mode_select: 'timer'` to "clear internal boost mode", but this activated timer mode which used a stale `timer_mode_target_temp` value (23°C) instead of the actual setpoint.

### The Fix

HA handles all scheduling. Dashboard should just send the setpoint:

```javascript
// thermostat-store.js setTargetTemp()
this.publishCommand(thermostat, {
  occupied_heating_setpoint: clampedTemp  // Only this!
});
```

### What NOT to Send

| Property | Why Not |
|----------|---------|
| `temporary_mode_select` | Activates timer/boost mode on TRV |
| `timer_mode_target_temp` | Can override setpoint if timer mode is active |
| `temporary_mode_duration` | Part of timer mode system |

### Debugging

```bash
# Check if a TRV has stale timer target
ssh pi@pi 'curl -s "http://localhost:8123/api/states" -H "Auth..." | grep timer_mode_target'

# Fix a stuck thermostat (if timer mode is active)
ssh pi@pi "docker exec mosquitto mosquitto_pub -h localhost \
  -t 'zigbee2mqtt/[Study] Thermostat/set' \
  -m '{\"occupied_heating_setpoint\": 18, \"timer_mode_target_temp\": 18}'"
```

---

## MQTT Visibility Pause (2026-01-20)

MQTT connection is paused when the browser tab is hidden to save resources and prevent stale data accumulation.

### Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│  MQTT Connection Lifecycle with Visibility Handling          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Browser Opens → MQTT connects ──────────────────────────┐   │
│                                                          │   │
│  Tab hidden (500ms debounce) → MQTT disconnects         │   │
│                                                          │   │
│  Tab visible → MQTT reconnects → Re-subscribes → Fresh! ←┘   │
│                                                              │
│  Browser Closes → Connection terminates                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Details

| Property | Purpose |
|----------|---------|
| `_visibilityPaused` | True when disconnected due to tab hidden |
| `_visibilityDebounceTimer` | 500ms debounce for rapid tab switches |
| `_visibilityListenerRegistered` | Prevents duplicate listener registration |

### Key Behaviors

1. **500ms debounce** - Rapid tab switches don't cause connect/disconnect churn
2. **Subscriptions persist** - `_topicHandlers` Map survives disconnect; `on('connect')` re-subscribes
3. **Notification suppressed** - "MQTT Disconnected" toast NOT shown for visibility pause
4. **Data recovery on resume** - `connectionCount > 0` triggers `loadOpenSensorTimestamps()` for fresh data

### Console Output

```
[mqtt] Tab hidden - pausing MQTT connection
[mqtt] Tab visible - resuming MQTT connection
```

### Testing

1. Open dashboard in browser
2. Switch to another tab → wait 500ms → check console for "Tab hidden - pausing"
3. Switch back → verify "Tab visible - resuming" → verify data flows again
4. Rapidly switch tabs → should NOT see multiple disconnect/connect logs

---

## Switches Store (2026-01-23)

Read-only state tracking for SONOFF smart switches used in floor plan light indicators.

### Purpose

The floor plan shows light status for each room. Some rooms (Bedroom) have smart switches but no smart bulbs. This store tracks switch state so the indicator can show ON/OFF based on the switch position.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SWITCH STATE FLOW                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SONOFF Switch → Zigbee2MQTT → MQTT Broker                      │
│                                   │                             │
│                                   ▼                             │
│                              mqtt-store.js                      │
│                                   │                             │
│                                   ▼ message dispatch            │
│                            switches store                       │
│                           updateSwitch(topic, data)             │
│                                   │                             │
│                                   ▼                             │
│                         getRoomLightClass()                     │
│                         Priority 2: Check switch                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Light Indicator Priority

```
getRoomLightClass(roomId):
  │
  ├─► Priority 1: Smart light available & ON? → 'lit'
  │   (Study, Living rooms with IKEA FLOALT)
  │
  ├─► Priority 2: Smart switch available & ON? → 'lit'
  │   (Bedroom only - has switch but no smart bulb)
  │
  └─► Priority 3: Presence sensor illumination 'bright'? → 'lit'
      (Kitchen, Bathroom - no light or switch)
```

### Room-to-Switch Mapping

| Room | Has Smart Light | Has Smart Switch | Indicator Uses |
|------|-----------------|------------------|----------------|
| Study | ✓ (IKEA FLOALT) | ✓ (SONOFF) | Smart light state |
| Living | ✓ (IKEA FLOALT) | ✓ (SONOFF) | Smart light state |
| Bedroom | ✗ | ✓ (SONOFF) | **Switch state** |
| Kitchen | ✗ | ✗ | Illumination |
| Bathroom | ✗ | ✗ | Illumination |

### Switch Configuration

```javascript
// Defined inline in index.html (Alpine.store('switches'))
{
  id: 'bedroom_switch',
  name: 'Bedroom Light Switch',
  roomId: 'bedroom',
  topic: '[Bed] Light Switch',
  state: 'OFF',          // 'ON' or 'OFF'
  available: true,       // false if switch offline
  linkquality: null,
  lastSeen: null
}
```

### MQTT Topics

| Topic | Purpose |
|-------|---------|
| `zigbee2mqtt/[Bed] Light Switch` | State updates (state, linkquality) |
| `zigbee2mqtt/[Bed] Light Switch/availability` | Online/offline status |

### Testing

```bash
# 1. Check store state in browser console
Alpine.store('switches').list[0]
# → { id: 'bedroom_switch', state: 'OFF', available: true, ... }

# 2. Toggle switch via MQTT
ssh pi@pi 'docker exec mosquitto mosquitto_pub \
  -t "zigbee2mqtt/[Bed] Light Switch/set" -m "{\"state\": \"ON\"}"'

# 3. Verify floor plan indicator changed to amber dot
# 4. Toggle OFF
ssh pi@pi 'docker exec mosquitto mosquitto_pub \
  -t "zigbee2mqtt/[Bed] Light Switch/set" -m "{\"state\": \"OFF\"}"'
```

### Key Code Locations

| Location | Purpose |
|----------|---------|
| `index.html:~4910` | Switches store definition |
| `index.html:~4396` | MQTT subscription for switch topics |
| `index.html:~4437` | Availability routing (dispatch to switches store) |
| `index.html:~4463` | State routing (dispatch to switches store) |
| `index.html:~5870` | `getRoomLightClass()` with switch priority |

---

## Notification History View (2026-01-21)

Unified timeline of mobile notifications and TTS announcements, with filtering by type, channel, date, and search.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  NOTIFICATION DATA FLOW                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Home Assistant                                                 │
│       │                                                         │
│       ├── notify.all_phones ──► MQTT: dashboard/notify          │
│       │   (via mobile_notification_mqtt_publisher automation)   │
│       │                                                         │
│       └── tts.google_say ────► MQTT: dashboard/tts              │
│           (via tts_publisher automation)                        │
│                                                                 │
│                    │                                            │
│                    ▼                                            │
│           mqtt-influx-bridge                                    │
│                    │                                            │
│      ┌─────────────┴─────────────┐                              │
│      ▼                           ▼                              │
│  notifications              tts_events                          │
│  (InfluxDB measurement)     (InfluxDB measurement)              │
│                                                                 │
│                    │                                            │
│                    ▼                                            │
│      notification-history-store.js                              │
│      ├── MQTT real-time updates                                 │
│      ├── InfluxDB historical queries                            │
│      └── Filter logic (type, channel, date, search)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Sources

| Source | Topic/Measurement | Data |
|--------|-------------------|------|
| Mobile Notifications | `dashboard/notify` → `notifications` | title, message, channel, importance |
| TTS Announcements | `dashboard/tts` → `tts_events` | message, success, all_available, devices |

### Filter Logic

**OR within category, AND across categories:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Example: [Mobile, TTS] types + [Alerts] channel                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Type filter (OR)                                       │
│    type === 'mobile' OR type === 'tts'                          │
│                                                                 │
│  Step 2: Channel filter (OR)                                    │
│    channel === 'Alerts'                                         │
│                                                                 │
│  Step 3: Combine (AND)                                          │
│    passesTypeFilter AND passesChannelFilter                     │
│                                                                 │
│  Result: Mobile OR TTS that are ALSO in Alerts channel          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `js/stores/notification-history-store.js` | Alpine store with MQTT handlers, InfluxDB queries, filtering |
| `views/notification-history.js` | View controller with lifecycle management |
| `styles/views/notification-history.css` | Card layout, filter chips, responsive design |

### Channels

| Channel | Icon | Color | Use Cases |
|---------|------|-------|-----------|
| Critical | 🚨 | Red | Freezing temps, CO2 emergency, system failures |
| Safety | 🛡️ | Red | Window safety, heater safety interlocks |
| Heater | 🔥 | Orange | Heating system, thermostat changes |
| Alerts | ⚠️ | Amber | Standard alerts, CO2 warnings |
| Warning | ⚡ | Orange | General warnings |
| Zigbee | 📡 | Purple | Zigbee network issues, device offline |
| Lights | 💡 | Yellow | Lighting reminders, circadian updates |
| Info | ℹ️ | Blue | Informational, status updates |
| Audit | 📝 | Indigo | Setpoint changes, audit trail |
| TTS | 🔊 | Purple | Voice announcements |
| Default | 📋 | Gray | Uncategorized |

### View Lifecycle

```javascript
// notification-history.js
init() {
  this.$store.notificationHistory.activate();  // Sets up MQTT, loads historical
}

destroy() {
  this.$store.notificationHistory.deactivate();  // Cleans up MQTT handlers
}
```

### Testing

```bash
# 1. Trigger a test notification
ssh pi@pi 'curl -X POST http://localhost:8123/api/services/notify/all_phones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Test\", \"message\": \"Test notification\", \"data\": {\"channel\": \"Alerts\"}}"'

# 2. Verify MQTT message received
ssh pi@pi 'timeout 5 docker exec mosquitto mosquitto_sub -t "dashboard/notify" -C 1'

# 3. Verify InfluxDB write
ssh pi@pi 'curl -s "http://localhost:8086/query?db=homeassistant" \
  --data-urlencode "q=SELECT * FROM notifications ORDER BY time DESC LIMIT 5"'

# 4. Open dashboard -> Notifications view -> verify data appears
```

---

## TTS Announce View (2026-02-13)

Hidden view for sending text-to-speech announcements to Google Cast speakers via Home Assistant REST API.

### Access

```
http://pi/#tts       (production)
http://localhost:8888#tts  (local dev)
```

No nav entry - accessible only via URL hash. Not persisted to localStorage (kiosk won't get stuck on it).

### Architecture

```
+-----------------------------------------------------------------+
|  TTS ANNOUNCE DATA FLOW                                         |
+-----------------------------------------------------------------+
|                                                                 |
|  Phone/Browser                                                  |
|       |                                                         |
|       |  User types message, picks speaker, adjusts volume      |
|       v                                                         |
|  tts-store.js  announce()                                       |
|       |                                                         |
|       |  Step 1: Set volume                                     |
|       |  POST /api/services/media_player/volume_set             |
|       |  { entity_id, volume_level: 0.0-1.0 }                  |
|       |                                                         |
|       |  Step 2: Speak                                          |
|       |  POST /api/services/tts/google_translate_say            |
|       |  { entity_id, message, language: 'en' }                 |
|       v                                                         |
|  Home Assistant (pi:8123)                                       |
|       |                                                         |
|       v                                                         |
|  Cast Speaker (audio plays in the room)                         |
|                                                                 |
+-----------------------------------------------------------------+
```

### Available Speakers

| Speaker | Entity ID | Location |
|---------|-----------|----------|
| Kitchen Display | `media_player.kitchen_display` | Kitchen (default) |
| Bedroom Clock | `media_player.master_bedroom_clock` | Bedroom |
| Broken Display | `media_player.broken_display` | Spare (cracked screen, speaker works) |

### Key Files

| File | Purpose |
|------|---------|
| `js/stores/tts-store.js` | Alpine store - HA API calls, form state, status management |
| `views/tts.js` | View controller with init/destroy lifecycle |
| `styles/views/tts.css` | Purple-themed card UI (Pi-safe CSS) |
| `index.html` (~line 2933) | View HTML with Alpine directives |
| `index.html` (~line 4375) | Module script with alpine:init registration |
| `index.html` (~line 6057) | Hash routing in app init |

### Features

- Speaker dropdown (3 Cast devices)
- Volume slider (0-100%, sent as 0.0-1.0 to HA)
- Message textarea (maxlength 1000, Google TTS limit)
- Enter key to send (Shift+Enter for newline)
- Auto-clearing success/error status (8 seconds)
- Touch-friendly (48px button, 44px select)

### Testing

```bash
# 1. Open the TTS view
# http://pi/#tts

# 2. Or test the HA API directly
ssh pi@pi 'curl -X POST http://localhost:8123/api/services/tts/google_translate_say \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"entity_id\": \"media_player.kitchen_display\", \"message\": \"Hello from the terminal\", \"language\": \"en\"}"'
```
