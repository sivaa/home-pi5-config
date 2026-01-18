# Pi Metrics Collector Service

## Purpose

Collects Raspberry Pi 5 system metrics every 60 seconds and publishes to:
- **MQTT**: `pi/system/metrics` (real-time dashboard updates)
- **InfluxDB**: `system_metrics` measurement (30-day historical charts)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PI METRICS COLLECTOR                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  System Files                                                   │
│  ├── /proc/stat              → CPU usage (%)                    │
│  ├── /sys/class/thermal/     → CPU temperature (°C)             │
│  │      thermal_zone0/temp                                      │
│  ├── /proc/meminfo           → Memory usage (%)                 │
│  ├── /sys/class/hwmon/*/     → Fan RPM                          │
│  │      fan1_input                                              │
│  └── /sys/class/hwmon/*/     → Fan PWM (0-255)                  │
│         pwm1                                                    │
│                                                                 │
│  pi-metrics-collector.py (systemd service)                      │
│       │                                                         │
│       ├─────────────────────────────┐                           │
│       ▼                             ▼                           │
│  MQTT Broker                   InfluxDB                         │
│  localhost:1883                localhost:8086                   │
│  Topic: pi/system/metrics      DB: homeassistant                │
│                                Measurement: system_metrics       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `pi-metrics-collector.py` | Main collector script |
| `requirements.txt` | Python dependencies |
| `/opt/pi-metrics-collector/` | Deployment location on Pi |
| `/etc/systemd/system/pi-metrics-collector.service` | Systemd unit |

---

## MQTT Payload Format

```json
{
  "timestamp": 1705580400000,
  "cpu_percent": 23.5,
  "cpu_temp": 55.6,
  "mem_percent": 45.2,
  "mem_used_mb": 3621,
  "mem_total_mb": 8192,
  "fan_rpm": 2805,
  "fan_pwm": 75,
  "fan_pwm_percent": 29.4,
  "fan_state": 1,
  "load_1m": 1.72,
  "load_5m": 1.45,
  "load_15m": 1.23
}
```

**Fan State Values (Pi 5):**
| State | Label | Description |
|-------|-------|-------------|
| 0 | Off | Fan not running |
| 1 | Low | Low speed cooling |
| 2 | Medium | Medium speed cooling |
| 3 | High | High speed cooling |
| 4 | Max | Maximum cooling |

---

## InfluxDB Schema

**Measurement:** `system_metrics`

| Field | Type | Description |
|-------|------|-------------|
| cpu_percent | FLOAT | CPU usage (0-100) |
| cpu_temp | FLOAT | CPU temperature (°C) |
| mem_percent | FLOAT | Memory usage (0-100) |
| mem_used_mb | FLOAT | Memory used (MB) |
| fan_rpm | INTEGER | Fan speed (RPM) |
| fan_pwm | INTEGER | Fan PWM raw (0-255) |
| fan_state | INTEGER | Pi 5 cooling state (0-4) |
| load_1m | FLOAT | 1-min load average |
| load_5m | FLOAT | 5-min load average |
| load_15m | FLOAT | 15-min load average |

---

## Deployment

```bash
# 1. Copy files to Pi
scp -r services/pi-metrics-collector pi@pi:/tmp/

# 2. Install on Pi
ssh pi@pi << 'EOF'
sudo mkdir -p /opt/pi-metrics-collector
sudo cp /tmp/pi-metrics-collector/*.py /opt/pi-metrics-collector/
sudo cp /tmp/pi-metrics-collector/requirements.txt /opt/pi-metrics-collector/
cd /opt/pi-metrics-collector
sudo pip3 install --break-system-packages -r requirements.txt
EOF

# 3. Install systemd service
scp configs/systemd/pi-metrics-collector.service pi@pi:/tmp/
ssh pi@pi "sudo cp /tmp/pi-metrics-collector.service /etc/systemd/system/ && \
           sudo systemctl daemon-reload && \
           sudo systemctl enable --now pi-metrics-collector"

# 4. Verify
ssh pi@pi "sudo systemctl status pi-metrics-collector"
ssh pi@pi "mosquitto_sub -h localhost -t 'pi/system/metrics' -C 1"
```

---

## Troubleshooting

```bash
# Check service status
sudo systemctl status pi-metrics-collector
sudo journalctl -u pi-metrics-collector -f

# Test script manually
python3 /opt/pi-metrics-collector/pi-metrics-collector.py

# Verify MQTT messages
mosquitto_sub -h localhost -t 'pi/system/metrics' -C 1

# Verify InfluxDB writes
influx -database homeassistant -execute "SELECT * FROM system_metrics ORDER BY time DESC LIMIT 5"

# Check fan sensor paths
ls -la /sys/class/hwmon/*/fan1_input
ls -la /sys/class/hwmon/*/pwm1
```

---

## Configuration

All settings are at the top of `pi-metrics-collector.py`:

```python
MQTT_HOST = 'localhost'
MQTT_PORT = 1883
MQTT_TOPIC = 'pi/system/metrics'

INFLUX_HOST = 'localhost'
INFLUX_PORT = 8086
INFLUX_DB = 'homeassistant'

COLLECTION_INTERVAL = 60  # seconds
```

No external config file needed - values are suitable for standard Pi setup.
