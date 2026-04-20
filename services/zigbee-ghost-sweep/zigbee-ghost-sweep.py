#!/usr/bin/env python3
"""
Zigbee Ghost Device Sweep
=========================

Detects "ghost removals" — Zigbee devices that disappeared from Z2M's
`bridge/devices` registry without ever publishing `availability=offline` and
without firing a `bridge/event type=device_leave`. The motivating case
(2026-04 incident): `[Living] Light Switch` (IEEE 0x58263afffefc5706) silently
vanished from bridge/devices ~22 days before detection. Its retained
`availability` MQTT topic still claimed `online`. No `device_leave` event in
log retention. Neither HA's per-entity offline alert nor the wildcard
availability alert can catch this class of failure — only a periodic diff of
bridge/devices vs a stored snapshot can.

What this script does
---------------------
1. Reads zigbee2mqtt/bridge/state. If 'offline' → exit (HA L0 will alert).
2. Reads retained zigbee2mqtt/bridge/devices via mosquitto_sub.
3. Loads previous IEEE+name snapshot from /var/lib/zigbee-ghost-sweep/snapshot.json
   (if present).
4. Computes diff:
     - additions: IEEEs in current that weren't in previous (informational)
     - ghosts:    IEEEs in previous that aren't in current  ← ALERT
5. For each ghost:
     - POST to HA /api/services/script/send_alert_email (CRITICAL severity)
     - Publish retained availability={"state":"offline"} on the device's topic
       to fix the lying state (so dashboard / device-health stops claiming online)
6. Save current snapshot for next run.

How it's scheduled
------------------
systemd timer `zigbee-ghost-sweep.timer` fires twice daily at 03:30 and 15:30
local time (avoiding the 04:30 daily-reboot.timer window).

Auth
----
HA long-lived token loaded from /opt/zigbee-watchdog/.env (HA_TOKEN=...).
Same env file used by zigbee-watchdog and heater-watchdog.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import urllib.request
import urllib.error

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SNAPSHOT_DIR = Path("/var/lib/zigbee-ghost-sweep")
SNAPSHOT_FILE = SNAPSHOT_DIR / "snapshot.json"
HA_URL = os.environ.get("HA_URL", "http://localhost:8123")
# .env on the Pi uses ZIGBEE_WATCHDOG_HA_TOKEN (legacy var name shared with
# zigbee-watchdog.sh). Accept either name so future cleanup is unblocked.
HA_TOKEN = (os.environ.get("HA_TOKEN") or os.environ.get("ZIGBEE_WATCHDOG_HA_TOKEN") or "").strip()
MOSQUITTO_CONTAINER = os.environ.get("MOSQUITTO_CONTAINER", "mosquitto")
MQTT_TIMEOUT_SEC = 10

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("zigbee-ghost-sweep")


# -----------------------------------------------------------------------------
# MQTT helpers (via docker exec mosquitto_sub — Pi has no host-side mosquitto)
# -----------------------------------------------------------------------------
def mqtt_read_retained(topic: str) -> str | None:
    """Read a single retained MQTT message. Returns None on timeout."""
    try:
        result = subprocess.run(
            [
                "docker", "exec", MOSQUITTO_CONTAINER,
                "mosquitto_sub", "-h", "localhost", "-t", topic,
                "-C", "1", "-W", str(MQTT_TIMEOUT_SEC),
            ],
            capture_output=True,
            text=True,
            timeout=MQTT_TIMEOUT_SEC + 5,
        )
    except subprocess.TimeoutExpired:
        log.warning("mosquitto_sub timed out reading %s", topic)
        return None
    if result.returncode != 0:
        log.warning("mosquitto_sub failed for %s: %s", topic, result.stderr.strip())
        return None
    return result.stdout.strip() or None


def mqtt_read_all_availability() -> dict[str, str]:
    """Read retained `zigbee2mqtt/+/availability` for all devices in one pass.
    Returns {friendly_name: 'online'|'offline'|'unknown'}. Used by the
    stuck-offline detector to cover the HA-startup-grace edge case where L1a
    never gets a fresh MQTT trigger to start its 12-h wait."""
    try:
        result = subprocess.run(
            [
                "docker", "exec", MOSQUITTO_CONTAINER,
                "mosquitto_sub", "-h", "localhost",
                "-t", "zigbee2mqtt/+/availability",
                "-v", "-W", "5",  # wall-clock timeout: retained msgs arrive in ms
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except subprocess.TimeoutExpired:
        log.warning("mosquitto_sub wildcard availability read timed out")
        return {}

    out: dict[str, str] = {}
    for line in result.stdout.strip().splitlines():
        parts = line.split(" ", 1)
        if len(parts) != 2:
            continue
        topic, payload = parts
        if not topic.startswith("zigbee2mqtt/") or not topic.endswith("/availability"):
            continue
        name = topic[len("zigbee2mqtt/"):-len("/availability")]
        if name == "bridge":
            continue
        payload = payload.strip()
        state = "unknown"
        if payload.startswith("{"):
            try:
                state = json.loads(payload).get("state", "unknown")
            except json.JSONDecodeError:
                pass
        elif payload in ("online", "offline"):
            state = payload
        out[name] = state
    return out


def mqtt_publish_retained(topic: str, payload: str) -> bool:
    """Publish a retained MQTT message. Returns True on success."""
    try:
        result = subprocess.run(
            [
                "docker", "exec", MOSQUITTO_CONTAINER,
                "mosquitto_pub", "-h", "localhost", "-t", topic,
                "-m", payload, "-r",
            ],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        log.error("mosquitto_pub timed out for %s", topic)
        return False
    if result.returncode != 0:
        log.error("mosquitto_pub failed for %s: %s", topic, result.stderr.strip())
        return False
    return True


# -----------------------------------------------------------------------------
# HA API
# -----------------------------------------------------------------------------
def ha_call_service(domain: str, service: str, data: dict[str, Any]) -> bool:
    """POST to HA /api/services/<domain>/<service>. Returns True on 2xx."""
    if not HA_TOKEN:
        log.error("HA_TOKEN not set — cannot send alert email. Set it in .env.")
        return False
    url = f"{HA_URL}/api/services/{domain}/{service}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {HA_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        log.error("HA call %s.%s failed: %s", domain, service, e)
        return False


def ha_read_state(entity_id: str) -> str | None:
    """GET /api/states/<entity_id>. Returns the state string, or None."""
    if not HA_TOKEN:
        return None
    url = f"{HA_URL}/api/states/{entity_id}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {HA_TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)
            return data.get("state")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def get_exclusions() -> set[str]:
    """Read `input_text.zigbee_offline_exclusions` from HA and parse to a set."""
    raw = ha_read_state("input_text.zigbee_offline_exclusions") or ""
    return {s.strip() for s in raw.split(",") if s.strip()}


def get_delay_minutes() -> int:
    """Read the configured offline alert delay. Default 720 (12 h)."""
    raw = ha_read_state("input_number.zigbee_offline_delay_minutes")
    try:
        return int(float(raw)) if raw else 720
    except (ValueError, TypeError):
        return 720


def send_stuck_offline_email(name: str, ieee: str, first_seen_iso: str, elapsed_min: int) -> None:
    """Alert for a device that's been retained-offline across sweeps.
    Covers the narrow edge case where a device went offline during HA's 30-min
    startup grace window and L1a never got a fresh MQTT trigger to start its
    wait. The ghost sweep catches it here by cross-referencing retained
    availability with the snapshot history."""
    ha_call_service(
        "script", "send_alert_email",
        {
            "severity": "WARNING",
            "title": "Zigbee Device Stuck Offline",
            "subtitle": name,
            "description": (
                f"{name} has been retained-offline across multiple ghost-sweep "
                f"runs for at least {elapsed_min} minutes. The main wildcard "
                f"offline alert (L1a) likely missed it because the device went "
                f"offline during the HA 30-min startup grace window — no fresh "
                f"MQTT trigger arrived afterwards to start its delay timer. "
                f"This sweep-based detector is the safety net."
            ),
            "actions": (
                "Open dashboard Device Health view (key D)|"
                "Check the device's battery / power|"
                f"docker logs zigbee2mqtt --tail 100 | grep -i '{name}'"
            ),
            "details": (
                f"Device:       {name}\n"
                f"IEEE:         {ieee}\n"
                f"First seen offline by sweep: {first_seen_iso}\n"
                f"Elapsed:      {elapsed_min} minutes\n"
                f"Detector:     zigbee-ghost-sweep (retained-availability scan)"
            ),
            "plain_text": f"{name} retained offline for {elapsed_min} min.",
        },
    )


def send_ghost_email(friendly_name: str, ieee: str, last_seen_iso: str | None) -> None:
    """Send a CRITICAL email about a ghost-removed device."""
    description = (
        f"{friendly_name} silently disappeared from zigbee2mqtt/bridge/devices "
        f"between sweeps — no `device_leave` event was emitted, and no "
        f"`availability=offline` was published. The MQTT retained availability "
        f"may still falsely claim 'online'. The device is gone from Z2M's "
        f"registry and will NOT auto-recover; manual re-pairing is required."
    )
    actions = (
        "Verify in Z2M UI that the device is truly missing|"
        "Check Z2M logs for any clue: docker logs zigbee2mqtt | grep "
        f"{ieee}|"
        "Open dashboard Device Health view (key D)|"
        "Re-pair the device per docs/05-zigbee-devices.md"
    )
    last_seen_line = f"Last seen: {last_seen_iso}" if last_seen_iso else "Last seen: unknown"
    details = (
        f"Device: {friendly_name}\n"
        f"IEEE:   {ieee}\n"
        f"{last_seen_line}\n"
        f"Detected by: zigbee-ghost-sweep (twice-daily snapshot diff)\n\n"
        f"NOTE: This script also re-published availability=offline retained "
        f"for this device, fixing any lying retained state."
    )
    plain = (
        f"GHOST DEVICE: {friendly_name} ({ieee}) silently removed from Z2M. "
        f"Re-pair required."
    )
    ok = ha_call_service(
        "script", "send_alert_email",
        {
            # WARNING — not CRITICAL. A ghost is a stale-registry condition
            # discovered during batch housekeeping, not a 3am emergency.
            "severity": "WARNING",
            "title": "Zigbee Ghost Device Detected",
            "subtitle": friendly_name,
            "description": description,
            "actions": actions,
            "details": details,
            "plain_text": plain,
        },
    )
    if ok:
        log.info("Sent ghost email for %s (%s)", friendly_name, ieee)
    else:
        log.error("FAILED to send ghost email for %s (%s)", friendly_name, ieee)


# -----------------------------------------------------------------------------
# Snapshot I/O
# -----------------------------------------------------------------------------
def _format_last_seen(last_seen: Any) -> str | None:
    """Format Z2M's `last_seen` value. Auto-detect ms vs seconds: any timestamp
    > 1e12 (i.e. > year 33658 if interpreted as seconds) must be ms. Z2M has
    historically emitted ms but future versions may change."""
    if isinstance(last_seen, (int, float)):
        v = float(last_seen)
        if v > 1e12:
            v = v / 1000.0
        try:
            return time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(int(v)))
        except (ValueError, OSError):
            return None
    if isinstance(last_seen, str):
        return last_seen
    return None


class SnapshotCorrupt(Exception):
    """Raised when the snapshot file exists but can't be parsed. We refuse to
    overwrite in this case — a silent first-run reset after a genuine ghost
    removal would lose the only evidence of it forever."""


def load_snapshot() -> dict[str, Any] | None:
    """Load previous snapshot. Returns None if missing (first run). Raises
    SnapshotCorrupt if the file exists but can't be parsed."""
    if not SNAPSHOT_FILE.exists():
        log.info("No prior snapshot at %s — first run, will save and exit.", SNAPSHOT_FILE)
        return None
    try:
        with SNAPSHOT_FILE.open() as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        raise SnapshotCorrupt(f"Cannot parse {SNAPSHOT_FILE}: {e}") from e


