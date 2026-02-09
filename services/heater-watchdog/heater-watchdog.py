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
from collections import defaultdict

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

# MQTT topics for TRVZB open_window reset (used in stuck-idle recovery)
THERMOSTAT_MQTT_TOPICS = {
    "climate.study_thermostat": "zigbee2mqtt/[Study] Thermostat/set",
    "climate.living_thermostat_inner": "zigbee2mqtt/[Living] Thermostat Inner/set",
    "climate.living_thermostat_outer": "zigbee2mqtt/[Living] Thermostat Outer/set",
    "climate.bed_thermostat": "zigbee2mqtt/[Bed] Thermostat/set",
}

# Guard flag entities
GUARD_FLAG_ENTITY = "input_boolean.heaters_off_due_to_window"
CO2_GUARD_FLAG = "input_boolean.heaters_off_due_to_co2"

# =============================================================================
# GHOST EXTERNAL TEMPERATURE DETECTION
# =============================================================================
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  INCIDENT: Feb 9, 2026 — Bedroom TRV idle with 5.7°C deficit          │
# │                                                                         │
# │  Root cause: external_temperature_input was stuck at 24°C while        │
# │  actual room temp was 16.3°C. Even with temperature_sensor_select      │
# │  set to "internal", the stale external value may confuse TRVZB         │
# │  firmware into thinking the room is warm enough → valve stays closed.  │
# │                                                                         │
# │  HOW IT HAPPENS:                                                        │
# │    HA/automation sends external temp (e.g., from room sensor)          │
# │    → Automation stops or sensor goes offline                           │
# │    → Last value (24°C) stays stuck in TRV memory forever              │
# │    → Room cools to 16°C but TRV still sees ghost 24°C                 │
# │                                                                         │
# │  ┌─── What we see ────────────────────────────────────────┐           │
# │  │                                                         │           │
# │  │  TRV brain:  "external says 24°C... room is warm"     │           │
# │  │  Reality:    16°C and freezing                          │           │
# │  │  Valve:      closed (idle)                              │           │
# │  │  User:       WHY IS IT COLD?!                           │           │
# │  │                                                         │           │
# │  │  After clearing ghost:                                  │           │
# │  │  TRV brain:  "internal says 16°C... need heat!"        │           │
# │  │  Valve:      opens → heating starts                     │           │
# │  └─────────────────────────────────────────────────────────┘           │
# │                                                                         │
# │  FIX: Every 5 min, compare external_temperature_input to local_temp.  │
# │  If divergence > 5°C → clear to 0 via MQTT + alert user.             │
# └─────────────────────────────────────────────────────────────────────────┘

# Mapping: thermostat entity_id -> external_temperature_input number entity
EXTERNAL_TEMP_ENTITIES = {
    "climate.study_thermostat": "number.study_thermostat_external_temperature_input",
    "climate.living_thermostat_inner": "number.living_thermostat_inner_external_temperature_input",
    "climate.living_thermostat_outer": "number.living_thermostat_outer_external_temperature_input",
    "climate.bed_thermostat": "number.bed_thermostat_external_temperature_input",
}

EXTERNAL_TEMP_MAX_DIVERGENCE = 5.0  # °C — clear if external drifts this far from local

