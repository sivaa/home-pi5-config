# 🏠 Multi-View Smart Home Dashboard

> **7 Ways to Monitor and Control Your Smart Home**
> Climate monitoring + IKEA light control with Apple-inspired design

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  🏠 Home Climate              ● LIVE                      Sat, Dec 7 · 5:30 PM       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│ [🎯 Score] [📊 Compare] [🏠 Floor] [🌡️ Ambient] [📖 Timeline] [🃏 Classic] [💡 Lights]│
│     ●          ○           ○           ○            ○            ○           ○       │
│                                                                                      │
│  ╭────────────────────────────────────────────────────────────────────────────╮     │
│  │                                                                             │     │
│  │                      CURRENTLY SHOWING:                                     │     │
│  │                                                                             │     │
│  │              One of 7 beautiful dashboard views                             │     │
│  │                                                                             │     │
│  │    🎯 Comfort Score - Single glanceable number (0-100)                     │     │
│  │    📊 Bar Compare  - Side-by-side room comparison                          │     │
│  │    🏠 Floor Plan   - Spatial heat map visualization                        │     │
│  │    🌡️ Ambient      - Giant display for wall tablets                        │     │
│  │    📖 Timeline     - Your home's daily climate story                       │     │
│  │    🃏 Classic      - Original card-based grid layout                       │     │
│  │    💡 Lights       - IKEA FLOALT light control panel                       │     │
│  │                                                                             │     │
│  ╰────────────────────────────────────────────────────────────────────────────╯     │
│                                                                                      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ● Connected │ 5 sensors │ 2 lights │ Last update: 2s ago                            │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎬 The 7 Dashboard Views

### 🎯 Vision 1: Comfort Score Dashboard
> *"One number to rule them all"*

Transform complex multi-room data into a single, instantly understandable comfort score.

```
                    ╭─────────────╮
                    │     78      │
                    │  ─────────  │
                    │ COMFORTABLE │
                    ╰─────────────╯

        [🛋️ 82] [🛏️ 85] [📚 76] [🍳 71] [🚿 68]
           Living  Bedroom  Study  Kitchen  Bath
```

**Features:**
- Giant animated score circle (0-100)
- Room score pills below
- Comfort spectrum visualization
- Smart suggestions ("Open window in Study")

---

### 📊 Vision 2: Bar Comparison Dashboard
> *"See differences instantly through visual comparison"*

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
```

**Features:**
- Horizontal bar charts with comfort zones
- Sort by temperature/humidity/name/score
- Auto-generated insights
- Click bar to expand details

---

### 🗺️ Vision 3: Floor Plan Heat Map
> *"Your home has a shape — your data should too"*

Based on actual apartment layout with real measurements:

```
    WEST                                                                   EAST
    ┌───────┬─────────────────────────────┬─────────────────────────────┬──────┐
    │       │                             │                             │ 🚪   │
    │ Balc. │      LIVING ROOM            │         BEDROOM             │ Door │
    │ 1.05m │     (4.75m × 3.97m)         │      (4.49m × 3.38m)        │      │
    │       │         24.5°               │          22.8°              │      │
    │       │                         🛋️   │                         🛏️  │      │
    ├───────┴─────────────────────────────┼──────────────┬──────────────┴──────┤
    │  Window                             │   HALLWAY    │            Window   │
    ├─────────────────────────────────────┤  (2.4m wide) ├─────────────────────┤
    │                                     │              │                     │
    │        STUDY ROOM                   │              │       KITCHEN       │
    │      (4.89m × 3.7m)                 │              │    (3.2m × 2.14m)   │
    │          25.2°                      │              │        26.1°        │
    │                                 📚   │              │                 🍳  │
    │                                     │              ├─────────────────────┤
    │                                     │              │      BATHROOM       │
    │                                     │              │   (3.15m × 1.42m)   │
    │                                     │              │        27.4°        │
    │                                     │              │                 🚿  │
    │  Window                             │              │            Window   │
    └─────────────────────────────────────┴──────────────┴─────────────────────┘

    LEGEND: Heat map colors based on temperature (18°C blue → 32°C red)

    Layout Features:
    • Balcony (west) → Living Room → Bedroom → Main Door (east)
    • Central hallway connects all rooms
    • Study Room (southwest), Kitchen + Bathroom stacked (southeast)
    • Windows on west (Living/Study) and east (Bedroom/Kitchen/Bath) walls
