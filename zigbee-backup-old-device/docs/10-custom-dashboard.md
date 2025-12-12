# Custom Climate Dashboard v2.0

> **5 Beautiful Ways to Visualize Your Home's Climate**
> Multi-view real-time dashboard with Apple-inspired design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Home Climate              ● LIVE               Sat, Dec 7 · 5:30 PM    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [🎯 Score]  [📊 Compare]  [🗺️ Floor Plan]  [🌡️ Ambient]  [📖 Timeline]   │
│       ●           ○              ○               ○             ○            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        VIEW 1: COMFORT SCORE                                │
│                                                                             │
│                         ╭───────────╮                                       │
│                         │    78     │                                       │
│                         │  ───────  │                                       │
│                         │COMFORTABLE│                                       │
│                         ╰───────────╯                                       │
│                                                                             │
│              [🛋️ 82] [🛏️ 85] [📚 76] [🍳 71] [🚿 68]                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ● Connected │ 5 sensors │ Last update: 2s ago                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Start local server (from Mac)
cd ~/pyrepos/siva-personal/zigbee/dashboard
python3 -m http.server 8888

# 2. Open in browser
open http://localhost:8888

# 3. Use keyboard shortcuts 1-5 to switch views
```

---

## 🎬 The 5 Dashboard Views

| Key | View | Best For | Description |
|-----|------|----------|-------------|
| `1` | 🎯 **Comfort Score** | Quick glance | Single number (0-100) showing overall comfort |
| `2` | 📊 **Bar Compare** | Analysis | Side-by-side room comparison with bars |
| `3` | 🗺️ **Floor Plan** | Spatial thinkers | Heat map on your actual floor layout |
| `4` | 🌡️ **Ambient** | Wall tablets | Giant display readable from across room |
| `5` | 📖 **Timeline** | Pattern seekers | Chronological story of climate events |

---

## View 1: Comfort Score

> *"One number to rule them all"*

```
                    ╭─────────────╮
                    │     78      │  ← Score 0-100
                    │  ─────────  │
                    │ COMFORTABLE │  ← Human-readable label
                    ╰─────────────╯

        [🛋️ 82] [🛏️ 85] [📚 76] [🍳 71] [🚿 68]  ← Per-room scores
```

**Score Algorithm:**
- Temperature: 70% of score (ideal: 20-26°C, perfect: 23°C)
- Humidity: 30% of score (ideal: 40-60%, perfect: 50%)
- Room weights: Living 1.5x, Bedroom 1.3x, Study 1.0x, Kitchen 0.8x, Bath 0.5x

**Score Labels:**
| Score | Label | Color |
|-------|-------|-------|
| 90-100 | Perfect | Green |
| 75-89 | Comfortable | Light Green |
| 60-74 | Okay | Yellow |
| 40-59 | Uncomfortable | Orange |
| 0-39 | Poor | Red |

---

## View 2: Bar Comparison

> *"See differences instantly"*

```
🌡️ TEMPERATURE                        💧 HUMIDITY
──────────────────────────────        ──────────────────────────────
🚿 Bath    ████████████████████▓ 27°  ████████████████████ 72%
🍳 Kitchen █████████████████░░░░ 26°  ██████████▒░░░░░░░░░ 45%
📚 Study   ████████████████░░░░░ 25°  ████████████░░░░░░░░ 48%
🛋️ Living  ███████████████░░░░░░ 24°  ████████████████░░░░ 58%
🛏️ Bedroom ████████████▒░░░░░░░░ 23°  ██████████████░░░░░░ 52%
           ├────┼────┼────┼────┤      ├────┼────┼────┼────┤
           18°  22°  26°  30°         0%   25%  50%  75%
              comfort zone               ideal range

