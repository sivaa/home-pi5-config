# Grafana Sensor Data Visualization

This guide covers the laptop-based visualization setup for temperature and humidity sensor data.

---

## 🎯 Quick Access - Live Dashboards

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         🏠 AURORA DASHBOARD SUITE                               │
│                     "Award-Winning Climate Visualization"                       │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  🏠 HOME CLIMATE HQ (Consolidated View)                                        │
│  └─ http://localhost:3333/d/home-climate-hq                                    │
│                                                                                │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐ │
│  │  🛋️ LIVING   │  🛏️ BEDROOM  │  📚 STUDY    │  🍳 KITCHEN  │  🚿 BATHROOM │ │
│  │  room-living │  room-bedroom│  room-study  │  room-kitchen│  room-bathroom│ │
│  │  -room       │              │              │              │              │ │
│  └──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

| Dashboard | URL | Description |
|-----------|-----|-------------|
| 🏠 **Home Climate HQ** | http://localhost:3333/d/home-climate-hq | All 5 rooms at a glance |
| 🛋️ Living Room | http://localhost:3333/d/room-living-room | Detailed living room view |
| 🛏️ Bedroom | http://localhost:3333/d/room-bedroom | Detailed bedroom view |
| 📚 Study | http://localhost:3333/d/room-study | Detailed study view |
| 🍳 Kitchen | http://localhost:3333/d/room-kitchen | Detailed kitchen view |
| 🚿 Bathroom | http://localhost:3333/d/room-bathroom | Detailed bathroom view |

---

## Architecture Overview

```
+---------------------------+          +---------------------------+
|    RASPBERRY PI 3B+       |          |      YOUR LAPTOP          |
|    (Data Collection)      |          |    (Visualization)        |
+---------------------------+          +---------------------------+
|                           |          |                           |
|  Zigbee Sensor            |          |  InfluxDB :8086           |
|       ↓                   |          |       ↑                   |
|  Zigbee2MQTT :8080        |          |       │                   |
|       ↓                   |          |  sync_ha_to_influx.py     |
|  Mosquitto :1883          |          |       ↑                   |
|       ↓                   |          |       │                   |
|  Home Assistant :8123     |---(scp)--+->  HA SQLite copy         |
|       ↓                   |          |                           |
|  SQLite (365 days)        |          |  Grafana :3333            |
+---------------------------+          +---------------------------+
```

## Why This Architecture?

- **Pi RAM preserved**: No additional services on resource-constrained Pi 3B+
- **Data never lost**: Home Assistant SQLite captures everything
- **Beautiful dashboards**: Grafana runs on laptop with plenty of resources
- **Sync when convenient**: Works even if laptop is away for weeks

## Quick Start

### 1. Start the Visualization Stack (on Laptop)

```bash
cd ~/zigbee-viz
docker compose up -d
```

### 2. Sync Data from Pi

```bash
# Make sure you have SSH key access to Pi
./auto_sync.sh
```

### 3. Open Grafana

- URL: http://localhost:3333
- Username: `admin`
- Password: `changeme` (change this!)

## Files Overview

| File | Purpose |
|------|---------|
| `docker-compose.yml` | InfluxDB + Grafana stack |
| `sync_ha_to_influx.py` | Import HA data to InfluxDB |
| `auto_sync.sh` | Auto-sync when Pi is reachable |
| `requirements.txt` | Python dependencies |
| `grafana/provisioning/` | Auto-configure Grafana data source |

## Manual Sync Steps

If the auto-sync doesn't work, here's the manual process:

```bash
# 1. Download HA database from Pi
scp pi@<PI_IP>:/home/homeassistant/.homeassistant/home-assistant_v2.db /tmp/

# 2. Install Python dependencies
cd ~/zigbee-viz
pip install -r requirements.txt

# 3. Run sync script
python3 sync_ha_to_influx.py
```

## Setting Up Auto-Sync

### Option A: Cron Job (Linux/macOS)

Add to crontab (`crontab -e`):

```cron
# Sync every hour when on home network
0 * * * * /Users/siva/zigbee-viz/auto_sync.sh --cron
```

### Option B: LaunchAgent (macOS)

Create `~/Library/LaunchAgents/com.zigbee-viz.sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.zigbee-viz.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/siva/zigbee-viz/auto_sync.sh</string>
        <string>--cron</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
```

