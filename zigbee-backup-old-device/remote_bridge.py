#!/usr/bin/env python3
"""
IKEA Remote to Light Bridge via MQTT

This script bridges the IKEA remote control to the light
by listening for remote button presses and sending commands
to the light.

Run this in the background:
    python remote_bridge.py &

Or use nohup for persistence:
    nohup python remote_bridge.py > remote_bridge.log 2>&1 &
"""

import json
import paho.mqtt.client as mqtt

# Configuration (supports environment variables for Docker)
import os
MQTT_BROKER = os.environ.get("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
REMOTE_TOPIC = "zigbee2mqtt/study_ikea_remote"
LIGHT_TOPIC = "zigbee2mqtt/study_ikea_light/set"
BASE_TOPIC = "zigbee2mqtt"

# Track light state
light_state = {"state": "OFF", "brightness": 254, "color_temp": 370}

# Brightness step for hold actions
BRIGHTNESS_STEP = 25

# Color temperature presets (in mireds) - index 0=warm, 1=neutral, 2=cool
COLOR_TEMPS = [454, 370, 250]  # warm, neutral, cool
COLOR_NAMES = {250: "COOL (4000K)", 370: "NEUTRAL (2700K)", 454: "WARM (2200K)"}

# Track previous color index for ping-pong direction
previous_color_idx = None


def on_connect(client, userdata, flags, rc):
    """Called when connected to MQTT broker"""
    print(f"Connected to MQTT broker (rc={rc})")
    # Subscribe to remote and light topics
    client.subscribe(REMOTE_TOPIC)
    client.subscribe(f"{BASE_TOPIC}/study_ikea_light")
    print(f"Subscribed to {REMOTE_TOPIC}")
    print("Remote bridge is now active! Press remote buttons to control the light.")


def on_message(client, userdata, msg):
    """Handle incoming MQTT messages"""
    global light_state

    try:
        payload = json.loads(msg.payload)
    except json.JSONDecodeError:
        return

    # Update light state from light topic
    if msg.topic == f"{BASE_TOPIC}/study_ikea_light":
        if "state" in payload:
            light_state["state"] = payload["state"]
        if "brightness" in payload:
            light_state["brightness"] = payload["brightness"]
        if "color_temp" in payload:
            light_state["color_temp"] = payload["color_temp"]
        return

    # Handle remote actions
    if msg.topic == REMOTE_TOPIC and "action" in payload:
        action = payload["action"]
        print(f"Remote action: {action}")

        if action == "toggle":
            # Toggle light state
            new_state = "OFF" if light_state["state"] == "ON" else "ON"
            cmd = {"state": new_state}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            print(f"  -> Light {new_state}")

        elif action == "brightness_up_click":
            # Increase brightness
            new_brightness = min(254, light_state["brightness"] + BRIGHTNESS_STEP)
            cmd = {"brightness": new_brightness, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            print(f"  -> Brightness up to {new_brightness}")

        elif action == "brightness_down_click":
            # Decrease brightness
            new_brightness = max(1, light_state["brightness"] - BRIGHTNESS_STEP)
            cmd = {"brightness": new_brightness, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            print(f"  -> Brightness down to {new_brightness}")

        elif action == "brightness_up_hold":
            # Hold for max brightness
            cmd = {"brightness": 254, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            print(f"  -> Brightness MAX")

        elif action == "brightness_down_hold":
            # Hold for min brightness
            cmd = {"brightness": 1, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            print(f"  -> Brightness MIN")

        elif action == "arrow_left_click" or action == "arrow_right_click":
            global previous_color_idx
            is_right = (action == "arrow_right_click")

            current = light_state["color_temp"]
            # Find current index (0=warm, 1=neutral, 2=cool)
            try:
                current_idx = COLOR_TEMPS.index(current)
            except ValueError:
                current_idx = min(range(len(COLOR_TEMPS)),
                                 key=lambda i: abs(COLOR_TEMPS[i] - current))

            # FIX: At edges, both buttons go to NEUTRAL (only valid move)
            if current_idx == 0 or current_idx == 2:
                new_idx = 1
            else:
                # At NEUTRAL: determine direction from history
                if previous_color_idx is None:
                    natural_direction = 1  # Default toward cool
                elif previous_color_idx < current_idx:
                    natural_direction = 1  # Came from warm, going toward cool
                else:
                    natural_direction = -1  # Came from cool, going toward warm

                # RIGHT continues, LEFT reverses
                if is_right:
                    move = natural_direction
                else:
                    move = -natural_direction

                new_idx = max(0, min(2, current_idx + move))

            new_temp = COLOR_TEMPS[new_idx]
            cmd = {"color_temp": new_temp, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))

            # Optimistic update
            light_state["color_temp"] = new_temp
            previous_color_idx = current_idx

            print(f"  -> Color: {COLOR_NAMES[new_temp]}")

        elif action == "arrow_left_hold":
            # Hold left - jump to coolest
            cmd = {"color_temp": 250, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            light_state["color_temp"] = 250
            print(f"  -> Color: {COLOR_NAMES[250]} (coolest)")

        elif action == "arrow_right_hold":
            # Hold right - jump to warmest
            cmd = {"color_temp": 454, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            light_state["color_temp"] = 454
            print(f"  -> Color: {COLOR_NAMES[454]} (warmest)")

        elif action == "toggle_hold":
            # Long press center - could be used for pairing or special action
            # Let's use it to set a "reading" preset
            cmd = {"brightness": 200, "color_temp": 370, "state": "ON"}
            client.publish(LIGHT_TOPIC, json.dumps(cmd))
            print(f"  -> Reading mode (brightness 200, neutral white)")


def main():
    print("=" * 50)
    print("IKEA Remote to Light Bridge")
    print("=" * 50)
    print()

    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        print(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
