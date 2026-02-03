#!/usr/bin/env python3
"""
Pi System Metrics Collector

Collects system metrics (CPU, memory, fan) every 60 seconds and:
- Publishes to MQTT topic: pi/system/metrics
- Writes to InfluxDB measurement: system_metrics

Designed for Raspberry Pi 5 running Debian.
"""

import json
import time
import glob
import logging
from datetime import datetime

import paho.mqtt.client as mqtt
from influxdb import InfluxDBClient

# Configuration
MQTT_HOST = 'localhost'
MQTT_PORT = 1883
MQTT_TOPIC = 'pi/system/metrics'

INFLUX_HOST = 'localhost'
INFLUX_PORT = 8086
INFLUX_DB = 'homeassistant'

COLLECTION_INTERVAL = 60  # seconds

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class MetricsCollector:
    """Collects system metrics from /sys and /proc filesystems."""

    def __init__(self):
        self._prev_cpu_stats = None
        self._fan_rpm_path = None
        self._fan_pwm_path = None
        self._find_fan_paths()

    def _find_fan_paths(self):
        """Find fan sensor paths in /sys/class/hwmon."""
        # Try common paths for Pi 5 fan
        rpm_patterns = [
            '/sys/devices/platform/cooling_fan/hwmon/*/fan1_input',
            '/sys/class/hwmon/*/fan1_input'
        ]
        pwm_patterns = [
            '/sys/devices/platform/cooling_fan/hwmon/*/pwm1',
            '/sys/class/hwmon/*/pwm1'
        ]

        for pattern in rpm_patterns:
            matches = glob.glob(pattern)
            if matches:
                self._fan_rpm_path = matches[0]
                break

        for pattern in pwm_patterns:
            matches = glob.glob(pattern)
            if matches:
                self._fan_pwm_path = matches[0]
                break

        if self._fan_rpm_path:
            logger.info(f'Fan RPM path: {self._fan_rpm_path}')
        else:
            logger.warning('Fan RPM sensor not found')

        if self._fan_pwm_path:
            logger.info(f'Fan PWM path: {self._fan_pwm_path}')
        else:
            logger.warning('Fan PWM sensor not found')

    def read_cpu_temp(self) -> float:
        """Read CPU temperature in Celsius."""
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                # Value is in millidegrees
                return int(f.read().strip()) / 1000.0
        except Exception as e:
            logger.error(f'Failed to read CPU temp: {e}')
            return 0.0

    def read_cpu_percent(self) -> float:
        """
        Calculate CPU usage percentage from /proc/stat.
        Uses delta between two readings (stored in self._prev_cpu_stats).
        """
        try:
            with open('/proc/stat', 'r') as f:
                line = f.readline()

            # Parse: cpu user nice system idle iowait irq softirq steal guest guest_nice
            parts = line.split()
            if parts[0] != 'cpu':
                return 0.0

            values = [int(x) for x in parts[1:]]

            # Total and idle time
            idle = values[3] + values[4]  # idle + iowait
            total = sum(values)

            if self._prev_cpu_stats is None:
                self._prev_cpu_stats = (idle, total)
                return 0.0

            prev_idle, prev_total = self._prev_cpu_stats
            self._prev_cpu_stats = (idle, total)

            idle_delta = idle - prev_idle
            total_delta = total - prev_total

            if total_delta == 0:
                return 0.0

            cpu_percent = (1.0 - (idle_delta / total_delta)) * 100.0
            return round(cpu_percent, 1)

        except Exception as e:
            logger.error(f'Failed to read CPU percent: {e}')
            return 0.0

    def read_memory(self) -> dict:
        """Read memory usage from /proc/meminfo."""
        try:
            meminfo = {}
            with open('/proc/meminfo', 'r') as f:
                for line in f:
                    parts = line.split(':')
                    if len(parts) == 2:
                        key = parts[0].strip()
                        # Remove 'kB' suffix and convert to int
                        value = parts[1].strip().replace(' kB', '')
                        meminfo[key] = int(value)

            total_kb = meminfo.get('MemTotal', 0)
            available_kb = meminfo.get('MemAvailable', 0)
            used_kb = total_kb - available_kb

            total_mb = total_kb / 1024
            used_mb = used_kb / 1024

            percent = (used_kb / total_kb * 100) if total_kb > 0 else 0

            return {
                'total_mb': round(total_mb, 0),
                'used_mb': round(used_mb, 0),
                'percent': round(percent, 1)
            }

        except Exception as e:
            logger.error(f'Failed to read memory: {e}')
            return {'total_mb': 0, 'used_mb': 0, 'percent': 0}

    def read_fan_rpm(self) -> int:
        """Read fan speed in RPM."""
        if not self._fan_rpm_path:
            return 0
        try:
            with open(self._fan_rpm_path, 'r') as f:
                return int(f.read().strip())
        except Exception as e:
            logger.error(f'Failed to read fan RPM: {e}')
            return 0

    def read_fan_pwm(self) -> dict:
        """Read fan PWM value (0-255) and convert to percentage."""
        if not self._fan_pwm_path:
            return {'raw': 0, 'percent': 0}
        try:
            with open(self._fan_pwm_path, 'r') as f:
                raw = int(f.read().strip())
                percent = round(raw / 255 * 100, 1)
                return {'raw': raw, 'percent': percent}
        except Exception as e:
            logger.error(f'Failed to read fan PWM: {e}')
            return {'raw': 0, 'percent': 0}

    def read_fan_state(self) -> int:
        """
        Read Pi 5 cooling state (0-4).
        0=off, 1=low, 2=medium, 3=high, 4=max
        """
        try:
            with open('/sys/class/thermal/cooling_device0/cur_state', 'r') as f:
                return int(f.read().strip())
        except Exception as e:
            logger.error(f'Failed to read fan state: {e}')
            return 0

    def read_load_average(self) -> dict:
        """Read system load averages."""
        try:
            with open('/proc/loadavg', 'r') as f:
                parts = f.read().split()
                return {
                    '1m': float(parts[0]),
                    '5m': float(parts[1]),
                    '15m': float(parts[2])
                }
        except Exception as e:
            logger.error(f'Failed to read load average: {e}')
            return {'1m': 0, '5m': 0, '15m': 0}

    def collect_all(self) -> dict:
        """Collect all metrics."""
        memory = self.read_memory()
        fan_pwm = self.read_fan_pwm()
        load = self.read_load_average()

        return {
            'timestamp': int(time.time() * 1000),
            'cpu_percent': self.read_cpu_percent(),
            'cpu_temp': self.read_cpu_temp(),
            'mem_percent': memory['percent'],
            'mem_used_mb': memory['used_mb'],
            'mem_total_mb': memory['total_mb'],
            'fan_rpm': self.read_fan_rpm(),
            'fan_pwm': fan_pwm['raw'],
            'fan_pwm_percent': fan_pwm['percent'],
            'fan_state': self.read_fan_state(),
            'load_1m': load['1m'],
            'load_5m': load['5m'],
            'load_15m': load['15m']
        }