Load with: `launchctl load ~/Library/LaunchAgents/com.zigbee-viz.sync.plist`

## Creating Grafana Dashboards

### Sensor Reference Table

| Room | Entity ID (Temperature) | Entity ID (Humidity) |
|------|------------------------|---------------------|
| Living Room | `sensor.living_room_trh_1_temperature` | `sensor.living_room_trh_1_humidity` |
| Bed Room | `sensor.bed_room_trh_2_temperature` | `sensor.bed_room_trh_2_humidity` |
| Study Room | `sensor.study_room_trh_3_temperature` | `sensor.study_room_trh_3_humidity` |
| Kitchen | `sensor.kitchen_trh_4_temperature` | `sensor.kitchen_trh_4_humidity` |
| Bath Room | `sensor.bath_room_trh_5_temperature` | `sensor.bath_room_trh_5_humidity` |

---

### Dashboard 1: All Rooms Temperature Overview

**Panel: Multi-Room Temperature Comparison**

```
┌──────────────────────────────────────────────────────────────────────┐
│  🌡️  ALL ROOMS TEMPERATURE                                    [24h] │
│  ────────────────────────────────────────────────────────────────── │
│  28°C ┤                                                              │
│       │    ╭──╮      Living Room (Blue)                              │
│  26°C ┤   ╱    ╲     Bed Room (Green)                                │
│       │  ╱      ╲    Study Room (Orange)                             │
│  24°C ┤ ╱        ╲   Kitchen (Red)                                   │
│       │╱          ╲  Bath Room (Purple)                              │
│  22°C ┤            ╲─────                                            │
│       └──────────────────────────────────────────────────────────── │
│       00:00    06:00    12:00    18:00    24:00                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Query (InfluxDB):**

```sql
-- Living Room
SELECT mean("value") FROM "temperature"
WHERE "entity_id" = 'sensor.living_room_trh_1_temperature'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Bed Room
SELECT mean("value") FROM "temperature"
WHERE "entity_id" = 'sensor.bed_room_trh_2_temperature'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Study Room
SELECT mean("value") FROM "temperature"
WHERE "entity_id" = 'sensor.study_room_trh_3_temperature'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Kitchen
SELECT mean("value") FROM "temperature"
WHERE "entity_id" = 'sensor.kitchen_trh_4_temperature'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Bath Room
SELECT mean("value") FROM "temperature"
WHERE "entity_id" = 'sensor.bath_room_trh_5_temperature'
AND $timeFilter GROUP BY time($__interval) fill(null)
```

**Panel Settings:**
- Y-axis: Unit = Celsius, Min = 15, Max = 35
- Legend: Show, Bottom, As Table
- Colors: Blue, Green, Orange, Red, Purple

---

### Dashboard 2: All Rooms Humidity Overview

**Panel: Multi-Room Humidity Comparison**

```
┌──────────────────────────────────────────────────────────────────────┐
│  💧  ALL ROOMS HUMIDITY                                       [24h] │
│  ────────────────────────────────────────────────────────────────── │
│  80% ┤                  ╭─╮                                          │
│      │    Bath Room ────╯ ╰──── (Usually highest)                    │
│  60% ┤ ╭─────────────────────╮                                       │
│      │ │   Living/Bed/Study   │                                      │
│  40% ┤ ╰─────────────────────╯                                       │
│      │    Kitchen ──────────── (Usually lowest)                      │
│  20% ┤                                                               │
│      └──────────────────────────────────────────────────────────── │
│       00:00    06:00    12:00    18:00    24:00                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Query (InfluxDB):**

```sql
-- Living Room
SELECT mean("value") FROM "humidity"
WHERE "entity_id" = 'sensor.living_room_trh_1_humidity'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Bed Room
SELECT mean("value") FROM "humidity"
WHERE "entity_id" = 'sensor.bed_room_trh_2_humidity'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Study Room
SELECT mean("value") FROM "humidity"
WHERE "entity_id" = 'sensor.study_room_trh_3_humidity'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Kitchen
SELECT mean("value") FROM "humidity"
WHERE "entity_id" = 'sensor.kitchen_trh_4_humidity'
AND $timeFilter GROUP BY time($__interval) fill(null)

-- Bath Room
SELECT mean("value") FROM "humidity"
WHERE "entity_id" = 'sensor.bath_room_trh_5_humidity'
AND $timeFilter GROUP BY time($__interval) fill(null)
```