def save_snapshot(devices: list[dict[str, Any]], availability_tracking: dict[str, dict[str, Any]] | None = None) -> None:
    """Persist the current non-coordinator device list as the new snapshot.
    Coordinator is excluded — it sits in bridge/devices with type=Coordinator
    but the diff logic treats it specially (never a ghost), so keeping it in
    the snapshot would cause a false positive on the very next run.

    `availability_tracking` (optional) is a dict keyed by IEEE with values
    {availability, first_offline_sweep_at, stuck_alerted} used by the
    stuck-offline detector. If provided, these fields are merged into each
    device's entry in the saved snapshot."""
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    real_devices = [d for d in devices if d.get("type") != "Coordinator"]
    availability_tracking = availability_tracking or {}
    snapshot = {
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "device_count": len(real_devices),
        "devices": [
            {
                "ieee_address": d.get("ieee_address"),
                "friendly_name": d.get("friendly_name"),
                "model": (d.get("definition") or {}).get("model"),
                "last_seen": d.get("last_seen"),
                **availability_tracking.get(d.get("ieee_address") or "", {}),
            }
            for d in real_devices
        ],
    }
    tmp = SNAPSHOT_FILE.with_suffix(".json.tmp")
    with tmp.open("w") as f:
        json.dump(snapshot, f, indent=2)
    tmp.replace(SNAPSHOT_FILE)
    # Device IEEEs + friendly_names (which include room labels) aren't
    # secret but aren't world-interesting either. 0600 keeps future
    # multi-user / container-mount scenarios clean.
    SNAPSHOT_FILE.chmod(0o600)
    log.info("Saved snapshot: %d devices (excl coordinator)", len(real_devices))