📊 AUTO-INSIGHTS
┌────────────────────────────────────────────────────────────┐
│ 🔺 TEMPERATURE GAP: Bathroom is 4.6° warmer than Bedroom   │
│ 💧 HUMIDITY ALERT: Bathroom at 72% — consider ventilation  │
│ ✓  GOOD NEWS: Living Room is in the ideal comfort zone     │
└────────────────────────────────────────────────────────────┘
```

**Controls:**
- View toggle: Temperature / Humidity / Both
- Sort: Temperature / Humidity / Name / Comfort Score
- Click bar to expand 24-hour mini chart

---

## View 3: 3D Floor Plan

> *"Walk through your data"*

An immersive **Three.js-powered 3D visualization** of your apartment with real-time temperature/humidity heatmaps. Rotate, zoom, and explore your home's climate from any angle.

### Apartment Layout (9.239m × 7.665m)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    APARTMENT (9.239m × 7.665m)                       │
│                                                                      │
│  ┌────────┬─────────────────────────┬─────────────────────┐         │
│  │        │                         │                     │   🚪    │
│  │BALCONY │     LIVING ROOM         │     BEDROOM         │  Main   │
│  │1.05×1.2│     5.91m × 3.97m       │    4.49m × 3.38m    │  Door   │
│  │  🌿    │     🛋️  (Green)         │    🛏️  (Yellow)     │         │
│  │        │                         │                     │         │
│  │   🪟   │         🪟              │          🪟         │    🪟   │
│  ├────────┴─────────────────────────┼─────────────────────┴─────────┤
│  │                                  │                               │
│  │       STUDY ROOM                 │         KITCHEN               │
│  │       4.885m × 3.697m            │       3.33m × 2.14m           │
│  │       📚  (Blue)                 │       🍳  (Red)               │
│  │                                  │                               │
│  │            🪟                    │   ┌───────────────────────────┤
│  │                                  │   │      BATHROOM             │
│  │                    ┌─────────────┤   │    3.15m × 1.42m          │
│  │                    │  HALLWAY    │   │    🚿  (Purple)           │
│  │                    │  1.5m×2.5m  │   │           🪟              │
│  │                    │  (Gray)     │   │                           │
│  └────────────────────┴─────────────┴───┴───────────────────────────┘
```

### Room Specifications

| Room | Dimensions | Center (x, z) | Color | Icon |
|------|------------|---------------|-------|------|
| Study | 4.885m × 3.697m | (2.44, 1.85) | 🔵 Blue `#60a5fa` | 📚 |
| Living Room | 5.908m × 3.968m | (2.95, 5.68) | 🟢 Green `#34d399` | 🛋️ |
| Bedroom | 4.489m × 3.378m | (6.99, 5.98) | 🟡 Yellow `#fbbf24` | 🛏️ |
| Kitchen | 3.331m × 2.138m | (7.57, 3.22) | 🔴 Red `#f87171` | 🍳 |
| Bathroom | 3.15m × 1.424m | (7.66, 0.71) | 🟣 Purple `#a78bfa` | 🚿 |
| Hallway | 1.5m × 2.5m | (5.4, 2.0) | ⚪ Gray `#94a3b8` | — |
| Balcony | 1.05m × 1.2m | (0.53, 7.07) | 🩵 Light Blue `#93c5fd` | 🌿 |

### 3D Scene Components

```
Scene Graph (~60 meshes, ~40k triangles)
├── Floor (base apartment)
├── Room Floors (7) ─── Transparent, color-coded by room
├── Walls (20) ─────── Semi-transparent glass (25% opacity)
├── Doors (6) ──────── Wood material with metal handles
├── Windows (5) ────── Glass panes + dark gray frames
├── Balcony ────────── Glass panel + metal railings
├── Furniture ──────── Bed in bedroom
└── Lighting (3) ───── Ambient + Directional + Fill
```

**Material Properties:**
| Element | Opacity | Metalness | Roughness | Notes |
|---------|---------|-----------|-----------|-------|
| Walls | 25% | 0.4 | 0.08 | Glass-like, see-through |
| Room Floors | 30% | 0.1 | 0.6 | Dynamic heatmap color |
| Doors | 100% | 0.1 | 0.7 | Wood texture (saddle brown) |
| Windows | 40% | 0.3 | 0.1 | Sky blue glass |

### Heatmap Color Scales

**Temperature (smooth interpolation):**
```
18°C ─────── 22°C ─────── 24°C ─────── 26°C ─────── 28°C ─────── 32°C
  │           │           │           │           │           │
Light Blue → Light Green → Green → Light Yellow → Peach → Red
  (Cold)      (Cool)    (Comfort)   (Warm)      (Hot)   (Very Hot)
```