# =============================================================================
# STUCK-IDLE DETECTION CONFIG
# =============================================================================
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  Layer 2 backup for HA automation (thermostat_stuck_idle_recovery)      │
# │                                                                         │
# │  TIERED THRESHOLDS (Fix 1, Feb 9 2026):                                │
# │  ┌──────────────────────────────────────────────────────────────────┐  │
# │  │  Tier    │ Time     │ Entry     │ Recovery  │ Reasoning          │  │
# │  │  ────────┼──────────┼───────────┼───────────┼──────────────────  │  │
# │  │  URGENT  │ 20 min   │ ≥ 2°C     │ ≥ 4°C     │ Big gap = fast    │  │
# │  │  NORMAL  │ 45 min   │ ≥ 2°C     │ any       │ Time-only (Fix 5) │  │
# │  └──────────────────────────────────────────────────────────────────┘  │
# │                                                                         │
# │  DEADLOCK FIX (Fix 5, Feb 9 2026):                                     │
# │  After HA restart, last_changed resets for all entities. The HA         │
# │  automation requires last_changed > 60 min, but ambient warming from    │
# │  other rooms reduces the deficit below 2°C before 60 min passes.       │
# │  The two conditions never overlap → automation never fires.             │
# │                                                                         │
# │  Fix: Once a TRV enters stuck_idle_tracker, only remove it when         │
# │  hvac_action becomes "heating" (not when deficit drops). Ambient        │
# │  warming masks the problem but doesn't fix the stuck valve.             │
# └─────────────────────────────────────────────────────────────────────────┘
STUCK_IDLE_THRESHOLD = 45 * 60  # Normal: 45 minutes before recovery
STUCK_IDLE_URGENT_THRESHOLD = 20 * 60  # Urgent: 20 min if deficit is severe
STUCK_IDLE_DEFICIT = 2.0  # Normal minimum °C deficit
STUCK_IDLE_URGENT_DEFICIT = 4.0  # Urgent tier: recover faster with big gap
STUCK_IDLE_MAX_RECOVERIES = 2  # Max recoveries per thermostat per hour
STUCK_IDLE_SETPOINT_FLOOR = 18  # Min setpoint for race condition guard

# =============================================================================
# VALVE VOLTAGE EARLY WARNING (Fix 4, Feb 9 2026)
# =============================================================================
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  TRVZB valve motors degrade over time, especially after extended OFF.  │
# │  valve_opening_limit_voltage indicates how much force the motor needs  │
# │  to open the valve. Healthy TRVs read ~2000-2100 mV.                  │
# │                                                                         │
# │  Feb 9 2026: Bedroom TRV was at 1662 mV while peers were at 2070 mV. │
# │  The motor was too weak to open the valve → stuck idle.                │
# │                                                                         │
# │  DETECTION: Compare each TRV's opening voltage against its peers.      │
# │  If one TRV is >20% below the average of others → alert.              │
# │  Also alert if absolute voltage < 1700 mV.                             │
# └─────────────────────────────────────────────────────────────────────────┘
VALVE_VOLTAGE_ENTITIES = {
    "climate.study_thermostat": "sensor.study_thermostat_valve_opening_limit_voltage",
    "climate.living_thermostat_inner": "sensor.living_thermostat_inner_valve_opening_limit_voltage",
    "climate.living_thermostat_outer": "sensor.living_thermostat_outer_valve_opening_limit_voltage",
    "climate.bed_thermostat": "sensor.bed_thermostat_valve_opening_limit_voltage",
}
VALVE_VOLTAGE_ABS_MIN = 1700  # mV — alert if below this
VALVE_VOLTAGE_PEER_DEVIATION = 0.20  # Alert if >20% below peer average

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
       + Stuck-idle TRV detection and auto-recovery (Layer 2 backup)
       + Ghost external temperature detection and auto-clear
       + Valve voltage early warning (motor degradation detection)
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


# =============================================================================
# STUCK-IDLE DETECTION & RECOVERY (Layer 2 Backup)
# =============================================================================
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  INCIDENT: Feb 7, 2026 — Living Inner TRV stuck idle for 10+ hours    │
# │  Valve motor seized after prolonged OFF mode. TRV accepted mode=heat   │
# │  but valve physically wouldn't open. All 3 safety nets missed it.      │
# │                                                                         │
# │  This is the Layer 2 backup — HA automation is Layer 1 (every 15min).  │
# │  Watchdog fires only if HA automation fails (HA restart, disabled, etc) │
# │                                                                         │
# │  TWO-PHASE RECOVERY:                                                    │
# │    Phase 1: MQTT open_window OFF + re-poke setpoint (gentle)           │
# │    Phase 2: off → heat → MQTT reset → setpoint (aggressive)           │
# └─────────────────────────────────────────────────────────────────────────┘

# In-memory tracking (reset on container restart — acceptable for Layer 2)
stuck_idle_tracker = {}  # {entity_id: first_seen_timestamp}
recovery_tracker = defaultdict(list)  # {entity_id: [timestamp, ...]}


