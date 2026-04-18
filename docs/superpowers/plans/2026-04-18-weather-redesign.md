# Weather Dashboard Redesign - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing "Mock D" weather view with a redesign adapted from `home-dashboard-redesign.zip`, adding wind/humidity/feels-like/UV, a smooth SVG 10-day trend curve, weekly highlights, and a 2-column sidebar — all within the Pi 5 kiosk's CSS performance budget.

**Architecture:** Extend the existing `Alpine.store('weatherForecast')` with new fetch fields and a `weeklyHighlights` eager-computed property. Add one new pure-function util (`utils/svg-curve.js`) for shared SVG math. Rewrite the view file, CSS file, and the weather block in `index.html`. Zero infra change on the Pi.

**Tech Stack:** Vanilla Alpine.js, handwritten SVG (no Recharts / framer-motion / Tailwind / React — all banned by Pi perf rules), CSS variables for theming, no build step. Verification is manual via local dev server at `http://localhost:8888` and Pi deploy via `scp`.

**Design doc:** `docs/superpowers/specs/2026-04-18-weather-redesign-design.md`

**Important project rules:**
- `CLAUDE.md` (pi-setup) says **do not create PRs or branches** - commit directly to `main`.
- Banned CSS (per `services/dashboard/CLAUDE.md`): `backdrop-filter`, `filter: blur()`, `animation: * infinite`, multi-layer box-shadow. See spec §6 for replacements.
- `scripts/lint-css-performance.sh` must exit 0 or 2 (warnings-only for the two expected `@keyframes`).

---

## Pre-flight

- [ ] **Step 0.1: Verify repo state**

Run from repo root:

```bash
git status
git log -3 --oneline
```

Expected: on `main`; recent commits include `3af23e1 docs(weather): amend spec after final Opus review` and `eab108f docs(weather): add weather dashboard redesign design spec`; working tree may have the pre-existing non-weather edits (`configs/homeassistant/automations.yaml`, `configs/homeassistant/configuration.yaml`, `docs/08-google-home-integration.md`, `services/dashboard/www/components/navigation.js`) — leave these alone, they are not part of this plan.

- [ ] **Step 0.2: Confirm current weather files are intact**

```bash
wc -l services/dashboard/www/js/stores/weather-forecast-store.js \
      services/dashboard/www/views/weather-forecast.js \
      services/dashboard/www/styles/views/weather-forecast.css
grep -c "currentView === 'weather'" services/dashboard/www/index.html
```

Expected: 313 / 245 / 472 lines; exactly 1 match in index.html.

- [ ] **Step 0.3: Start the local dev server in the background**

```bash
cd services/dashboard/www && python -m http.server 8888 &
```

Open `http://localhost:8888/#weather` in Chrome (or your main browser). Keep DevTools console visible for all tasks. Leave this server running for the rest of the plan.

---

## Task 1: Create `utils/svg-curve.js` with pure geometric helpers

**Files:**
- Create: `services/dashboard/www/utils/svg-curve.js`

These three functions are used by both the hourly curve (Task 7) and the 10-day curve (Task 8). Writing them first, in isolation, gives us a reusable unit we can sanity-check via the browser console before any UI depends on them.

- [ ] **Step 1.1: Create the file with full contents**

Create `services/dashboard/www/utils/svg-curve.js`:

```javascript
/**
 * SVG curve geometry helpers.
 *
 * Pure functions only. No Alpine, no DOM, no module side effects.
 * Used by the weather view for hourly and 10-day curves.
 */

/**
 * Catmull-Rom -> cubic Bezier smoothed path for an ordered series of points.
 * @param {{x:number,y:number}[]} pts - at least 2 points in draw order.
 * @returns {string} SVG path `d` attribute value. Empty string if <2 points.
 */
export function smoothPath(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/**
 * Linear horizontal scale for `n` evenly-spaced points across an inner width.
 * @param {number} i - zero-based index (0..n-1).
 * @param {number} n - total number of points.
 * @param {number} width - overall width of the SVG viewBox.
 * @param {number} padX - horizontal inset on each side.
 * @returns {number} x coordinate in viewBox units.
 */
export function xScale(i, n, width, padX) {
  if (n <= 1) return width / 2;
  const innerW = width - padX * 2;
  return padX + (i * innerW) / (n - 1);
}

/**
 * Linear vertical scale for a value within [min, max], inverted so larger
 * values sit higher in the viewBox (smaller y).
 * @param {number} v - value to place.
 * @param {number} min - lower bound of the value range.
 * @param {number} max - upper bound of the value range.
 * @param {number} height - overall height of the SVG viewBox.
 * @param {number} padTop - top inset.
 * @param {number} padBottom - bottom inset.
 * @returns {number} y coordinate in viewBox units.
 */
export function yScale(v, min, max, height, padTop, padBottom) {
  const innerH = height - padTop - padBottom;
  if (max === min) return padTop + innerH / 2;
  return padTop + (1 - (v - min) / (max - min)) * innerH;
}
```

- [ ] **Step 1.2: Verify the file parses as a module**

In the browser DevTools console (at `http://localhost:8888`), run:

```javascript
const m = await import('/utils/svg-curve.js');
console.log(m.smoothPath([{x:0,y:0},{x:10,y:5},{x:20,y:0}]));
console.log(m.xScale(3, 10, 1000, 50));    // 350
console.log(m.yScale(20, 10, 30, 100, 10, 10));  // 50
```

Expected: first line prints a non-empty path string starting with `M 0 0 C`; `xScale(3, 10, 1000, 50)` returns `350`; `yScale(20, 10, 30, 100, 10, 10)` returns `50`.

- [ ] **Step 1.3: Commit**

```bash
git add services/dashboard/www/utils/svg-curve.js
git commit -m "feat(dashboard): add utils/svg-curve.js with smoothPath/xScale/yScale"
```

---

## Task 2: Extend the weather store fetch params and parsers

**Files:**
- Modify: `services/dashboard/www/js/stores/weather-forecast-store.js` (params block around line 105-113, `_parseCurrent` around line 173-184, `_parseDaily` around line 213-234)

Goal: fetch four new Open-Meteo fields (`wind_speed_10m`, `wind_direction_10m`, `relative_humidity_2m`, `apparent_temperature` on current; `uv_index_max` on daily). Parse them into `current.{wind,windDir,humidity,feelsLike}` and `daily[i].uvIndex`. Add `daily[i].isWeekend`.

- [ ] **Step 2.1: Update the fetch params**

Find this block (around line 105-113):

```javascript
      const params = new URLSearchParams({
        latitude: this.LATITUDE,
        longitude: this.LONGITUDE,
        timezone: this.TIMEZONE,
        forecast_days: 10,
        current: 'temperature_2m,weather_code,is_day',
        hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset'
      });
```

Replace with:

```javascript
      const params = new URLSearchParams({
        latitude: this.LATITUDE,
        longitude: this.LONGITUDE,
        timezone: this.TIMEZONE,
        forecast_days: 10,
        current: [
          'temperature_2m',
          'weather_code',
          'is_day',
          'wind_speed_10m',
          'wind_direction_10m',
          'relative_humidity_2m',
          'apparent_temperature'
        ].join(','),
        hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
        daily: [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'precipitation_sum',
          'sunrise',
          'sunset',
          'uv_index_max'
        ].join(',')
      });
```

- [ ] **Step 2.2: Extend `_parseCurrent`**

Replace the existing `_parseCurrent` (around line 173-184) with:

```javascript
    _parseCurrent(current) {
      if (!current) return null;
      const code = current.weather_code;
      const isDay = current.is_day === 1;
      const info = this._weatherInfo(code, isDay);
      return {
        temp: Math.round(current.temperature_2m),
        emoji: info.emoji,
        description: info.desc,
        isDay,
        wind: Math.round(current.wind_speed_10m || 0),
        windDir: current.wind_direction_10m ?? null,
        humidity: Math.round(current.relative_humidity_2m || 0),
        feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m)
      };
    },
```

- [ ] **Step 2.3: Extend `_parseDaily`**

Replace the existing `_parseDaily` (around line 213-234) with:

```javascript
    _parseDaily(daily) {
      if (!daily?.time) return [];
      return daily.time.map((t, i) => {
        const date = new Date(t);
        const code = daily.weather_code[i];
        const info = this._weatherInfo(code, true);
        const dayOfWeek = date.getDay();

        return {
          date,
          dayName: this._dayName(date, i),
          dateStr: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          emoji: info.emoji,
          description: info.desc,
          tempMax: Math.round(daily.temperature_2m_max[i]),
          tempMin: Math.round(daily.temperature_2m_min[i]),
          precipProb: Math.round(daily.precipitation_probability_max[i] || 0),
          precipSum: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
          sunrise: daily.sunrise[i],
          sunset: daily.sunset[i],
          uvIndex: Math.round(daily.uv_index_max?.[i] ?? 0),
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6
        };
      });
    },
```

