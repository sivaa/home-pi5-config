# Light + Upstream Switch Integration - Design

**Date:** 2026-04-18
**Scope:** Dashboard (`services/dashboard/www/`)
**Status:** Approved for implementation

## Problem

Three smart lights are physically wired through SONOFF ZBM5-1C wall switches:

| Light | Upstream switch |
|-------|-----------------|
| `[Study] IKEA Light` (FLOALT) | `[Study] Light Switch` |
| `[Living] IKEA Light` (FLOALT) | `[Living] Light Switch` |
| `[Bed] Light` (EGLO Rovito-Z) | `[Bed] Light Switch` |

When a user (or anyone in the flat) flips one of these wall switches off, the bulb loses mains power and drops off Zigbee. The dashboard's ON button on that light card then silent-fails: it publishes `{state: "ON"}` to a bulb topic with no powered device listening. Worse, the button is usually disabled anyway because `light.available === false` once Z2M flags the bulb offline.

`[Bath] Light` and `[Hallway] Light` have no upstream smart switch - they're wired directly - so they are not in scope.

## Goal

Tapping ON on a light card should *make the light come on*, even when the upstream switch is off. Tapping OFF should behave as it does today (bulb command only - the switch stays energised so the bulb stays on the mesh).

Additionally: surface the switch-off state on the card so the user understands why the bulb appears unavailable.

## Design

### 1. Data model

**Switches store** (`Alpine.store('switches', ...)` in `index.html`)

Today the store has one entry (`bedroom_switch`). Add two more so all three gating switches are tracked:

```js
{
  id: 'study_switch',
  name: 'Study Light Switch',
  roomId: 'study',
  topic: '[Study] Light Switch',
  state: 'OFF',
  available: true,
  linkquality: null,
  lastSeen: null,
},
{
  id: 'living_switch',
  name: 'Living Light Switch',
  roomId: 'living',
  topic: '[Living] Light Switch',
  state: 'OFF',
  available: true,
  linkquality: null,
  lastSeen: null,
},
{
  id: 'bedroom_switch',   // unchanged, kept for continuity
  name: 'Bedroom Light Switch',
  roomId: 'bedroom',
  topic: '[Bed] Light Switch',
  ...
}
```

Add a lookup helper on the store: `byId(id)` and `byLightId(lightId)` (or expose the list and let callers filter - trivial).

The existing MQTT subscription loop (`sw.topic` in the subscription block) already iterates the list, so the two new entries get subscribed to `zigbee2mqtt/[Study|Living] Light Switch` and their `/availability` topics automatically. No subscription-code changes.

**Lights store** - add one field to the three gated lights:

```
study_light   → switchId: 'study_switch'
living_light  → switchId: 'living_switch'
bed_light     → switchId: 'bedroom_switch'
```

Bath and Hallway get no `switchId`.

### 2. Behaviour: `toggleLight(light)`

```
toggleLight(light):
  clearTimeout(light._pendingOnTimer)           // cancel any previous delayed ON

  newState = light.state === 'ON' ? 'OFF' : 'ON'
  sw       = light.switchId ? switches.byId(light.switchId) : null

  // Defensive: if we have a switch and aren't certain it's ON, send ON first.
  // State 'OFF' or undefined (stale / never seen) both trigger the pre-pulse.
  // Switch-ON is idempotent; an extra frame is free insurance against stale state.
  needsPowerCycle = (newState === 'ON') and sw and sw.available and sw.state !== 'ON'

  if needsPowerCycle:
    publish `zigbee2mqtt/{sw.topic}/set` {state: 'ON'}
    // Bulb needs ~2-5s to boot its Zigbee radio and rejoin the mesh after
    // mains restore. 3000ms is a pragmatic middle ground: long enough for
    // IKEA FLOALT / AwoX / EGLO Rovito-Z to be reachable, short enough
    // that the UI still feels responsive. Bulb's power-on default is
    // "restore last state" - if last state was OFF we still need to push ON.
    light._pendingOnTimer = setTimeout(() => {
      sendBulbCommand(light, 'ON')              // existing publish path
      light._pendingOnTimer = null
    }, 3000)
  else:
    sendBulbCommand(light, newState)            // existing path, untouched
```

`sendBulbCommand(light, state)` is just a name for the **existing** branching inside the current `toggleLight` (publishCommand for simple lights; `_publishRaw(light, _togglePayload(light, state))` for dual-endpoint lamps like Bed/Hallway). No new publish code - we just hoist the existing logic into an internal helper so it can be called from either the immediate path or the delayed path.

**Race cancellation:** any subsequent `toggleLight` call on the same light clears `_pendingOnTimer` first, so a rapid ON → OFF tap sequence correctly lands on OFF. Same pattern the store already uses for `_brightnessTimeout` / `_colorTempTimeout`.

### 3. Behaviour: `toggleAllLights()`