def is_guard_flag_active():
    """Check if any guard flag is active (heaters intentionally off).

    FAIL-SAFE: Returns True (assume active) if HA is unreachable.
    This prevents stuck-idle recovery from running when we can't
    confirm guard flags are off — better to skip recovery than
    to fight an intentional shutoff.
    """
    for flag in [GUARD_FLAG_ENTITY, CO2_GUARD_FLAG]:
        try:
            state = get_entity_state(flag)
            if state.get("state") == "on":
                return True
        except Exception as e:
            log(f"Cannot read guard flag {flag}: {e} — assuming active (fail-safe)", "WARN")
            return True
    return False


def can_recover(entity_id):
    """Check if we haven't exceeded rate limit for this thermostat."""
    now = time.time()
    # Clean old entries (>1 hour)
    recovery_tracker[entity_id] = [
        ts for ts in recovery_tracker[entity_id] if now - ts < 3600
    ]
    return len(recovery_tracker[entity_id]) < STUCK_IDLE_MAX_RECOVERIES


def publish_mqtt_via_ha(topic, payload):
    """Publish MQTT message via HA REST API (mqtt.publish service)."""
    try:
        call_service("mqtt", "publish", {"topic": topic, "payload": payload})
        return True
    except Exception as e:
        log(f"Failed to publish MQTT via HA: {e}", "WARN")
        return False


def recover_stuck_idle_thermostat(entity_id):
    """Two-phase recovery for a stuck-idle thermostat.

    Phase 1: Reset open_window flag + re-poke setpoint (gentle)
    Phase 2: Full off/heat cycle (aggressive, only if Phase 1 fails)

    Returns: 'phase1' | 'phase2' | 'failed'
    """
    name = THERMOSTAT_NAMES.get(entity_id, entity_id)
    mqtt_topic = THERMOSTAT_MQTT_TOPICS.get(entity_id)

    # Get current setpoint before any changes
    try:
        state = get_entity_state(entity_id)
        attrs = state.get("attributes", {})
        setpoint = max(float(attrs.get("temperature", 18)), STUCK_IDLE_SETPOINT_FLOOR)
    except Exception as e:
        log(f"  Cannot read setpoint for {name}: {e} — using floor ({STUCK_IDLE_SETPOINT_FLOOR}°C)", "WARN")
        setpoint = STUCK_IDLE_SETPOINT_FLOOR

    # ─── Phase 1: Gentle (MQTT reset + re-poke setpoint) ───
    log(f"  Phase 1 (gentle): Resetting open_window + re-poking setpoint for {name}", "INFO")
    if mqtt_topic:
        if not publish_mqtt_via_ha(mqtt_topic, json.dumps({"open_window": "OFF"})):
            log(f"  WARNING: MQTT reset failed for {name}, Phase 1 may not work", "WARN")

    try:
        call_service(
            "climate",
            "set_temperature",
            {"entity_id": entity_id, "temperature": setpoint},
        )
    except Exception as e:
        log(f"  Phase 1 setpoint re-poke failed for {name}: {e}", "WARN")

    # Wait for Phase 1 to take effect
    log(f"  Waiting 60s for Phase 1 to take effect on {name}...", "INFO")
    time.sleep(60)

    # Re-check — if HA unreachable, don't blindly escalate to Phase 2
    try:
        state = get_entity_state(entity_id)
        attrs = state.get("attributes", {})
        if attrs.get("hvac_action") != "idle":
            recovery_tracker[entity_id].append(time.time())
            log(f"  Phase 1 SUCCESS: {name} is now {attrs.get('hvac_action')}", "INFO")
            return "phase1"
    except Exception as e:
        log(f"  Phase 1 re-check failed for {name}: {e} — skipping Phase 2 (can't confirm state)", "WARN")
        recovery_tracker[entity_id].append(time.time())
        return "phase1"  # Assume Phase 1 worked rather than escalate blindly

    # ─── Phase 2: Aggressive (off → heat → MQTT reset → setpoint) ───
    log(f"  Phase 2 (aggressive): Off→heat cycle for {name}", "WARN")

    try:
        # Off
        call_service(
            "climate",
            "set_hvac_mode",
            {"entity_id": entity_id, "hvac_mode": "off"},
        )
        time.sleep(5)

        # Heat
        call_service(
            "climate",
            "set_hvac_mode",
            {"entity_id": entity_id, "hvac_mode": "heat"},
        )

        # Reset open_window flag (TRVZB sets this when mode=off)
        if mqtt_topic:
            if not publish_mqtt_via_ha(mqtt_topic, json.dumps({"open_window": "OFF"})):
                log(f"  WARNING: MQTT reset failed for {name} in Phase 2", "WARN")
        time.sleep(5)

        # Restore setpoint
        call_service(
            "climate",
            "set_temperature",
            {"entity_id": entity_id, "temperature": setpoint},
        )

        # Track recovery for rate limiting
        recovery_tracker[entity_id].append(time.time())

        log(f"  Phase 2 complete for {name} (setpoint={setpoint}°C)", "INFO")
        return "phase2"

    except Exception as e:
        log(f"  Phase 2 FAILED for {name}: {e}", "ERROR")
        return "failed"


