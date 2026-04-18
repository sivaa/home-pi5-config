# Light + Upstream Switch Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard ON button for Study / Living / Bed lights work even when the upstream SONOFF wall switch is off, and show a "Switch off" badge on affected cards so the user knows why the bulb was unavailable.

**Architecture:** Extend the existing `Alpine.store('switches', ...)` in `index.html` with two more entries (Study, Living). Add a `switchId` link on each gated light. `toggleLight` checks whether a pre-pulse of the switch is needed; if so, it publishes switch ON first and schedules the bulb ON command 3 s later via a per-light timer. OFF path is unchanged (bulb-only). A small badge appears on the card when the linked switch is known-OFF.

**Tech Stack:** Alpine.js (inline stores in `index.html`), MQTT over WebSockets, plain CSS. No build step, no bundler, no test runner. Verification is manual via a local dev server and `mosquitto_sub` on the Pi.

**Design doc:** `docs/superpowers/specs/2026-04-18-light-switch-integration-design.md`

**Important project rule:** `CLAUDE.md` (pi-setup) says **do not create PRs or branches** - commit directly to `main`. This overrides the global worktree rule for this repo.

---

## Pre-flight

- [ ] **Step 0.1: Verify repo state**

Run from repo root:

```bash
git status
git log -1 --oneline
```

Expected: on `main`, working tree has the previously-mentioned dashboard edits (`services/dashboard/www/components/navigation.js` modified) but nothing related to light-switch work yet.

- [ ] **Step 0.2: Confirm current switches store has exactly one entry**

```bash
grep -n "id: 'bedroom_switch'" services/dashboard/www/index.html
grep -nE "id: '(study|living)_switch'" services/dashboard/www/index.html
```

Expected: first grep finds the one existing entry around line 5923; second grep finds nothing.

- [ ] **Step 0.3: Start the local dev server (background)**

```bash
cd services/dashboard/www && python -m http.server 8888
```

Open http://localhost:8888 in a browser. Keep this running for the rest of the plan. Keep browser DevTools console open to watch `[switches] ...` and `[mqtt] ...` logs.

---

## Task 1: Add Study and Living switches to the switches store

**Files:**
- Modify: `services/dashboard/www/index.html` around line 5918-5955 (the `Alpine.store('switches', ...)` block)

- [ ] **Step 1.1: Add the two new entries**

Replace the `list:` array in the switches store (currently 1 entry) with 3 entries. Find this block near line 5920:

```js
      Alpine.store('switches', {
        list: [
          {
            id: 'bedroom_switch',
            name: 'Bedroom Light Switch',
            roomId: 'bedroom',
            topic: '[Bed] Light Switch',
            state: 'OFF',
            linkquality: null,
            lastSeen: null,
            available: true
          }
        ],
```

Replace with:

```js
      Alpine.store('switches', {
        list: [
          {
            id: 'study_switch',
            name: 'Study Light Switch',
            roomId: 'study',
            topic: '[Study] Light Switch',
            state: 'OFF',
            linkquality: null,
            lastSeen: null,
            available: true
          },
          {
            id: 'living_switch',
            name: 'Living Light Switch',
            roomId: 'living',
            topic: '[Living] Light Switch',
            state: 'OFF',
            linkquality: null,
            lastSeen: null,
            available: true
          },
          {
            id: 'bedroom_switch',
            name: 'Bedroom Light Switch',
            roomId: 'bedroom',
            topic: '[Bed] Light Switch',
            state: 'OFF',
            linkquality: null,
            lastSeen: null,
            available: true
          }
        ],
```

- [ ] **Step 1.2: Verify in browser**

Reload http://localhost:8888. Open DevTools console. Run:

```js
Alpine.store('switches').list.map(s => s.id)
```

Expected: `["study_switch", "living_switch", "bedroom_switch"]`

Within a few seconds you should see in the console (assuming MQTT is connected):

```
[switches] Study Light Switch state: ON   (or OFF, whatever actually is)
[switches] Living Light Switch state: ON  (or OFF)
[switches] Bedroom Light Switch state: ...
```

These lines confirm the existing MQTT subscription logic auto-picked up the new entries.

- [ ] **Step 1.3: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): track Study and Living light switches

Adds two entries to the switches store alongside the existing
bedroom_switch. The MQTT subscription loop already iterates the
store list, so the new entries are subscribed automatically.

Groundwork for integrating the upstream switch into the light
card ON button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `byId` lookup helper to the switches store

**Files:**
- Modify: `services/dashboard/www/index.html` - the switches store block

- [ ] **Step 2.1: Add the method**