```

**Features:**
- SVG floor plan matching actual apartment layout
- Real room dimensions from floor plan (in meters)
- Toggle between temperature/humidity views
- Click any room for detailed history
- Color interpolation for smooth gradients
- Balcony, hallway, door, and window indicators

---

### 🌡️ Vision 4: Minimal Ambient Display
> *"Glanceable temperature from across the room"*

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                                                               ║
║                           24.5°                               ║
║                                                               ║
║                        LIVING ROOM                            ║
║                            58%                                ║
║                                                               ║
║                                                               ║
║              ●     ○     ○     ○     ○                        ║
║             24°   23°   25°   26°   27°                       ║
║                                                               ║
║                    ← swipe to change room →                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

**Features:**
- Giant 180px+ temperature display
- Swipe left/right to change rooms
- Auto-rotate mode (10s per room)
- Dark mode auto-enables at night (10 PM - 6 AM)
- Tap for details overlay

---

### 📖 Vision 5: Timeline Story View
> *"Data is a story — tell it that way"*

```
NOW ────────────────●
                    │
                    │  🛋️ Living Room · 24.5° · 58%
    5:30 PM         │  All 5 rooms are currently comfortable
                    │
────────────────────┼──────────────────────────────────────
                    │
                    │  🚿 BATHROOM PEAKED
    4:00 PM         │  Temperature hit 29° (highest today)
                    │  💡 Likely cause: Hot shower
                    │
────────────────────┼──────────────────────────────────────
                    │
                    │  🍳 KITCHEN HEATING EVENT
    2:15 PM         │  Rose 4° in 30 minutes (22° → 26°)
                    │  💡 Likely cause: Cooking activity
                    │
────────────────────●
    MIDNIGHT