def check_stuck_idle():
    """Check for and recover stuck-idle thermostats (Layer 2 backup).

    Only runs when no guard flags are active and no windows are open.

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Fix 1 (Feb 9 2026): TIERED THRESHOLDS                            │
    │  Entry: deficit ≥ 2°C to start tracking any TRV.                 │
    │  ┌──────────┬──────────┬─────────────────────────────────────────┐ │
    │  │ URGENT   │ 20 min   │ recovery needs deficit ≥ 4°C           │ │
    │  │ NORMAL   │ 45 min   │ time-only (deficit may have dropped)   │ │
    │  └──────────┴──────────┴─────────────────────────────────────────┘ │
    │                                                                     │
    │  Fix 5 (Feb 9 2026): DEADLOCK PREVENTION                          │
    │  Once tracked, only remove when hvac_action changes from "idle".   │
    │  Ambient warming reducing deficit does NOT clear the tracker —     │
    │  the valve is still stuck even if the room warms from other heat.  │
    │                                                                     │
    │  Old bug: deficit drops 3°C→1.5°C (ambient) → removed from        │
    │  tracker → never recovers. Now: stays tracked until valve opens.   │
    └─────────────────────────────────────────────────────────────────────┘
    """
    # Don't interfere with intentional shutoffs
    if is_guard_flag_active():
        return

    now = time.time()

    for entity_id in THERMOSTATS:
        try:
            state = get_entity_state(entity_id)
            attrs = state.get("attributes", {})
            hvac_mode = state.get("state")  # 'heat', 'off', etc.
            hvac_action = attrs.get("hvac_action")  # 'idle', 'heating', etc.
            setpoint = attrs.get("temperature")
            current_temp = attrs.get("current_temperature")
            name = THERMOSTAT_NAMES.get(entity_id, entity_id)

            # ─── Fix 5: Only clear tracker when TRV actually recovers ───
            # NOT when deficit drops (ambient warming masks the real problem)
            if entity_id in stuck_idle_tracker:
                if hvac_mode != "heat" or hvac_action != "idle":
                    log(f"  Stuck-idle cleared: {name} (now {hvac_mode}/{hvac_action})", "INFO")
                    del stuck_idle_tracker[entity_id]
                    continue

            # Skip if not in stuck-idle state
            if hvac_mode != "heat" or hvac_action != "idle":
                continue
            if setpoint is None or current_temp is None:
                continue

            deficit = float(setpoint) - float(current_temp)

            # ─── Track new stuck TRVs (entry requires deficit ≥ 2°C) ───
            if entity_id not in stuck_idle_tracker:
                if deficit >= STUCK_IDLE_DEFICIT:
                    stuck_idle_tracker[entity_id] = now
                    log(
                        f"  Stuck-idle detected: {name} "
                        f"({current_temp}°C / {setpoint}°C target, "
                        f"deficit={deficit:.1f}°C) — tracking started",
                        "WARN",
                    )
                continue  # Just started tracking, don't recover yet

            # ─── Fix 1: Tiered threshold check ───
            first_seen = stuck_idle_tracker[entity_id]
            duration = now - first_seen

            # Tier 1: URGENT — big deficit, recover fast
            if deficit >= STUCK_IDLE_URGENT_DEFICIT and duration >= STUCK_IDLE_URGENT_THRESHOLD:
                tier_name = f"URGENT ({duration / 60:.0f}min, deficit={deficit:.1f}°C)"
            # Tier 2: NORMAL — after 45min, recover regardless of current deficit
            # (Fix 5: deficit may have dropped from ambient warming, valve still stuck)
            elif duration >= STUCK_IDLE_THRESHOLD:
                tier_name = f"NORMAL ({duration / 60:.0f}min, deficit={deficit:.1f}°C)"
            else:
                continue

            log(f"  Stuck-idle {tier_name}: {name}", "WARN")

            if not can_recover(entity_id):
                log(
                    f"  Rate limit hit for {name} "
                    f"({STUCK_IDLE_MAX_RECOVERIES} recoveries/hour) — skipping",
                    "WARN",
                )
                continue

            # Attempt recovery
            result = recover_stuck_idle_thermostat(entity_id)

            if result in ("phase1", "phase2"):
                stuck_idle_tracker.pop(entity_id, None)
                phase_desc = "MQTT reset" if result == "phase1" else "off/heat cycle"
                send_notification(
                    title=f"WATCHDOG: Stuck-Idle Recovery ({name})",
                    message=(
                        f"Recovered {name} via {phase_desc}.\n"
                        f"Was: {current_temp}°C (target {setpoint}°C)\n"
                        f"Stuck for {duration / 60:.0f} minutes.\n"
                        f"Tier: {tier_name}"
                    ),
                    importance="high",
                )
            else:
                log(f"  Recovery FAILED for {name} — will retry next cycle", "ERROR")

        except Exception as e:
            log(f"Error checking stuck-idle for {entity_id}: {e}", "WARN")