class MqttPublisher:
    """Publishes metrics to MQTT broker."""

    # ┌─────────────────────────────────────────────────────────────┐
    # │ HARD RESET: Nuclear option for stuck MQTT connections       │
    # │                                                             │
    # │ INCIDENT (Feb 2026): The old code called reconnect()        │
    # │ manually in publish() while loop_start()'s background       │
    # │ thread was ALSO trying to reconnect. Two threads fighting   │
    # │ over one socket = _on_connect callback never fires:         │
    # │                                                             │
    # │   Main thread         Background thread (loop_start)        │
    # │   ┌──────────┐        ┌──────────────────┐                  │
    # │   │reconnect()│───X───│auto-reconnect    │                  │
    # │   │poll 5s... │       │manages socket    │                  │
    # │   │timeout!   │       │confused state    │                  │
    # │   └──────────┘        └──────────────────┘                  │
    # │                                                             │
    # │ Result: 41 hours of "MQTT not connected" while mosquitto    │
    # │ logs showed connections arriving and immediately dropping.  │
    # │                                                             │
    # │ FIX: Let loop_start() handle reconnection exclusively.     │
    # │ If it fails for >5min, tear everything down and start      │
    # │ fresh — no conflicting reconnect paths.                    │
    # └─────────────────────────────────────────────────────────────┘
    HARD_RESET_AFTER = 300  # seconds (5 minutes)

    def __init__(self, host: str, port: int, topic: str):
        self.host = host
        self.port = port
        self.topic = topic
        self.client = None
        self._connected = False
        self._disconnected_at = None

    def _create_client(self):
        """Create a fresh MQTT client instance."""
        self.client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id='pi-metrics-collector'
        )
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect

    def connect(self):
        """Connect to MQTT broker."""
        try:
            self._create_client()
            self.client.connect(self.host, self.port, keepalive=60)
            self.client.loop_start()
        except Exception as e:
            logger.error(f'MQTT connection failed: {e}')
            self._disconnected_at = time.time()

    def _on_connect(self, client, userdata, connect_flags, reason_code, properties):
        if reason_code.is_failure:
            logger.error(f'MQTT connection failed: {reason_code}')
            if self._disconnected_at is None:
                self._disconnected_at = time.time()
        else:
            logger.info('Connected to MQTT broker')
            self._connected = True
            self._disconnected_at = None

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        logger.warning(f'Disconnected from MQTT broker (reason={reason_code})')
        self._connected = False
        if self._disconnected_at is None:
            self._disconnected_at = time.time()

    def _hard_reset(self):
        """Tear down and recreate MQTT client from scratch."""
        logger.warning('Performing MQTT hard reset — creating fresh client')
        try:
            if self.client is not None:
                self.client.loop_stop()
                self.client.disconnect()
        except Exception as e:
            logger.debug(f'Ignoring error during MQTT teardown (expected): {e}')
        self._connected = False
        self._disconnected_at = None
        self.connect()

    def publish(self, metrics: dict):
        """Publish metrics to MQTT topic."""
        if not self._connected:
            disconnected_at = self._disconnected_at  # snapshot for thread safety
            if disconnected_at is not None:
                down_secs = int(time.time() - disconnected_at)
                if down_secs > self.HARD_RESET_AFTER:
                    logger.error(
                        f'MQTT disconnected for {down_secs}s (>{self.HARD_RESET_AFTER}s) '
                        f'— triggering hard reset'
                    )
                    self._hard_reset()
                else:
                    logger.warning(
                        f'MQTT not connected ({down_secs}s), '
                        f'waiting for auto-reconnect...'
                    )
            else:
                self._disconnected_at = time.time()
                logger.warning('MQTT not connected, waiting for auto-reconnect...')
            return

        try:
            payload = json.dumps(metrics)
            # ┌─────────────────────────────────────────────────────────┐
            # │ retain=True: New subscribers get last value immediately │
            # │                                                        │
            # │ Without retain, the dashboard must wait up to 60s      │
            # │ (collection interval) after subscribing for the first  │
            # │ value. With retain, the broker stores the last message │
            # │ and delivers it instantly to any new subscriber.       │
            # │                                                        │
            # │ SAFETY: Dashboard uses payload.timestamp (not          │
            # │ Date.now()) for staleness detection, so old retained   │
            # │ messages correctly show as "Data Stale".               │
            # └─────────────────────────────────────────────────────────┘
            self.client.publish(self.topic, payload, qos=0, retain=True)
            logger.debug(f'Published to {self.topic}')
        except Exception as e:
            logger.error(f'MQTT publish failed: {e}')

    def disconnect(self):
        """Disconnect from MQTT broker."""
        try:
            if self.client is not None:
                self.client.loop_stop()
                self.client.disconnect()
        except Exception as e:
            logger.warning(f'Error during MQTT disconnect (ignoring): {e}')


