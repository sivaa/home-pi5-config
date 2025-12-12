#!/usr/bin/env python3
"""
Zigbee Binding Watchdog
=======================
Monitors IKEA light remotes via MQTT and auto-fixes stale bindings.

When a remote sends a brightness action but the light doesn't report
its new state within the timeout period, the script automatically
unbinds and rebinds the genLevelCtrl cluster to restore reporting.

Usage:
    python3 binding-watchdog.py

Runs as a systemd service on DietPi.
"""

import json
import time
import logging
from threading import Timer, Lock
from datetime import datetime
from typing import Dict, Optional

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt not installed. Run: pip3 install paho-mqtt")
    exit(1)

# =============================================================================
# Configuration
# =============================================================================

MQTT_BROKER = "localhost"
MQTT_PORT = 1883
Z2M_BASE_TOPIC = "zigbee2mqtt"
REPORT_TIMEOUT = 15  # seconds to wait for light to report after remote action
REBIND_COOLDOWN = 60  # seconds to wait between rebind attempts for same light

# Light/Remote pairs to monitor
MONITORED_PAIRS = [
    {
        "light": "Living Room Light",
        "remote": "Living Room Light Remote",
        "cluster": "genLevelCtrl"
    },
    {
        "light": "Study Room Light",
        "remote": "Study Room Light Remote",
        "cluster": "genLevelCtrl"
    }
]

# Actions that should trigger brightness reporting
BRIGHTNESS_ACTIONS = {
    "brightness_up_click",
    "brightness_up_hold",
    "brightness_up_release",
    "brightness_down_click",
    "brightness_down_hold",
    "brightness_down_release"
}

# =============================================================================
# Logging Setup
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# =============================================================================
# Watchdog Class
# =============================================================================