Inside the switches store, right after `getSwitchForRoom(roomId)` (currently the last method near line 5952), add:

```js
        byId(id) {
          return this.list.find(s => s.id === id) || null;
        }
```

Final shape of the method list:

```js
        updateSwitch(topic, data) { ... },
        setAvailability(topic, isOnline) { ... },
        getSwitchForRoom(roomId) { ... },
        byId(id) {
          return this.list.find(s => s.id === id) || null;
        }
```

- [ ] **Step 2.2: Verify in browser**

Reload. In DevTools console:

```js
Alpine.store('switches').byId('study_switch')
// Expected: the study_switch object

Alpine.store('switches').byId('nonexistent')
// Expected: null
```

- [ ] **Step 2.3: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): add byId lookup to switches store

Needed by the lights store to resolve a light's upstream switch
from its switchId field.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Link gated lights to their upstream switch and add `getLightSwitch` / `canPowerCycle` helpers

**Files:**
- Modify: `services/dashboard/www/index.html` - the `Alpine.store('lights', ...)` block (starts around line 5349) and the `list:` entries (around lines 5351-5424)

- [ ] **Step 3.1: Add `switchId: 'study_switch'` to the study light entry**

Find the entry starting `id: 'study_light'` (around line 5352) and add a new field next to `topic`:

```js
          {
            id: 'study_light',
            name: 'Study Room',
            icon: '📚',
            topic: '[Study] IKEA Light',
            switchId: 'study_switch',
            state: 'OFF',
            ...
          },
```

- [ ] **Step 3.2: Add `switchId: 'living_switch'` to the living light entry**

Find `id: 'living_light'` (around line 5370):

```js
          {
            id: 'living_light',
            name: 'Living Room',
            icon: '🛋️',
            topic: '[Living] IKEA Light',
            switchId: 'living_switch',
            state: 'OFF',
            ...
          },
```

- [ ] **Step 3.3: Add `switchId: 'bedroom_switch'` to the bed light entry**

Find `id: 'bed_light'` (around line 5406):

```js
          {
            id: 'bed_light',
            name: 'Bedroom',
            icon: '🛏️',
            topic: '[Bed] Light',
            switchId: 'bedroom_switch',
            state: 'OFF',
            ...
          },
```

Do **not** add `switchId` to `bath_light` or `hallway_light`. They have no upstream switch.

- [ ] **Step 3.4: Add `getLightSwitch` and `canPowerCycle` methods on the lights store**

Find `toggleLight(light) {` (around line 5636). Immediately **before** it, insert:

```js
        // Returns the switch record linked to this light, or null.
        // Handles missing switchId, missing store entry, etc.
        getLightSwitch(light) {
          if (!light?.switchId) return null;
          return Alpine.store('switches').byId(light.switchId);
        },

        // True when the light has a linked switch that is online AND
        // not currently ON - i.e. we can pre-pulse it to re-energise
        // an offline bulb. Used for both the pre-pulse decision and
        // for keeping the ON button enabled when light.available is
        // false because the switch killed the bulb's power.
        canPowerCycle(light) {
          const sw = this.getLightSwitch(light);
          return !!(sw && sw.available && sw.state !== 'ON');
        },

```

- [ ] **Step 3.5: Verify in browser**

Reload. In DevTools console:

```js
const L = Alpine.store('lights')
L.list.filter(l => l.switchId).map(l => ({id: l.id, switchId: l.switchId}))
// Expected: three entries: study/study_switch, living/living_switch, bed/bedroom_switch

L.getLightSwitch(L.list.find(l => l.id === 'study_light'))
// Expected: the study_switch object

L.getLightSwitch(L.list.find(l => l.id === 'bath_light'))
// Expected: null

L.canPowerCycle(L.list.find(l => l.id === 'study_light'))
// Expected: false (if Study switch is currently ON - which it normally is)
//           true  (if Study switch is currently OFF)
```

- [ ] **Step 3.6: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): link gated lights to their upstream switch

Adds switchId to study_light, living_light, bed_light. Adds
getLightSwitch() and canPowerCycle() helpers on the lights
store. Pure plumbing - no behaviour changes yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extract `_sendBulbCommand` and add `_publishSwitchOn` helpers

This refactor has zero behavioural change. Its purpose is to give Task 5 two small callables: one to send the bulb command (now invoked either immediately or via setTimeout) and one to publish the switch ON frame. `_publishSwitchOn` mirrors the existing `_publishRaw` idiom (same client, same qos, same error handling).

**Files:**
- Modify: `services/dashboard/www/index.html` around line 5636-5649 (`toggleLight`)