# -----------------------------------------------------------------------------
# Main flow
# -----------------------------------------------------------------------------
def main() -> int:
    log.info("=== Zigbee ghost sweep starting ===")

    # Load .env if HA_TOKEN not already in environment (systemd EnvironmentFile)
    if not HA_TOKEN:
        log.warning("HA_TOKEN not in env. Alerts will fail. Check EnvironmentFile in service unit.")

    # 1. Check Z2M is alive — skip if down (HA L0 alert fires separately)
    bridge_state_raw = mqtt_read_retained("zigbee2mqtt/bridge/state")
    if bridge_state_raw is None:
        log.warning("Could not read bridge/state — Z2M or mosquitto down. Skipping sweep.")
        return 1
    try:
        bridge_state = json.loads(bridge_state_raw)
        is_online = bridge_state.get("state") == "online"
    except (json.JSONDecodeError, AttributeError):
        is_online = bridge_state_raw.strip() == "online"
    if not is_online:
        log.warning("Z2M bridge/state == offline — skipping sweep (HA L0 handles this).")
        return 0

    # 2. Read current device list
    devices_raw = mqtt_read_retained("zigbee2mqtt/bridge/devices")
    if devices_raw is None:
        log.error("bridge/devices was not readable — Z2M may be unresponsive.")
        return 2
    try:
        devices = json.loads(devices_raw)
    except json.JSONDecodeError as e:
        log.error("bridge/devices JSON parse failed: %s", e)
        return 3
    if not isinstance(devices, list) or not devices:
        log.error("bridge/devices empty or wrong shape — refusing to overwrite snapshot.")
        return 4

    current_by_ieee = {
        d["ieee_address"]: d
        for d in devices
        if d.get("ieee_address") and d.get("type") != "Coordinator"
    }
    log.info("Current device count (excl coordinator): %d", len(current_by_ieee))

    # 3. Load previous snapshot
    try:
        prev = load_snapshot()
    except SnapshotCorrupt as e:
        log.error("CRITICAL: %s", e)
        ha_call_service(
            "script", "send_alert_email",
            {
                "severity": "CRITICAL",
                "title": "Ghost Sweep Snapshot Corrupt",
                "subtitle": "Manual intervention required",
                "description": (
                    "The ghost-sweep snapshot file cannot be parsed. The script "
                    "refuses to overwrite it with a fresh snapshot because "
                    "doing so would silently destroy evidence of any pending "
                    "ghost-removal detection. Inspect the file manually, "
                    "repair or delete it if you are sure no ghost state is "
                    "present, and the next scheduled run will re-baseline."
                ),
                "actions": (
                    "ssh pi@pi 'sudo cat /var/lib/zigbee-ghost-sweep/snapshot.json | jq .'"
                    "|If valid JSON but structure wrong: adjust or delete"
                    "|If corrupt: sudo rm /var/lib/zigbee-ghost-sweep/snapshot.json"
                    "|Retry: sudo systemctl start zigbee-ghost-sweep.service"
                ),
                "details": f"Error: {e}",
                "plain_text": f"Ghost-sweep snapshot corrupt: {e}. Manual fix required.",
            },
        )
        return 6
    if prev is None:
        save_snapshot(devices)
        log.info("First run — snapshot saved, no diff to compute.")
        return 0

    prev_by_ieee = {
        d["ieee_address"]: d
        for d in prev.get("devices", [])
        if d.get("ieee_address")
    }

    # 4. Diff
    ghost_ieees = sorted(set(prev_by_ieee.keys()) - set(current_by_ieee.keys()))
    new_ieees = sorted(set(current_by_ieee.keys()) - set(prev_by_ieee.keys()))

    if new_ieees:
        log.info(
            "New devices since last sweep (%d): %s",
            len(new_ieees),
            ", ".join(current_by_ieee.get(i, {}).get("friendly_name", i) for i in new_ieees),
        )

    # Re-pair detection: if a ghost's friendly_name matches any new device's
    # friendly_name, the user just re-paired the device (new IEEE, same name).
    # That's not a silent removal — it's a deliberate action. Log INFO, skip
    # the CRITICAL email + self-heal. Keyed by friendly_name because IEEE
    # changes on re-pair but friendly_name is preserved via Z2M config.
    new_friendly_names = {
        current_by_ieee.get(i, {}).get("friendly_name")
        for i in new_ieees
        if current_by_ieee.get(i, {}).get("friendly_name")
    }
    repaired_ieees: set[str] = set()
    true_ghost_ieees: list[str] = []
    for ieee in ghost_ieees:
        prev_fn = prev_by_ieee.get(ieee, {}).get("friendly_name")
        if prev_fn and prev_fn in new_friendly_names:
            repaired_ieees.add(ieee)
            log.info(
                "  RE-PAIR (not a ghost): %s — old IEEE=%s replaced by new IEEE",
                prev_fn, ieee,
            )
        else:
            true_ghost_ieees.append(ieee)

    # 5. Alert + self-heal each true ghost (if any)
    if true_ghost_ieees:
        log.warning("GHOSTS DETECTED: %d device(s) silently removed", len(true_ghost_ieees))
        for ieee in true_ghost_ieees:
            prev_dev = prev_by_ieee.get(ieee, {})
            friendly_name = prev_dev.get("friendly_name", "unknown")
            last_seen_iso = _format_last_seen(prev_dev.get("last_seen"))

            log.warning("  GHOST: %s  IEEE=%s  last_seen=%s", friendly_name, ieee, last_seen_iso)
            send_ghost_email(friendly_name, ieee, last_seen_iso)

            # Self-heal: CLEAR the retained availability (publish empty + retain).
            # Per MQTT spec, this deletes the retained message entirely. We used
            # to publish {"state":"offline"}, but that woke L1a-waiter and caused
            # a second email 12h later for the same ghost we already alerted on.
            if friendly_name and friendly_name != "unknown":
                avail_topic = f"zigbee2mqtt/{friendly_name}/availability"
                published = mqtt_publish_retained(avail_topic, "")
                if published:
                    log.info("  Self-healed (cleared retained availability) for %s", friendly_name)
                else:
                    log.error("  Self-heal failed for %s", friendly_name)
            else:
                log.warning(
                    "  Skipping self-heal — friendly_name missing for IEEE %s "
                    "(retained availability for its true name, if any, remains stale).",
                    ieee,
                )
    else:
        if repaired_ieees:
            log.info("Only re-pairs detected (%d); no true ghosts. ✓", len(repaired_ieees))
        else:
            log.info("No ghosts detected. ✓")

    # 6. STUCK-OFFLINE DETECTION (covers HA startup-grace edge case).
    # L1a's wildcard wait relies on receiving a fresh MQTT `offline` payload.
    # If a device went offline DURING HA's 30-min startup grace, that payload
    # was suppressed and no later message arrives until Z2M re-pings the
    # device (minutes for routers, ~25 h for battery devices). This loop
    # catches devices that are retained-offline across multiple sweeps.
    availability_now = mqtt_read_all_availability()
    availability_tracking: dict[str, dict[str, Any]] = {}
    # Carry forward prev tracking keys unchanged — used as the fallback path
    # when any upstream read (MQTT or HA) fails. Preserves the clock on
    # devices that were already being tracked so a single transient failure
    # doesn't reset first_offline_sweep_at and cause a false re-alert next
    # sweep.
    def _carry_forward_all():
        for ieee, prev_dev in prev_by_ieee.items():
            carry = {k: prev_dev[k] for k in ("availability", "first_offline_sweep_at", "stuck_alerted") if k in prev_dev}
            if carry:
                availability_tracking[ieee] = carry

    # Guard: if MQTT retained-availability read failed (empty dict from
    # `-W 5` timeout) OR if HA API is unreachable (exclusions/delay lookup
    # returns sentinel), skip this sweep's stuck-offline detection entirely.
    # Without these reads we can't correctly distinguish online-but-unknown
    # from excluded-by-user, and resetting tracking would cause false alerts
    # next sweep.
    if not availability_now:
        log.warning("STUCK-OFFLINE: skipping — retained availability read returned no results (mosquitto slow / down?)")
        _carry_forward_all()
    else:
        exclusions_raw = ha_read_state("input_text.zigbee_offline_exclusions")
        if exclusions_raw is None:
            log.warning("STUCK-OFFLINE: skipping — HA API unreachable (exclusions lookup failed)")
            _carry_forward_all()
        else:
            exclusions = {s.strip() for s in exclusions_raw.split(",") if s.strip()}
            delay_minutes = get_delay_minutes()
            stuck_count = 0
            now_ts = time.time()

            for ieee, device in current_by_ieee.items():
                name = device.get("friendly_name", "")
                if not name or name in exclusions:
                    continue
                prev_dev = prev_by_ieee.get(ieee, {})

                # If the wildcard MQTT read didn't return a value for this
                # device (partial response — mosquitto slow, or >48 devices
                # straddled the 5s window), preserve prev tracking unchanged
                # rather than resetting to "unknown" (which would wipe
                # first_offline_sweep_at and cause a false re-alert later).
                if name not in availability_now:
                    carry = {k: prev_dev[k] for k in ("availability", "first_offline_sweep_at", "stuck_alerted") if k in prev_dev}
                    if carry:
                        availability_tracking[ieee] = carry
                    continue

                state = availability_now[name]

                if state != "offline":
                    # Online or unknown — reset tracking. "unknown" here means
                    # retained availability was genuinely an unknown value
                    # (broker returned a parseable payload we didn't recognise);
                    # missing-from-dict is handled by the branch above.
                    availability_tracking[ieee] = {"availability": state}
                    continue

                # Device is retained-offline.
                if prev_dev.get("availability") != "offline":
                    # First sweep seeing it offline — mark, don't alert yet
                    availability_tracking[ieee] = {
                        "availability": "offline",
                        "first_offline_sweep_at": now_ts,
                        "stuck_alerted": False,
                    }
                    continue

                # Seen offline in both prev and current. Carry forward the first-seen
                # timestamp, and decide whether to alert.
                first_ts = prev_dev.get("first_offline_sweep_at") or now_ts
                already_alerted = bool(prev_dev.get("stuck_alerted"))
                availability_tracking[ieee] = {
                    "availability": "offline",
                    "first_offline_sweep_at": first_ts,
                    "stuck_alerted": already_alerted,
                }

                elapsed_min = int((now_ts - first_ts) / 60)
                if elapsed_min >= delay_minutes and not already_alerted:
                    first_iso = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(int(first_ts)))
                    log.warning(
                        "  STUCK OFFLINE: %s  IEEE=%s  elapsed=%d min  delay=%d min",
                        name, ieee, elapsed_min, delay_minutes,
                    )
                    send_stuck_offline_email(name, ieee, first_iso, elapsed_min)
                    availability_tracking[ieee]["stuck_alerted"] = True
                    stuck_count += 1

            if stuck_count:
                log.warning("STUCK-OFFLINE ALERTS: %d device(s)", stuck_count)

    # 7. Save current snapshot (includes availability tracking state)
    save_snapshot(devices, availability_tracking)
    log.info("=== Zigbee ghost sweep complete ===")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        log.exception("Unhandled exception in ghost sweep")
        sys.exit(99)