class InfluxWriter:
    """Writes metrics to InfluxDB."""

    def __init__(self, host: str, port: int, database: str):
        self.host = host
        self.port = port
        self.database = database
        self.client = None

    def connect(self):
        """Connect to InfluxDB."""
        try:
            self.client = InfluxDBClient(
                host=self.host,
                port=self.port,
                database=self.database
            )
            # Ensure database exists
            self.client.create_database(self.database)
            logger.info(f'Connected to InfluxDB at {self.host}:{self.port}')
        except Exception as e:
            logger.error(f'InfluxDB connection failed: {e}')

    def write(self, metrics: dict):
        """Write metrics to InfluxDB."""
        if not self.client:
            logger.warning('InfluxDB not connected, skipping write')
            return

        try:
            point = {
                'measurement': 'system_metrics',
                'time': datetime.utcnow().isoformat() + 'Z',
                'fields': {
                    'cpu_percent': float(metrics['cpu_percent']),
                    'cpu_temp': float(metrics['cpu_temp']),
                    'mem_percent': float(metrics['mem_percent']),
                    'mem_used_mb': float(metrics['mem_used_mb']),
                    'fan_rpm': int(metrics['fan_rpm']),
                    'fan_pwm': int(metrics['fan_pwm']),
                    'fan_state': int(metrics['fan_state']),
                    'load_1m': float(metrics['load_1m']),
                    'load_5m': float(metrics['load_5m']),
                    'load_15m': float(metrics['load_15m'])
                }
            }
            self.client.write_points([point])
            logger.debug('Wrote metrics to InfluxDB')
        except Exception as e:
            logger.error(f'InfluxDB write failed: {e}')

    def close(self):
        """Close InfluxDB connection."""
        if self.client:
            self.client.close()