- [ ] **Step 4.1: Add `_sendBulbCommand` and `_publishSwitchOn` methods**

Right **before** `toggleLight(light)` (near line 5636, after the helpers added in Task 3), insert:

```js
        // Existing publish branch extracted from toggleLight so it can
        // be invoked either immediately or after a delay (when a switch
        // pre-pulse was needed). No behaviour change vs. the inline code
        // that was in toggleLight before.
        _sendBulbCommand(light, newState) {
          if (light.colorPropSuffix) {
            this._publishRaw(light, this._togglePayload(light, newState));
            // Optimistic: both endpoints flip together. light.state stays
            // a pure derivation of mainOn || sidelightOn.
            light.mainOn = (newState === 'ON');
            light.sidelightOn = (newState === 'ON');
            light.state = (light.mainOn || light.sidelightOn) ? 'ON' : 'OFF';
          } else {
            this.publishCommand(light, { state: newState });
            light.state = newState;
          }
        },

        // Publish {state: 'ON'} to an upstream SONOFF wall switch, so an
        // offline bulb can be re-energised from the dashboard. Mirrors
        // the client/qos/error pattern used by _publishRaw. Does NOT
        // mark anything as syncing - the switch isn't the light.
        _publishSwitchOn(sw) {
          const client = Alpine.store('mqtt').client;
          if (!client || !Alpine.store('mqtt').connected) {
            console.error('MQTT not connected (switch pre-pulse skipped)');
            return;
          }
          const topic = `zigbee2mqtt/${sw.topic}/set`;
          client.publish(topic, JSON.stringify({ state: 'ON' }), { qos: 0 }, (err) => {
            if (err) console.error('Failed to publish switch ON:', err);
          });
          console.log(`[lights] Pre-pulse: ${sw.topic} ON`);
        },

```

- [ ] **Step 4.2: Replace the body of `toggleLight` with a call to the helper**

Current body (lines 5636-5649):

```js
        toggleLight(light) {
          const newState = light.state === 'ON' ? 'OFF' : 'ON';
          if (light.colorPropSuffix) {
            this._publishRaw(light, this._togglePayload(light, newState));
            light.mainOn = (newState === 'ON');
            light.sidelightOn = (newState === 'ON');
            light.state = (light.mainOn || light.sidelightOn) ? 'ON' : 'OFF';
          } else {
            this.publishCommand(light, { state: newState });
            light.state = newState;
          }
        },
```

Replace with:

```js
        toggleLight(light) {
          const newState = light.state === 'ON' ? 'OFF' : 'ON';
          this._sendBulbCommand(light, newState);
        },
```

- [ ] **Step 4.3: Verify in browser**

Reload. Tap ON on the Study light card. Bulb should behave exactly as before the refactor: turns on. Tap OFF: turns off. Tap ON on the Bed card (dual-endpoint): both main and sidelight flip together, same as before.

In the terminal, watch MQTT during a tap:

```bash
ssh pi@pi "docker exec mosquitto mosquitto_sub -v -t 'zigbee2mqtt/[Study] IKEA Light/set'"
```

Expected: single message `{"state":"ON"}` or `{"state":"OFF"}` on tap - exactly the same as before.

- [ ] **Step 4.4: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
refactor(dashboard): extract _sendBulbCommand from toggleLight

Pure extraction. No behaviour change. Prepares for the next
commit which needs to invoke the bulb-publish path both
immediately and after a delay.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Pre-pulse switch + delayed bulb ON with race cancellation

**Files:**
- Modify: `services/dashboard/www/index.html` - `toggleLight` method

- [ ] **Step 5.1: Replace `toggleLight` with the switch-aware version**

Current (after Task 4):

```js
        toggleLight(light) {
          const newState = light.state === 'ON' ? 'OFF' : 'ON';
          this._sendBulbCommand(light, newState);
        },
```

Replace with:

```js
        toggleLight(light) {
          // Kill any pending delayed ON from a previous tap. Handles the
          // rapid-tap race: ON -> (switch pre-pulse scheduled) -> OFF must
          // land on OFF, not have the delayed ON overwrite it.
          if (light._pendingOnTimer) {
            clearTimeout(light._pendingOnTimer);
            light._pendingOnTimer = null;
          }

          const newState = light.state === 'ON' ? 'OFF' : 'ON';
          const sw = this.getLightSwitch(light);

          // Defensive pre-pulse: if we have a linked switch and it is
          // available but not confirmed ON (OFF or undefined/stale),
          // publish switch ON first. Switch ON is idempotent, so the
          // extra frame costs nothing when state is actually already ON.
          const needsPrePulse =
            newState === 'ON' && sw && sw.available && sw.state !== 'ON';

          if (needsPrePulse) {
            this._publishSwitchOn(sw);

            // IKEA FLOALT / AwoX / EGLO Rovito-Z need ~2-5 s to boot
            // their Zigbee radio and rejoin the mesh after mains restore.
            // 3000 ms balances reliability vs. UI responsiveness. If this
            // misses, the user taps ON again and it hits a live bulb.
            light._pendingOnTimer = setTimeout(() => {
              light._pendingOnTimer = null;
              this._sendBulbCommand(light, 'ON');
            }, 3000);
          } else {
            this._sendBulbCommand(light, newState);
          }
        },
```

- [ ] **Step 5.2: Manual test - happy path (switch already ON)**

Reload http://localhost:8888.

On the Pi, in a separate terminal, start watching MQTT:

```bash
ssh pi@pi "docker exec mosquitto mosquitto_sub -v -t 'zigbee2mqtt/#'" | grep -i "light\|switch"
```

In the dashboard, tap ON on the Study card (assuming the Study Light Switch is currently ON in real life - which it almost certainly is).

Expected in the MQTT stream: **one** publish only - `zigbee2mqtt/[Study] IKEA Light/set {"state":"ON"}`.

Expected in DevTools console: no `[lights] Pre-pulse` log.

Expected physically: Study bulb turns on immediately.

Tap OFF. Expected: single publish `{"state":"OFF"}` to the bulb. Bulb turns off.

- [ ] **Step 5.3: Manual test - recovery path (switch physically off)**

**Pick the Bed light for this test** - the Study and Living switches are in daily use and you don't want to leave them in a weird state during testing.

Physically flip the Bed Light Switch off (wall switch). Wait ~30 s for Z2M to mark the bulb unavailable and the switch state to propagate. Verify in DevTools console:

```js
Alpine.store('switches').byId('bedroom_switch').state
// Expected: 'OFF'

Alpine.store('lights').list.find(l => l.id === 'bed_light').available
// Expected: false (bulb offline)

Alpine.store('lights').canPowerCycle(Alpine.store('lights').list.find(l => l.id === 'bed_light'))
// Expected: true
```

**The button is still disabled at this point** - Task 7 fixes that. For this test, force-click by calling `toggleLight` directly from the console:

```js
const bed = Alpine.store('lights').list.find(l => l.id === 'bed_light')
Alpine.store('lights').toggleLight(bed)
```

Expected MQTT stream:
1. Immediately: `zigbee2mqtt/[Bed] Light Switch/set {"state":"ON"}`
2. ~3 s later: `zigbee2mqtt/[Bed] Light/set {"state":"ON",...}` (exact shape depends on dual-endpoint payload)

Expected in DevTools console:
```
[lights] Pre-pulse: [Bed] Light Switch ON
```

Expected physically: bulb turns on within ~4 s total.

- [ ] **Step 5.4: Manual test - race cancellation**

With the Bed switch still off again (flip it off), type in DevTools console:

```js
const bed = Alpine.store('lights').list.find(l => l.id === 'bed_light')
Alpine.store('lights').toggleLight(bed)   // schedules ON in 3s
// wait 1 second
Alpine.store('lights').toggleLight(bed)   // should cancel the pending ON and toggle OFF
```

Type the second call within 1-2 seconds of the first.

Expected MQTT stream:
1. `[Bed] Light Switch/set {"state":"ON"}` (from first toggle)
2. `[Bed] Light/set {"state":"OFF",...}` (from second toggle - immediate, not delayed; because newState flipped back to OFF and there was no pre-pulse needed for OFF)
3. **No** delayed `[Bed] Light/set {"state":"ON"}` ~3 s after the first toggle.

In DevTools console verify no stale timer:

```js
bed._pendingOnTimer
// Expected: null
```

- [ ] **Step 5.5: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): pre-pulse upstream switch on light ON tap

When the user taps ON on a light with a linked switch that is
available but not confirmed ON, publish switch ON first, wait
3s for the bulb to rejoin Zigbee, then publish the bulb ON.

OFF path unchanged (bulb command only, switch stays energised).
A per-light _pendingOnTimer handles race cancellation when the
user taps OFF during the delay.

See docs/superpowers/specs/2026-04-18-light-switch-integration-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Apply the same logic to `toggleAllLights`

**Files:**
- Modify: `services/dashboard/www/index.html` - `toggleAllLights` method (around lines 5651-5665)