- [ ] **Step 2.4: Verify new fields arrive in the browser**

Reload `http://localhost:8888/#weather`. In DevTools console, run:

```javascript
const s = Alpine.store('weatherForecast');
console.log('current:', s.current);
console.log('day0:', s.daily[0]);
```

Expected: `current` has numeric `wind`, `humidity`, `feelsLike`, and a non-null `windDir`. `daily[0]` has `uvIndex` (0-11) and `isWeekend` (boolean). All previously-present fields still appear.

- [ ] **Step 2.5: Commit**

```bash
git add services/dashboard/www/js/stores/weather-forecast-store.js
git commit -m "feat(weather): fetch wind, humidity, feels-like, UV from Open-Meteo"
```

---

## Task 3: Add `weeklyHighlights` eager-computed property to the store

**Files:**
- Modify: `services/dashboard/www/js/stores/weather-forecast-store.js` (store object near top around line 50-80, `fetchForecast` around line 138-143, new `_computeHighlights` near `_generateAlert`)

- [ ] **Step 3.1: Add `weeklyHighlights` to the store's initial state**

Find this block (around line 55-60):

```javascript
    // Contextual alert text (derived from hourly data)
    alertText: null,
```

Insert directly below:

```javascript
    // Derived highlights (computed once per fetch, see _computeHighlights)
    weeklyHighlights: null,
```

- [ ] **Step 3.2: Add the `_computeHighlights` method**

Find the method `_generateAlert` (around line 241-289). Directly AFTER the closing `},` of `_generateAlert`, insert:

```javascript
    // ========================================
    // WEEKLY HIGHLIGHTS
    // Eager compute, called once per fetch (see fetchForecast).
    // NOT a getter - getters run on every Alpine reactive read.
    // ========================================

    _computeHighlights(daily) {
      if (!daily || daily.length === 0) return null;

      const warmest = daily.reduce((a, b) => (b.tempMax > a.tempMax ? b : a));
      const coldest = daily.reduce((a, b) => (b.tempMin < a.tempMin ? b : a));
      const wettest = daily.reduce((a, b) => (b.precipProb > a.precipProb ? b : a));

      const weekends = daily.filter(d => d.isWeekend);
      let bestWeekend = null;
      if (weekends.length > 0) {
        // Highest tempMax, tiebreak lowest precipProb
        bestWeekend = weekends.reduce((a, b) => {
          if (b.tempMax !== a.tempMax) return b.tempMax > a.tempMax ? b : a;
          return b.precipProb < a.precipProb ? b : a;
        });
      }

      return { warmest, coldest, wettest, bestWeekend };
    },
```

- [ ] **Step 3.3: Call `_computeHighlights` from `fetchForecast`**

Find (around line 138-143):

```javascript
          this.current = newCurrent;
          this.hourly = newHourly;
          this.daily = newDaily;
          this.alertText = newAlert;
```

Replace with:

```javascript
          this.current = newCurrent;
          this.hourly = newHourly;
          this.daily = newDaily;
          this.alertText = newAlert;
          this.weeklyHighlights = this._computeHighlights(newDaily);
```

- [ ] **Step 3.4: Verify `weeklyHighlights` populates**

Reload `http://localhost:8888/#weather`. In DevTools console:

```javascript
const s = Alpine.store('weatherForecast');
console.log(s.weeklyHighlights);
console.log('is getter?', Object.getOwnPropertyDescriptor(s, 'weeklyHighlights').get);
```

Expected: first log shows `{ warmest, coldest, wettest, bestWeekend }` where each value is a `daily[]` entry (or `bestWeekend` is `null` if the 10-day window has no Sat/Sun). Second log prints `undefined` (confirms it is a plain property, not a getter).

- [ ] **Step 3.5: Commit**

```bash
git add services/dashboard/www/js/stores/weather-forecast-store.js
git commit -m "feat(weather): compute weekly highlights eagerly on each fetch"
```

---

## Task 4: Replace CSS with new skeleton (tokens, grid, base panel)

**Files:**
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (full rewrite)

This task sets up the foundational styles only. Individual components (hero, hourly, 10-day, etc.) are styled in their own tasks below so each is reviewable in isolation.

- [ ] **Step 4.1: Overwrite the CSS file with the base layer**

Replace the entire contents of `services/dashboard/www/styles/views/weather-forecast.css` with:

```css
/* ============================================================
   Weather Forecast View - Redesign (2026-04-18)
   Pi-safe: no backdrop-filter, no filter:blur, no infinite anims,
   single-shadow panels only. See spec §6.
   ============================================================ */

/* ---------- Design tokens ---------- */
.weather-forecast-view {
  --wx-panel-bg: rgba(255, 255, 255, 0.04);
  --wx-panel-border: rgba(255, 255, 255, 0.08);
  --wx-panel-radius: 20px;
  --wx-text-primary: #f1f5f9;
  --wx-text-muted: rgba(255, 255, 255, 0.6);
  --wx-text-dim: rgba(255, 255, 255, 0.4);
  --wx-accent-hi-a: #fbbf24;
  --wx-accent-hi-b: #f97316;
  --wx-accent-lo-a: #38bdf8;
  --wx-accent-lo-b: #22d3ee;
  --wx-weekend-tint: rgba(251, 191, 36, 0.06);
  --wx-selected-tint: rgba(255, 255, 255, 0.06);
  --wx-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  --wx-gap: 16px;
}

[data-theme="light"] .weather-forecast-view {
  --wx-panel-bg: rgba(15, 23, 42, 0.04);
  --wx-panel-border: rgba(15, 23, 42, 0.08);
  --wx-text-primary: #0f172a;
  --wx-text-muted: rgba(15, 23, 42, 0.65);
  --wx-text-dim: rgba(15, 23, 42, 0.4);
  --wx-weekend-tint: rgba(234, 88, 12, 0.08);
  --wx-selected-tint: rgba(15, 23, 42, 0.06);
  --wx-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ---------- Top-level grid ---------- */
.weather-forecast-view {
  display: grid;
  grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
  grid-template-rows: auto auto;
  gap: var(--wx-gap);
  padding: 16px 24px;
  color: var(--wx-text-primary);
  position: relative;
}

.weather-forecast-view .wx-header {
  grid-column: 1 / -1;
}
.weather-forecast-view .wx-left-col {
  display: flex; flex-direction: column; gap: var(--wx-gap);
}
.weather-forecast-view .wx-right-col {
  display: flex; flex-direction: column; gap: var(--wx-gap);
}

@media (max-width: 1023px) {
  .weather-forecast-view {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ---------- Panel base ---------- */
.wx-panel {
  background: var(--wx-panel-bg);
  border: 1px solid var(--wx-panel-border);
  border-radius: var(--wx-panel-radius);
  box-shadow: var(--wx-shadow);
  padding: 20px;
}

.wx-panel-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--wx-text-muted);
  margin-bottom: 12px;
}

/* ---------- Header ---------- */
.wx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 4px 4px 0;
}
.wx-header-title {
  display: flex; align-items: center; gap: 12px;
}
.wx-header-icon {
  width: 44px; height: 44px; border-radius: 14px;
  background: linear-gradient(135deg, #2563eb, #22d3ee);
  display: grid; place-items: center;
  font-size: 22px;
}
.wx-header-h1 {
  font-size: 18px; font-weight: 700; margin: 0; line-height: 1.1;
}
.wx-header-location {
  font-size: 12px; color: var(--wx-text-muted);
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 2px;
}
.wx-header-actions {
  display: flex; align-items: center; gap: 10px;
}
.wx-freshness {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--wx-text-muted);
  padding: 6px 12px; border-radius: 999px;
  background: var(--wx-panel-bg); border: 1px solid var(--wx-panel-border);
}
.wx-freshness-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #22c55e;
}
.wx-freshness.warn .wx-freshness-dot { background: #f59e0b; }
.wx-freshness.stale .wx-freshness-dot { background: #ef4444; }

.wx-refresh-btn {
  width: 48px; height: 48px; border-radius: 14px;
  background: var(--wx-panel-bg); border: 1px solid var(--wx-panel-border);
  color: var(--wx-text-muted);
  cursor: pointer;
  display: grid; place-items: center;
  font-size: 18px;
  transition: transform 0.15s ease, background 0.15s ease;
}
@media (hover: hover) {
  .wx-refresh-btn:hover { background: rgba(255,255,255,0.08); }
}
.wx-refresh-btn:active { transform: scale(0.95); }

/* ---------- Loading / error ---------- */
.wx-loading, .wx-error {
  grid-column: 1 / -1;
  padding: 40px; text-align: center;
  color: var(--wx-text-muted);
}
.wx-error { color: #ef4444; }

/* ---------- Footer ---------- */
.wx-footer {
  grid-column: 1 / -1;
  font-size: 11px; color: var(--wx-text-dim);
  text-align: center; padding: 8px 0 4px;
}

/* Individual component styles are appended in tasks 6-12. */
```

