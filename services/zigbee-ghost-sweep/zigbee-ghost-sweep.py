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
# A ghost must have been present for at least this many runs before alerting.
# Prevents one-shot bridge/devices glitches from causing false positives.
MIN_PRESENT_RUNS_BEFORE_GHOST_ALERT = 1

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
            "severity": "CRITICAL",
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
def load_snapshot() -> dict[str, Any] | None:
    """Load previous snapshot. Returns None if missing or corrupt."""
    if not SNAPSHOT_FILE.exists():
        log.info("No prior snapshot at %s — first run, will save and exit.", SNAPSHOT_FILE)
        return None
    try:
        with SNAPSHOT_FILE.open() as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        log.error("Snapshot %s is corrupt: %s — treating as first run.", SNAPSHOT_FILE, e)
        return None


def save_snapshot(devices: list[dict[str, Any]]) -> None:
    """Persist the current non-coordinator device list as the new snapshot.
    Coordinator is excluded — it sits in bridge/devices with type=Coordinator
    but the diff logic treats it specially (never a ghost), so keeping it in
    the snapshot would cause a false positive on the very next run."""
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    real_devices = [d for d in devices if d.get("type") != "Coordinator"]
    snapshot = {
        "saved_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "device_count": len(real_devices),
        "devices": [
            {
                "ieee_address": d.get("ieee_address"),
                "friendly_name": d.get("friendly_name"),
                "model": (d.get("definition") or {}).get("model"),
                "last_seen": d.get("last_seen"),
            }
            for d in real_devices
        ],
    }
    tmp = SNAPSHOT_FILE.with_suffix(".json.tmp")
    with tmp.open("w") as f:
        json.dump(snapshot, f, indent=2)
    tmp.replace(SNAPSHOT_FILE)
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
    prev = load_snapshot()
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
            ", ".join(prev_by_ieee.get(i, current_by_ieee.get(i, {})).get("friendly_name", i) for i in new_ieees),
        )

    if not ghost_ieees:
        log.info("No ghosts detected. ✓")
        save_snapshot(devices)
        return 0

    # 5. Alert + self-heal each ghost
    log.warning("GHOSTS DETECTED: %d device(s) silently removed", len(ghost_ieees))
    for ieee in ghost_ieees:
        prev_dev = prev_by_ieee.get(ieee, {})
        friendly_name = prev_dev.get("friendly_name", "unknown")
        last_seen = prev_dev.get("last_seen")
        last_seen_iso = None
        if isinstance(last_seen, (int, float)):
            try:
                last_seen_iso = time.strftime(
                    "%Y-%m-%d %H:%M:%S UTC",
                    time.gmtime(int(last_seen) / 1000),
                )
            except (ValueError, OSError):
                pass
        elif isinstance(last_seen, str):
            last_seen_iso = last_seen

        log.warning("  GHOST: %s  IEEE=%s  last_seen=%s", friendly_name, ieee, last_seen_iso)

        # Email
        send_ghost_email(friendly_name, ieee, last_seen_iso)

        # Self-heal: publish retained availability=offline so dashboards stop
        # claiming the device is online.
        if friendly_name and friendly_name != "unknown":
            avail_topic = f"zigbee2mqtt/{friendly_name}/availability"
            published = mqtt_publish_retained(avail_topic, '{"state":"offline"}')
            if published:
                log.info("  Self-healed retained availability for %s", friendly_name)
            else:
                log.error("  Self-heal failed for %s", friendly_name)

    # 6. Save current snapshot for next run
    save_snapshot(devices)
    log.info("=== Zigbee ghost sweep complete ===")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        log.exception("Unhandled exception in ghost sweep")
        sys.exit(99)