ghost_temp_clear_tracker = defaultdict(list)  # {entity_id: [timestamp, ...]}
GHOST_TEMP_MAX_CLEARS = 3  # Max clears per thermostat per hour


def can_clear_ghost_temp(entity_id):
    """Rate limit ghost temp clears: max 3 per thermostat per hour."""
    now = time.time()
    ghost_temp_clear_tracker[entity_id] = [
        ts for ts in ghost_temp_clear_tracker[entity_id] if now - ts < 3600
    ]
    return len(ghost_temp_clear_tracker[entity_id]) < GHOST_TEMP_MAX_CLEARS


def check_ghost_external_temps():
    """Detect and clear stale external_temperature_input values on TRVs.

    For each TRV, compares the external_temperature_input (number entity in HA)
    against the TRV's own local_temperature reading (from climate entity).

    If divergence exceeds EXTERNAL_TEMP_MAX_DIVERGENCE (5°C), the external value
    is almost certainly stale/wrong. Clears it to 0 via MQTT and sends alert.

    Rate limited: max 3 clears per thermostat per hour to prevent spam if an
    automation keeps re-setting the external temp.
    """
    for entity_id in THERMOSTATS:
        try:
            ext_entity = EXTERNAL_TEMP_ENTITIES.get(entity_id)
            if not ext_entity:
                continue

            name = THERMOSTAT_NAMES.get(entity_id, entity_id)

            # Read the external temperature input value
            ext_state = get_entity_state(ext_entity)
            ext_temp_str = ext_state.get("state", "0")
            if ext_temp_str in ("unknown", "unavailable"):
                log(f"  Ghost temp skip: {name} external_temperature_input is {ext_temp_str}", "WARN")
                continue
            ext_temp = float(ext_temp_str)
            # ext_temp == 0 means "cleared/disabled" on TRVZB — nothing to validate
            if ext_temp == 0:
                continue

            # Read the TRV's internal local temperature
            climate_state = get_entity_state(entity_id)
            attrs = climate_state.get("attributes", {})
            local_temp = attrs.get("current_temperature")
            if local_temp is None or str(local_temp) in ("unknown", "unavailable"):
                log(f"  Ghost temp skip: {name} local_temperature is {local_temp}", "WARN")
                continue
            local_temp = float(local_temp)

            divergence = abs(ext_temp - local_temp)

            if divergence > EXTERNAL_TEMP_MAX_DIVERGENCE:
                log(
                    f"  GHOST TEMP: {name} external={ext_temp}°C vs "
                    f"local={local_temp}°C (divergence={divergence:.1f}°C)",
                    "WARN",
                )

                # Rate limit check
                if not can_clear_ghost_temp(entity_id):
                    log(
                        f"  Rate limit hit for {name} "
                        f"({GHOST_TEMP_MAX_CLEARS} clears/hour) — automation may be re-setting it",
                        "WARN",
                    )
                    continue

                # Clear via MQTT (set external_temperature_input to 0)
                mqtt_topic = THERMOSTAT_MQTT_TOPICS.get(entity_id)
                cleared = False
                if mqtt_topic:
                    payload = json.dumps({"external_temperature_input": 0})
                    if publish_mqtt_via_ha(mqtt_topic, payload):
                        log(f"  Cleared ghost external_temperature_input for {name}", "INFO")
                        ghost_temp_clear_tracker[entity_id].append(time.time())
                        cleared = True
                    else:
                        log(f"  FAILED to clear external_temperature_input for {name}", "ERROR")

                # Notification reflects actual outcome
                if cleared:
                    send_notification(
                        title=f"WATCHDOG: Ghost Temp Cleared ({name})",
                        message=(
                            f"Stale external_temperature_input on {name}.\n"
                            f"External: {ext_temp}°C vs Local: {local_temp}°C "
                            f"(diff: {divergence:.1f}°C)\n"
                            f"Cleared to 0 to prevent heating blockage."
                        ),
                        importance="high",
                    )
                else:
                    send_notification(
                        title=f"WATCHDOG: Ghost Temp FAILED ({name})",
                        message=(
                            f"Stale external_temperature_input on {name}.\n"
                            f"External: {ext_temp}°C vs Local: {local_temp}°C "
                            f"(diff: {divergence:.1f}°C)\n"
                            f"FAILED to clear — manual intervention required!"
                        ),
                        importance="max",
                    )

        except Exception as e:
            log(f"Error checking external temp for {entity_id}: {e}", "WARN")