```

**Features:**
- Chronological event timeline
- Peak/valley detection
- Rapid change alerts
- Cause inference (shower, cooking, sun)
- Pattern recognition badges

---

### 🃏 Vision 6: Classic Cards View
> *"The original Apple-inspired grid design"*

The classic view preserves the original dashboard design with room cards in a grid layout.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│   ┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────┐ │
│   │ 🛋️ Living Room    ● │   │ 🛏️ Bedroom       ● │   │ 📚 Study      ● │ │
│   │                     │   │                     │   │                 │ │
│   │     24.5°    💧58%  │   │     22.8°    💧52%  │   │   25.2°  💧48% │ │
│   │                     │   │                     │   │                 │ │
│   │  ╭──────────────╮   │   │  ╭──────────────╮   │   │ ╭────────────╮ │ │
│   │  │ ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒ │   │   │  │ ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒ │   │   │ │⌒⌒⌒⌒⌒⌒⌒⌒⌒│ │ │
│   │  ╰──────────────╯   │   │  ╰──────────────╯   │   │ ╰────────────╯ │ │
│   └─────────────────────┘   └─────────────────────┘   └─────────────────┘ │
│                                                                           │
│   ┌─────────────────────┐   ┌─────────────────────┐                       │
│   │ 🍳 Kitchen       ● │   │ 🚿 Bathroom      ● │                       │
│   │                     │   │                     │                       │
│   │     26.1°    💧45%  │   │     27.4°    💧72%  │                       │
│   │                     │   │                     │                       │
│   │  ╭──────────────╮   │   │  ╭──────────────╮   │                       │
│   │  │ ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒ │   │   │  │ ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒ │   │                       │
│   │  ╰──────────────╯   │   │  ╰──────────────╯   │                       │
│   └─────────────────────┘   └─────────────────────┘                       │
│                                                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │  HOME AVERAGE                                                       │ │
│   │       24.0°C                  55%              ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒   │ │
│   │    Temperature             Humidity               History           │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Grid of room cards with temperature and humidity
- Comfort indicator dot (green/yellow/red) on each card
- Sparkline charts showing recent history
- Dark-themed home average summary card
- Click any card for detailed room view
- Responsive 2-column layout on mobile

---

### 💡 Vision 7: Lights Control Panel
> *"Control your IKEA lights with style"*

A dedicated control panel for IKEA FLOALT panel lights.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            💡 Light Control                                 │
│                  Control your IKEA FLOALT panel lights                      │
│                                                                             │
│                    ┌──────────────────────────────┐                        │
│                    │   ☀️  All Lights On           │                        │
│                    └──────────────────────────────┘                        │
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │  📚 Study Light        [ON] │  │  🛋️ Living Room Light  [ON] │          │
│  │                             │  │                              │          │
│  │  🔆 Brightness     ████░ 80%│  │  🔆 Brightness     ██████ 100%│          │
│  │  🌡️ Color Temp    Warm White│  │  🌡️ Color Temp     Neutral  │          │
│  │                             │  │                              │          │
│  │  [📖] [🌅] [☀️] [🌙]        │  │  [📖] [🌅] [☀️] [🌙]         │          │
│  │  Read  Relax Bright Night   │  │  Read  Relax Bright Night    │          │
│  │                             │  │                              │          │
│  │  📶 156  •  Just now        │  │  📶 142  •  Just now         │          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                             │
│                          Quick Scenes                                       │
│            [🎬 Movie] [💼 Work] [🌆 Evening] [😴 Goodnight]                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- On/Off toggle switch for each light
- Brightness slider (1-254 scale, displayed as %)
- Color temperature slider (warm 454 ↔ cool 250 mireds)
- Quick presets: Reading, Relax, Bright, Night
- Scene buttons: Movie, Work, Evening, Goodnight
- "All Lights" master toggle
- Link quality and last update indicators
- Real-time MQTT state sync

**Supported Devices:**
- IKEA FLOALT L1528 LED Panel (Study Room)
- IKEA FLOALT L1528 LED Panel (Living Room)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER/TABLET                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Alpine.js Application                       │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                     Alpine Stores                         │   │   │
│  │  │  $store.mqtt    - Connection state, messages              │   │   │
│  │  │  $store.rooms   - Room data, history, averages            │   │   │
│  │  │  $store.config  - Settings, preferences                   │   │   │
│  │  │  $store.roomDetail - Modal state                          │   │   │
│  │  │  $store.navigation - Current view state                   │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                              │                                   │   │
│  │  ┌───────────────────────────┼───────────────────────────────┐  │   │
│  │  │                    7 View Components                       │  │   │
│  │  │                                                            │  │   │
│  │  │  comfortScoreView()  barCompareView()  floorPlanView()    │  │   │
│  │  │  ambientView()       timelineView()    classicView()      │  │   │
│  │  │  lightsView()                                              │  │   │
│  │  └────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ WebSocket (MQTT.js)                      │
│                              ▼                                          │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               │ ws://dietpi.local:9001
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DIETPI SERVER                                    │
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│  │  Mosquitto  │ ◄── │ Zigbee2MQTT │ ◄── │   Sonoff    │              │
│  │   Broker    │     │  Container  │     │  SNZB-02P   │              │
│  │  :1883/:9001│     │             │     │  (5 rooms)  │              │
│  └─────────────┘     └─────────────┘     └─────────────┘              │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐                                                       │
│  │  InfluxDB   │  ◄── Historical data for timeline/charts              │
│  │  :8086      │                                                       │
│  └─────────────┘                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
dashboard/
├── index.html                 # Main app (~2800 lines, all-in-one)
├── CLAUDE.md                  # This documentation
│
├── utils/                     # Utility modules
│   ├── mqtt-client.js         # MQTT connection class
│   ├── comfort-algo.js        # Comfort score calculations
│   └── insights.js            # Auto-insight generation
│
├── components/                # Reusable components
│   ├── navigation.js          # Tab navigation
│   └── room-detail.js         # Room detail modal
│
├── views/                     # Dashboard view modules
│   ├── comfort-score.js       # Vision 1: Comfort Score
│   ├── bar-compare.js         # Vision 2: Bar Comparison
│   ├── floor-plan.js          # Vision 3: Floor Plan
│   ├── ambient.js             # Vision 4: Ambient Display
│   ├── timeline.js            # Vision 5: Timeline
│   ├── classic.js             # Vision 6: Classic Cards
│   └── lights.js              # Vision 7: Lights Control
│
└── styles/                    # CSS modules
    └── base.css               # Design tokens & shared styles
```

> **Note:** All components are currently inlined in `index.html` for simplicity.
> The modular files exist for reference and future extraction.

---

## ⚙️ Configuration

Edit the `CONFIG` object in `index.html`:

```javascript
const CONFIG = {
  // MQTT WebSocket broker
  mqttUrl: 'ws://dietpi.local:9001',
  baseTopic: 'zigbee2mqtt',

  // InfluxDB for historical data
  influxUrl: '/api/influx',
  influxDb: 'homeassistant',

  // Room definitions
  rooms: [
    { id: 'living',   name: 'Living Room', icon: '🛋️', sensor: 'Living Room TRH (1)', entityId: 'sensor.living_room_trh_1' },
    { id: 'bedroom',  name: 'Bedroom',     icon: '🛏️', sensor: 'Bed Room TRH (2)',    entityId: 'sensor.bed_room_trh_2' },
    { id: 'study',    name: 'Study',       icon: '📚', sensor: 'Study Room TRH (3)',  entityId: 'sensor.study_room_trh_3' },
    { id: 'kitchen',  name: 'Kitchen',     icon: '🍳', sensor: 'Kitchen TRH (4)',     entityId: 'sensor.kitchen_trh_4' },
    { id: 'bathroom', name: 'Bathroom',    icon: '🚿', sensor: 'Bath Room TRH (5)',   entityId: 'sensor.bath_room_trh_5' }
  ],

  // Thresholds
  staleThreshold: 5 * 60 * 1000,   // 5 minutes
  maxHistoryPoints: 500,
  historyHours: 6
};
```

---

## 🧮 Comfort Score Algorithm

The comfort score (0-100) combines temperature and humidity:

```javascript
// Temperature contributes 70% of score
// Humidity contributes 30% of score

IDEAL_TEMP     = { min: 20, max: 26, perfect: 23 }
IDEAL_HUMIDITY = { min: 40, max: 60, perfect: 50 }

// Room weights for home average
WEIGHTS = {
  'Living Room': 1.5,   // Most used
  'Bedroom':     1.3,   // Sleep quality matters
  'Study':       1.0,   // Normal
  'Kitchen':     0.8,   // Expect variation
  'Bathroom':    0.5    // Expect humidity spikes
}
```

| Score | Label | Color |
|-------|-------|-------|
| 90-100 | Perfect | Green |
| 75-89 | Comfortable | Light Green |
| 60-74 | Okay | Yellow |
| 40-59 | Uncomfortable | Orange |
| 0-39 | Poor | Red |

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Switch to Comfort Score view |
| `2` | Switch to Bar Compare view |
| `3` | Switch to Floor Plan view |
| `4` | Switch to Ambient view |
| `5` | Switch to Timeline view |
| `6` | Switch to Classic view |
| `7` | Switch to Lights view |
| `←` / `→` | Navigate rooms (Ambient view) |
| `d` | Toggle dark mode (Ambient view) |
| `a` | Toggle auto-rotate (Ambient view) |

---

## 🚀 Quick Start

```bash
# 1. Navigate to dashboard directory
cd ~/pyrepos/siva-personal/zigbee/dashboard

# 2. Start local HTTP server
python3 -m http.server 8888

# 3. Open in browser
open http://localhost:8888
```

### Prerequisites
1. ✅ Mosquitto with WebSocket listener on port 9001
2. ✅ Port 9001 exposed in docker-compose.yml
3. ✅ Sensors publishing to `zigbee2mqtt/<sensor_name>`

---

## 🎨 Design System

### Color Palette

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-primary` | #007AFF | Interactive elements |
| `--color-success` | #34C759 | Comfortable, good |
| `--color-warning` | #FF9500 | Attention needed |
| `--color-danger` | #FF3B30 | Alert, hot |
| `--color-info` | #5AC8FA | Information |

### Temperature Colors

| Zone | Color | Temperature |
|------|-------|-------------|
| Cold | #90CAF9 | < 18°C |
| Cool | #A5D6A7 | 18-22°C |
| Comfortable | #81C784 | 22-26°C |
| Warm | #FFE082 | 26-28°C |
| Hot | #FFAB91 | 28-32°C |
| Very Hot | #EF5350 | > 32°C |

### Typography

| Element | Size | Weight |
|---------|------|--------|
| Giant temp (Ambient) | clamp(100px, 30vw, 220px) | 200 |
| Score number | 96px | 200 |
| Section title | 20px | 600 |
| Body text | 16px | 400 |
| Labels | 14px | 500 |
| Captions | 12px | 400 |

---

## 📱 Tablet/Kiosk Setup

### For Wall-Mounted Display

1. **Open** `http://<mac-ip>:8888` in browser
2. **Add to Home Screen** for app-like experience
3. **Enable kiosk mode**:
   - iOS: Settings → Guided Access
   - Android: Developer Options → Stay Awake
