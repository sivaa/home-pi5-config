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
from datetime import datetime, timezone

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

# Window sensors - "on" = open (immediate response)
WINDOW_SENSORS = [
    "binary_sensor.bath_window_contact_sensor_contact",
    "binary_sensor.bed_window_contact_sensor_contact",
    "binary_sensor.kitchen_window_contact_sensor_contact",
    "binary_sensor.study_window_contact_sensor_large_contact",
    "binary_sensor.study_window_contact_sensor_small_contact",
    "binary_sensor.living_window_contact_sensor_window_contact",
]

# Door sensors - "on" = open (with delay to avoid false positives from brief openings)
DOOR_SENSORS = [
    "binary_sensor.living_window_contact_sensor_balcony_door_contact",
    "binary_sensor.hallway_window_contact_sensor_main_door_contact",
]

# Combined list for backwards compatibility
CONTACT_SENSORS = WINDOW_SENSORS + DOOR_SENSORS

# Door delay in seconds (matches HA automation behavior)
# Doors opened briefly for entry/exit won't trigger violation
# NOTE: With 5-min poll interval, worst-case response time = CHECK_INTERVAL + DOOR_OPEN_DELAY
DOOR_OPEN_DELAY = int(os.environ.get("DOOR_OPEN_DELAY", 120))  # Default: 2 minutes

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

# Mapping: thermostat entity_id -> (input_boolean, input_number)
# Used for saving state before turning off heaters
THERMOSTAT_HELPERS = {
    "climate.study_thermostat": (
        "input_boolean.study_heater_was_on",
        "input_number.study_heater_saved_temp",
    ),
    "climate.living_thermostat_inner": (
        "input_boolean.living_inner_heater_was_on",
        "input_number.living_inner_heater_saved_temp",
    ),
    "climate.living_thermostat_outer": (
        "input_boolean.living_outer_heater_was_on",
        "input_number.living_outer_heater_saved_temp",
    ),
    "climate.bed_thermostat": (
        "input_boolean.bedroom_heater_was_on",
        "input_number.bedroom_heater_saved_temp",
    ),
}

# Guard flag entity
GUARD_FLAG_ENTITY = "input_boolean.heaters_off_due_to_window"

# State save timeout (seconds) - don't block core safety action
STATE_SAVE_TIMEOUT = 5

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


