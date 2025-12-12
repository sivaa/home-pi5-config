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

## Version History

| Date | Change |
|------|--------|
| 2024-12-13 | Initial documentation - fixed InfluxDB queries and entity ID mapping |

---

*Last updated: December 13, 2024*