- [ ] **Step 4.2: Verify CSS parses, no visual regression yet (weather view will look broken)**

Reload `http://localhost:8888/#weather`. Expected: page still loads; weather view looks stripped (we haven't rewritten the HTML yet so the old markup is now missing styles). No JS console errors. CSS file parses fine — check the Network tab: `weather-forecast.css` 200 OK.

- [ ] **Step 4.3: Commit**

```bash
git add services/dashboard/www/styles/views/weather-forecast.css
git commit -m "refactor(weather): replace CSS with redesign skeleton (tokens, grid, panel)"
```

---

## Task 5: Rewrite the weather block in `index.html` with the empty redesign shell

**Files:**
- Modify: `services/dashboard/www/index.html` - replace the entire `<div x-show="currentView === 'weather'" ...>` block (currently lines 3094-3229)

This task wires up the new DOM skeleton only. Panels are empty or show placeholders; individual sections get their markup filled in by tasks 6-12.

- [ ] **Step 5.1: Locate the existing weather block**

```bash
grep -n "currentView === 'weather'" services/dashboard/www/index.html
grep -n "</div>\s*<!--\s*TTS Announce\s*-->" services/dashboard/www/index.html || grep -n "TTS Announce" services/dashboard/www/index.html | head
```

Record the start and end line numbers. Start should be around 3094 (`<div x-show="currentView === 'weather'"`). End is the closing `</div>` just before the "TTS Announce" comment around line 3231.

- [ ] **Step 5.2: Replace the block**

Replace lines 3094-3229 (the entire weather block from `<div x-show="currentView === 'weather'"` through its closing `</div>` before `<!-- TTS Announce -->`) with:

```html
        <!-- Weather Forecast View - Redesign (2026-04-18) -->
        <div x-show="currentView === 'weather'"
             x-cloak
             x-data="weatherForecastView()"
             x-init="init()"
             @view-changed.window="if ($event.detail.view !== 'weather') destroy()"
             class="view weather-forecast-view">

          <!-- Loading -->
          <template x-if="isLoading && !daily.length">
            <div class="wx-loading">Loading forecast...</div>
          </template>

          <!-- Error (no cached data) -->
          <template x-if="hasError">
            <div class="wx-error">
              <strong>Cannot load forecast</strong><br>
              <span x-text="store.error"></span>
            </div>
          </template>

          <!-- Header -->
          <header class="wx-header">
            <div class="wx-header-title">
              <div class="wx-header-icon">🌦</div>
              <div>
                <h1 class="wx-header-h1">Weather</h1>
                <div class="wx-header-location">📍 Zehlendorf, DE</div>
              </div>
            </div>
            <div class="wx-header-actions">
              <div class="wx-freshness" :class="getFreshnessClass()">
                <span class="wx-freshness-dot"></span>
                <span x-text="getLastUpdateText()"></span>
              </div>
              <button class="wx-refresh-btn"
                      @click="refresh()"
                      :disabled="isLoading"
                      aria-label="Refresh forecast">
                <span x-show="!isLoading">🔄</span>
                <span x-show="isLoading">...</span>
              </button>
            </div>
          </header>

          <!-- Left column -->
          <div class="wx-left-col" x-show="current">
            <section class="wx-panel wx-hero"></section>
            <section class="wx-panel wx-hourly"></section>
            <section class="wx-panel wx-10day"></section>
          </div>

          <!-- Right column -->
          <div class="wx-right-col" x-show="current">
            <section class="wx-panel wx-stats"></section>
            <section class="wx-panel wx-sun"></section>
            <section class="wx-panel wx-highlights"></section>
          </div>

          <!-- Footer -->
          <footer class="wx-footer" x-show="current">
            Updated <span x-text="getLastUpdateText()"></span> · Open-Meteo
          </footer>
        </div>
```

- [ ] **Step 5.3: Add the two new view methods to `weather-forecast.js` temporarily**

The template above references `getFreshnessClass()` and `hasError`. Both need stubs. In `services/dashboard/www/views/weather-forecast.js`, find the existing file (we rewrite fully in Task 6 but need these now). For now, add these methods to the existing `weatherForecastView()` return object (near the top, alongside `isLoading`, `store`, etc.):

```javascript
    hasError: false,  // will be refined by getter in Task 6
    getFreshnessClass() {
      const last = this.store.lastUpdate;
      if (!last) return 'stale';
      const ageMin = (Date.now() - last) / 60000;
      if (ageMin < 10) return '';
      if (ageMin < 60) return 'warn';
      return 'stale';
    },
```

(Locate the `weatherForecastView` object; add these keys anywhere in it.)

- [ ] **Step 5.4: Reload and verify shell**

Reload `http://localhost:8888/#weather`. Expected: you see the new header with `🌦 Weather`, `📍 Zehlendorf, DE`, a freshness pill, and a refresh button. Below: 6 empty rounded panels in a 2-column grid (3 tall on left, 3 smaller on right), plus a footer. No JS errors in console.

- [ ] **Step 5.5: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/views/weather-forecast.js
git commit -m "refactor(weather): rewrite weather block with redesign shell + freshness helper"
```

---

## Task 6: Rewrite `views/weather-forecast.js` as the new view controller

**Files:**
- Modify: `services/dashboard/www/views/weather-forecast.js` (full rewrite)

- [ ] **Step 6.1: Replace the entire file**

Replace all contents of `services/dashboard/www/views/weather-forecast.js` with:

```javascript
/**
 * Weather Forecast View - Redesign (2026-04-18)
 * See docs/superpowers/specs/2026-04-18-weather-redesign-design.md
 *
 * View controller. Reads from Alpine.store('weatherForecast').
 * Owns UI-only state: selectedDayIndex. Exposes helpers for the template.
 *
 * Selected day resets to 0 on view re-entry by design - the Highlights
 * panel is the persistent summary.
 */

import { smoothPath, xScale, yScale } from '../utils/svg-curve.js';

export function weatherForecastView() {
  return {
    // ----- UI state -----
    selectedDayIndex: 0,
    _initialized: false,

    // ----- Lifecycle -----
    init() {
      if (this._initialized) return;
      this._initialized = true;
      this.store.activate();
    },

    destroy() {
      if (!this._initialized) return;
      this._initialized = false;
      this.store.deactivate();
    },

    // ----- Store proxy -----
    get store() { return Alpine.store('weatherForecast'); },
    get current() { return this.store.current; },
    get hourly() { return this.store.hourly; },
    get daily() { return this.store.daily; },
    get isLoading() { return this.store.loading; },
    get hasError() { return !!this.store.error && !this.store.daily?.length; },
    get isStale() { return !!this.store.error && this.store.daily?.length > 0; },

    // ----- Freshness / refresh -----
    getFreshnessClass() {
      const last = this.store.lastUpdate;
      if (!last) return 'stale';
      const ageMin = (Date.now() - last) / 60000;
      if (ageMin < 10) return '';
      if (ageMin < 60) return 'warn';
      return 'stale';
    },
    getLastUpdateText() {
      const last = this.store.lastUpdate;
      if (!last) return 'never';
      const ageMin = Math.floor((Date.now() - last) / 60000);
      if (ageMin < 1) return 'just now';
      if (ageMin < 60) return `${ageMin}m ago`;
      return `${Math.floor(ageMin / 60)}h ago`;
    },
    refresh() { this.store.fetchForecast(); },

    // ----- Hero -----
    get heroTemp() { return this.current?.temp ?? '--'; },
    get heroEmoji() { return this.current?.emoji ?? '❓'; },
    get heroDescription() { return this.current?.description ?? ''; },
    get heroHiLoLine() {
      const d = this.daily?.[0];
      if (!d) return '';
      const feels = this.current?.feelsLike;
      return `H ${d.tempMax}° · L ${d.tempMin}°` + (feels != null ? ` · Feels ${feels}°` : '');
    },

    // ----- Precipitation summary (next 6 hours) -----
    get precipSummary() {
      const next6 = (this.hourly || []).slice(0, 6);
      if (next6.length === 0) return { pct: 0, label: 'No data' };
      const peak = next6.reduce((a, b) => (b.precipProb > a.precipProb ? b : a));
      if (peak.precipProb < 20) return { pct: 0, label: 'Dry next 6h' };
      const hr = peak.time instanceof Date
        ? peak.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }).toLowerCase()
        : `${peak.hour}:00`;
      return { pct: peak.precipProb, label: `${peak.precipProb}% · peak ${hr}` };
    },

    // ----- Hourly curve (SVG) -----
    hourlyCurve() {
      const h = this.hourly || [];
      if (h.length < 2) return { d: '', points: [], width: 0, height: 0 };
      const W = 808, H = 140, padX = 16, padTop = 16, padBottom = 24;
      const temps = h.map(x => x.temp);
      const tMin = Math.min(...temps) - 1;
      const tMax = Math.max(...temps) + 1;
      const pts = h.map((x, i) => ({
        x: xScale(i, h.length, W, padX),
        y: yScale(x.temp, tMin, tMax, H, padTop, padBottom)
      }));
      return { d: smoothPath(pts), points: pts, width: W, height: H, baseline: H - padBottom };
    },

    // ----- 10-day curve (SVG) -----
    dailyCurve() {
      const d = this.daily || [];
      if (d.length < 2) return null;
      const W = 808, H = 180, padX = 40, padTop = 24, padBottom = 36;
      const allTemps = d.flatMap(x => [x.tempMax, x.tempMin]);
      const tMin = Math.min(...allTemps) - 2;
      const tMax = Math.max(...allTemps) + 2;
      const colW = (W - padX * 2) / (d.length - 1);
      const hiPts = d.map((x, i) => ({
        x: xScale(i, d.length, W, padX),
        y: yScale(x.tempMax, tMin, tMax, H, padTop, padBottom)
      }));
      const loPts = d.map((x, i) => ({
        x: xScale(i, d.length, W, padX),
        y: yScale(x.tempMin, tMin, tMax, H, padTop, padBottom)
      }));
      const hiPath = smoothPath(hiPts);
      const loPath = smoothPath(loPts);
      const areaPath = hiPath + ' L ' +
        loPts.slice().reverse().map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ') + ' Z';
      return {
        width: W, height: H, padX, padTop, padBottom, colW,
        hiPts, loPts, hiPath, loPath, areaPath,
        gridY: [0.25, 0.5, 0.75].map(p => padTop + p * (H - padTop - padBottom))
      };
    },

    // ----- Day column selection -----
    selectDay(i) { this.selectedDayIndex = i; },
    get selectedDay() { return this.daily?.[this.selectedDayIndex] ?? null; },
    get showSelectedDetail() { return this.selectedDayIndex !== 0; },

    // ----- Sun card -----
    get daylightLabel() {
      const d = this.daily?.[0];
      if (!d?.sunrise || !d?.sunset) return '';
      const rise = new Date(d.sunrise);
      const set = new Date(d.sunset);
      const mins = Math.round((set - rise) / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m of daylight`;
    },
    get sunriseText() {
      const d = this.daily?.[0];
      return d?.sunrise ? new Date(d.sunrise).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    },
    get sunsetText() {
      const d = this.daily?.[0];
      return d?.sunset ? new Date(d.sunset).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    },

    // ----- UV description -----
    uvDescription(uv) {
      if (uv <= 2) return 'Low. Minimal sun protection needed.';
      if (uv <= 5) return 'Moderate. Sunscreen advised.';
      if (uv <= 7) return 'High. Cover up and use sunscreen.';
      if (uv <= 10) return 'Very high. Limit midday exposure.';
      return 'Extreme. Avoid sun exposure.';
    }
  };
}

// Alpine component registration (matches sibling views)
document.addEventListener('alpine:init', () => {
  window.weatherForecastView = weatherForecastView;
});
```

- [ ] **Step 6.2: Confirm the view loads without errors**

Reload `http://localhost:8888/#weather`. DevTools console must show no errors. The 6 empty panels should still render (we haven't styled their contents yet — that comes next). Verify the freshness pill still updates and the refresh button still works.

- [ ] **Step 6.3: Commit**

```bash
git add services/dashboard/www/views/weather-forecast.js
git commit -m "refactor(weather): rewrite view controller with redesign helpers"
```

---

## Task 7: Implement Hero panel

**Files:**
- Modify: `services/dashboard/www/index.html` (the `<section class="wx-panel wx-hero">` tag in the weather block)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 7.1: Fill in the hero section markup**

Replace `<section class="wx-panel wx-hero"></section>` in the weather block with:

```html
            <section class="wx-panel wx-hero">
              <div class="wx-hero-main">
                <div class="wx-hero-temp">
                  <span x-text="heroTemp"></span><span class="wx-hero-unit">°</span>
                </div>
                <div class="wx-hero-desc" x-text="heroDescription"></div>
                <div class="wx-hero-hilo" x-text="heroHiLoLine"></div>
              </div>
              <div class="wx-hero-right">
                <div class="wx-hero-emoji" x-text="heroEmoji"></div>
                <div class="wx-hero-precip">
                  <div class="wx-hero-precip-label">
                    <span>Precip next 6h</span>
                    <span x-text="precipSummary.label"></span>
                  </div>
                  <div class="wx-hero-precip-track">
                    <div class="wx-hero-precip-fill" :style="'width: ' + precipSummary.pct + '%'"></div>
                  </div>
                </div>
              </div>
            </section>
```

- [ ] **Step 7.2: Append hero styles to the CSS file**

Append to `services/dashboard/www/styles/views/weather-forecast.css`:

```css
/* ---------- Hero ---------- */
.wx-hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: center;
  padding: 28px 32px;
}
.wx-hero-main { display: flex; flex-direction: column; gap: 8px; }
.wx-hero-temp {
  font-size: 72px; font-weight: 800; line-height: 1;
  letter-spacing: -0.03em;
}
.wx-hero-unit { font-weight: 500; opacity: 0.6; }
.wx-hero-desc { font-size: 18px; color: var(--wx-text-muted); }
.wx-hero-hilo { font-size: 13px; color: var(--wx-text-dim); }
.wx-hero-right {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 16px;
}
.wx-hero-emoji { font-size: 96px; line-height: 1; }
.wx-hero-precip {
  min-width: 220px;
  background: var(--wx-panel-bg);
  border: 1px solid var(--wx-panel-border);
  border-radius: 14px;
  padding: 12px 14px;
}
.wx-hero-precip-label {
  display: flex; justify-content: space-between;
  font-size: 11px; font-weight: 700;
  color: var(--wx-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 8px;
}
.wx-hero-precip-track {
  height: 6px; border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.wx-hero-precip-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--wx-accent-lo-a), var(--wx-accent-lo-b));
  transition: width 0.4s ease;
}
```

- [ ] **Step 7.3: Verify**

Reload. Expected: the hero panel now shows a large temperature, description, H/L/Feels line, the hero emoji, and a precipitation bar with the `% · peak Xpm` or `Dry next 6h` label. No console errors.

- [ ] **Step 7.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): implement hero panel with precip-next-6h bar"
```

---

## Task 8: Implement Hourly chart + card strip

**Files:**
- Modify: `services/dashboard/www/index.html` (the `wx-hourly` section)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 8.1: Fill in the hourly section markup**

Replace `<section class="wx-panel wx-hourly"></section>` with:

```html
            <section class="wx-panel wx-hourly">
              <div class="wx-panel-title">Next 24h</div>

              <!-- SVG area curve -->
              <template x-if="hourly.length >= 2">
                <div class="wx-hourly-chart">
                  <svg :viewBox="'0 0 ' + hourlyCurve().width + ' ' + hourlyCurve().height"
                       preserveAspectRatio="xMidYMid meet"
                       class="wx-hourly-svg">
                    <defs>
                      <linearGradient id="wx-hourly-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                      </linearGradient>
                    </defs>
                    <!-- Area under curve -->
                    <path :d="hourlyCurve().d + ' L ' + hourlyCurve().width + ' ' + hourlyCurve().baseline + ' L 0 ' + hourlyCurve().baseline + ' Z'"
                          fill="url(#wx-hourly-fill)"/>
                    <!-- Curve line -->
                    <path :d="hourlyCurve().d"
                          fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
                  </svg>
                </div>
              </template>

              <!-- Hourly cards strip -->
              <div class="wx-hourly-cards">
                <template x-for="(h, i) in hourly.slice(0, 12)" :key="'hr-' + i">
                  <div class="wx-hourly-card">
                    <div class="wx-hourly-card-time" x-text="h.hour + ':00'"></div>
                    <div class="wx-hourly-card-emoji" x-text="h.emoji"></div>
                    <div class="wx-hourly-card-temp"><span x-text="h.temp"></span>°</div>
                    <div class="wx-hourly-card-precip" x-text="h.precipProb + '%'"></div>
                  </div>
                </template>
              </div>
            </section>
```

- [ ] **Step 8.2: Append hourly styles**

Append to the CSS file:

```css
/* ---------- Hourly ---------- */
.wx-hourly-chart {
  height: 140px;
  width: 100%;
  margin-bottom: 16px;
}
.wx-hourly-svg { width: 100%; height: 100%; display: block; }

.wx-hourly-cards {
  display: flex; gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 4px 2px 8px;
  scrollbar-width: none;
}
.wx-hourly-cards::-webkit-scrollbar { display: none; }
.wx-hourly-card {
  flex: 0 0 64px;
  scroll-snap-align: start;
  display: flex; flex-direction: column; align-items: center;
  padding: 10px 4px;
  background: var(--wx-panel-bg);
  border: 1px solid var(--wx-panel-border);
  border-radius: 12px;
  gap: 4px;
}
.wx-hourly-card-time { font-size: 10px; color: var(--wx-text-dim); font-weight: 600; }
.wx-hourly-card-emoji { font-size: 18px; }
.wx-hourly-card-temp { font-size: 13px; font-weight: 700; }
.wx-hourly-card-precip { font-size: 10px; color: var(--wx-accent-lo-a); font-weight: 700; }
```

- [ ] **Step 8.3: Verify**

Reload. Expected: hourly panel shows a "Next 24h" label, a smooth SVG area curve, and a horizontal strip of 12 cards (time / emoji / temp / precip%). Strip should scroll horizontally on the kiosk width. No errors.

- [ ] **Step 8.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): implement hourly SVG curve + 12-card strip"
```

---

## Task 9: Implement 10-day chart (static SVG) + selection overlay

**Files:**
- Modify: `services/dashboard/www/index.html` (the `wx-10day` section)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 9.1: Fill in the 10-day chart section markup**

Replace `<section class="wx-panel wx-10day"></section>` with (IMPORTANT: this is the top half only — day-column buttons and detail strip come in Task 10):

```html
            <section class="wx-panel wx-10day">
              <div class="wx-10day-header">
                <div>
                  <div class="wx-panel-title">10-Day Forecast</div>
                  <div class="wx-10day-subtitle">Trend · Weekend highlighted</div>
                </div>
                <div class="wx-10day-legend">
                  <span><span class="wx-legend-chip wx-legend-hi"></span> High</span>
                  <span><span class="wx-legend-chip wx-legend-lo"></span> Low</span>
                </div>
              </div>

              <div class="wx-10day-chart-wrap">
                <!-- Static SVG chart -->
                <template x-if="dailyCurve()">
                  <svg viewBox="0 0 808 180"
                       preserveAspectRatio="xMidYMid meet"
                       class="wx-10day-svg"
                       x-ref="curve10d"
                       x-init="$nextTick(() => $refs.curve10d && $refs.curve10d.classList.add('wx-drawn'))">
                    <defs>
                      <linearGradient id="wx-hi-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#fbbf24"/>
                        <stop offset="100%" stop-color="#f97316"/>
                      </linearGradient>
                      <linearGradient id="wx-lo-grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#38bdf8"/>
                        <stop offset="100%" stop-color="#22d3ee"/>
                      </linearGradient>
                      <linearGradient id="wx-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.22"/>
                        <stop offset="50%" stop-color="#a78bfa" stop-opacity="0.12"/>
                        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.22"/>
                      </linearGradient>
                    </defs>

                    <!-- Weekend column tints -->
                    <template x-for="(d, i) in daily" :key="'wk-' + i">
                      <rect x-show="d.isWeekend"
                            :x="dailyCurve().padX + i * dailyCurve().colW - dailyCurve().colW / 2"
                            y="0"
                            :width="dailyCurve().colW"
                            height="180"
                            fill="rgba(251, 191, 36, 0.05)"
                            stroke="rgba(251, 191, 36, 0.12)"
                            stroke-dasharray="2 4"/>
                    </template>

                    <!-- Horizontal gridlines -->
                    <template x-for="y in dailyCurve().gridY" :key="'g-' + y">
                      <line :x1="dailyCurve().padX" :x2="808 - dailyCurve().padX"
                            :y1="y" :y2="y"
                            stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 6"/>
                    </template>

                    <!-- Filled area between high and low -->
                    <path :d="dailyCurve().areaPath" fill="url(#wx-area-grad)"/>

                    <!-- High curve (one-shot draw) -->
                    <path :d="dailyCurve().hiPath"
                          fill="none" stroke="url(#wx-hi-grad)"
                          stroke-width="2.5" stroke-linecap="round"
                          class="wx-curve wx-curve-high"/>

                    <!-- Low curve (one-shot draw) -->
                    <path :d="dailyCurve().loPath"
                          fill="none" stroke="url(#wx-lo-grad)"
                          stroke-width="2.5" stroke-linecap="round"
                          class="wx-curve wx-curve-low"/>

                    <!-- Per-day dots + temp labels -->
                    <template x-for="(p, i) in dailyCurve().hiPts" :key="'hi-' + i">
                      <g>
                        <circle :cx="p.x" :cy="p.y" r="4"
                                fill="#0a0c10" stroke="#f97316" stroke-width="2"/>
                        <text :x="p.x" :y="p.y - 10" text-anchor="middle"
                              fill="white" font-size="12" font-weight="700"
                              x-text="daily[i].tempMax + '°'"></text>
                      </g>
                    </template>
                    <template x-for="(p, i) in dailyCurve().loPts" :key="'lo-' + i">
                      <g>
                        <circle :cx="p.x" :cy="p.y" r="4"
                                fill="#0a0c10" stroke="#38bdf8" stroke-width="2"/>
                        <text :x="p.x" :y="p.y + 20" text-anchor="middle"
                              fill="rgba(255,255,255,0.65)" font-size="11" font-weight="600"
                              x-text="daily[i].tempMin + '°'"></text>
                      </g>
                    </template>
                  </svg>
                </template>

                <!-- Selection overlay (sibling div, only updates this element on selection) -->
                <div class="wx-10day-sel-overlay"
                     :style="'--wx-sel-i: ' + selectedDayIndex"></div>
              </div>

              <!-- Day columns + selected-day detail strip added in Task 10 -->
            </section>
```

- [ ] **Step 9.2: Append 10-day chart styles**

Append to the CSS file:

```css
/* ---------- 10-day chart ---------- */
.wx-10day-header {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 16px; margin-bottom: 12px;
}
.wx-10day-subtitle { font-size: 11px; color: var(--wx-text-dim); margin-top: 2px; }
.wx-10day-legend {
  display: flex; gap: 16px;
  font-size: 11px; color: var(--wx-text-muted);
}
.wx-legend-chip {
  display: inline-block; width: 12px; height: 3px; border-radius: 999px;
  vertical-align: middle; margin-right: 4px;
}
.wx-legend-hi { background: linear-gradient(90deg, #fbbf24, #f97316); }
.wx-legend-lo { background: linear-gradient(90deg, #38bdf8, #22d3ee); }

.wx-10day-chart-wrap {
  position: relative;
  aspect-ratio: 808 / 180;
  width: 100%;
}
.wx-10day-svg { width: 100%; height: 100%; display: block; }

/* Selection overlay: width = 10% (1 of 10 cols), left driven by Alpine-set var */
.wx-10day-sel-overlay {
  position: absolute;
  top: 0; bottom: 0;
  width: 10%;
  left: calc(var(--wx-sel-i, 0) * 10%);
  background: var(--wx-selected-tint);
  border-left: 1px solid var(--wx-panel-border);
  border-right: 1px solid var(--wx-panel-border);
  transition: left 0.2s ease;
  pointer-events: none;
}

/* One-shot stroke-draw gate (see spec §6) */
.wx-curve {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
}
.wx-drawn .wx-curve-high { animation: wx-draw 1.2s ease-out forwards; }
.wx-drawn .wx-curve-low  { animation: wx-draw 1.2s 0.2s ease-out forwards; }
@keyframes wx-draw { to { stroke-dashoffset: 0; } }
```

- [ ] **Step 9.3: Verify**

Reload. Expected: the 10-day panel shows a header (title + legend), then the SVG chart: weekend columns have amber tint, three dashed gridlines are visible, the area between high/low curves is gradient-filled, amber/orange high curve strokes on from left to right (one-shot, ~1.2s), sky/cyan low curve follows with slight delay. Temperature labels appear above/below each dot. No console errors.

- [ ] **Step 9.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): implement 10-day static SVG chart with one-shot draw"
```

---

## Task 10: Implement day-column buttons + selected-day detail strip

**Files:**
- Modify: `services/dashboard/www/index.html` (inside `wx-10day`, after the chart-wrap div)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 10.1: Extend the 10-day section with day buttons + detail strip**

Inside `<section class="wx-panel wx-10day">`, directly AFTER the `<div class="wx-10day-chart-wrap">...</div>` block, add:

```html
              <!-- Day columns -->
              <div class="wx-daycols">
                <template x-for="(d, i) in daily" :key="'dc-' + i">
                  <button class="wx-daycol"
                          :class="{ 'is-selected': selectedDayIndex === i, 'is-weekend': d.isWeekend, 'is-today': i === 0 }"
                          @click="selectDay(i)"
                          type="button">
                    <span x-show="i === 0" class="wx-daycol-badge wx-daycol-badge-today">Today</span>
                    <span x-show="i !== 0 && d.isWeekend" class="wx-daycol-badge wx-daycol-badge-wknd">Wknd</span>
                    <span class="wx-daycol-name" x-text="d.dayName"></span>
                    <span class="wx-daycol-date" x-text="d.dateStr"></span>
                    <span class="wx-daycol-emoji" x-text="d.emoji"></span>
                    <span class="wx-daycol-precip" x-text="d.precipProb + '%'"></span>
                  </button>
                </template>
              </div>

              <!-- Selected day detail strip -->
              <div class="wx-selday">
                <template x-if="!showSelectedDetail">
                  <div class="wx-selday-hint">Tap any day above for details</div>
                </template>
                <template x-if="showSelectedDetail && selectedDay">
                  <div class="wx-selday-grid">
                    <div class="wx-selday-cell">
                      <span class="wx-selday-icon" x-text="selectedDay.emoji"></span>
                      <div>
                        <div class="wx-selday-label">Selected</div>
                        <div class="wx-selday-value" x-text="selectedDay.dayName + ' · ' + selectedDay.dateStr"></div>
                      </div>
                    </div>
                    <div class="wx-selday-cell">
                      <span class="wx-selday-icon">🌡️</span>
                      <div>
                        <div class="wx-selday-label">High / Low</div>
                        <div class="wx-selday-value">
                          <span x-text="selectedDay.tempMax"></span>° /
                          <span x-text="selectedDay.tempMin"></span>°
                        </div>
                      </div>
                    </div>
                    <div class="wx-selday-cell">
                      <span class="wx-selday-icon">💧</span>
                      <div>
                        <div class="wx-selday-label">Precipitation</div>
                        <div class="wx-selday-value"><span x-text="selectedDay.precipProb"></span>%</div>
                      </div>
                    </div>
                    <div class="wx-selday-cell">
                      <span class="wx-selday-icon">🌬</span>
                      <div>
                        <div class="wx-selday-label">UV Index</div>
                        <div class="wx-selday-value"><span x-text="selectedDay.uvIndex"></span></div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
```

- [ ] **Step 10.2: Append day-column + selected-day styles**

Append:

```css
/* ---------- Day columns ---------- */
.wx-daycols {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
  margin-top: 16px;
}
.wx-daycol {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  gap: 4px;
  min-height: 92px;
  padding: 10px 4px;
  background: var(--wx-panel-bg);
  border: 1px solid var(--wx-panel-border);
  border-radius: 14px;
  color: var(--wx-text-primary);
  cursor: pointer;
  font: inherit;
  transition: transform 0.15s ease, background 0.15s ease;
  touch-action: manipulation;
}
.wx-daycol:active { transform: scale(0.98); }
.wx-daycol.is-selected {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.22);
}
.wx-daycol.is-weekend:not(.is-selected) {
  background: rgba(251, 191, 36, 0.05);
  border-color: rgba(251, 191, 36, 0.15);
}
.wx-daycol-badge {
  position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
  font-size: 9px; font-weight: 800;
  padding: 2px 6px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: 0.08em;
  white-space: nowrap;
}
.wx-daycol-badge-today { background: #2563eb; color: white; }
.wx-daycol-badge-wknd  { background: rgba(251, 191, 36, 0.9); color: #451a03; }

.wx-daycol-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.wx-daycol-date { font-size: 9px; color: var(--wx-text-dim); }
.wx-daycol-emoji { font-size: 20px; line-height: 1; }
.wx-daycol-precip { font-size: 10px; font-weight: 700; color: var(--wx-accent-lo-a); }

/* ---------- Selected day detail strip ---------- */
.wx-selday {
  margin-top: 16px;
  padding: 14px 16px;
  background: var(--wx-panel-bg);
  border: 1px solid var(--wx-panel-border);
  border-radius: 16px;
  min-height: 56px;
  display: flex; align-items: center;
}
.wx-selday-hint {
  width: 100%;
  text-align: center;
  font-size: 12px;
  color: var(--wx-text-dim);
}
.wx-selday-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  width: 100%;
}
.wx-selday-cell { display: flex; align-items: center; gap: 10px; }
.wx-selday-icon { font-size: 18px; }
.wx-selday-label { font-size: 10px; font-weight: 700; color: var(--wx-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.wx-selday-value { font-size: 13px; font-weight: 700; }
```

- [ ] **Step 10.3: Verify**

Reload. Expected: 10 day-column buttons under the SVG chart, first one has a blue "Today" badge, weekend days have amber "Wknd" badges. Clicking a day other than Today reveals the 4-cell detail strip below; clicking Today (or on initial load) shows the "Tap any day above for details" hint. Selecting a day animates the overlay column-tint across the chart.

- [ ] **Step 10.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): add 10-day day buttons + selected-day detail strip"
```

---

## Task 11: Implement Stats 2x2 grid

**Files:**
- Modify: `services/dashboard/www/index.html` (the `wx-stats` section)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 11.1: Fill in the stats section markup**

Replace `<section class="wx-panel wx-stats"></section>` with:

```html
            <section class="wx-panel wx-stats">
              <div class="wx-panel-title">Conditions</div>
              <div class="wx-stats-grid">
                <div class="wx-stat">
                  <div class="wx-stat-icon wx-stat-icon-wind">🌬</div>
                  <div class="wx-stat-label">Wind</div>
                  <div class="wx-stat-value">
                    <span x-text="current?.wind ?? '--'"></span><span class="wx-stat-unit">km/h</span>
                  </div>
                  <div class="wx-stat-desc">From <span x-text="current?.windDir ?? '--'"></span>°</div>
                </div>
                <div class="wx-stat">
                  <div class="wx-stat-icon wx-stat-icon-feels">🌡️</div>
                  <div class="wx-stat-label">Feels like</div>
                  <div class="wx-stat-value">
                    <span x-text="current?.feelsLike ?? '--'"></span><span class="wx-stat-unit">°</span>
                  </div>
                  <div class="wx-stat-desc">Apparent temperature</div>
                </div>
                <div class="wx-stat">
                  <div class="wx-stat-icon wx-stat-icon-humid">💧</div>
                  <div class="wx-stat-label">Humidity</div>
                  <div class="wx-stat-value">
                    <span x-text="current?.humidity ?? '--'"></span><span class="wx-stat-unit">%</span>
                  </div>
                  <div class="wx-stat-desc">Relative humidity</div>
                </div>
                <div class="wx-stat">
                  <div class="wx-stat-icon wx-stat-icon-uv">☀️</div>
                  <div class="wx-stat-label">UV Index</div>
                  <div class="wx-stat-value">
                    <span x-text="daily[0]?.uvIndex ?? '--'"></span>
                  </div>
                  <div class="wx-stat-desc" x-text="uvDescription(daily[0]?.uvIndex ?? 0)"></div>
                </div>
              </div>
            </section>
```

- [ ] **Step 11.2: Append stats styles**

Append:

```css
/* ---------- Stats ---------- */
.wx-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.wx-stat {
  padding: 14px;
  background: var(--wx-panel-bg);
  border: 1px solid var(--wx-panel-border);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 2px;
}
.wx-stat-icon {
  width: 32px; height: 32px; border-radius: 10px;
  display: grid; place-items: center;
  font-size: 16px;
  margin-bottom: 6px;
}
.wx-stat-icon-wind  { background: rgba(59, 130, 246, 0.18); }
.wx-stat-icon-feels { background: rgba(249, 115, 22, 0.18); }
.wx-stat-icon-humid { background: rgba(56, 189, 248, 0.18); }
.wx-stat-icon-uv    { background: rgba(250, 204, 21, 0.18); }
.wx-stat-label { font-size: 10px; font-weight: 700; color: var(--wx-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.wx-stat-value {
  display: flex; align-items: baseline; gap: 4px;
  font-size: 22px; font-weight: 800;
}
.wx-stat-unit { font-size: 12px; font-weight: 500; color: var(--wx-text-muted); }
.wx-stat-desc { font-size: 10px; color: var(--wx-text-dim); line-height: 1.3; margin-top: 4px; }
```

- [ ] **Step 11.3: Verify**

Reload. Expected: the Stats panel in the right sidebar now shows 4 cards (Wind / Feels / Humidity / UV) with icon pill, label, value, and one-line description.

- [ ] **Step 11.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): implement 2x2 stats grid (wind/feels/humidity/UV)"
```

---

## Task 12: Implement Sun card

**Files:**
- Modify: `services/dashboard/www/index.html` (the `wx-sun` section)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 12.1: Fill in the sun section markup**

Replace `<section class="wx-panel wx-sun"></section>` with:

```html
            <section class="wx-panel wx-sun">
              <div class="wx-panel-title">Daylight</div>
              <div class="wx-sun-times">
                <div class="wx-sun-time">
                  <span class="wx-sun-emoji">🌅</span>
                  <span x-text="sunriseText"></span>
                </div>
                <div class="wx-sun-duration" x-text="daylightLabel"></div>
                <div class="wx-sun-time">
                  <span class="wx-sun-emoji">🌇</span>
                  <span x-text="sunsetText"></span>
                </div>
              </div>
              <svg viewBox="0 0 200 40" class="wx-sun-arc" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <path d="M 10 40 Q 100 -10 190 40"
                      fill="none"
                      stroke="rgba(251, 191, 36, 0.35)"
                      stroke-width="1.5"
                      stroke-dasharray="3 4"/>
              </svg>
            </section>
```

- [ ] **Step 12.2: Append sun styles**

Append:

```css
/* ---------- Sun ---------- */
.wx-sun { display: flex; flex-direction: column; gap: 8px; }
.wx-sun-times {
  display: flex; justify-content: space-between; align-items: center;
  gap: 12px;
  font-size: 13px; font-weight: 700;
}
.wx-sun-time { display: inline-flex; align-items: center; gap: 6px; }
.wx-sun-emoji { font-size: 18px; }
.wx-sun-duration { font-size: 11px; color: var(--wx-text-muted); }
.wx-sun-arc { width: 100%; height: 36px; }
```

- [ ] **Step 12.3: Verify**

Reload. Expected: Sun card shows `🌅 HH:MM` · `Xh Ym of daylight` · `🌇 HH:MM` across one row, with a thin decorative arc below. No rotating sun, no infinite animation.

- [ ] **Step 12.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): implement sunrise/sunset card (static, no rotation)"
```

---

## Task 13: Implement Weekly Highlights panel

**Files:**
- Modify: `services/dashboard/www/index.html` (the `wx-highlights` section)
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 13.1: Fill in the highlights section markup**

Replace `<section class="wx-panel wx-highlights"></section>` with:

```html
            <section class="wx-panel wx-highlights" x-show="store.weeklyHighlights">
              <div class="wx-panel-title">Week Highlights</div>
              <template x-if="store.weeklyHighlights">
                <div class="wx-highlights-list">
                  <div class="wx-hl-row wx-hl-warm">
                    <div class="wx-hl-icon">☀️</div>
                    <div class="wx-hl-body">
                      <div class="wx-hl-label">Warmest day</div>
                      <div class="wx-hl-day" x-text="store.weeklyHighlights.warmest.dayName + ', ' + store.weeklyHighlights.warmest.dateStr"></div>
                    </div>
                    <div class="wx-hl-value"><span x-text="store.weeklyHighlights.warmest.tempMax"></span>°</div>
                  </div>
                  <div class="wx-hl-row wx-hl-cold">
                    <div class="wx-hl-icon">❄️</div>
                    <div class="wx-hl-body">
                      <div class="wx-hl-label">Coldest night</div>
                      <div class="wx-hl-day" x-text="store.weeklyHighlights.coldest.dayName + ', ' + store.weeklyHighlights.coldest.dateStr"></div>
                    </div>
                    <div class="wx-hl-value"><span x-text="store.weeklyHighlights.coldest.tempMin"></span>°</div>
                  </div>
                  <div class="wx-hl-row wx-hl-wet">
                    <div class="wx-hl-icon">🌧️</div>
                    <div class="wx-hl-body">
                      <div class="wx-hl-label">Wettest day</div>
                      <div class="wx-hl-day" x-text="store.weeklyHighlights.wettest.dayName + ', ' + store.weeklyHighlights.wettest.dateStr"></div>
                    </div>
                    <div class="wx-hl-value"><span x-text="store.weeklyHighlights.wettest.precipProb"></span>%</div>
                  </div>
                  <template x-if="store.weeklyHighlights.bestWeekend">
                    <div class="wx-hl-row wx-hl-wknd">
                      <div class="wx-hl-icon">🌤️</div>
                      <div class="wx-hl-body">
                        <div class="wx-hl-label">Best weekend</div>
                        <div class="wx-hl-day" x-text="store.weeklyHighlights.bestWeekend.dayName + ', ' + store.weeklyHighlights.bestWeekend.dateStr"></div>
                      </div>
                      <div class="wx-hl-value" x-text="store.weeklyHighlights.bestWeekend.tempMax + '°'"></div>
                    </div>
                  </template>
                </div>
              </template>
            </section>
```

- [ ] **Step 13.2: Append highlights styles**

Append:

```css
/* ---------- Weekly highlights ---------- */
.wx-highlights-list { display: flex; flex-direction: column; gap: 8px; }
.wx-hl-row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--wx-panel-border);
  background: var(--wx-panel-bg);
}
.wx-hl-warm { background: linear-gradient(90deg, rgba(249,115,22,0.12), rgba(251,191,36,0.06)); }
.wx-hl-cold { background: linear-gradient(90deg, rgba(56,189,248,0.14), rgba(59,130,246,0.06)); }
.wx-hl-wet  { background: linear-gradient(90deg, rgba(59,130,246,0.14), rgba(99,102,241,0.06)); }
.wx-hl-wknd { background: linear-gradient(90deg, rgba(251,191,36,0.14), rgba(250,204,21,0.06)); }

.wx-hl-icon { width: 32px; height: 32px; display: grid; place-items: center; font-size: 16px; background: rgba(255,255,255,0.05); border-radius: 10px; }
.wx-hl-label { font-size: 10px; font-weight: 700; color: var(--wx-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
.wx-hl-day { font-size: 12px; font-weight: 700; }
.wx-hl-value { font-size: 16px; font-weight: 800; }
```

- [ ] **Step 13.3: Verify**

Reload. Expected: Highlights panel (bottom of right sidebar) shows 3-4 gradient pill rows (Warmest / Coldest / Wettest, plus Best weekend if the next 10 days include a Sat/Sun). Each row has an emoji, label, day text, and a bold value.

- [ ] **Step 13.4: Commit**

```bash
git add services/dashboard/www/index.html services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): implement weekly highlights panel (warmest/coldest/wettest/wknd)"
```

---

## Task 14: Staggered entrance fades (panel groups)

**Files:**
- Modify: `services/dashboard/www/styles/views/weather-forecast.css` (append)

- [ ] **Step 14.1: Append the fade animation + group rules**

Append:

```css
/* ---------- Staggered entrance ---------- */
@keyframes wx-fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Group 1: header, hero, and panel titles */
.weather-forecast-view .wx-header,
.weather-forecast-view .wx-hero {
  animation: wx-fade 0.3s ease-out both;
  animation-delay: 0ms;
}
/* Group 2: hourly + 10-day */
.weather-forecast-view .wx-hourly,
.weather-forecast-view .wx-10day {
  animation: wx-fade 0.3s ease-out both;
  animation-delay: 100ms;
}
/* Group 3: sidebar */
.weather-forecast-view .wx-stats,
.weather-forecast-view .wx-sun,
.weather-forecast-view .wx-highlights {
  animation: wx-fade 0.3s ease-out both;
  animation-delay: 200ms;
}
```

- [ ] **Step 14.2: Verify**

Reload. Expected: on entering the weather view, the panels fade + slide in subtly in 3 groups within ~500ms. Zero infinite motion. After the initial entrance, no repeated animation (switch to Transport and back - animation replays only on view entry, which is acceptable per spec).

- [ ] **Step 14.3: Commit**

```bash
git add services/dashboard/www/styles/views/weather-forecast.css
git commit -m "feat(weather): staggered entrance fade in 3 panel groups"
```

---

## Task 15: Lint + grep assertions (objective acceptance checks)

This task enforces spec §10's falsifiable checks before any Pi deployment. All checks must pass.

- [ ] **Step 15.1: CSS performance lint**

```bash
scripts/lint-css-performance.sh services/dashboard/www/styles/views/weather-forecast.css
echo "exit=$?"
```

Expected: exit code `0` (clean) or `2` (warnings-only for the `@keyframes wx-fade` and `@keyframes wx-draw` one-shot animations). If exit code is `1`, something went wrong - read the output, fix the banned property, re-run.

- [ ] **Step 15.2: Infinite-animation grep**

```bash
grep -rnE "animation:[^;]*infinite" services/dashboard/www/styles/views/weather-forecast.css
```

Expected: zero output (no matches).

- [ ] **Step 15.3: Backdrop/blur grep**

```bash
grep -rnE "backdrop-filter|filter:\s*blur" services/dashboard/www/styles/views/weather-forecast.css
```

Expected: zero output.

- [ ] **Step 15.4: `preserveAspectRatio="none"` grep (weather files only)**

```bash
grep -nE "preserveAspectRatio=\"none\"" \
  services/dashboard/www/styles/views/weather-forecast.css \
  services/dashboard/www/views/weather-forecast.js \
  services/dashboard/www/utils/svg-curve.js
grep -nE "preserveAspectRatio=\"none\"" services/dashboard/www/index.html | grep -i weather
```

Expected: zero output from both.

- [ ] **Step 15.5: DOM structural checks via browser console**

Reload `http://localhost:8888/#weather`. In DevTools console:

```javascript
// Day columns: exactly 10
console.log('daycols:', document.querySelectorAll('.wx-daycol').length);
// Hourly cards: 12
console.log('hourly cards:', document.querySelectorAll('.wx-hourly-card').length);
// Stat cards: 4
console.log('stats:', document.querySelectorAll('.wx-stat').length);
// Scroll-snap on hourly strip
const hs = document.querySelector('.wx-hourly-cards');
console.log('snap:', getComputedStyle(hs).scrollSnapType);
// weeklyHighlights is a plain prop, not a getter
const s = Alpine.store('weatherForecast');
console.log('wh is getter?', !!Object.getOwnPropertyDescriptor(s, 'weeklyHighlights').get);
```

Expected: `daycols: 10`, `hourly cards: 12`, `stats: 4`, `snap: x mandatory`, `wh is getter? false`.

- [ ] **Step 15.6: No console errors**

Look at the Console tab. Expected: zero errors, zero red text. Warnings are acceptable. If any error appears, read the stack trace and fix before proceeding.

- [ ] **Step 15.7: Commit if any fixes were needed**

If Step 15.1-15.6 required edits, commit them now:

```bash
git status
# if staged changes exist:
git commit -m "fix(weather): address lint/grep findings from task 15"
```

If nothing changed, skip this step.

---

## Task 16: Playwright screenshots at 3 viewports

**Files:**
- Create: `services/dashboard/www/test-results/weather/kiosk-1280x800-dark.png`
- Create: `services/dashboard/www/test-results/weather/kiosk-1280x800-light.png`
- Create: `services/dashboard/www/test-results/weather/desktop-1440x900-dark.png`
- Create: `services/dashboard/www/test-results/weather/phone-375x812-dark.png`

- [ ] **Step 16.1: Ensure the test-results directory exists**

```bash
mkdir -p services/dashboard/www/test-results/weather
```

- [ ] **Step 16.2: Take screenshots via Playwright (or Chrome DevTools device mode)**

If Playwright MCP is available, use it to take each screenshot. Otherwise, use Chrome DevTools device mode:
1. Open `http://localhost:8888/#weather` in Chrome.
2. Open DevTools (F12) > Device Mode (Ctrl+Shift+M).
3. Set viewport to `1280 x 800`, full-page screenshot.
4. Save as `services/dashboard/www/test-results/weather/kiosk-1280x800-dark.png`.
5. Toggle light theme via localStorage: `localStorage.setItem('theme', 'light'); location.reload();`.
6. Screenshot and save as `kiosk-1280x800-light.png`.
7. Toggle back to dark: `localStorage.setItem('theme', 'dark'); location.reload();`.
8. Repeat at `1440 x 900` (save as `desktop-1440x900-dark.png`) and `375 x 812` (save as `phone-375x812-dark.png`).

- [ ] **Step 16.3: Commit the screenshots**

```bash
git add services/dashboard/www/test-results/weather/
git commit -m "test(weather): add Playwright screenshots at 3 viewports (dark + light)"
```

---

## Task 17: Deploy to Pi and run thermal + view-switch checks

**Files:**
- None (Pi deployment + verification)

- [ ] **Step 17.1: Confirm you are on main**

```bash
git branch --show-current
git log -1 --oneline
```

Expected: `main`, and the most recent commit is one of the redesign commits.

- [ ] **Step 17.2: Deploy to the Pi**

```bash
scp services/dashboard/www/utils/svg-curve.js pi@pi:/opt/dashboard/www/utils/
scp services/dashboard/www/js/stores/weather-forecast-store.js pi@pi:/opt/dashboard/www/js/stores/
scp services/dashboard/www/views/weather-forecast.js pi@pi:/opt/dashboard/www/views/
scp services/dashboard/www/styles/views/weather-forecast.css pi@pi:/opt/dashboard/www/styles/views/
scp services/dashboard/www/index.html pi@pi:/opt/dashboard/www/
ssh pi@pi "sudo chmod -R 755 /opt/dashboard/www"
```

Expected: all `scp` complete without error.

- [ ] **Step 17.3: Reload the kiosk browser (from the Pi)**

```bash
ssh pi@pi "pkill -HUP epiphany 2>/dev/null || true"
```

Or physically tap the kiosk to bring it to the Weather view.

- [ ] **Step 17.4: Idle thermal check (10 minutes)**

Open the Weather view on the kiosk. Leave it on that view for 10 minutes, then run:

```bash
ssh pi@pi 'cat /sys/class/thermal/thermal_zone0/temp && \
           cat /sys/class/thermal/cooling_device0/cur_state && \
           uptime && \
           ps aux | grep -E "epiphany|WebKit" | grep -v grep'
```

Expected:
- Temp < `55000` (55°C)
- Fan state `0` or `1`
- Load avg < `2.0`
- WebKit CPU < `50%`

If any threshold is exceeded, read logs and diagnose before continuing. DO NOT ship a regression.

- [ ] **Step 17.5: View-switch repaint storm test**

From the kiosk or via remote click simulation, cycle: Transport → Weather → Lights → Weather. Repeat 5 times while running on the Pi:

```bash
ssh pi@pi "top -b -n 30 -d 1 -p \$(pgrep -f WebKitWebProcess | head -1) | awk '/%CPU/||/WebKit/' | tail -30"
```

Expected: during each view switch, WebKit CPU peaks below `80%` and settles under `20%` within 2 seconds. No thermal alarm.

- [ ] **Step 17.6: Confirm MQTT / freshness pill works on Pi**

On the kiosk, verify the freshness pill updates correctly (should show `just now` or `Xm ago`, color = green/amber/red per age).

- [ ] **Step 17.7: Pi Epiphany emoji render spot check**

Visually inspect the kiosk display:
- The hero emoji (e.g. 🌦, ☁️, ⛅) renders as an emoji, not `[?]` or a tofu rectangle.
- Stat icons (🌬 🌡️ 💧 ☀️) render.
- Day-column emojis render.
- Sunrise/sunset emojis render (🌅 🌇).

If any glyph is broken on Epiphany, fall back to an inline SVG for that specific icon in a follow-up commit.

---

## Task 18: Final verification + close-out

- [ ] **Step 18.1: Re-run all acceptance checks from the spec**

For each item in spec §10, confirm it passes. The Task 15 and Task 17 steps cover all of them — this is a sanity re-read.

- [ ] **Step 18.2: Update CLAUDE.md (if structural facts changed)**

If this implementation added a new pattern worth documenting (e.g., the `x-init + $nextTick` one-shot gate), add a brief note to `services/dashboard/CLAUDE.md` under a "Weather View (2026-04-18)" section with: architecture summary, key files, and the one-shot-gate pattern. Keep it under 30 lines. This is optional — only add if genuinely useful for future agents.

- [ ] **Step 18.3: Final commit if CLAUDE.md was updated**

```bash
git add services/dashboard/CLAUDE.md
git commit -m "docs(dashboard): document weather view redesign patterns"
```

- [ ] **Step 18.4: Summary to the user**

Report the final state: commits created, files touched, screenshot paths, Pi verification results. Flag any deviations from the spec (there should be none; if there are, they must be called out explicitly).

---

## Done

All 18 tasks complete. The weather view now matches the mockup's information architecture while operating within the Pi kiosk's CSS budget. The store exposes 4 new fields + `weeklyHighlights`. The new `utils/svg-curve.js` is reusable for future SVG-chart work.