**Panel Settings:**
- Y-axis: Unit = Percent (0-100), Min = 0, Max = 100
- Legend: Show, Bottom, As Table
- Colors: Blue, Green, Orange, Red, Purple

---

### Dashboard 3: Current Stats (Single Stat Panels)

**Layout:**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  📊  CURRENT READINGS                                                      │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────┤
│  🛋️ LIVING   │  🛏️ BEDROOM  │  📚 STUDY    │  🍳 KITCHEN  │  🚿 BATHROOM │
│              │              │              │              │              │
│    24.5°C    │    23.2°C    │    25.1°C    │    26.3°C    │    27.8°C    │
│    ───────   │    ───────   │    ───────   │    ───────   │    ───────   │
│    58% 💧    │    52% 💧    │    48% 💧    │    45% 💧    │    72% 💧    │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

**Query for Single Stat (repeat for each room):**

```sql
-- Living Room Temperature (Single Stat)
SELECT last("value") FROM "temperature"
WHERE "entity_id" = 'sensor.living_room_trh_1_temperature'
AND $timeFilter
```

**Thresholds (Temperature):**
- Green: 18-26°C (Comfortable)
- Yellow: 26-28°C (Warm)
- Red: >28°C (Hot) or <18°C (Cold)

**Thresholds (Humidity):**
- Green: 40-60% (Ideal)
- Yellow: 60-70% or 30-40% (Acceptable)
- Red: >70% (Too humid) or <30% (Too dry)

---

### Dashboard 4: Daily Min/Max Summary

```
┌──────────────────────────────────────────────────────────────────────┐
│  📈  DAILY TEMPERATURE RANGE                               [7 days] │
│  ────────────────────────────────────────────────────────────────── │
│  Room         │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │           │
│  ─────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤           │
│  Living Room  │22-26│21-25│22-27│23-28│22-26│21-25│20-24│           │
│  Bed Room     │20-24│19-23│20-25│21-26│20-24│19-23│18-22│           │
│  Study Room   │23-27│22-26│23-28│24-29│23-27│22-26│21-25│           │
│  Kitchen      │24-28│23-27│24-29│25-30│24-28│23-27│22-26│           │
│  Bath Room    │25-29│24-28│25-30│26-31│25-29│24-28│23-27│           │
└──────────────────────────────────────────────────────────────────────┘
```

**Query (Bar Gauge or Table):**

```sql
-- Daily min/max for Living Room
SELECT min("value"), max("value") FROM "temperature"
WHERE "entity_id" = 'sensor.living_room_trh_1_temperature'
AND $timeFilter GROUP BY time(1d)
```

## Troubleshooting

### Sync script fails to connect

```bash
# Test SSH connection
ssh pi@<PI_IP>

# If it asks for password, set up SSH keys:
ssh-copy-id pi@<PI_IP>
```

### InfluxDB not running

```bash
cd ~/zigbee-viz
docker compose up -d
docker compose logs influxdb
```

### No data in Grafana

1. Check InfluxDB has data:
   ```bash
   docker exec -it influxdb influx -database homeassistant \
     -execute "SELECT * FROM temperature LIMIT 5"
   ```

2. Verify data source configuration in Grafana:
   - Settings → Data Sources → InfluxDB
   - Test connection

### Sync state issues

Reset the sync state to re-import all data:

```bash
rm ~/.zigbee-viz-sync-state.json
./auto_sync.sh
```

## Data Retention

- **Home Assistant (Pi)**: 365 days (configured in `configuration.yaml`)
- **InfluxDB (Laptop)**: Forever (default retention policy)

To create a custom retention policy:

```bash
docker exec -it influxdb influx -execute \
  "CREATE RETENTION POLICY forever ON homeassistant DURATION INF REPLICATION 1 DEFAULT"
```

## Alerts

**Note**: Grafana alerts only work when your laptop is running.

For 24/7 alerts, use Home Assistant automations instead. See `homeassistant/automations.yaml`.

Example alert automation in Home Assistant:

```yaml
- alias: "High Temperature Alert"
  trigger:
    - platform: numeric_state
      entity_id: sensor.bath_room_th_nd_sensor_temperature
      above: 30
      for: "00:05:00"
  action:
    - service: notify.mobile_app
      data:
        message: "Bathroom temp is {{ states('sensor.bath_room_th_nd_sensor_temperature') }}C!"
```