def main():
    """Main loop: collect and publish metrics every 60 seconds."""
    logger.info('Starting Pi Metrics Collector')
    logger.info(f'Collection interval: {COLLECTION_INTERVAL}s')
    logger.info(f'MQTT: {MQTT_HOST}:{MQTT_PORT}/{MQTT_TOPIC}')
    logger.info(f'InfluxDB: {INFLUX_HOST}:{INFLUX_PORT}/{INFLUX_DB}')

    collector = MetricsCollector()
    mqtt_pub = MqttPublisher(MQTT_HOST, MQTT_PORT, MQTT_TOPIC)
    influx = InfluxWriter(INFLUX_HOST, INFLUX_PORT, INFLUX_DB)

    # Connect to services
    mqtt_pub.connect()
    influx.connect()

    # Wait for MQTT connection
    time.sleep(2)

    # Initial read to prime CPU delta calculation
    collector.read_cpu_percent()
    time.sleep(1)

    try:
        while True:
            start_time = time.time()

            # Collect metrics
            metrics = collector.collect_all()
            logger.info(
                f'CPU: {metrics["cpu_percent"]}%, '
                f'Temp: {metrics["cpu_temp"]}°C, '
                f'Mem: {metrics["mem_percent"]}%, '
                f'Fan: {metrics["fan_rpm"]} RPM (state={metrics["fan_state"]})'
            )

            # Publish to MQTT and InfluxDB
            mqtt_pub.publish(metrics)
            influx.write(metrics)

            # Sleep for remaining interval time
            elapsed = time.time() - start_time
            sleep_time = max(0, COLLECTION_INTERVAL - elapsed)
            time.sleep(sleep_time)

    except KeyboardInterrupt:
        logger.info('Shutting down...')
    finally:
        mqtt_pub.disconnect()
        influx.close()


if __name__ == '__main__':
    main()