- [ ] **Step 6.1: Replace `toggleAllLights` body**

Current:

```js
        toggleAllLights() {
          const allOn = this.list.every(l => l.state === 'ON');
          const newState = allOn ? 'OFF' : 'ON';
          this.list.forEach(light => {
            if (light.colorPropSuffix) {
              this._publishRaw(light, this._togglePayload(light, newState));
              light.mainOn = (newState === 'ON');
              light.sidelightOn = (newState === 'ON');
              light.state = (light.mainOn || light.sidelightOn) ? 'ON' : 'OFF';
            } else {
              this.publishCommand(light, { state: newState });
              light.state = newState;
            }
          });
        },
```

Replace with:

```js
        toggleAllLights() {
          const allOn = this.list.every(l => l.state === 'ON');
          const newState = allOn ? 'OFF' : 'ON';
          this.list.forEach(light => {
            // Per-light: cancel any pending delayed ON from a prior tap.
            if (light._pendingOnTimer) {
              clearTimeout(light._pendingOnTimer);
              light._pendingOnTimer = null;
            }

            const sw = this.getLightSwitch(light);
            const needsPrePulse =
              newState === 'ON' && sw && sw.available && sw.state !== 'ON';

            if (needsPrePulse) {
              this._publishSwitchOn(sw);
              light._pendingOnTimer = setTimeout(() => {
                light._pendingOnTimer = null;
                this._sendBulbCommand(light, 'ON');
              }, 3000);
            } else {
              this._sendBulbCommand(light, newState);
            }
          });
        },
```

Note: each light gets its own `_pendingOnTimer` property, so concurrent timers for different lights don't clobber each other.

- [ ] **Step 6.2: Manual test - all-lights toggle with one switch off**

With the Bed switch physically off (from Task 5 testing), find the "all lights" button on the dashboard. If unsure where it is:

```bash
grep -n "toggleAllLights" services/dashboard/www/index.html
```

Tap it. Expected MQTT stream:
- Immediately: bulb ON publishes for Study, Living, Bath, Hallway (4 simple publishes)
- Immediately: switch ON publish for `[Bed] Light Switch` (the pre-pulse)
- ~3 s later: bulb ON publish for Bed (`[Bed] Light`)

Total: 5 bulb commands + 1 switch command, with the Bed bulb command delayed.

- [ ] **Step 6.3: Flip the Bed switch back on**

Either physically flip it, or (if the bulb came back on after the test) leave it. Do **NOT** leave the test in a state where the Bed light is stuck off overnight.

- [ ] **Step 6.4: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): apply switch pre-pulse to toggleAllLights

Each light gets its own _pendingOnTimer so parallel pre-pulses
for different lights don't clobber each other.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Keep the ON button enabled when the switch can recover the bulb

**Files:**
- Modify: `services/dashboard/www/index.html` line 704 (light-card `:disabled` expression)

- [ ] **Step 7.1: Update the `:disabled` expression**

Find line 704. Current:

```html
                    <button class="light-toggle" :class="{ 'toggle-on': light.state === 'ON' && light.available, 'toggle-syncing': light.syncing, 'toggle-unavailable': !light.available }"
                            @click="$store.lights.toggleLight(light)" :disabled="light.syncing || !light.available">
```

Change **only** the `:disabled` attribute:

```html
                    <button class="light-toggle" :class="{ 'toggle-on': light.state === 'ON' && light.available, 'toggle-syncing': light.syncing, 'toggle-unavailable': !light.available }"
                            @click="$store.lights.toggleLight(light)" :disabled="light.syncing || (!light.available && !$store.lights.canPowerCycle(light))">
```

The `:class` expression stays exactly as it was - we still want the `toggle-unavailable` visual treatment when the bulb is offline. We just no longer disable the click.

- [ ] **Step 7.2: Manual test**

Flip the Bed switch physically off. Wait ~30 s.

Reload dashboard. Inspect the Bed card's toggle button with DevTools. Expected:
- `disabled` attribute is absent or false
- Visually it still has `toggle-unavailable` styling (greyed out)
- `light-card` still has `light-unavailable` class
- **Clicking it works** and triggers the pre-pulse path from Task 5

Flip the Bed switch back on. Wait ~30 s. Bulb should come back online. No visible weirdness.

- [ ] **Step 7.3: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): keep light ON button clickable when switch can recover

Previously the toggle was disabled whenever light.available was
false, which was exactly the case the pre-pulse logic exists to
recover from. Now it stays clickable iff the linked switch is
available and can power-cycle the bulb back on.

Visual 'unavailable' styling is preserved so the user still sees
the bulb is offline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add the "Switch off" badge to the light card

