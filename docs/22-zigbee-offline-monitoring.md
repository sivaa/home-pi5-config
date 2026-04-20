# Zigbee Offline Monitoring

> **Purpose:** Email + push alerts whenever ANY Zigbee device drops off the network — current devices and any device added in the future. No hardcoded device lists.

## Why This Exists

```
┌──────────────────────────────────────────────────────────────────────────┐
│  THE INCIDENT (April 2026)                                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Living] Light Switch silently disappeared from Z2M's bridge/devices    │
│  registry ~22 days before anyone noticed. The retained MQTT availability │
│  topic still claimed `online` (lie). No `device_leave` event in Z2M log  │
│  retention. Last embedded `last_seen` was 2026-03-29.                    │
│                                                                          │
│  Pre-existing automations failed to catch it:                            │
│    - `zigbee_router_offline_alert` had the switch in its hardcoded       │
│      list — but its state-trigger edge was missed across an HA restart.  │
│    - `zigbee_device_left_alert` (wildcard) didn't fire — no `Leave`      │
│      frame was emitted; the device was force-removed or dropped silently.│
│                                                                          │
│  Pre-existing automations also only covered ~21 of 48 devices            │
│  (curated lists). The other 27 had no offline alerting at all.           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## The Solution: 6 Layers

```
┌────────────────────────────────────────────────────────────────────────────┐
│  LAYER STACK                                                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  L0  Z2M Bridge State        ← detects Z2M itself going down,             │
│                                gates L1 + L3 to avoid spam during outage  │
│                                                                            │
│  L1a Wildcard Offline        ← MQTT trigger on +/availability,            │
│                                covers ALL devices (current + future)      │
│                                + storm guard + 30-min startup grace       │
│                                                                            │
│  L1b Wildcard Recovery       ← back-online emails (with own storm guard)  │
│                                                                            │
│  L2  Device Left (existing)  ← explicit Zigbee Leave frame                │
│                                (already wildcard, kept untouched)         │
│                                                                            │
│  L3  Daily Ghost Sweep       ← Python systemd-timer twice a day:          │
│                                diffs bridge/devices vs snapshot, alerts   │
│                                + self-heals on silent removals            │
│                                                                            │
│  L4  Email Delivery Monitor  ← phone push fallback if SMTP itself fails   │
│                                                                            │
│  L5  SMTP Canary + Z2M-Nag   ← weekly heartbeat + hourly stuck-down nag   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Defense-in-depth**: the existing per-entity automations (`contact_sensor_offline_alert`, `thermostat_low_battery_alert`) are kept alongside the new wildcard for their specialized messaging. The legacy `zigbee_router_offline_alert` was RETIRED on 2026-04-20 after a full-system review — L1a wildcard now covers all routers and the legacy was firing duplicate emails 12 h after each L1a alert for the same event.

### Additional resilience features (Apr 2026)

**Weekly SMTP canary** (automation `smtp_canary_weekly`, alias "SMTP Canary — Weekly Heartbeat"): Sundays at 09:00 local, sends a minimal INFO "Pi weekly heartbeat" email. Its absence means Gmail App Password has silently expired. L4 complements this: fires immediately on an active SMTP error, whereas the canary catches the case where no real email was attempted during the quiet period.

**Z2M stuck-down hourly nag** (`z2m_stuck_down_hourly_nag`): if `input_boolean.z2m_online` stays `off` for >1 hour, fires hourly CRITICAL email + phone push. Gated to 07:00–22:00 local so it doesn't wake anyone at 3am — the initial L0 transition alert already fired when Z2M went down, the nag is for persistent daytime visibility.

**Ghost-sweep stuck-offline detector** (in `zigbee-ghost-sweep.py`): covers the narrow edge case where a device went offline during HA's 30-min startup grace window and L1a never got a fresh MQTT trigger to start its wait. Each sweep scans retained `zigbee2mqtt/+/availability` topics and tracks `first_offline_sweep_at` per device in the snapshot. If a device has been retained-offline across sweeps for > `zigbee_offline_delay_minutes`, fires WARNING email once.

