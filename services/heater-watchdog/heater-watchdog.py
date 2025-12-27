#!/usr/bin/env python3
"""
Heater Safety Watchdog - Independent safety monitor for heater-window violations.

PURPOSE:
  This is a BACKUP safety layer that runs independently of Home Assistant automations.
  It polls every 5 minutes to catch any edge cases where HA automations might fail.

LOGIC:
  IF any_window_open AND any_heater_heating THEN turn_off_ALL_heaters + notify

WHY NOT JUST USE HA AUTOMATIONS?
  HA automations are event-driven. This watchdog is poll-based and provides:
  1. Independent safety net (defense in depth)
  2. Catches edge cases (sensor unavailable->available, HA restart, etc.)
  3. Full audit trail of all checks
  4. Runs outside HA container (survives HA restarts)
"""

import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime

# =============================================================================
# CONFIGURATION
# =============================================================================

# Home Assistant connection
HA_URL = os.environ.get("HA_URL", "http://homeassistant:8123")
HA_TOKEN = os.environ.get("HA_TOKEN", "")  # REQUIRED: Long-lived access token

# Check interval (seconds)
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", 300))  # 5 minutes

# Notification service in Home Assistant
NOTIFY_SERVICE = os.environ.get("NOTIFY_SERVICE", "notify.mobile_app_22111317pg")

# Contact sensors (windows + doors) - "on" = open
CONTACT_SENSORS = [
    "binary_sensor.bath_window_contact_sensor_contact",
    "binary_sensor.bed_window_contact_sensor_contact",
    "binary_sensor.kitchen_window_contact_sensor_contact",
    "binary_sensor.study_window_contact_sensor_large_contact",
    "binary_sensor.study_window_contact_sensor_small_contact",
    "binary_sensor.living_window_contact_sensor_balcony_door_contact",
    "binary_sensor.living_window_contact_sensor_window_contact",
    "binary_sensor.hallway_window_contact_sensor_main_door_contact",
]

# Friendly names for logging
CONTACT_NAMES = {
    "binary_sensor.bath_window_contact_sensor_contact": "Bathroom Window",
    "binary_sensor.bed_window_contact_sensor_contact": "Bedroom Window",
    "binary_sensor.kitchen_window_contact_sensor_contact": "Kitchen Window",
    "binary_sensor.study_window_contact_sensor_large_contact": "Study Large Window",
    "binary_sensor.study_window_contact_sensor_small_contact": "Study Small Window",
    "binary_sensor.living_window_contact_sensor_balcony_door_contact": "Balcony Door",
    "binary_sensor.living_window_contact_sensor_window_contact": "Living Window",
    "binary_sensor.hallway_window_contact_sensor_main_door_contact": "Main Door",
}

# Thermostats - check hvac_action attribute for "heating"
THERMOSTATS = [
    "climate.study_thermostat",
    "climate.living_thermostat_inner",
    "climate.living_thermostat_outer",
    "climate.bed_thermostat",
]

THERMOSTAT_NAMES = {
    "climate.study_thermostat": "Study",
    "climate.living_thermostat_inner": "Living Inner",
    "climate.living_thermostat_outer": "Living Outer",
    "climate.bed_thermostat": "Bedroom",
}

# =============================================================================
# LOGGING
# =============================================================================


def log(msg, level="INFO"):
    """Log with timestamp and level."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {msg}", flush=True)


def log_banner():
    """Print startup banner."""
    print(
        """
================================================================================
       HEATER SAFETY WATCHDOG
       Independent safety monitor for heater-window violations
       Runs every 5 minutes as defense-in-depth layer