# =============================================================================
# VALVE VOLTAGE EARLY WARNING (Fix 4, Feb 9 2026)
# =============================================================================
# ┌─────────────────────────────────────────────────────────────────────────┐
# │  TRVZB valve motors degrade over time. The valve_opening_limit_voltage │
# │  shows how much force the motor needs. Healthy = ~2000-2100 mV.       │
# │                                                                         │
# │  Feb 9 2026 incident:                                                   │
# │    Bedroom: 1662 mV ← motor struggling                                 │
# │    Peers:   2070 mV ← healthy                                          │
# │    Result:  Valve stuck closed → room freezing                         │
# │                                                                         │
# │  This is EARLY WARNING only — alerts, no recovery.                     │
# │  Detection: absolute floor (1700 mV) OR >20% below peer average.      │
# └─────────────────────────────────────────────────────────────────────────┘

valve_voltage_alert_tracker = {}  # {entity_id: last_alert_timestamp}
VALVE_VOLTAGE_ALERT_COOLDOWN = 3600 * 4  # 4 hours between alerts per TRV


def check_valve_voltages():
    """Check TRV valve opening voltages for degradation.

    Compares each TRV's valve_opening_limit_voltage against:
    1. Absolute minimum (1700 mV) — motor too weak to open valve
    2. Peer average — >20% below peers suggests degradation

    Sends alert only (no recovery) — early warning system.
    """
    voltages = {}

    for entity_id, voltage_entity in VALVE_VOLTAGE_ENTITIES.items():
        try:
            state = get_entity_state(voltage_entity)
            voltage_str = state.get("state")
            if not voltage_str or voltage_str in ("unknown", "unavailable"):
                log(
                    f"  Valve voltage skip: {THERMOSTAT_NAMES.get(entity_id, entity_id)} "
                    f"voltage is {voltage_str}",
                    "WARN",
                )
                continue
            voltages[entity_id] = float(voltage_str)
        except Exception as e:
            log(f"Error reading valve voltage for {entity_id}: {e}", "WARN")

    if not voltages:
        return

    now = time.time()

    for entity_id, voltage in voltages.items():
        name = THERMOSTAT_NAMES.get(entity_id, entity_id)
        alerts = []

        # Check 1: Absolute minimum (always runs, even with 1 TRV)
        if voltage < VALVE_VOLTAGE_ABS_MIN:
            alerts.append(
                f"Below absolute minimum ({voltage:.0f} mV < {VALVE_VOLTAGE_ABS_MIN} mV)"
            )

        # Check 2: Peer comparison (needs at least 2 TRVs with readings)
        peer_voltages = [v for eid, v in voltages.items() if eid != entity_id]
        if peer_voltages:
            peer_avg = sum(peer_voltages) / len(peer_voltages)
            if peer_avg > 0:
                deviation = (peer_avg - voltage) / peer_avg
                if deviation > VALVE_VOLTAGE_PEER_DEVIATION:
                    alerts.append(
                        f"{deviation * 100:.0f}% below peer average "
                        f"({voltage:.0f} mV vs avg {peer_avg:.0f} mV)"
                    )

        if alerts:
            # Rate limit: 4h cooldown per TRV
            last_alert = valve_voltage_alert_tracker.get(entity_id, 0)
            if now - last_alert < VALVE_VOLTAGE_ALERT_COOLDOWN:
                log(f"  Valve voltage alert suppressed for {name} (cooldown)", "INFO")
                continue

            valve_voltage_alert_tracker[entity_id] = now
            alert_detail = "; ".join(alerts)
            log(f"  VALVE VOLTAGE WARNING: {name} — {alert_detail}", "WARN")

            all_voltages = ", ".join(
                f"{THERMOSTAT_NAMES.get(eid, eid)}={v:.0f}mV"
                for eid, v in voltages.items()
            )
            send_notification(
                title=f"WATCHDOG: Valve Voltage Warning ({name})",
                message=(
                    f"TRV {name} valve motor may be degrading.\n"
                    f"{alert_detail}\n"
                    f"All voltages: {all_voltages}\n"
                    f"Consider: off/heat cycle or replace battery."
                ),
                importance="high",
            )


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
        log("Safety check: OK (no window+heating violation)", "INFO")

        # ─── Ghost External Temperature Check ───
        # Runs before stuck-idle: clearing a ghost temp may fix the idle state
        log("Checking for ghost external temperatures...")
        try:
            check_ghost_external_temps()
        except Exception as e:
            log(f"Error during ghost temp check: {e}", "ERROR")

        # ─── Stuck-Idle Check (Layer 2 backup) ───
        # Only runs when no windows are open (window safety takes priority)
        log("Checking for stuck-idle thermostats...")
        try:
            check_stuck_idle()
        except Exception as e:
            log(f"Error during stuck-idle check: {e}", "ERROR")

        # ─── Valve Voltage Early Warning (Fix 4) ───
        # Detect degrading valve motors before they seize
        log("Checking valve voltages...")
        try:
            check_valve_voltages()
        except Exception as e:
            log(f"Error during valve voltage check: {e}", "ERROR")

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
    log(f"  Stuck-idle normal: {STUCK_IDLE_THRESHOLD // 60}min (entry: deficit >= {STUCK_IDLE_DEFICIT}°C, recovery: time-only)")
    log(f"  Stuck-idle urgent: {STUCK_IDLE_URGENT_THRESHOLD // 60}min (entry: deficit >= {STUCK_IDLE_DEFICIT}°C, recovery: deficit >= {STUCK_IDLE_URGENT_DEFICIT}°C)")
    log(f"  Stuck-idle max recoveries/hour: {STUCK_IDLE_MAX_RECOVERIES}")
    log(f"  Valve voltage alert: < {VALVE_VOLTAGE_ABS_MIN} mV or > {VALVE_VOLTAGE_PEER_DEVIATION * 100:.0f}% below peers")
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