Same logic per-light. Each light gets its own `_pendingOnTimer`; the three switches may pre-pulse in parallel (harmless - they're independent devices on the mesh).

```
toggleAllLights():
  allOn    = every light is ON
  newState = allOn ? 'OFF' : 'ON'
  for each light:
    (same branch as toggleLight, per-light timer)
```

### 4. Button enablement

Current (`index.html:704`):

```html
:disabled="light.syncing || !light.available"
```

Problem: a light whose bulb is unavailable *because the switch is off* is exactly the case we want to let the user recover from. Override:

```html
:disabled="light.syncing || (!light.available && !$store.lights.canPowerCycle(light))"
```

Where `canPowerCycle(light)` on the lights store:

```js
canPowerCycle(light) {
  if (!light.switchId) return false
  const sw = Alpine.store('switches').byId(light.switchId)
  return !!(sw && sw.available && sw.state !== 'ON')
}
```

So the button stays clickable when the bulb is offline **iff** we have a powered switch we can use to re-energise it.

### 5. UI hint - "Switch off" badge

In the light-card template, add a small badge rendered only when:

```
light.switchId && sw.available && sw.state === 'OFF'
```

(Implementation: an Alpine `x-show` block using a `$store.lights.getLightSwitch(light)` helper that returns the linked switch record or `null`.)

Visuals:
- Text: `🔌 Switch off`
- Placement: directly under the light name, small (11-12 px), muted text colour
- New CSS class `light-switch-off` on the card root for any card-level styling (e.g. slightly different opacity than `light-unavailable` to distinguish the two states)

When the switch turns ON (after user tap, or externally), the badge disappears reactively as soon as the switch's MQTT state propagates.

**Do NOT** show the badge when the switch is *unavailable* (Z2M hasn't heard from it recently). We don't know its true state; claiming "switch off" would lie. The existing `light-unavailable` styling already covers that case adequately.

### 6. Circadian / brightness / color-temp commands

Out of scope. If a user adjusts brightness or colour temp while the bulb is offline, those commands still silent-fail as they do today. This spec only covers the ON path. If a follow-up needs "auto-repower on any command", it can reuse `canPowerCycle` - but we're deliberately not shipping that now.

## Non-goals

- No OFF-cuts-mains behaviour. Standby power (~0.3 W per bulb) accepted in exchange for reliable Zigbee availability and instant next ON.
- No change to Bath / Hallway cards (no upstream switch).
- No change to the floor-plan indicator (`getRoomLightClass`) - it already uses the switch as a Priority 2 fallback.
- No new store. The existing `switches` store absorbs two more entries.
- No listen-for-availability-then-ON robustness logic (debated and deferred; 3000 ms fixed delay is proportional to the risk).

## Files touched

| File | Change |
|------|--------|
| `services/dashboard/www/index.html` | +2 entries in switches store, +1 `switchId` field on each of 3 lights, `toggleLight` / `toggleAllLights` pre-pulse branch, `canPowerCycle` + `getLightSwitch` helpers, `:disabled` expression, badge markup in light-card template |
| `services/dashboard/www/styles/views/lights.css` | `.light-switch-off` class + badge styling (co-located with existing `.light-unavailable`) |
| `services/dashboard/CLAUDE.md` | Update "Switches Store" and "Room-to-Switch Mapping" sections: 3 switches tracked, not 1; indicator priority unchanged |

No new files. No backend / HA / Z2M changes.

## Testing plan

Local dashboard (`python -m http.server 8888` from `services/dashboard/www/`), connected to live Pi MQTT:

1. **Happy path - switch already ON.** Tap ON on Study card. Expected: single MQTT publish to `zigbee2mqtt/[Study] IKEA Light/set {"state":"ON"}`. No switch publish. Bulb turns on immediately.
2. **Recovery path - switch physically off.** Use the Bed Light Switch (for safety - won't disturb Study/Living during testing). Physically flip it off. Wait for Z2M to mark bulb unavailable and switch state to OFF. On the dashboard, tap ON on the Bed card. Expected:
   - Button is clickable despite `light.available === false`
   - Badge "🔌 Switch off" is visible before tap
   - First MQTT publish: `[Bed] Light Switch/set {"state":"ON"}`
   - 3 s later: bulb ON publish
   - Bulb comes on; badge clears; card returns to normal.
3. **Race - rapid ON → OFF.** With switch off, tap ON then tap OFF within 1 s. Expected: switch ON goes out, pending timer is cancelled, bulb OFF publishes. Bulb ends up OFF (not briefly ON). Verify by watching `docker exec mosquitto mosquitto_sub -t 'zigbee2mqtt/#' -v`.
4. **Defensive - stale switch state.** Force `switches.list[i].state = undefined` via browser DevTools. Tap ON. Expected: switch pre-pulse still fires (because `state !== 'ON'`). Idempotent - no harm.
5. **Bath/Hallway unchanged.** Tap ON on Bath. Expected: no switch lookup, single bulb publish, identical to current behaviour.
6. **All-lights toggle.** Tap the all-lights button with one gated light's switch off. Expected: each affected light fires its own pre-pulse + its own 3 s timer independently. All three switches may publish in parallel.
7. **Badge reactivity.** With badge visible, publish `zigbee2mqtt/[Study] Light Switch {"state":"ON"}` manually via `mosquitto_pub`. Expected: badge disappears within one MQTT round-trip.

Deploy to Pi after local tests pass.

## Risks

- **3000 ms is a guess.** If real-world rejoin exceeds 3 s for a specific bulb on a specific day (mesh congestion, rejoin backoff), the delayed ON will miss and the user will have to tap ON a second time (which then hits the already-powered bulb and works). Acceptable failure mode. If it recurs, upgrade to the listen-for-availability approach.
- **AwoX/EGLO Rovito-Z firmware quirks.** Per the 2026-04-15 lesson, older AwoX firmware had ZDO handshake issues. Re-energising via switch triggers a full rejoin, which could re-surface any latent rejoin bug. Mitigation: the bulb is already on firmware `3.0.1_1593`; the workflow is well-tested from the re-pair incident on 2026-04-17.
- **Circadian race.** The HA circadian automation may push colour-temp to the bulb during the 3 s rejoin window. Those commands will silent-fail but circadian retries on its own cadence, so state converges. No action needed.

## Approval

Design approved conversationally on 2026-04-18. Proceed to implementation plan.