**Ghost-sweep OnFailure hook**: systemd `OnFailure=zigbee-ghost-sweep-failure.service` POSTs a CRITICAL email via HA API if the Python script crashes. Closes the silent-crash gap.

**Snapshot corruption guard**: ghost-sweep refuses to overwrite a corrupt `snapshot.json` (would wipe evidence of any pending ghost) and instead fires a CRITICAL email for manual investigation.

## What Each Layer Catches

| Failure mode | L0 | L1 | L2 | L3 | Per-entity (legacy) |
|---|---|---|---|---|---|
| Z2M container dies | ✓ | gated off | — | gated off | — |
| USB dongle disconnects | ✓ | gated off | — | gated off | — |
| Device battery dies | — | ✓ (after timeout) | — | — | only if curated |
| Device unplugged (router) | — | ✓ (after 2 min) | — | — | only if curated |
| Device sends Zigbee `Leave` | — | ✓ | ✓ | ✓ | only if curated |
| Device silently force-removed | — | ✗ no MQTT | ✗ no event | ✓ | ✗ |
| Living-Switch incident class | — | ✗ | ✗ | ✓ | ✗ |
| Coordinator wipes the network | ✓ + L1 storm | summary email | flood | ✓ | flood |
| `notify.email` itself fails | — | — | — | — | L4 catches |

## Detection Timing

| Device class | Z2M marks as offline | Email fires (with 12 h delay) |
|---|---|---|
| Mains-powered router (plugs, switches, USB sensors) | ~2 min (Z2M `active.timeout: 2`) | ~12 h later, if still offline |
| Battery end device (temp / thermostats / contacts / remotes) | ~25 h (Z2M default `passive.timeout`) | ~12 h later, if still offline |
| Silent registry removal | never (the whole bug) | Caught by L3 ghost sweep at next 03:30 or 15:30 — fires immediately (no delay) |

### Configurable recovery delay

L1a does NOT email immediately when a device goes offline. It waits
`input_number.zigbee_offline_delay_minutes` (default **720 min = 12 h**)
and only emails if the device is STILL offline at the end. If the
device publishes `availability=online` during the wait, the run exits
silently — no email.

Rationale: many "offlines" are transient (wall-switch reboot, Z2M
restart republishing stale retained state, momentary mesh routing
hiccup). The 12-hour wait absorbs all of them.

Change the delay via HA UI → Settings → Devices & Services → Helpers →
*Zigbee Offline Alert Delay (minutes)*. Effective immediately for
newly-triggered waits (in-flight waits keep their original timeout).

- **0 min** → back to immediate alerts (old behavior)
- **60 min** → 1-hour grace (sensible for battery devices that
  occasionally stall briefly)
- **720 min** → default 12 h
- **1440 min** → 24 h (maximally forgiving)

The ghost sweep (L3) and Z2M-down alert (L0) are NOT affected by this
helper — both fire immediately, because both represent irrecoverable
conditions that need human attention.

### Two-stage L1a architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  L1a STAGE 1: zigbee_offline_waiter (mode: parallel, max: 60)        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  trigger: MQTT +/availability                                        │
│  conditions: offline payload, not excluded, Z2M up, grace passed     │
│         │                                                            │
│         ▼                                                            │
│  wait_for_trigger on same topic with payload: online                 │
│  timeout: zigbee_offline_delay_minutes min (default 720)             │
│         │                                                            │
│         ├── online arrived → wait.completed=true → skip, exit         │
│         └── timeout → fire event zigbee_offline_confirmed           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  L1a STAGE 2: zigbee_offline_confirmed_emailer (mode: queued, max:50)│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  trigger: event zigbee_offline_confirmed                             │
│  action:                                                             │
│    reset storm window if expired                                     │
│    counter.increment                                                 │
│    if count == 6 → send summary email + stop                         │
│    if count >  6 → suppress + stop                                   │
│    else          → send per-device email                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Why split? The waiter is `parallel` so each device waits independently
(48 devices can wait 12 h simultaneously without blocking each other).
The emailer is `queued` because the storm-guard counter is only safe
under serial execution (see commit 2713492 for the race-fix detail).
The internal event is the bridge that decouples them.

## Storm Guard (Both Directions)