**Humidity (smooth interpolation):**
```
30% ──────── 40% ──────── 50% ──────── 60% ──────── 70% ──────── 85%
  │           │           │           │           │           │
Orange → Light Green → Green → Light Green → Light Blue → Indigo
 (Dry)    (Ideal)    (Perfect)  (Ideal)     (Humid)   (Very Humid)
```

### Interactive Controls

| Control | Action |
|---------|--------|
| **Left Drag** | Rotate camera around apartment |
| **Right Drag** | Pan/translate view |
| **Scroll** | Zoom in/out (5-40m range) |
| **Top View** | Bird's eye view from above |
| **3D View** | Isometric diagonal angle |
| **Toggle Walls** | Show/hide wall visibility |
| **Auto Rotate** | Continuous 360° rotation |
| **Dark Theme** | Switch background color |

**Keyboard Shortcuts (in 3D view):**
| Key | Action |
|-----|--------|
| `T` | Top view (bird's eye) |
| `3` | 3D isometric view |

### Floating Room Labels

```
        ┌─────────────────┐
        │       📚       │  ← Room icon
        │   STUDY ROOM    │  ← Room name
        │     25.2°      │  ← Temperature
        │      48%       │  ← Humidity
        └─────────────────┘
```

- **HTML labels** positioned in 3D space (projected to 2D screen)
- **Smooth fade** when entering/leaving viewport
- **Updates 60fps** with real-time sensor data

### Lighting Setup

```
                    ☀️ Directional Light (0.8)
                    Position: (15, 20, 15)
                    Casts soft shadows
                         │
                         ▼
    ┌─────────────────────────────────────┐
    │                                     │
    │         🏠 APARTMENT                │◀── 💡 Ambient Light (0.6)
    │                                     │
    └─────────────────────────────────────┘
                         ▲
                         │
                    Fill Light (0.3)
                    Position: (-10, 10, -10)
```

### Implementation Files

| File | Purpose |
|------|---------|
| `dashboard/views/floor-plan-3d.js` | Main 3D view (Alpine component) |
| `dashboard/views/floor-plan.js` | 2D fallback view |
| `dashboard/js/three/orbit-controls.js` | Camera control system |
| `dashboard/js/config.js` | Room dimensions & colors |
| `dashboard/styles/views/3d-view.css` | 3D view styling |
| `prototypes/3d-sensor-monitor.html` | Standalone prototype |

### Source Files

| File | Description |
|------|-------------|
| [floor-map.svg](./floor-map.svg) | Vector floor plan |
| [floor-map.png](./floor-map.png) | PNG export |
| [floor-map.excalidraw](./floor-map.excalidraw) | Editable source (Excalidraw) |

---

## View 4: Ambient Display

> *"Glanceable temperature from across the room"*

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║                                                                ║
║                          24.5°                                 ║
║                                                                ║
║                       LIVING ROOM                              ║
║                           58%                                  ║
║                                                                ║
║                                                                ║
║             ●     ○     ○     ○     ○                          ║
║            24°   23°   25°   26°   27°                         ║
║            Liv   Bed   Stu   Kit   Bath                        ║
║                                                                ║
║                   ← swipe to change room →                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

**Features:**
- **Giant display**: 180px+ font, readable from 5 meters
- **Swipe navigation**: Left/right to change rooms
- **Auto-rotate**: Cycles rooms every 10 seconds
- **Dark mode**: Auto-enables 10 PM - 6 AM
- **Tap for details**: Shows min/max today, trend arrow

**Keyboard shortcuts (in Ambient view):**
| Key | Action |
|-----|--------|
| `←` / `→` | Previous/next room |
| `d` | Toggle dark mode |
| `a` | Toggle auto-rotate |

---

## View 5: Timeline Story

> *"Data is a story — tell it that way"*

```
TODAY'S CLIMATE STORY                          Saturday, Dec 7

NOW ────────────────●
                    │
                    │  🛋️ Living Room · 24.5° · 58%
    5:30 PM         │  All 5 rooms are currently comfortable
                    │
────────────────────┼──────────────────────────────────────────
                    │
                    │  🚿 BATHROOM PEAKED
    4:00 PM         │  Temperature hit 29° (highest today)
                    │  Humidity spiked to 85%
                    │  💡 Likely cause: Hot shower
                    │
────────────────────┼──────────────────────────────────────────
                    │
                    │  🍳 KITCHEN HEATING EVENT
    2:15 PM         │  Rose 4° in 30 minutes
                    │  22.1° → 26.1°
                    │  💡 Likely cause: Cooking activity
                    │
────────────────────┼──────────────────────────────────────────
                    │
                    │  ☀️ AFTERNOON SUN
    11:00 AM        │  Study warmed 3° as sun moved south
                    │  📊 This happens every sunny day at ~11 AM
                    │
────────────────────┼──────────────────────────────────────────
                    │
                    │  🌙 OVERNIGHT LOW
    6:30 AM         │  Bedroom dropped to 19.2° (coldest point)
                    │
────────────────────●
    MIDNIGHT
```

**Event Types Detected:**
| Type | Icon | Trigger |
|------|------|---------|
| Peak | 📈 | Temperature highest of day |
| Valley | 📉 | Temperature lowest of day |
| Rapid Rise | 🔥 | +3° in 30 minutes |
| Rapid Drop | ❄️ | -3° in 30 minutes |
| Humidity Spike | 💧 | +15% humidity |

**Cause Inference:**
- Bathroom peak + high humidity → "Hot shower"
- Kitchen rise (11 AM-2 PM or 6-9 PM) → "Cooking"
- Rise at 10 AM-3 PM → "Sun exposure"
- Valley at 3-6 AM → "Overnight cooling"

---

## Architecture

```
                                    ┌─────────────────────────┐
                                    │     Browser/Tablet      │
                                    │   (Alpine.js + MQTT.js) │
                                    └───────────┬─────────────┘
                                                │
                                                │ WebSocket
                                                │ ws://dietpi.local:9001
                                                ▼
┌─────────────┐    MQTT     ┌───────────────────────────────┐
│   Zigbee    │ ─────────►  │         Mosquitto             │
│   Sensors   │             │  ┌─────────┐   ┌───────────┐  │
│  (5 rooms)  │             │  │TCP:1883 │   │WS:9001    │  │
└─────────────┘             │  │(internal)│   │(browser)  │  │
                            │  └─────────┘   └───────────┘  │
                            └───────────────────────────────┘
                                     dietpi.local
                                          │
                                          ▼
                            ┌───────────────────────────────┐
                            │         InfluxDB              │
                            │   (Historical data storage)   │
                            └───────────────────────────────┘
```

---

## Prerequisites

### 1. Mosquitto WebSocket Enabled

**File:** `mosquitto/mosquitto.conf`
```conf
# TCP for internal Docker services
listener 1883
protocol mqtt

# WebSocket for browser dashboard
listener 9001
protocol websockets

allow_anonymous true
persistence true
persistence_location /mosquitto/data/
log_dest stdout
```

### 2. Port 9001 Exposed

**File:** `docker-compose.yml`
```yaml
mosquitto:
  ports:
    - "1883:1883"
    - "9001:9001"  # WebSocket for browser
```

### 3. Deploy & Restart

```bash
# Sync config to dietpi
rsync -avz mosquitto/mosquitto.conf root@dietpi.local:/root/zigbee/mosquitto/
rsync -avz docker-compose.yml root@dietpi.local:/root/zigbee/

# Restart mosquitto
ssh root@dietpi.local "cd /root/zigbee && docker compose restart mosquitto"

# Verify WebSocket is listening
ssh root@dietpi.local "docker compose logs mosquitto --tail 5"
# Should show: "Opening websockets listen socket on port 9001."
```

---

## Configuration

Edit `CONFIG` in `dashboard/index.html`:

```javascript
const CONFIG = {
  mqttUrl: 'ws://dietpi.local:9001',
  baseTopic: 'zigbee2mqtt',
  influxUrl: '/api/influx',
  influxDb: 'homeassistant',
  rooms: [
    { id: 'living', name: 'Living Room', icon: '🛋️', sensor: 'Living Room TRH (1)', entityId: 'sensor.living_room_trh_1' },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', sensor: 'Bed Room TRH (2)', entityId: 'sensor.bed_room_trh_2' },
    { id: 'study', name: 'Study', icon: '📚', sensor: 'Study Room TRH (3)', entityId: 'sensor.study_room_trh_3' },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', sensor: 'Kitchen TRH (4)', entityId: 'sensor.kitchen_trh_4' },
    { id: 'bathroom', name: 'Bathroom', icon: '🚿', sensor: 'Bath Room TRH (5)', entityId: 'sensor.bath_room_trh_5' }
  ],
  staleThreshold: 5 * 60 * 1000,  // 5 minutes
  maxHistoryPoints: 500,
  historyHours: 6
};
```

---

## Features

| Feature | Description |
|---------|-------------|
| **5 Views** | Score, Compare, 3D Floor Plan, Ambient, Timeline |
| **3D Visualization** | Three.js powered interactive floor plan |
| **Real-time Heatmaps** | Smooth color interpolation for temp/humidity |
| **Interactive Camera** | Rotate, zoom, pan with OrbitControls |
| **Real-time** | Live MQTT updates via WebSocket |
| **Auto-reconnect** | Handles network drops gracefully |
| **Comfort Score** | Weighted algorithm (temp 70%, humidity 30%) |
| **Auto-Insights** | Automatically generated observations |
| **Event Detection** | Peaks, valleys, rapid changes |
| **Cause Inference** | "Likely cause: Hot shower" |
| **Stale Detection** | Dims rooms with old data (>5 min) |
| **Responsive** | Works on tablets, phones, desktop |
| **Kiosk-ready** | Optimized for wall displays |
| **Dark Mode** | Auto-enables at night |
| **No Build Step** | Pure HTML/CSS/JS |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Comfort Score view |
| `2` | Bar Compare view |
| `3` | 3D Floor Plan view |
| `4` | Ambient view |
| `5` | Timeline view |
| `T` | Top view (in 3D Floor Plan) |
| `←` / `→` | Change room (Ambient) |
| `d` | Toggle dark mode (Ambient) |
| `a` | Toggle auto-rotate (Ambient)

---

## Tablet/Kiosk Setup

### For iPad/iPhone
1. Open `http://<mac-ip>:8888` in Safari
2. Share → Add to Home Screen
3. Settings → Guided Access for kiosk mode
4. Settings → Display → Auto-Lock → Never
5. Press `4` for Ambient view

### For Android
1. Open in Chrome
2. Menu → Install App / Add to Home Screen
3. Developer Options → Stay Awake
4. Press `4` for Ambient view

---

## Coexistence with Other Dashboards

| Dashboard | Use Case | URL |
|-----------|----------|-----|
| **Custom (this)** | Real-time multi-view | `http://localhost:8888` |
| Grafana | Historical analysis | `http://localhost:3333` |
| Home Assistant | Automation control | `http://localhost:8123` |

All run simultaneously - no conflicts.

---

## Troubleshooting

### "Offline" Status
```bash
# Check WebSocket is listening
ssh root@dietpi.local "netstat -tlnp | grep 9001"

# Check mosquitto logs
ssh root@dietpi.local "docker compose logs mosquitto --tail 20"
```

### No Data Displayed
```bash
# Verify sensors are publishing
ssh root@dietpi.local "docker exec mosquitto mosquitto_sub -t 'zigbee2mqtt/#' -v"
```

### Connection Refused
```bash
# Restart mosquitto
ssh root@dietpi.local "cd /root/zigbee && docker compose restart mosquitto"
```

### Debug in Browser Console
```javascript
// Check Alpine stores
Alpine.store('mqtt')        // Connection state
Alpine.store('rooms').list  // Room data

// Test MQTT connection
const client = mqtt.connect('ws://dietpi.local:9001');
client.on('connect', () => console.log('Connected!'));
client.subscribe('zigbee2mqtt/#');
client.on('message', (t, m) => console.log(t, JSON.parse(m.toString())));
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Alpine.js 3.x |
| State | Alpine.js Stores |
| 3D Rendering | Three.js (ES modules) |
| Camera Controls | OrbitControls |
| MQTT | MQTT.js (CDN) |
| Styling | Vanilla CSS |
| Fonts | Inter (Google Fonts) |
| Server | Python http.server |
| History | InfluxDB |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | Dec 7, 2025 | 3D Floor Plan view with Three.js, interactive heatmaps |
| 2.0 | Dec 7, 2025 | Multi-view architecture (5 visions) |
| 1.0 | Dec 6, 2025 | Initial single-view dashboard |