================================================================================
""",
        flush=True,
    )


# =============================================================================
# HOME ASSISTANT API
# =============================================================================


def ha_request(endpoint, method="GET", data=None):
    """Make authenticated request to Home Assistant API."""
    url = f"{HA_URL}/api/{endpoint}"
    headers = {
        "Authorization": f"Bearer {HA_TOKEN}",
        "Content-Type": "application/json",
    }

    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        log(f"HTTP error {e.code}: {e.reason}", "ERROR")
        raise
    except urllib.error.URLError as e:
        log(f"URL error: {e.reason}", "ERROR")
        raise


def get_entity_state(entity_id):
    """Get current state of an entity."""
    return ha_request(f"states/{entity_id}")


def call_service(domain, service, data=None):
    """Call a Home Assistant service."""
    return ha_request(f"services/{domain}/{service}", method="POST", data=data or {})


# =============================================================================
# CORE LOGIC
# =============================================================================


def get_open_windows():
    """Return list of open windows/doors."""
    open_windows = []
    for sensor in CONTACT_SENSORS:
        try:
            state = get_entity_state(sensor)
            if state.get("state") == "on":
                name = CONTACT_NAMES.get(sensor, sensor)
                open_windows.append(name)
        except Exception as e:
            log(f"Error checking {sensor}: {e}", "WARN")
    return open_windows


def get_heating_thermostats():
    """Return list of thermostats that are actively heating."""
    heating = []
    for thermostat in THERMOSTATS:
        try:
            state = get_entity_state(thermostat)
            attrs = state.get("attributes", {})
            hvac_action = attrs.get("hvac_action")
            if hvac_action == "heating":
                name = THERMOSTAT_NAMES.get(thermostat, thermostat)
                heating.append(name)
        except Exception as e:
            log(f"Error checking {thermostat}: {e}", "WARN")
    return heating


def turn_off_all_heaters():
    """Turn off all thermostats by setting hvac_mode to 'off'."""
    log("VIOLATION: Turning off ALL heaters", "WARN")
    try:
        call_service(
            "climate", "set_hvac_mode", {"entity_id": THERMOSTATS, "hvac_mode": "off"}
        )
        log("All heaters turned off successfully", "INFO")
        return True
    except Exception as e:
        log(f"FAILED to turn off heaters: {e}", "ERROR")
        return False


def send_notification(title, message, importance="max"):
    """Send mobile notification via Home Assistant."""
    log(f"Sending notification: {title}", "INFO")
    try:
        # Extract domain and service from notify.mobile_app_xxx
        parts = NOTIFY_SERVICE.split(".")
        domain = parts[0]  # "notify"
        service = parts[1]  # "mobile_app_22111317pg"

        call_service(
            domain,
            service,
            {
                "title": title,
                "message": message,
                "data": {
                    "channel": "Critical",
                    "importance": importance,
                    "tag": "heater_watchdog",
                },
            },
        )
        log("Notification sent successfully", "INFO")
        return True
    except Exception as e:
        log(f"FAILED to send notification: {e}", "ERROR")
        return False


def perform_safety_check():
    """Main safety check logic."""
    log("=" * 60)
    log("Performing safety check...")

    # Step 1: Get open windows
    open_windows = get_open_windows()
    log(
        f"Open windows/doors: {len(open_windows)} - {open_windows if open_windows else 'None'}"
    )

    # Step 2: Get heating thermostats
    heating = get_heating_thermostats()
    log(
        f"Heaters actively heating: {len(heating)} - {heating if heating else 'None'}"
    )

    # Step 3: Check for violation
    if open_windows and heating:
        # VIOLATION DETECTED
        log("!" * 60, "WARN")
        log("SAFETY VIOLATION: Windows open AND heaters running!", "WARN")
        log("!" * 60, "WARN")

        # Turn off all heaters
        turn_off_result = turn_off_all_heaters()

        # Send notification
        open_list = ", ".join(open_windows)
        heating_list = ", ".join(heating)

        send_notification(
            title="WATCHDOG: Heaters Emergency Off",
            message=(
                f"Safety violation detected!\n"
                f"Open: {open_list}\n"
                f"Heating: {heating_list}\n"
                f"All heaters have been turned off."
            ),
            importance="max",
        )

        log(f"Action taken: heaters_off={turn_off_result}", "INFO")
        return "VIOLATION"
    else:
        log("Safety check: OK", "INFO")
        return "OK"


# =============================================================================
# MAIN LOOP
# =============================================================================


def validate_config():
    """Validate required configuration."""
    if not HA_TOKEN:
        log("ERROR: HA_TOKEN environment variable is required!", "ERROR")
        log("Create a long-lived access token in Home Assistant:", "ERROR")
        log("  1. Profile (bottom left) -> Long-Lived Access Tokens", "ERROR")
        log("  2. Create Token -> Copy the token", "ERROR")
        log("  3. Set HA_TOKEN environment variable", "ERROR")
        return False
    return True


def test_ha_connection():
    """Test connection to Home Assistant."""
    log(f"Testing connection to {HA_URL}...")
    try:
        result = ha_request("")
        log(f"Connected to Home Assistant: {result.get('message', 'OK')}")
        return True
    except Exception as e:
        log(f"Failed to connect to Home Assistant: {e}", "ERROR")
        return False


def main():
    """Main entry point."""
    log_banner()
    log("Configuration:")
    log(f"  HA_URL: {HA_URL}")
    log(f"  CHECK_INTERVAL: {CHECK_INTERVAL}s ({CHECK_INTERVAL // 60}min)")
    log(f"  NOTIFY_SERVICE: {NOTIFY_SERVICE}")
    log(f"  Monitoring {len(CONTACT_SENSORS)} contact sensors")
    log(f"  Monitoring {len(THERMOSTATS)} thermostats")
    log("")

    # Validate configuration
    if not validate_config():
        return 1

    # Test connection
    if not test_ha_connection():
        log("Retrying in 30 seconds...", "WARN")
        time.sleep(30)
        if not test_ha_connection():
            log("Failed to connect after retry. Exiting.", "ERROR")
            return 1

    log("")
    log("Starting safety monitoring loop...")
    log("=" * 60)

    # Stats
    checks_total = 0
    violations_total = 0
    errors_total = 0
    start_time = datetime.now()

    while True:
        try:
            result = perform_safety_check()
            checks_total += 1
            if result == "VIOLATION":
                violations_total += 1
        except Exception as e:
            log(f"Error during safety check: {e}", "ERROR")
            errors_total += 1

        # Print stats every 12 checks (1 hour at 5min interval)
        if checks_total % 12 == 0:
            uptime = datetime.now() - start_time
            log("-" * 60)
            log(
                f"Stats: {checks_total} checks | {violations_total} violations | {errors_total} errors"
            )
            log(f"Uptime: {uptime}")
            log("-" * 60)

        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    exit(main() or 0)