If 6+ offline events fire within a 5-minute sliding window:
- 5 per-device emails sent (counter 1→5)
- 6th event triggers ONE summary email + phone push
- 7th onwards silently suppressed

Same pattern protects L1b recovery (when 48 devices come back after Z2M restart).

```
event #1  → counter 1, per-device email
event #2  → counter 2, per-device email
event #3  → counter 3, per-device email
event #4  → counter 4, per-device email
event #5  → counter 5, per-device email
event #6  → counter 6, ┌─ stop: STORM SUMMARY EMAIL FIRES
                       └─ phone push CRITICAL
events 7+ → counter N, stop: silently suppressed
            (window resets after 5 min of silence)
```

**Why it works under load**: counter is read FRESH via `states()` AFTER `counter.increment` — this is post-increment state, so each serialized run sees its own correct value. An earlier broken design captured the counter in a `variables:` snapshot at trigger-queue time and missed the threshold under rapid-fire load. See commit 2713492 for the fix detail.

## Startup Grace

After HA restart:
- `input_boolean.ha_startup_complete` is OFF for 30 minutes
- L1a + L1b conditions check this — both suppressed during the grace window
- L0 (bridge state) is NOT suppressed — Z2M-down should alert immediately

This absorbs the retained-MQTT-replay storm that would otherwise hit on every HA restart.

## Excluding Devices

Some lights are powered off via the wall switch (not Zigbee). Their `availability=offline` is normal, not a fault. The default exclusion list:

```
[Study] IKEA Light, [Living] IKEA Light, [Bath] Light
```

To add or remove: HA UI → Settings → Devices & Services → Helpers → search "Zigbee Offline Alert Exclusions" → edit. Comma-separated, max 255 chars. Effective immediately, no restart.

## Layer 3: Ghost Sweep

Standalone Python systemd timer that diffs `bridge/devices` against a saved snapshot. Catches silent removals where:
- L1 can't fire (no `availability=offline` was published)
- L2 can't fire (no `device_leave` event was emitted)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GHOST SWEEP FLOW                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  systemd timer fires at 03:30 + 15:30 daily (avoiding 04:30 reboot)      │
│         │                                                                │
│         ▼                                                                │
│  zigbee-ghost-sweep.py                                                   │
│         ├── Read bridge/state from MQTT  →  if offline, skip (L0 owns)   │
│         ├── Read bridge/devices retained                                 │
│         ├── Load /var/lib/zigbee-ghost-sweep/snapshot.json (prev IEEEs)  │
│         ├── Diff:                                                        │
│         │     ghosts  = prev - current                                    │
│         │     newcomers = current - prev                                 │
│         ├── Re-pair detection: if a ghost's friendly_name matches a      │
│         │   newcomer's friendly_name → log INFO, skip alert              │
│         ├── For each TRUE ghost:                                         │
│         │     - POST script.send_alert_email (CRITICAL)                  │
│         │     - mosquitto_pub -r availability=offline (self-heal)        │
│         └── Save current snapshot for next run                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Manual run**:
```bash
ssh pi@pi 'sudo systemctl start zigbee-ghost-sweep.service'
ssh pi@pi 'sudo journalctl -u zigbee-ghost-sweep.service -n 30 --no-pager'
```

## What To Do When You Get An Alert

| Email title | Likely cause | Action |
|---|---|---|
| 🚨 Z2M BRIDGE DOWN | container crash / USB dongle | `ssh pi@pi 'sudo systemctl status zigbee2mqtt'` |
| Zigbee Device Offline (battery sensor) | dead battery / out of range | Replace battery (CR2032/CR2477/AA), or move closer |
| Zigbee Device Offline (router: switch/plug) | unplugged / power loss / firmware crash | Check power; reboot the device |
| Zigbee Device Offline (presence / CO2) | USB power loss or USB cable | Check USB cable + power source |
| 🌩 ZIGBEE OFFLINE STORM | many devices at once | Coordinator failure, Z2M crash, or critical router down — open dashboard Device Health view |
| 🚨 Zigbee Ghost Device Detected | silent removal | Re-pair the device per `docs/05-zigbee-devices.md` |
| 📧 EMAIL DELIVERY FAILED (phone push) | Gmail App Password expired | Regenerate App Password, update `secrets.yaml` |