**Files:**
- Modify: `services/dashboard/www/index.html` - light-card template around lines 692-701 (the `light-header` -> `light-details` block)

- [ ] **Step 8.1: Add badge markup under `light-name`**

Find (around line 695-700):

```html
                      <div class="light-details">
                        <span class="light-name" x-text="light.name"></span>
                        <span class="light-status">
                          <span x-show="light.available && light.syncing" class="syncing-text">Syncing...</span>
                          <span x-show="light.available && !light.syncing" x-text="light.state === 'ON' ? 'On' : 'Off'"></span>
                        </span>
                      </div>
```

Insert a new badge line between `light-name` and `light-status`:

```html
                      <div class="light-details">
                        <span class="light-name" x-text="light.name"></span>
                        <span class="light-switch-badge"
                              x-show="$store.lights.getLightSwitch(light) && $store.lights.getLightSwitch(light).available && $store.lights.getLightSwitch(light).state === 'OFF'"
                              x-cloak>
                          🔌 Switch off
                        </span>
                        <span class="light-status">
                          <span x-show="light.available && light.syncing" class="syncing-text">Syncing...</span>
                          <span x-show="light.available && !light.syncing" x-text="light.state === 'ON' ? 'On' : 'Off'"></span>
                        </span>
                      </div>
```

Note the `x-cloak` to prevent flash-of-content before Alpine initialises.

- [ ] **Step 8.2: Add `light-switch-off` modifier class to the card root (optional card-level styling)**

On line 686 (`<div class="light-card" :class="{ ... }">`), extend the `:class` object so the card root gets an extra class when the switch is off. Current:

```html
                <div class="light-card" :class="{ 'light-on': light.state === 'ON' && light.available, 'light-off': light.state === 'OFF' && light.available, 'light-syncing': light.syncing, 'light-unavailable': !light.available }">
```

Change to:

```html
                <div class="light-card" :class="{ 'light-on': light.state === 'ON' && light.available, 'light-off': light.state === 'OFF' && light.available, 'light-syncing': light.syncing, 'light-unavailable': !light.available, 'light-switch-off': $store.lights.getLightSwitch(light) && $store.lights.getLightSwitch(light).available && $store.lights.getLightSwitch(light).state === 'OFF' }">
```

- [ ] **Step 8.3: Manual test - badge appears and clears**

With the Bed switch physically off (and Z2M aware of it), reload the dashboard. Expected on the Bed card:
- A small "🔌 Switch off" badge under "Bedroom"
- Card still has `light-unavailable` styling (greyed out) - they coexist
- Card also has `light-switch-off` class (check via DevTools element inspector)

Tap ON on the Bed card. ~3 s later the bulb comes back on and the switch publishes its new `{"state":"ON"}`. Expected: badge disappears reactively within a second of the switch state updating.

Tap OFF. Bulb goes off. Switch is still ON. Badge stays hidden.

Flip switch physically off again. After ~1-2 s badge reappears.

- [ ] **Step 8.4: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "$(cat <<'EOF'
feat(dashboard): show '🔌 Switch off' badge on affected light cards

Badge appears when the linked switch is available and OFF.
Hidden when the switch is ON, or when it's unavailable (we
don't know its true state - claiming 'off' would lie).

Adds a light-switch-off modifier class on the card root so CSS
can differentiate 'bulb unavailable because switch off' from
'bulb unavailable for some other reason'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Style the badge and `.light-switch-off` card state

**Files:**
- Modify: `services/dashboard/www/styles/views/lights.css` around lines 142-147 (next to `.light-unavailable`)

- [ ] **Step 9.1: Append badge + card modifier styles**

At the end of `services/dashboard/www/styles/views/lights.css`, append:

```css
    /* Switch-off badge on light cards - shown when a light's
       upstream SONOFF wall switch is known-off. Pi-safe CSS:
       no backdrop-filter, no infinite animations, simple colours. */
    .light-switch-badge {
      display: inline-block;
      font-size: 11px;
      line-height: 1.2;
      padding: 2px 6px;
      margin-top: 2px;
      border-radius: 4px;
      background: var(--color-bg-muted, rgba(0, 0, 0, 0.05));
      color: var(--color-text-muted, #666);
      border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
      white-space: nowrap;
    }

    [data-theme="dark"] .light-switch-badge {
      background: rgba(255, 255, 255, 0.06);
      color: #aaa;
      border-color: rgba(255, 255, 255, 0.1);
    }

    /* When switch is off, dial back the unavailable opacity a bit -
       the card is recoverable (user can tap ON to re-energise),
       so it shouldn't look as dead as true light-unavailable. */
    .light-card.light-unavailable.light-switch-off {
      opacity: 0.7;
    }
```