class BindingWatchdog:
    """Monitors MQTT for stale bindings and auto-fixes them."""

    def __init__(self):
        self.client: Optional[mqtt.Client] = None
        self.pending_expectations: Dict[str, Timer] = {}
        self.last_rebind: Dict[str, float] = {}
        self.lock = Lock()

        # Build lookup maps for fast access
        self.remote_to_light = {
            p["remote"]: p["light"] for p in MONITORED_PAIRS
        }
        self.light_to_config = {
            p["light"]: p for p in MONITORED_PAIRS
        }

    def connect(self):
        """Connect to MQTT broker."""
        self.client = mqtt.Client(client_id="binding-watchdog")
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        logger.info(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}")
        self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)

    def _on_connect(self, client, userdata, flags, rc):
        """Handle MQTT connection."""
        if rc == 0:
            logger.info("Connected to MQTT broker")

            # Subscribe to all monitored remotes and lights
            for pair in MONITORED_PAIRS:
                remote_topic = f"{Z2M_BASE_TOPIC}/{pair['remote']}"
                light_topic = f"{Z2M_BASE_TOPIC}/{pair['light']}"

                client.subscribe(remote_topic)
                client.subscribe(light_topic)
                logger.info(f"Subscribed to {remote_topic}")
                logger.info(f"Subscribed to {light_topic}")

            # Subscribe to bridge responses for rebind confirmation
            client.subscribe(f"{Z2M_BASE_TOPIC}/bridge/response/#")
        else:
            logger.error(f"Failed to connect to MQTT: rc={rc}")

    def _on_disconnect(self, client, userdata, rc):
        """Handle MQTT disconnection."""
        logger.warning(f"Disconnected from MQTT (rc={rc}), will reconnect...")

    def _on_message(self, client, userdata, msg):
        """Handle incoming MQTT messages."""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())

            # Extract device name from topic
            if not topic.startswith(Z2M_BASE_TOPIC + "/"):
                return
            device = topic[len(Z2M_BASE_TOPIC) + 1:]

            # Check if this is a remote action
            if device in self.remote_to_light:
                self._handle_remote_message(device, payload)

            # Check if this is a light state report
            elif device in self.light_to_config:
                self._handle_light_message(device, payload)

            # Check for rebind responses
            elif device.startswith("bridge/response/"):
                self._handle_bridge_response(device, payload)

        except json.JSONDecodeError:
            pass
        except Exception as e:
            logger.error(f"Error processing message: {e}")

    def _handle_remote_message(self, remote: str, payload: dict):
        """Handle a message from a remote control."""
        action = payload.get("action")
        if not action or action not in BRIGHTNESS_ACTIONS:
            return

        light = self.remote_to_light[remote]
        logger.info(f"Remote '{remote}' sent '{action}' -> expecting report from '{light}'")

        # Set expectation for light to report
        self._set_expectation(light)

    def _handle_light_message(self, light: str, payload: dict):
        """Handle a message from a light."""
        # If we have brightness in the payload, the light is reporting
        if "brightness" in payload:
            self._clear_expectation(light)

    def _handle_bridge_response(self, topic: str, payload: dict):
        """Handle bridge response messages."""
        if "bind" in topic or "unbind" in topic:
            status = payload.get("status", "unknown")
            data = payload.get("data", {})
            logger.info(f"Bridge response: {topic} -> {status} | {data}")

    def _set_expectation(self, light: str):
        """Set expectation that light should report within timeout."""
        with self.lock:
            # Cancel any existing timer
            if light in self.pending_expectations:
                self.pending_expectations[light].cancel()

            # Create new timer
            timer = Timer(REPORT_TIMEOUT, self._on_timeout, args=[light])
            timer.start()
            self.pending_expectations[light] = timer
            logger.debug(f"Expecting report from '{light}' within {REPORT_TIMEOUT}s")

    def _clear_expectation(self, light: str):
        """Clear expectation - light reported successfully."""
        with self.lock:
            if light in self.pending_expectations:
                self.pending_expectations[light].cancel()
                del self.pending_expectations[light]
                logger.debug(f"'{light}' reported successfully - binding healthy")

    def _on_timeout(self, light: str):
        """Handle timeout - light didn't report, binding may be stale."""
        with self.lock:
            if light in self.pending_expectations:
                del self.pending_expectations[light]

        logger.warning(f"TIMEOUT: '{light}' didn't report - possible stale binding!")
        self._attempt_rebind(light)

    def _attempt_rebind(self, light: str):
        """Attempt to fix stale binding by unbinding and rebinding."""
        now = time.time()

        # Check cooldown
        if light in self.last_rebind:
            elapsed = now - self.last_rebind[light]
            if elapsed < REBIND_COOLDOWN:
                logger.info(f"Skipping rebind for '{light}' - cooldown ({REBIND_COOLDOWN - elapsed:.0f}s remaining)")
                return

        config = self.light_to_config.get(light)
        if not config:
            logger.error(f"No config found for '{light}'")
            return

        cluster = config["cluster"]
        logger.info(f"AUTO-FIX: Rebinding '{cluster}' for '{light}'")
        self.last_rebind[light] = now

        # Step 1: Unbind
        unbind_payload = json.dumps({
            "from": light,
            "to": "Coordinator",
            "clusters": [cluster]
        })
        self.client.publish(
            f"{Z2M_BASE_TOPIC}/bridge/request/device/unbind",
            unbind_payload
        )
        logger.info(f"Sent unbind request for '{light}' cluster '{cluster}'")

        # Step 2: Wait and rebind
        def do_rebind():
            bind_payload = json.dumps({
                "from": light,
                "to": "Coordinator",
                "clusters": [cluster]
            })
            self.client.publish(
                f"{Z2M_BASE_TOPIC}/bridge/request/device/bind",
                bind_payload
            )
            logger.info(f"Sent bind request for '{light}' cluster '{cluster}'")

        # Schedule rebind after 3 seconds
        Timer(3.0, do_rebind).start()

    def run(self):
        """Run the watchdog."""
        self.connect()

        logger.info("=" * 60)
        logger.info("Zigbee Binding Watchdog Started")
        logger.info(f"Monitoring {len(MONITORED_PAIRS)} light/remote pairs")
        logger.info(f"Report timeout: {REPORT_TIMEOUT}s")
        logger.info(f"Rebind cooldown: {REBIND_COOLDOWN}s")
        logger.info("=" * 60)

        try:
            self.client.loop_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            self.client.disconnect()


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    watchdog = BindingWatchdog()
    watchdog.run()