4. **Disable auto-lock** to prevent screen sleep
5. **Switch to Ambient view** (press `4`) for best wall display

### Recommended: Ambient View Settings
- Auto-rotate: ON (cycles rooms every 10 seconds)
- Dark mode: Auto (dims at 10 PM - 6 AM)
- Orientation: Landscape

---

## 🔧 Troubleshooting

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

### Historical Data Not Loading
```bash
# Check InfluxDB is accessible
curl http://dietpi.local:8086/ping

# Test query
curl -G 'http://dietpi.local:8086/query' \
  --data-urlencode "db=homeassistant" \
  --data-urlencode "q=SHOW MEASUREMENTS"
```

### Debug in Browser Console
```javascript
// Check MQTT connection state
Alpine.store('mqtt')

// Check room data
Alpine.store('rooms').list

// Test MQTT manually
const client = mqtt.connect('ws://dietpi.local:9001');
client.on('connect', () => console.log('Connected!'));
client.subscribe('zigbee2mqtt/#');
client.on('message', (t, m) => console.log(t, JSON.parse(m.toString())));
```

---

## 🔄 MQTT Topics

### Climate Sensors
| Room | Topic |
|------|-------|
| Living Room | `zigbee2mqtt/Living Room TRH (1)` |
| Bedroom | `zigbee2mqtt/Bed Room TRH (2)` |
| Study | `zigbee2mqtt/Study Room TRH (3)` |
| Kitchen | `zigbee2mqtt/Kitchen TRH (4)` |
| Bathroom | `zigbee2mqtt/Bath Room TRH (5)` |

### IKEA Lights
| Light | Subscribe Topic | Control Topic |
|-------|-----------------|---------------|
| Study Light | `zigbee2mqtt/Study Room Light` | `zigbee2mqtt/Study Room Light/set` |
| Living Room Light | `zigbee2mqtt/Living Room Light` | `zigbee2mqtt/Living Room Light/set` |

### Expected Message Formats

**Climate Sensor:**
```json
{
  "temperature": 24.5,
  "humidity": 58,
  "battery": 100,
  "linkquality": 156
}
```

**Light State:**
```json
{
  "state": "ON",
  "brightness": 254,
  "color_temp": 370,
  "linkquality": 156
}
```

**Light Control Commands:**
```json
// Toggle on/off
{ "state": "ON" }
{ "state": "OFF" }

// Set brightness (1-254)
{ "brightness": 200 }

// Set color temperature (250=cool, 454=warm mireds)
{ "color_temp": 370 }
```

---

## 📊 Coexistence with Other Dashboards

| Dashboard | Purpose | URL |
|-----------|---------|-----|
| **This (Custom)** | Real-time multi-view | `http://localhost:8888` |
| Grafana | Historical analysis | `http://localhost:3333` |
| Home Assistant | Automation control | `http://localhost:8123` |

All run simultaneously without conflicts.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Alpine.js 3.x |
| State Management | Alpine.js Stores |
| MQTT Client | MQTT.js (CDN) |
| Styling | Vanilla CSS with Custom Properties |
| Fonts | Inter (Google Fonts) |
| Server | Python http.server |
| Data Storage | InfluxDB (historical) |

---

## 📅 Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.4 | Dec 7, 2025 | Added Lights Control Panel (7th vision) - IKEA FLOALT light control with brightness, color temp, presets, and scenes |
| 2.3 | Dec 7, 2025 | Fixed Floor Plan layout: corrected room positions (hallway in center, Kitchen/Bathroom stacked on right), proper balcony/door/window positions |
| 2.2 | Dec 7, 2025 | Floor Plan updated with actual apartment layout |
| 2.1 | Dec 7, 2025 | Added Classic view (6th vision) - original card design preserved |
| 2.0 | Dec 7, 2025 | Multi-view architecture with 5 visions |
| 1.0 | Dec 6, 2025 | Initial single-view dashboard |

---

*Documentation updated: December 7, 2025*