- [ ] **Step 9.2: Manual test - visual check**

Reload dashboard. With the Bed switch physically off:
- Badge is visible on the Bed card, small, muted colour
- Card opacity is 0.7 (slightly more visible than a bulb that is offline for mesh reasons)
- Toggle the browser between light and dark theme (if the dashboard supports it) - badge should remain legible in both

- [ ] **Step 9.3: CSS performance lint check**

Per `services/dashboard/CLAUDE.md`:

```bash
scripts/lint-css-performance.sh 2>/dev/null || echo "(script not present - skip)"
```

If the script exists, confirm no violations were introduced. The added CSS uses only simple borders, background colours, and a single opacity override - no banned properties (no `backdrop-filter`, no `filter: blur`, no multi-layer shadows, no infinite animations).

- [ ] **Step 9.4: Commit**

```bash
git add services/dashboard/www/styles/views/lights.css
git commit -m "$(cat <<'EOF'
style(dashboard): badge + card state for switch-off lights

Pi-safe CSS: single-layer border/background/opacity only.
No banned properties per dashboard CSS guidelines.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Deploy to Pi and verify end-to-end

**Files:** None modified. Deploy only.

- [ ] **Step 10.1: Confirm on main**

```bash
git branch --show-current
```

Expected: `main`. If not, per repo policy this project lives on main only - switch back.

- [ ] **Step 10.2: Copy files to Pi**

```bash
scp services/dashboard/www/index.html pi@pi:/tmp/dashboard-index.html
scp services/dashboard/www/styles/views/lights.css pi@pi:/tmp/dashboard-lights.css
ssh pi@pi "sudo cp /tmp/dashboard-index.html /opt/dashboard/www/index.html && \
           sudo cp /tmp/dashboard-lights.css /opt/dashboard/www/styles/views/lights.css && \
           sudo chmod 644 /opt/dashboard/www/index.html /opt/dashboard/www/styles/views/lights.css"
```

- [ ] **Step 10.3: Verify files on Pi**

```bash
ssh pi@pi "grep -c 'study_switch' /opt/dashboard/www/index.html && \
           grep -c 'light-switch-badge' /opt/dashboard/www/styles/views/lights.css"
```

Expected: both non-zero.

- [ ] **Step 10.4: Browser test on the Pi kiosk (or phone)**

Open http://pi/ on a phone or on the kiosk itself. Navigate to the Lights view. Confirm the UI still renders correctly (no JavaScript errors in any reachable device's console). Tap ON/OFF on Study - no switch pre-pulse expected (switch is ON), single publish, bulb responds.

- [ ] **Step 10.5: End-to-end recovery test on real hardware**

On the Pi itself, watch MQTT:

```bash
ssh pi@pi "docker exec mosquitto mosquitto_sub -v -t 'zigbee2mqtt/#'" 2>&1 | grep -iE "light|switch"
```

Physically flip the Bed Light Switch off. Wait 30 s. On the dashboard, tap ON on the Bed card. Confirm:
1. MQTT stream shows `[Bed] Light Switch/set {"state":"ON"}` first
2. ~3 s later `[Bed] Light/set ...` with `"state":"ON"`
3. Bedroom bulb physically turns on
4. Badge disappears on the card

If the 3 s delay is consistently too short (bulb not yet responsive when the command fires), this is a real-world calibration failure - NOT a bug in the plan. Document it and discuss whether to bump to 4000 or 5000 ms before changing the code.

- [ ] **Step 10.6: Commit nothing (deploy is not a git-tracked step)**

No commit. Deploy is a side effect on the Pi, not a repo change.

---

## Task 11: Update dashboard CLAUDE.md documentation

**Files:**
- Modify: `services/dashboard/CLAUDE.md` - "Switches Store" section and "Room-to-Switch Mapping" table

- [ ] **Step 11.1: Update the "Switches Store" section intro**

Find the `## Switches Store (2026-01-23)` section. The current intro says:

> Currently only `bedroom_switch` is tracked. Note: Study and Living rooms also have physical SONOFF switches, but those are not tracked in this store - their floor plan indicators use the smart light state directly.

Replace that paragraph with:

```
As of 2026-04-18 all three physical SONOFF wall switches are tracked:
`study_switch`, `living_switch`, `bedroom_switch`. The store serves two
roles: (1) floor-plan indicator fallback for rooms whose smart bulb is
offline, and (2) pre-pulse source for the light-card ON button so a
bulb with an OFF wall switch can be re-energised from the dashboard.
See docs/superpowers/specs/2026-04-18-light-switch-integration-design.md
for the integration design.
```

