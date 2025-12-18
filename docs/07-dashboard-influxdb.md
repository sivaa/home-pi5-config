# Dashboard & InfluxDB Integration

> **Purpose**: Document the custom dashboard setup and how it queries historical data from InfluxDB.

---

## Architecture Overview

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      BROWSER                                │
                    │                                                             │
                    │   Dashboard (http://pi:8888)                               │
                    │       │                                                     │
                    │       ├── Live Data ──► WebSocket ──► Zigbee2MQTT/MQTT     │
                    │       │                                                     │
                    │       └── Historical ──► HTTP ──► /api/influx/ proxy       │
                    │                                                             │
                    └────────────────────────────┬────────────────────────────────┘
                                                 │
                    ┌────────────────────────────┴────────────────────────────────┐
                    │                      RASPBERRY PI                           │
                    │                                                             │
                    │   ┌──────────┐    ┌──────────────┐    ┌───────────────┐    │
                    │   │  Nginx   │    │ Home         │    │   InfluxDB    │    │
                    │   │  :8888   │────│ Assistant    │────│   :8086       │    │
                    │   └──────────┘    │  :8123       │    └───────────────┘    │
                    │        │          └──────────────┘           ▲             │
                    │        │                 │                   │             │
                    │   /api/influx/ ──────────┼───────────────────┘             │
                    │                          │                                  │
                    │                          ▼                                  │
                    │                  ┌──────────────┐    ┌───────────────┐     │
                    │                  │  Mosquitto   │◄───│ Zigbee2MQTT   │     │
                    │                  │  :1883/:9001 │    │               │     │
                    │                  └──────────────┘    └───────────────┘     │
                    │                                                             │
                    └─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Live Data (WebSocket/MQTT)
- Dashboard connects to `ws://pi:9001` (Mosquitto WebSocket)
- Subscribes to `zigbee2mqtt/#` topics
- Receives real-time sensor updates directly

### 2. Historical Data (InfluxDB)
- Dashboard queries `/api/influx/` (nginx proxy to InfluxDB:8086)
- Home Assistant writes sensor data to InfluxDB
- Data stored with specific measurement names and entity IDs

---

## InfluxDB Data Format

### Measurement Names

Home Assistant uses the **unit of measurement** as the InfluxDB measurement name:

| Sensor Type | Measurement Name | Example Query |
|-------------|------------------|---------------|
| Temperature | `°C` | `SELECT value FROM "°C" WHERE ...` |
| Humidity | `%` | `SELECT value FROM "%" WHERE ...` |
| Battery | `%` | `SELECT value FROM "%" WHERE ...` |
| Link Quality | `lqi` | `SELECT value FROM "lqi" WHERE ...` |

**Important**: The measurement names contain special characters and must be quoted in queries!

### Entity ID Format

The `entity_id` tag in InfluxDB follows this pattern:

```
<device_friendly_name>_<attribute>
```

| Room | Zigbee Friendly Name | InfluxDB entity_id (temp) | InfluxDB entity_id (humidity) |
|------|---------------------|---------------------------|-------------------------------|
| Living Room | `[Living] Temperature & Humidity` | `living_temperature_humidity_temperature` | `living_temperature_humidity_humidity` |
| Bedroom | `[Bed] Temperature & Humidity Sensor` | `bed_temperature_humidity_sensor_temperature` | `bed_temperature_humidity_sensor_humidity` |
| Study | `[Study] Temperature & Humidity` | `study_temperature_humidity_temperature` | `study_temperature_humidity_humidity` |
| Kitchen | `[Kitchen] Temperature & Humidity` | `kitchen_temperature_humidity_temperature` | `kitchen_temperature_humidity_humidity` |
| Bathroom | `[Bath] Temperature & Humidity` | `bath_temperature_humidity_temperature` | `bath_temperature_humidity_humidity` |
| Balcony | `[Balcony] Temperature & Humidity` | `balcony_temperature_humidity_temperature` | `balcony_temperature_humidity_humidity` |

**Note**: The `sensor.` prefix from Home Assistant entity IDs is NOT included in InfluxDB.

---

## Example Queries

### Temperature for Living Room (last 6 hours)
```sql
SELECT value FROM "°C"
WHERE entity_id = 'living_temperature_humidity_temperature'
AND time > now() - 6h
ORDER BY time ASC
```

### Humidity for Bedroom (last 24 hours)
```sql
SELECT value FROM "%"
WHERE entity_id = 'bed_temperature_humidity_sensor_humidity'
AND time > now() - 24h
ORDER BY time ASC
```

### Test Query via curl
```bash
# From Pi
curl -G 'http://localhost:8086/query' \
  --data-urlencode "db=homeassistant" \
  --data-urlencode "q=SELECT * FROM \"°C\" WHERE time > now() - 1h LIMIT 5"
```

---

## Dashboard Configuration

### Entity ID Mapping in index.html

The dashboard CONFIG maps rooms to Home Assistant entity IDs:

```javascript
const CONFIG = {
  influxUrl: '/api/influx',  // Uses nginx proxy
  influxDb: 'homeassistant',
  rooms: [
    { id: 'living',   entityId: 'sensor.living_temperature_humidity' },
    { id: 'bedroom',  entityId: 'sensor.bed_temperature_humidity_sensor' },
    { id: 'study',    entityId: 'sensor.study_temperature_humidity' },
    { id: 'kitchen',  entityId: 'sensor.kitchen_temperature_humidity' },
    { id: 'bathroom', entityId: 'sensor.bath_temperature_humidity' },
    { id: 'balcony',  entityId: 'sensor.balcony_temperature_humidity' }
  ]
};
```

The dashboard strips `sensor.` prefix and appends `_temperature` or `_humidity` for queries.

---

## Nginx Proxy Configuration

The dashboard uses `/api/influx/` to query InfluxDB, avoiding CORS issues:

```nginx
# In services/dashboard/nginx/dashboard.conf

location /api/influx/ {
    auth_basic off;
    proxy_pass http://influxdb:8086/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## Home Assistant InfluxDB Configuration

In `/opt/homeassistant/configuration.yaml`:

```yaml
influxdb:
  host: influxdb
  port: 8086
  database: homeassistant
  default_measurement: state
  include:
    entity_globs:
      - sensor.*temperature*
      - sensor.*humidity*
      - sensor.*battery*
```

---

## Troubleshooting

### No Historical Data in Dashboard

1. **Check InfluxDB is receiving data**:
   ```bash
   ssh pi@pi "curl -sG 'http://localhost:8086/query' \
     --data-urlencode 'db=homeassistant' \
     --data-urlencode 'q=SHOW MEASUREMENTS'"
   ```
   Should show `°C`, `%`, etc.

2. **Check entity IDs exist**:
   ```bash
   ssh pi@pi "curl -sG 'http://localhost:8086/query' \
     --data-urlencode 'db=homeassistant' \
     --data-urlencode 'q=SHOW TAG VALUES FROM \"°C\" WITH KEY = \"entity_id\"'"
   ```

3. **Test query directly**:
   ```bash
   ssh pi@pi "curl -sG 'http://localhost:8086/query' \
     --data-urlencode 'db=homeassistant' \
     --data-urlencode 'q=SELECT * FROM \"°C\" WHERE time > now() - 1h LIMIT 5'"
   ```

4. **Check nginx proxy works**:
   ```bash
   curl 'http://pi:8888/api/influx/ping'
   # Should return 204 No Content
   ```

### MQTT Integration Not Configured

If no data appears at all, Home Assistant MQTT integration may be missing:

1. Go to Home Assistant UI (http://pi:8123)
2. Settings > Devices & Services > Add Integration
3. Search "MQTT" and configure:
   - Broker: `mosquitto`
   - Port: `1883`

---

## Dashboard Views & Navigation

The dashboard features **14 different views** organized into a clean navigation system.

### Navigation Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│  🎯 Score │ 📊 Compare │ 🏠 Floor Plan │ 💡 Lights │ 🌡️ Ambient │ ••• More ▼│
└───────────────────────────────────────────────────────────────────────────┘
                                                                    │
                                                    ┌───────────────┴───────────────┐
                                                    │ 📈 MONITOR                    │
                                                    │    📖 Timeline (5)            │
                                                    │    💨 CO2 (0)                 │
                                                    │ 👁️ VISUALIZE                  │
                                                    │    🏗️ 3D (4)                  │
                                                    │    🔷 Isometric (I)           │
                                                    │    📡 Network (N)             │
                                                    │ 🎛️ CONTROL                    │
                                                    │    🔥 Heater (H)              │
                                                    │    📬 Mailbox (M)             │
                                                    │ 📺 DISPLAY                    │
                                                    │    🃏 Classic (8)             │
                                                    │ ⚙️ SETTINGS                   │
                                                    │    ⚙️ Config (9)              │
                                                    └───────────────────────────────┘
```

### All Views & Keyboard Shortcuts

| Key | View | Category | Description |
|-----|------|----------|-------------|
| `1` | 🎯 Score | Monitor | Overall comfort score with room breakdown |
| `2` | 📊 Compare | Monitor | Side-by-side room comparison bars |
| `3` | 🏠 Floor Plan | Visualize | 2D SVG floor plan with temp overlay |
| `4` | 🏗️ 3D | Visualize | Three.js 3D floor plan |
| `5` | 📖 Timeline | Monitor | Event timeline (heating, setpoints, etc.) |
| `6` | 🌡️ Ambient | Display | Minimal ambient display mode |
| `7` | 💡 Lights | Control | IKEA FLOALT light controls |
| `8` | 🃏 Classic | Display | Traditional card-based layout |
| `9` | ⚙️ Config | Settings | Sensor position configuration |
| `0` | 💨 CO2 | Monitor | CO2 monitoring with alerts |
| `I` | 🔷 Isometric | Visualize | Isometric 3D view |
| `N` | 📡 Network | Visualize | Zigbee network topology |
| `H` | 🔥 Heater | Control | Thermostat controls (SONOFF TRVZB) |
| `M` | 📬 Mailbox | Control | Mailbox vibration sensor monitor |

### View Configuration

Views are defined in `www/js/config.js`:

```javascript
export const VIEW_CATEGORIES = [
  {
    id: 'monitor',
    name: 'Monitor',
    icon: '📈',
    views: [
      { id: 'comfort', name: 'Score', icon: '🎯', key: '1', primary: true },
      { id: 'compare', name: 'Compare', icon: '📊', key: '2', primary: true },
      { id: 'timeline', name: 'Timeline', icon: '📖', key: '5' },
      { id: 'co2', name: 'CO2', icon: '💨', key: '0' }
    ]
  },
  // ... other categories
];

// Derived exports
export const ALL_VIEWS = VIEW_CATEGORIES.flatMap(cat => cat.views);
export const PRIMARY_VIEWS = ALL_VIEWS.filter(v => v.primary);
export const KEYBOARD_SHORTCUTS = Object.fromEntries(ALL_VIEWS.map(v => [v.key, v.id]));
```

### Adding a New View

1. Add view definition to `VIEW_CATEGORIES` in `www/js/config.js`
2. Create view component in `www/views/your-view.js`
3. Import and register in `www/js/app.js`
4. Add HTML template section in `www/index.html`
5. (Optional) Add view-specific CSS in `www/styles/views/`

---

## Pi Display Requirements

### Emoji Fonts

The dashboard uses emojis extensively. Install emoji fonts on the Pi:

```bash
sudo apt-get install fonts-noto-color-emoji
fc-cache -fv
```

### File Permissions

Ensure nginx can read all dashboard files:

```bash
# Fix permissions if CSS/JS doesn't load
find /opt/dashboard/www -type f -exec chmod 644 {} \;
find /opt/dashboard/www -type d -exec chmod 755 {} \;
```

---

## Version History

| Date | Change |
|------|--------|
| 2024-12-18 | Added navigation UX overhaul with grouped dropdown menu |
| 2024-12-18 | Documented Pi display requirements (emoji fonts, permissions) |
| 2024-12-13 | Initial documentation - fixed InfluxDB queries and entity ID mapping |

---

*Last updated: December 18, 2024*