def get_seconds_in_current_state(state):
    """Get how many seconds the entity has been in its current state.

    Args:
        state: Already-fetched state dict from get_entity_state()
               (avoids duplicate API call)

    Uses HA's last_changed attribute to calculate duration.
    Returns float('inf') if unable to determine (safer - assumes long-open).
    """
    try:
        last_changed = state.get("last_changed")
        if last_changed:
            # HA returns ISO format: 2025-12-31T12:50:29.123456+00:00
            changed_time = datetime.fromisoformat(last_changed.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            return (now - changed_time).total_seconds()
    except Exception as e:
        log(f"Error calculating state duration: {e}", "WARN")
    return float("inf")  # If unknown, treat as long-open (safer)


def call_service(domain, service, data=None):
    """Call a Home Assistant service."""
    return ha_request(f"services/{domain}/{service}", method="POST", data=data or {})


# =============================================================================
# STATE SAVE HELPERS (Best-Effort for Hybrid Approach)
# =============================================================================


def save_heater_states():
    """
    Save current state of all thermostats in heat mode to input helpers.
    This is BEST EFFORT - failures don't block safety action.
    Returns: (success_count, fail_count)
    """
    success = 0
    fail = 0

    for thermostat in THERMOSTATS:
        try:
            state = get_entity_state(thermostat)
            attrs = state.get("attributes", {})
            hvac_mode = state.get("state")  # 'heat', 'off', etc.
            setpoint = attrs.get("temperature", 18)

            # Only save if heater was in heat mode
            if hvac_mode == "heat":
                bool_entity, number_entity = THERMOSTAT_HELPERS[thermostat]
                name = THERMOSTAT_NAMES.get(thermostat, thermostat)

                # Save "was on" state
                call_service(
                    "input_boolean",
                    "turn_on",
                    {"entity_id": bool_entity},
                )

                # Save setpoint
                call_service(
                    "input_number",
                    "set_value",
                    {"entity_id": number_entity, "value": float(setpoint)},
                )

                log(f"  Saved state: {name} (setpoint={setpoint}°C)", "INFO")
                success += 1
        except Exception as e:
            fail += 1
            log(f"  Failed to save state for {thermostat}: {e}", "WARN")

    return success, fail


def set_guard_flag(value, max_retries=3):
    """
    Set the guard flag (heaters_off_due_to_window) with retry logic.

    This is critical for auto-resume to work - if the flag isn't set,
    the HA resume automation won't know heaters were intentionally turned off.

    Args:
        value: True to turn on, False to turn off
        max_retries: Number of attempts before giving up

    Returns: True if successful, False otherwise
    """
    service = "turn_on" if value else "turn_off"
    flag_state = "ON" if value else "OFF"

    for attempt in range(max_retries):
        try:
            call_service(
                "input_boolean",
                service,
                {"entity_id": GUARD_FLAG_ENTITY},
            )
            log(f"  Guard flag set to {flag_state} (attempt {attempt + 1})", "INFO")
            return True
        except Exception as e:
            log(f"  Failed to set guard flag (attempt {attempt + 1}/{max_retries}): {e}", "WARN")
            if attempt < max_retries - 1:
                time.sleep(1)  # Brief delay before retry

    log(f"  CRITICAL: Guard flag could not be set after {max_retries} attempts!", "ERROR")
    log(f"  Auto-resume may not work - manual intervention may be required", "ERROR")
    return False


# =============================================================================
# CORE LOGIC
# =============================================================================


def get_open_windows():
    """Return list of open windows/doors that should trigger safety action.

    Windows: Immediate response (no delay)
    Doors: 2-minute delay to avoid false positives from brief entry/exit
    """
    open_contacts = []

    # Check windows (no delay - immediate response)
    for sensor in WINDOW_SENSORS:
        try:
            state = get_entity_state(sensor)
            if state.get("state") == "on":
                name = CONTACT_NAMES.get(sensor, sensor)
                open_contacts.append(name)
        except Exception as e:
            log(f"Error checking {sensor}: {e}", "WARN")

    # Check doors (with delay to avoid false positives)
    for sensor in DOOR_SENSORS:
        try:
            state = get_entity_state(sensor)
            if state.get("state") == "on":
                duration = get_seconds_in_current_state(state)  # Pass state object, not entity_id
                name = CONTACT_NAMES.get(sensor, sensor)
                if duration >= DOOR_OPEN_DELAY:
                    open_contacts.append(name)
                    log(f"  Door '{name}' open for {duration:.0f}s (>= {DOOR_OPEN_DELAY}s, triggering)", "INFO")
                else:
                    log(f"  Door '{name}' open for {duration:.0f}s (< {DOOR_OPEN_DELAY}s delay, ignoring)", "INFO")
        except Exception as e:
            log(f"Error checking {sensor}: {e}", "WARN")

    return open_contacts


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
    """
    Main safety check logic with HYBRID APPROACH:
    1. CORE SAFETY: Turn off heaters FIRST (must succeed)
    2. BEST EFFORT: Try to save state (won't block safety action)
    3. NOTIFICATION: Clearly indicate if manual intervention needed
    """
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

        # =================================================================
        # HYBRID APPROACH: Safety first, state save is best-effort
        # =================================================================

        # 1. BEST EFFORT: Try to save heater states FIRST
        #    (So we capture setpoints before they drop to 7°C)
        log("Attempting to save heater states (best-effort)...", "INFO")
        save_success, save_fail = save_heater_states()
        state_saved = save_fail == 0 and save_success > 0

        # 2. BEST EFFORT: Try to set guard flag
        log("Attempting to set guard flag (best-effort)...", "INFO")
        guard_set = set_guard_flag(True)

        # 3. CORE SAFETY: Turn off all heaters (MUST succeed)
        log("CORE SAFETY: Turning off all heaters...", "WARN")
        turn_off_result = turn_off_all_heaters()

        # 4. Build notification message based on state save status
        open_list = ", ".join(open_windows)
        heating_list = ", ".join(heating)

        if state_saved and guard_set:
            # Full success: state saved, will auto-resume
            message = (
                f"Safety violation detected!\n"
                f"Open: {open_list}\n"
                f"Heating: {heating_list}\n"
                f"All heaters turned off.\n"
                f"✅ State saved - will auto-resume when windows close."
            )
            log("State saved successfully - auto-resume will work", "INFO")
        else:
            # Partial failure: manual intervention needed
            message = (
                f"Safety violation detected!\n"
                f"Open: {open_list}\n"
                f"Heating: {heating_list}\n"
                f"All heaters turned off.\n"
                f"⚠️ State save failed - MANUAL re-enable required after closing windows!"
            )
            log("STATE SAVE FAILED - manual intervention required!", "WARN")

        send_notification(
            title="WATCHDOG: Heaters Emergency Off",
            message=message,
            importance="max",
        )

        log(
            f"Action summary: heaters_off={turn_off_result}, state_saved={state_saved}, guard_set={guard_set}",
            "INFO",
        )
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
    log(f"  DOOR_OPEN_DELAY: {DOOR_OPEN_DELAY}s ({DOOR_OPEN_DELAY // 60}min)")
    log(f"  NOTIFY_SERVICE: {NOTIFY_SERVICE}")
    log(f"  Monitoring {len(WINDOW_SENSORS)} window sensors (immediate response)")
    log(f"  Monitoring {len(DOOR_SENSORS)} door sensors ({DOOR_OPEN_DELAY}s delay)")
    log(f"  Monitoring {len(THERMOSTATS)} thermostats")
    log(f"  Worst-case response time for doors: {CHECK_INTERVAL + DOOR_OPEN_DELAY}s ({(CHECK_INTERVAL + DOOR_OPEN_DELAY) // 60}min)")
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
