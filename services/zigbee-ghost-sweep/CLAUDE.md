# Zigbee Ghost Device Sweep

## Purpose

Detects "ghost removals" — Zigbee devices that disappeared from Z2M's
`bridge/devices` registry without ever publishing `availability=offline` and
without firing a `bridge/event type=device_leave`. These cases are invisible
to the wildcard MQTT availability alert (Layer 1) and to the explicit-leave
alert (Layer 2) inside Home Assistant, so a periodic snapshot diff is the
only way to catch them.

## The Incident That Motivated This

> **2026-04-20** — `[Living] Light Switch` (IEEE `0x58263afffefc5706`,
> SONOFF ZBM5-1C-80/86 wall switch) was discovered missing from
> `zigbee2mqtt/bridge/devices`. The retained `availability` MQTT topic still
> claimed `{"state":"online"}`. No `device_leave` event was in the Z2M log
> retention window (5 days). Last embedded `last_seen` timestamp:
> `2026-03-29 10:57:18 UTC` — meaning the device had been silently gone for
> ~22 days before anyone noticed. Neither HA's `zigbee_router_offline_alert`
> (the switch was in its hardcoded list) nor any other alert fired, because
> the state-trigger edge was missed across an HA restart while the device
> was already in the unavailable state.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GHOST SWEEP DATA FLOW                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  systemd timer (03:30 + 15:30 daily)                                     │
│         │                                                                │
│         ▼                                                                │
│  zigbee-ghost-sweep.py                                                   │
│         │                                                                │
│         ├── 1. mosquitto_sub bridge/state                                │
│         │     │                                                          │
│         │     └── if offline → exit (HA L0 alerts separately)            │
│         │                                                                │
│         ├── 2. mosquitto_sub bridge/devices  (retained, full registry)   │
│         │                                                                │
│         ├── 3. Load /var/lib/zigbee-ghost-sweep/snapshot.json (previous) │
│         │                                                                │
│         ├── 4. Diff:  ghosts = prev_IEEEs - current_IEEEs                │
│         │                                                                │
│         ├── 5. For each ghost:                                           │
│         │     ├── POST to HA /api/services/script/send_alert_email       │
│         │     │   (CRITICAL severity, includes IEEE + last_seen)         │
│         │     └── mosquitto_pub -r availability=offline                  │
│         │         (self-heal lying retained state)                        │
│         │                                                                │
│         └── 6. Save current snapshot for next run                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Key Files

| Path | Purpose |
|------|---------|
| `services/zigbee-ghost-sweep/zigbee-ghost-sweep.py` | Main script |
| `configs/zigbee-ghost-sweep/zigbee-ghost-sweep.service` | systemd one-shot unit |
| `configs/zigbee-ghost-sweep/zigbee-ghost-sweep.timer` | systemd timer (03:30 + 15:30) |

## Pi-Side Layout

| Path | Purpose |
|------|---------|
| `/opt/zigbee-ghost-sweep/zigbee-ghost-sweep.py` | Deployed script |
| `/etc/systemd/system/zigbee-ghost-sweep.service` | systemd unit |
| `/etc/systemd/system/zigbee-ghost-sweep.timer` | systemd timer |
| `/opt/zigbee-watchdog/.env` | `HA_TOKEN=...` (shared with zigbee-watchdog + heater-watchdog) |
| `/var/lib/zigbee-ghost-sweep/snapshot.json` | Previous device list |

## Configuration

Reads `HA_TOKEN` from `/opt/zigbee-watchdog/.env` (same long-lived token used
by `heater-watchdog` and `zigbee-watchdog`).

Optional environment overrides:
- `HA_URL` (default `http://localhost:8123`)
- `MOSQUITTO_CONTAINER` (default `mosquitto`)

## Behavior on First Run

If `snapshot.json` doesn't exist, the script saves the current device list
and exits without alerting. Subsequent runs diff against this snapshot.

## False-Positive Guards

1. **Z2M-down skip** — exits silently if `bridge/state == offline`. HA's L0
   bridge-state alert covers that case via a different channel.
2. **Empty / malformed bridge/devices skip** — refuses to overwrite the
   snapshot if the live payload is missing or malformed (prevents one
   network blip from wiping the baseline and false-alarming on every device
   the next run).
3. **Coordinator excluded** — the coordinator's own IEEE is skipped (it
   appears in `bridge/devices` with `type: Coordinator` and never goes
   "missing" in the same sense).

## Self-Heal

When a ghost is detected, the script publishes a retained
`availability={"state":"offline"}` on `zigbee2mqtt/<friendly_name>/availability`.
This corrects the lying retained state so the dashboard's device-health
view + any other MQTT subscribers stop claiming the device is online.

## Manual Run / Debug

```bash
# Trigger one sweep manually
ssh pi@pi 'sudo systemctl start zigbee-ghost-sweep.service'

# Check last run output
ssh pi@pi 'sudo journalctl -u zigbee-ghost-sweep.service -n 50'

# Inspect the snapshot
ssh pi@pi 'sudo cat /var/lib/zigbee-ghost-sweep/snapshot.json | jq ".device_count, .saved_at"'

# Force a fake ghost (DESTRUCTIVE — for testing only)
# 1. Save current snapshot
# 2. Manually edit it to add a fake IEEE that won't be in current bridge/devices
# 3. Run the service — should alert
```

## Companion HA Automations

| ID | Layer | Role |
|----|-------|------|
| `z2m_bridge_state_alert` | L0 | Alert when Z2M itself goes down — gates this script |
| `zigbee_any_device_offline_alert` | L1 | Wildcard MQTT availability=offline emails |
| `zigbee_device_left_alert` | L2 | Explicit Zigbee Leave frame emails |
| (this script) | L3 | Catches the silent-removal case the others miss |
| `email_delivery_failure_alert` | L4 | Phone fallback if SMTP itself fails |