## Files & Locations

### In this repo (source of truth)

| File | Purpose |
|---|---|
| `configs/homeassistant/automations.yaml` | L0 + L1a + L1b + L4 + storm guards |
| `configs/homeassistant/configuration.yaml` | helpers (input_boolean, input_text, counter, input_datetime) |
| `configs/homeassistant/scripts.yaml` | `send_alert_email` script (HTML-escaped) |
| `services/zigbee-ghost-sweep/zigbee-ghost-sweep.py` | L3 ghost sweep |
| `configs/zigbee-ghost-sweep/zigbee-ghost-sweep.{service,timer}` | systemd unit |
| `services/zigbee-ghost-sweep/CLAUDE.md` | service architecture doc |

### On the Pi

| Path | Purpose |
|---|---|
| `/opt/homeassistant/{automations,configuration,scripts}.yaml` | Live HA configs |
| `/opt/zigbee-ghost-sweep/zigbee-ghost-sweep.py` | Live script |
| `/etc/systemd/system/zigbee-ghost-sweep.{service,timer}` | systemd units |
| `/var/lib/zigbee-ghost-sweep/snapshot.json` | Ghost-sweep snapshot |
| `/opt/zigbee-watchdog/.env` | `ZIGBEE_WATCHDOG_HA_TOKEN` (shared HA long-lived token) |
| `/opt/homeassistant/secrets.yaml` | `gmail_app_password` |

## HA Helpers Reference

| Helper | Purpose | Default |
|---|---|---|
| `input_boolean.z2m_online` | Bridge state gate for L1+L3 | `on` |
| `input_boolean.ha_startup_complete` | 30-min grace flag | `off` for 30 min after start, then `on` |
| `input_text.zigbee_offline_exclusions` | Comma-list of devices to skip | 3 wall-switch lights |
| `counter.zigbee_offline_storm_count` | Sliding 5-min offline counter | 0 |
| `counter.zigbee_recovery_storm_count` | Sliding 5-min recovery counter | 0 |
| `input_datetime.zigbee_offline_storm_window_start` | Offline storm window anchor | sentinel |
| `input_datetime.zigbee_recovery_storm_window_start` | Recovery storm window anchor | sentinel |
| `input_datetime.zigbee_offline_storm_summary_last` | Last summary email sent | sentinel |
| `input_datetime.zigbee_recovery_storm_summary_last` | Last recovery summary sent | sentinel |
| `input_datetime.email_delivery_alert_last` | L4 throttle (1/24h) | sentinel |
| `input_number.zigbee_offline_delay_minutes` | L1a wait time before emailing | 720 (12 h) |

## Testing

### Verify L1 wildcard fires

```bash
ssh pi@pi 'HA_TOKEN=$(sudo grep ZIGBEE_WATCHDOG_HA_TOKEN /opt/zigbee-watchdog/.env | cut -d= -f2- | tr -d "\"")
# Force startup grace ON for testing
curl -sf -X POST -H "Authorization: Bearer $HA_TOKEN" \
  -d "{\"entity_id\":\"input_boolean.ha_startup_complete\"}" \
  -H "Content-Type: application/json" \
  http://localhost:8123/api/services/input_boolean/turn_on > /dev/null

# Publish fake offline
docker exec mosquitto mosquitto_pub -h localhost \
  -t "zigbee2mqtt/[Test] Fake/availability" -m "{\"state\":\"offline\"}"

# Cleanup retained message
docker exec mosquitto mosquitto_pub -h localhost \
  -t "zigbee2mqtt/[Test] Fake/availability" -m "" -r'
```

### Verify storm guard kicks in

Publish 7 fake offlines in rapid succession; expect exactly 5 per-device emails + 1 summary + 1 silent suppression. The counter reaches 7. Reset between tests:

```bash
ssh pi@pi 'HA_TOKEN=$(sudo grep ZIGBEE_WATCHDOG_HA_TOKEN /opt/zigbee-watchdog/.env | cut -d= -f2- | tr -d "\"")
curl -sf -X POST -H "Authorization: Bearer $HA_TOKEN" \
  -d "{\"entity_id\":\"counter.zigbee_offline_storm_count\"}" \
  -H "Content-Type: application/json" \
  http://localhost:8123/api/services/counter/reset > /dev/null
curl -sf -X POST -H "Authorization: Bearer $HA_TOKEN" \
  -d "{\"entity_id\":\"input_datetime.zigbee_offline_storm_window_start\",\"datetime\":\"1970-01-01 00:00:00\"}" \
  -H "Content-Type: application/json" \
  http://localhost:8123/api/services/input_datetime/set_datetime > /dev/null'
```

### Verify ghost sweep

```bash
# Manual run
ssh pi@pi 'sudo systemctl start zigbee-ghost-sweep.service'
ssh pi@pi 'sudo journalctl -u zigbee-ghost-sweep.service --since "1 min ago" --no-pager'

# Inject a fake ghost (DESTRUCTIVE — only for testing)
# 1. Read snapshot
ssh pi@pi 'sudo cat /var/lib/zigbee-ghost-sweep/snapshot.json | jq .device_count'
# 2. Add a fake IEEE entry by manually editing snapshot.json on the Pi
# 3. Run the service — should alert about the fake ghost
# 4. Restore by deleting snapshot — next run will resnapshot from current state
```

## Disaster Recovery

If rebuilding the Pi from scratch:

1. Deploy `configs/homeassistant/{automations,configuration,scripts}.yaml` per `docs/00-DISASTER-RECOVERY.md`
2. Create the helpers via HA YAML reload (helpers from `configuration.yaml` register on HA restart)
3. Deploy ghost-sweep:
   ```bash
   sudo mkdir -p /opt/zigbee-ghost-sweep /var/lib/zigbee-ghost-sweep
   sudo cp services/zigbee-ghost-sweep/zigbee-ghost-sweep.py /opt/zigbee-ghost-sweep/
   sudo cp configs/zigbee-ghost-sweep/zigbee-ghost-sweep.{service,timer} /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now zigbee-ghost-sweep.timer
   ```
4. Verify:
   ```bash
   sudo systemctl list-timers zigbee-ghost-sweep.timer
   sudo systemctl start zigbee-ghost-sweep.service  # manually fire once
   ```

## Related Documentation

- [services/zigbee-ghost-sweep/CLAUDE.md](../services/zigbee-ghost-sweep/CLAUDE.md) — full architecture for the ghost sweep
- [configs/homeassistant/CLAUDE.md](../configs/homeassistant/CLAUDE.md) — alert automation matrix + history
- [docs/19-zigbee-watchdog.md](19-zigbee-watchdog.md) — restart Z2M after USB disconnect
- [docs/21-zigbee-network-incident-2026-01-04.md](21-zigbee-network-incident-2026-01-04.md) — prior network-loss incident

## History

- **2026-04-20** — Built. 4 layers + storm guard + startup grace. Triggered by `[Living] Light Switch` ghost-removal incident. Total HA automations: 78 → 83.
- **2026-04-20** — Code-review fixes (commit 2713492): storm-guard race fixed (post-increment counter read), L1b recovery storm guard added, ghost-sweep re-pair detection, HTML-escape on email template, tightened L4 trigger.
- **2026-04-20** — 12-hour recovery delay (commit 8fbd880): L1a split into parallel waiter + queued emailer. Wait configurable via `input_number.zigbee_offline_delay_minutes` (default 720). Transient offlines no longer email.
- **2026-04-20** — Full-system review response (commit 61acdc6): retired legacy `zigbee_router_offline_alert`/`_online_alert` (redundant with L1a), removed dead `_summary_last` helpers, added B5 stuck-offline detector in ghost sweep, systemd `OnFailure=` hook, Z2M stuck-down hourly nag, snapshot-corruption CRITICAL alert, self-heal leak fix, weekly SMTP canary, contact-repeat cadence /4h→/12h, HTML template dark-mode fixes.
- **2026-04-20** — Post-review fixes: B5 tracking preserves state on MQTT/HA failure (no false re-alerts); notify-failure.sh uses real newlines; stale docs swept.
