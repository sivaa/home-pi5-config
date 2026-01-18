# MQTT-InfluxDB Bridge

> **Purpose:** Capture Zigbee events from MQTT and write to InfluxDB for timeline dashboard
> **Runtime:** Docker container (Node.js 20)
> **Port:** None (internal service)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  zigbee2mqtt ─────┐                                                 │
│                   │                                                 │
│  dashboard ───────┼──► MQTT Broker ──► mqtt-influx-bridge ──► InfluxDB │
│  (audit events)   │    (mosquitto)        (this service)             │
│                   │                                                 │
│  vibration ───────┘                                                 │
│  sensor                                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MQTT Topics Subscribed

| Topic | Purpose |
|-------|---------|
| `zigbee2mqtt/#` | All Zigbee device events (state changes, sensor readings) |
| `dashboard/audit/#` | Source tracking (was change from Dashboard or External?) |
| `homeassistant/tts/result` | TTS announcement results |
| `zigbee2mqtt/Vibration Sensor` | Hot water usage detection |

---

## InfluxDB Schema

### Measurement: `zigbee_events`

| Field | Type | Description |
|-------|------|-------------|
| `value` | FLOAT | Numeric value (temperature, humidity, etc.) |
| `state` | STRING | State description ("on", "off", "motion detected") |
| `brightness` | INTEGER | Light brightness (0-255) |

| Tag | Values | Description |
|-----|--------|-------------|
| `device_name` | Zigbee friendly name | Device identifier |
| `device_type` | motion, contact, light, plug, etc. | Device category |
| `room` | Study, Living, Bedroom, Kitchen, Bathroom | Location |
| `event_type` | motion_detected, door_opened, light_on, etc. | Event classification |
| `source` | Dashboard, External | Who triggered the change |

### Measurement: `tts_events`

| Field | Type | Description |
|-------|------|-------------|
| `message` | STRING | TTS message content |
| `success` | BOOLEAN | Whether announcement succeeded |
| `all_available` | BOOLEAN | All speakers available |
| `devices_available` | INTEGER | Count of available speakers |
| `devices_total` | INTEGER | Total speaker count |
| `devices_json` | STRING | JSON array of device status |

| Tag | Values |
|-----|--------|
| `automation` | Automation name (co2_high_alert, etc.) |
| `status` | success, partial, all_failed |

### Measurement: `hot_water`

| Field | Type | Description |
|-------|------|-------------|
| `running` | BOOLEAN | Is hot water flowing? |

| Tag | Values |
|-----|--------|
| `device_name` | Vibration Sensor |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MQTT_URL` | Yes | - | MQTT broker URL (mqtt://mosquitto:1883) |
| `MQTT_USER` | No | - | MQTT username |
| `MQTT_PASSWORD` | No | - | MQTT password |
| `INFLUX_URL` | Yes | - | InfluxDB URL (http://influxdb:8086) |
| `INFLUX_DB` | Yes | - | Database name (homeassistant) |
| `TZ` | No | UTC | Timezone |

---

## Event Types Tracked

### Motion Sensors
- `motion_detected` - PIR sensor triggered
- `motion_cleared` - PIR sensor cleared

### Contact Sensors
- `door_opened` - Contact sensor opened
- `door_closed` - Contact sensor closed

### Lights
- `light_on` - Light turned on
- `light_off` - Light turned off

### Plugs
- `plug_on` - Smart plug on
- `plug_off` - Smart plug off

### Thermostats
- `heating_started` - Valve opened (heating)
- `heating_stopped` - Valve closed
- `setpoint_changed` - Temperature target changed
- `mode_changed_heat` - Mode set to heat
- `mode_changed_off` - Mode set to off

### CO2 Sensor
- `co2_reading` - CO2 level update
- `air_quality_excellent` - Below 600 ppm
- `air_quality_moderate` - 600-1000 ppm
- `air_quality_poor` - Above 1000 ppm

### Device Status
- `device_online` - Device reconnected
- `device_offline` - Device disconnected

---

## Files

```
services/mqtt-influx-bridge/
├── CLAUDE.md          <- This file
├── Dockerfile         <- Node.js 20 Alpine image
├── package.json       <- Dependencies: mqtt, influx
└── src/
    ├── index.js       <- Main entry point
    ├── config.js      <- Environment config
    └── event-processor.js <- Message parsing logic
```

---

## Deployment

Defined in `configs/zigbee2mqtt/docker-compose.yml`:

```yaml
mqtt-influx-bridge:
  build:
    context: ../../services/mqtt-influx-bridge
  container_name: mqtt-influx-bridge
  restart: unless-stopped
  depends_on:
    - mosquitto
    - influxdb
  environment:
    - MQTT_URL=mqtt://mosquitto:1883
    - MQTT_USER=${MQTT_USER}
    - MQTT_PASSWORD=${MQTT_PASSWORD}
    - INFLUX_URL=http://influxdb:8086
    - INFLUX_DB=homeassistant
```

---

## Querying Data

```bash
# Recent events (last hour)
influx -database homeassistant -execute \
  "SELECT * FROM zigbee_events WHERE time > now() - 1h LIMIT 20"

# Hot water usage today
influx -database homeassistant -execute \
  "SELECT * FROM hot_water WHERE time > now() - 24h AND running = true"

# TTS failures
influx -database homeassistant -execute \
  "SELECT * FROM tts_events WHERE status != 'success' AND time > now() - 7d"
```

---

## Troubleshooting

### No Events Being Written

1. Check container logs: `docker logs mqtt-influx-bridge`
2. Verify MQTT connection: Look for "Connected to MQTT broker"
3. Test MQTT manually: `mosquitto_sub -h pi -t 'zigbee2mqtt/#' -C 1`

### Events Missing Source Tag

- Ensure dashboard is publishing to `dashboard/audit/` topic
- Check `event-processor.js` for source correlation logic

### High Memory Usage

- Stats printed every 5 minutes show message count
- If message backlog growing, check InfluxDB connectivity