- [ ] **Step 11.2: Update the Light Indicator Priority block**

Current (inside the Switches Store section):

```
Priority 2: Smart switch available & ON? → 'lit'
    (Fallback when smart bulb is offline or unavailable)
```

This part stays correct - do NOT change the priority logic. Verify by searching:

```bash
grep -n "Priority 2" services/dashboard/CLAUDE.md
```

Read the block. If the wording is accurate, leave it. If it still says "bedroom only" somewhere, update to reflect "any gated room".

- [ ] **Step 11.3: Update the "Room-to-Switch Mapping" table**

Current:

```
| Room | Has Smart Light | Has Smart Switch | Indicator Uses |
|------|-----------------|------------------|----------------|
| Study | ✓ (IKEA FLOALT) | ✓ (SONOFF) | Smart light state |
| Living | ✓ (IKEA FLOALT) | ✓ (SONOFF) | Smart light state |
| Bedroom | ✓ (EGLO Rovito-Z) | ✓ (SONOFF) | Smart light state |
| Bathroom | ✓ (AwoX 33955) | ✗ | Smart light state |
| Hallway | ✓ (Aqara T1M) | ✗ | Smart light state |
| Kitchen | ✗ | ✗ | Illumination |
```

Add a column documenting the new ON-button behaviour:

```
| Room | Has Smart Light | Has Smart Switch | Indicator Uses | ON Button Behaviour |
|------|-----------------|------------------|----------------|---------------------|
| Study | ✓ (IKEA FLOALT) | ✓ (SONOFF) | Smart light state | Pre-pulse switch if OFF, then bulb ON |
| Living | ✓ (IKEA FLOALT) | ✓ (SONOFF) | Smart light state | Pre-pulse switch if OFF, then bulb ON |
| Bedroom | ✓ (EGLO Rovito-Z) | ✓ (SONOFF) | Smart light state | Pre-pulse switch if OFF, then bulb ON |
| Bathroom | ✓ (AwoX 33955) | ✗ | Smart light state | Bulb only |
| Hallway | ✓ (Aqara T1M) | ✗ | Smart light state | Bulb only |
| Kitchen | ✗ | ✗ | Illumination | N/A |
```

- [ ] **Step 11.4: Update the Switch Configuration example**

Current example shows only `bedroom_switch`. Add a note underneath that `study_switch` and `living_switch` follow the identical shape with their respective `id`, `name`, `roomId`, `topic` values.

- [ ] **Step 11.5: Add a note about the switchId link**

In the "Key Code Locations" table, add one row:

```
| `switchId:` on lights in `Alpine.store('lights')` | Links a light to its upstream switch for pre-pulse on ON |
```

- [ ] **Step 11.6: Commit**

```bash
git add services/dashboard/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(dashboard): reflect 3 tracked switches and ON-button pre-pulse

Updates the Switches Store section to document that all three
SONOFF wall switches are now tracked (not just bedroom), and
that the ON button on Study / Living / Bed light cards will
pre-pulse the switch before sending the bulb command.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

- [ ] **Step F.1: Clean tree**

```bash
git status
```

Expected: clean (or only pre-existing unrelated changes like `components/navigation.js` and the untracked screenshot PNGs that were already there).

- [ ] **Step F.2: Commit log sanity**

```bash
git log --oneline -15
```

Expected: a clear sequence of feat/refactor/style/docs commits for Tasks 1-9 and 11. Each commit should describe one focused change.

- [ ] **Step F.3: Smoke test on Pi one more time**

On the kiosk, tap ON/OFF on every light card (Study, Living, Bath, Bed, Hallway). All five should respond normally. No console errors. No regressions.

- [ ] **Step F.4: Restore any test-disrupted state**

Confirm Bed Light Switch is physically ON and the bulb is online before walking away. Check the Study and Living switches too - they should never have been touched during testing, but double-check.

---

## Rollback

If anything breaks in production on the Pi:

```bash
git log --oneline | head -20          # find the last good commit before this work
git show HEAD:services/dashboard/www/index.html > /tmp/index.html
# edit as needed, or revert specific commits with:
git revert <sha>

# Deploy the good version:
scp services/dashboard/www/index.html pi@pi:/tmp/
ssh pi@pi "sudo cp /tmp/index.html /opt/dashboard/www/index.html"
```

The dashboard is static files served by nginx - no restart needed, just copy the file.
