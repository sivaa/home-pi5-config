# Weather Dashboard Redesign — Design Spec

**Date:** 2026-04-18
**Target view:** `services/dashboard/www` — weather-forecast view (`#weather`)
**Source mockup:** `home-dashboard-redesign.zip` (React + Tailwind + framer-motion prototype)
**Target runtime:** Pi 5 kiosk, WebKit/Epiphany on Wayland, 1280×800 touch display
**Stack constraint:** stay on vanilla Alpine.js + CSS variables. No build step. No new JS dependencies.

---

## 1. Goals & Non-Goals

### Goals

- Adopt the mockup's visual language and information architecture as closely as the Pi kiosk allows.
- Upgrade the 10-day forecast from the current "tiered ruler rows" to a smooth SVG high/low trend curve with touch-selectable day columns and a selected-day detail strip.
- Add a right-column sidebar with weekly highlights, a 2×2 stat grid, and a sunrise/sunset card.
- Extend Open-Meteo fetch with `wind_speed_10m`, `relative_humidity_2m`, `apparent_temperature`, `uv_index_max`. No new external APIs.
- Keep the existing store's tested parts: 30-minute polling, activate/deactivate lifecycle, WMO code map, alert logic (rain window / freezing / heat / snow), stale-data warning.

### Non-Goals

- No React, Tailwind, framer-motion, recharts, or lucide. No build step.
- No multi-city support. Location is fixed to Zehlendorf, Berlin.
- No "Pro" branding / "SkyCast" identity. Title is "Weather" (matches `Transport`, `Lights`, etc.).
- No search bar.
- No "Air" tab (no air-quality data source exists in the project).
- No backdrop-filter, no filter:blur, no infinite animations, no multi-layer box-shadows — all banned by `services/dashboard/CLAUDE.md`.
- No rollback-friendly sidecar view. Replace in place. No feature flag.

---

## 2. Architecture & File Impact

```
services/dashboard/www/
│
├── js/stores/weather-forecast-store.js   EXTEND
│   • fetch params: +wind_speed_10m, +relative_humidity_2m,
│     +apparent_temperature, +uv_index_max
│   • _parseCurrent() → wind, windDir, humidity, feelsLike
│   • _parseDaily() → uvIndex
│   • New eager-computed property: weeklyHighlights
│     { warmest: day, coldest: day, wettest: day, bestWeekend: day | null }
│     (Plain property, not a getter — computed once per fetch inside
│      fetchForecast(), same pattern as alertText)
│   • Unchanged: activate, deactivate, _generateAlert, _weatherInfo,
│     POLL_MS, LATITUDE, LONGITUDE, TIMEZONE, WMO_CODES map, stale warning
│
├── views/weather-forecast.js             REWRITE
│   • New getters: selectedDay, sunPositionPct, daylightLabel
│   • New state: selectedDayIndex (defaults to 0, resets on re-entry
│     by design — weekly highlights panel is the persistent summary)
│   • Kept: init/destroy lifecycle, refresh(), getLastUpdateText(),
│     alert icon/type/title/sub helpers
│
├── utils/svg-curve.js                    NEW
│   • Pure geometry helpers: smoothPath(points),
│     xScale(i, n, width, padX), yScale(v, min, max, height, padTop, padBottom)
│   • Zero dependencies. Unit-testable.
│   • Imported by views/weather-forecast.js (used by hourly + 10-day curves)
│
├── styles/views/weather-forecast.css     REWRITE
│   • 2-col grid layout (8fr / 4fr) from ≥1024px
│   • Single-column stacked from <1024px (phone/narrow kiosk fallback)
│   • New tokens: --wx-panel-bg, --wx-panel-border, --wx-accent-hi,
│     --wx-accent-lo, --wx-grad-high, --wx-grad-low
│   • Components: .wx-hero, .wx-precip, .wx-hourly, .wx-curve-10d,
│     .wx-daycol, .wx-selday, .wx-highlights, .wx-stats, .wx-stat,
│     .wx-sun
│   • Pi-safe: solid rgba panels, no backdrop-filter, one-shot entrance
│     fade only (0.3s), single box-shadow, border-based emphasis
│
└── index.html                            REWRITE weather block only
    • Replace entire <div x-show="currentView === 'weather'"> block
    • Same anchor: x-data="weatherForecastView()" x-init="init()"
      @view-changed.window handler for destroy()
```

**Unchanged:** navigation, stores outside of weather-forecast-store, Pi infra (nginx, HA, MQTT, InfluxDB).

---

## 3. Layout (1280×800 Kiosk Baseline)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER    🌦  Weather · Zehlendorf, DE        ● Live 3m    [🔄 Refresh]     │
├───────────────────────────────────────────────────────────┬─────────────────┤
│  LEFT (8fr, ~800px)                                        │ RIGHT (4fr,     │
│                                                            │ ~380px)         │
│ ┌────────────────── HERO ─────────────────────────────┐   │┌ STATS 2×2 ───┐ │
│ │  20°  Mostly Overcast                        ☁️      │   ││ Wind  │ Feels │ │
│ │  H 22° · L 14° · Feels 18°                          │   ││       │       │ │
│ │  ┌──────────── PRECIP NEXT 6H ──────────┐           │   ││ Humid │ UV    │ │
│ │  │ ████████████░░░░░░░ 65% · peak 7pm   │           │   │└───────────────┘ │
│ │  └───────────────────────────────────────┘          │   │                 │
│ └──────────────────────────────────────────────────────┘   │┌ SUN ──────────┐ │
│                                                            ││ 🌅 05:24       │ │
│ ┌─── HOURLY · Next 24h ──────────────────────────────┐    ││ 14h 48m daylight│ │
│ │                                                     │    ││ 🌇 20:12       │ │
│ │  [SVG area curve: temperature, 24 points]           │    │└───────────────┘ │
│ │                                                     │    │                 │
│ │  [12 hourly cards: time / emoji / temp / precip%]   │    │┌ HIGHLIGHTS ──┐ │
│ └─────────────────────────────────────────────────────┘    ││ Warmest       │ │
│                                                            ││ Coldest       │ │
│ ┌─── 10-DAY FORECAST ────────────────────────────────┐    ││ Wettest       │ │
│ │  Trend · Weekend highlighted                        │    ││ Best weekend  │ │
│ │                                                     │    │└───────────────┘ │
│ │  [Static SVG: high curve (amber→orange) + low       │    │                 │
│ │   curve (sky→cyan) + filled area + weekend tints]   │    │                 │
│ │                                                     │    │                 │
│ │  [Selection overlay div: absolute, 1 column wide]   │    │                 │
│ │                                                     │    │                 │
│ │  [10 day columns: Today/Fri/Sat/...  touch-sized]   │    │                 │
│ │                                                     │    │                 │
│ │  ┌────── SELECTED DAY DETAIL (only if ≠ today) ──┐ │    │                 │
│ │  │ ☁ Fri · Apr 19   H 14°/L 9°   65%   14km/h    │ │    │                 │
│ │  └───────────────────────────────────────────────┘ │    │                 │
│ └─────────────────────────────────────────────────────┘    │                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ FOOTER    Updated 3 min ago · Open-Meteo                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Grid math
- Viewport: `1280 × 800`. Nav eats ~64px top, footer ~40px. Content area: `1280 × ~696`.
- Horizontal padding: 24px each side → 1232px usable.
- Grid: `grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); gap: 20px;` → left ≈ 808px, right ≈ 388px.
- Breakpoint fallback: at `<1024px` the grid collapses to single column, sidebar panels stack below the 10-day.
- Vertical: hero ~180px, hourly ~260px, 10-day ~320px → ~760px total. Fits with a small internal scroll on the 10-day card if needed; never a full-page scroll on the kiosk.

### Touch targets
- Day column buttons: min `64 × 92px` (well above 44×44 minimum).
- Refresh button: 48×48.
- Selected day detail strip is not touch-interactive (display only).

---

## 4. Component Breakdown

### 4.1 Hero (`.wx-hero`)
- Two-column flex. Left: big temperature (64–72px), condition label, H/L/Feels-like line. Right: hero emoji (sized 96–112px) and the precipitation probability bar.
- Precipitation bar: width = `max(next6h.precipProb)`. Label: `{max}% · peak {time}` where `time` is the hour with the highest precipitation probability in the next 6 hours (derived client-side from `hourly[]`). If `max < 20%`, label reads `Dry next 6h` instead.
- Entrance: one-shot 0.3s fade-in (`@keyframes wx-fade`), no infinite animation on the hero emoji.

### 4.2 Hourly (`.wx-hourly`)
- SVG area curve (NOT recharts). 24 hourly points, smooth Catmull-Rom→Bezier path (`smoothPath()` ported from the mockup's `TenDayForecast`).
- Below the curve: horizontally-scrollable row of 12 compact cards. `overflow-x: auto; scroll-snap-type: x mandatory;` Each card shows time, emoji, temp°, precip%.
- The "Forecast / Details / Air" tabs from the mockup are DROPPED. Replaced with a static header: **Next 24h**. Keeps the visual weight of the header without inventing tabs we can't populate.

### 4.3 10-day forecast (`.wx-curve-10d`)
- The hero move. Split into a STATIC SVG chart + a thin absolute-positioned overlay div for the selected-column highlight. This avoids re-rasterizing the entire ~60-node SVG on every day-column tap (see perf review, P1 SVG layer repaint).
- **Static SVG:** `<svg viewBox="0 0 808 180" preserveAspectRatio="xMidYMid meet">`. The viewBox is locked to the kiosk baseline pixel dimensions; `meet` lets it scale cleanly on desktop (1440) and phone (375) fallback widths without introducing non-uniform stroke rendering. `preserveAspectRatio="none"` is FORBIDDEN (WebKit path-rendering slow path). No `ResizeObserver` on the viewBox — mutating the viewBox attribute would invalidate the static-chart/overlay-div split from this same section by triggering a full SVG repaint.
  - Weekend column tint rects (amber 5% fill + dashed border).
  - 3 horizontal dashed gridlines at 25/50/75%.
  - Filled area between high and low curves (vertical gradient: amber → muted purple → sky).
  - High curve (amber→orange gradient stroke, 2.5px).
  - Low curve (sky→cyan gradient stroke, 2.5px).
  - Per-day dots (2 per day: high + low), temperature labels above/below each dot.
  - **Dropped** (per UX P1 — avoid visual soup): per-day vertical connector lines. The filled area between the two curves already communicates the range. Two range-visualization devices would compete.
- **Selection overlay** (sibling div, positioned absolutely over the chart): a rounded rect with `width: 10%` (one of ten columns) and `left: calc(var(--wx-sel-i, 0) * 10%)` where `--wx-sel-i` is bound via Alpine `:style="'--wx-sel-i: ' + selectedDayIndex"`. At index 0 the overlay sits at `left: 0%`; at index 9 it sits at `left: 90%` with `width: 10%`, ending exactly at 100%. Alpine only updates the inline CSS custom property on the div — the SVG is never re-rendered.
- Below the SVG: 10 day-column buttons in a `grid-template-columns: repeat(10, minmax(0, 1fr));`.
  - Each shows day short name, date, emoji, precip%.
  - "Today" badge on index 0 (blue pill).
  - "Wknd" badge on weekend days (amber pill).
  - Selected column has raised border + subtle bg.
- Below the column grid: selected-day detail strip — 4-slot grid showing (condition, H/L, precip%, wind). **Visibility rule (UX P0 — avoid duplicating hero on default load):**
  - When `selectedDayIndex === 0`, render a dim hint row instead: `Tap any day above for details`.
  - When `selectedDayIndex !== 0`, render the detail strip.
  - 0.3s fade on transitions.

### 4.4 Weekly Highlights (`.wx-highlights`)
- Position (UX P0 — eye-path correction): bottom of the right sidebar, below Stats and Sun. A user scanning weather at 7am needs current conditions and today's trend first; "warmest day in the next 9 days" is browse-level content, not urgent content. Order in sidebar: **Stats → Sun → Highlights**.
- Vertical stack of 4 rows.
- Each row is a horizontal pill: `[gradient icon] · label · day · value`.
- Labels + their source:
  - Warmest day → `daily.reduce(max tempMax)`
  - Coldest night → `daily.reduce(min tempMin)`
  - Wettest day → `daily.reduce(max precipProb)`
  - Best weekend → pick the weekend day with the highest `tempMax` among the weekend days, tiebreak by lowest `precipProb`; falls back to first sunny/partly day if no weekend is sunny.
- No infinite shimmer / glow animation. Static gradients only.

### 4.5 Stats grid (`.wx-stats`)
- 2×2 CSS grid.
- Cards: Wind (current + direction), Feels-like (apparent_temperature), Humidity (relative_humidity_2m), UV (uv_index_max for today).
- Card anatomy: accent-colored icon pill top-left, small "⋯" top-right (visual parity with mockup but non-interactive), label below, value + unit, one-line description computed client-side (e.g. UV 4 → "Moderate risk. Sunscreen advised.").

### 4.6 Sunrise / Sunset (`.wx-sun`)
- Uses existing `daily[0].sunrise` / `daily[0].sunset`.
- Layout: single compact card. Text-dominant (UX P2 — text is more readable than decorative SVG for this data), with a small, flat, static SVG arc underlay for visual interest.
- Top line: `🌅 05:24`    center: `14h 48m of daylight`    bottom line: `🌇 20:12`.
- Arc: a thin flat path (no gradient, no marker rotation, no sun position marker). Purely decorative.
- CRITICAL: NO `animate-spin` / `animate: * infinite` anywhere in this card.

### 4.7 Header
- Cloud icon in a solid rounded-2xl gradient tile (static gradient, no animation).
- Title: `Weather` with subtitle `📍 Zehlendorf, DE`.
- Right side: `● Live 3m` freshness pill (color = green <10m, amber <60m, red otherwise). Refresh button.

### 4.8 Footer
- Text: `Updated X ago · Open-Meteo`. Single line, muted.

---

## 5. Data Flow & Store Extension

### 5.1 New fetch params (additive to the existing URLSearchParams)

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
    'wind_speed_10m',            // NEW
    'wind_direction_10m',        // NEW
    'relative_humidity_2m',      // NEW
    'apparent_temperature'       // NEW
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
    'uv_index_max'               // NEW
  ].join(',')
});
```

No cost change: Open-Meteo is free, no rate limiting at this call volume (30-min poll).

### 5.2 Parser extensions

```javascript
_parseCurrent(current) {
  // existing: temp, emoji, description, isDay
  return {
    temp: Math.round(current.temperature_2m),
    emoji: info.emoji,
    description: info.desc,
    isDay,
    // NEW:
    wind: Math.round(current.wind_speed_10m),            // km/h
    windDir: current.wind_direction_10m,                 // 0–359°
    humidity: Math.round(current.relative_humidity_2m),  // %
    feelsLike: Math.round(current.apparent_temperature)  // °C
  };
}

_parseDaily(daily) {
  return daily.time.map((t, i) => ({
    // existing fields kept
    date, dayName, dateStr, emoji, description,
    tempMax, tempMin, precipProb, precipSum,
    sunrise, sunset,
    // NEW:
    uvIndex: Math.round(daily.uv_index_max[i] || 0),
    isWeekend: [0, 6].includes(date.getDay())
  }));
}
```

### 5.3 Derived field — `weeklyHighlights` (eager compute, not a getter)

**Architectural P0 — computed once per fetch, stored as a plain property.** The same pattern `alertText` already uses at line 142 of `weather-forecast-store.js`. Alpine getters run on every reactive read; a naive getter here would re-scan `daily[]` 16+ times per render tick.

```javascript
// Inside fetchForecast(), after: this.daily = newDaily
this.weeklyHighlights = this._computeHighlights(newDaily);  // plain property
```

`_computeHighlights(daily)` returns `{ warmest, coldest, wettest, bestWeekend }` where each entry is a direct reference to the `daily[]` object (so the UI reaches `entry.dayName`, `entry.tempMax`, etc). `bestWeekend` is `null` if the 10-day window contains no weekend.

### 5.4 No removed fields
All existing fields the current view reads are preserved. This keeps the alert logic (`_generateAlert`) and stale warning intact.

---

## 6. CSS Strategy (Pi-Safe Translation of the Mockup)

This is the most important section. Every banned pattern from `services/dashboard/CLAUDE.md` has a specific replacement rule.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ MOCKUP PATTERN                  PI-SAFE REPLACEMENT                        │
├───────────────────────────────────────────────────────────────────────────┤
│ bg-white/10 backdrop-blur-xl    background: rgba(255,255,255,0.04);       │
│ (8+ glass panels)               border: 1px solid rgba(255,255,255,0.08); │
│                                 (solid semi-transparent, no filter)       │
│                                                                           │
│ blur-[120px] bg-blue-600/10     body::before { background: radial-        │
│ ambient gradient blobs          gradient(ellipse at top left,             │
│ (fixed inset-0 trio)            rgba(59,130,246,0.06), transparent 60%); }│
│                                 (no blur filter; gradient alone)          │
│                                                                           │
│ animate-pulse on Live dot       One-shot 0.4s fade-in only. The dot       │
│                                 color encodes freshness, not motion.      │
│                                                                           │
│ motion.div animate y: [0,-10,0] DROP. Hero emoji is static.                │
│ infinite bob on cloud icon                                                │
│                                                                           │
│ Sun rotate infinite on          DROP. Sun marker position set once per    │
│ sunrise/sunset card             data refresh, no animation.               │
│                                                                           │
│ shadow-lg shadow-blue-500/20    box-shadow: 0 2px 8px rgba(0,0,0,0.18);   │
│ multi-layer glows               single shadow, ≤10px blur.                │
│                                                                           │
│ framer whileHover { y: -2 }     CSS :hover { transform: translateY(-2px); │
│                                 transition: transform 0.2s ease; }        │
│                                 Wrapped in @media (hover: hover) so it    │
│                                 doesn't run on touch devices.             │
│                                                                           │
│ <motion.path pathLength 0→1     CSS animation: wx-draw 1.2s ease-out      │
│ animated stroke                 forwards; uses stroke-dasharray trick.    │
│                                 ONE-SHOT (forwards), not infinite.        │
│                                                                           │
│ Recharts <AreaChart>            Hand-written SVG with smoothPath() helper │
│ for hourly                      (same function used for 10-day curve).    │
│                                                                           │
│ Lucide icons                    Unicode emoji (already used elsewhere in  │
│                                 the dashboard: 🌡️ 🌦 🌬 💧 ☀️ 🌙 etc) or   │
│                                 hand-drawn inline SVG for the 4 stat     │
│                                 cards. No icon font, no external set.    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Light/dark theme parity
- Dashboard supports `[data-theme="dark"]` overrides. The mockup is dark-only; we add a light variant by mapping:
  - Panel bg: dark `rgba(255,255,255,0.04)` → light `rgba(15,23,42,0.04)`
  - Panel border: dark `rgba(255,255,255,0.08)` → light `rgba(15,23,42,0.08)`
  - Text primary: dark `#f1f5f9` → light `#0f172a`
  - Gradient accents stay the same (orange→amber, sky→cyan, etc.) since they read well on both themes.

### Stroke-draw animation: one-shot gate pattern

The `@keyframes wx-draw` used to stroke-on the two 10-day curves is a one-shot animation. Without a gate, every Alpine re-render of the SVG container will replay the 1.2s draw. To prevent this:

```html
<svg x-ref="curve10d" x-init="$nextTick(() => $refs.curve10d.classList.add('wx-drawn'))">
  <path class="wx-curve-high" ... />
  <path class="wx-curve-low" ... />
</svg>
```

```css
/* Paths start invisible (dasharray set equal to pathLength) */
.wx-curve-high, .wx-curve-low {
  stroke-dasharray: 2000;        /* > any realistic path length */
  stroke-dashoffset: 2000;
}
/* Drawn class is applied ONCE via x-init $nextTick; animation runs once with 'forwards' */
.wx-drawn .wx-curve-high { animation: wx-draw 1.2s ease-out forwards; }
.wx-drawn .wx-curve-low  { animation: wx-draw 1.2s 0.2s ease-out forwards; }
@keyframes wx-draw { to { stroke-dashoffset: 0; } }
```

Path `d` attribute changes (e.g. data refresh) do NOT retrigger the animation since `.wx-drawn` stays applied.

**DOM-persistence dependency note:** this gate relies on the weather view using `x-show` (not `x-if`) at the top-level view container — `x-show` keeps the SVG node in the DOM across tab switches, so `.wx-drawn` persists. The current pattern in `index.html` (`<div x-show="currentView === 'weather'">`) already does this. Do NOT refactor to `x-if` without also moving the `.wx-drawn` gate to survive re-mount.

### Entrance fade: staggered, not wrapper-wide

**Perf P2 — don't wrap all 9 panels in one fade.** A single wrapper opacity transition forces WebKit to composite all semi-transparent panels together for the duration of the fade (9 layers × 18 frames at 60fps). Instead, stagger fades on 2–3 groups:

- Group 1 (fade 0ms): hero, hourly header, 10-day header
- Group 2 (fade 100ms): hourly chart + cards, 10-day SVG
- Group 3 (fade 200ms): sidebar (stats, sun, highlights)

### Lint gate
- Run `scripts/lint-css-performance.sh` before commit. Must report zero violations.
- **Expected lint warnings** (not violations): `@keyframes wx-fade`, `@keyframes wx-draw` will be flagged by the script's `@keyframes` regex. These are one-shot animations with `forwards` fill-mode; warnings are acceptable per the script's exit-code-2 convention.

---

## 7. Testing Plan

### 7.1 Local iteration
- `cd services/dashboard/www && python -m http.server 8888`
- Open `http://localhost:8888/#weather` in Chrome.
- Validate at viewport sizes: 1280×800 (kiosk baseline), 1440×900 (desktop), 375×812 (phone fallback).
- **Pi-render spot check (before full deploy):** copy the built view to the Pi and open it in Epiphany via ssh + nohup to confirm emoji glyphs (hero 🌦 ☀️ ⛅, stat icons) render at the expected width on WebKit/Wayland — Epiphany emoji rendering has differed from Chrome in prior incidents. If a glyph is clipped or substituted with `[?]`, fall back to an inline SVG for that icon.

### 7.2 Data verification
- Curl Open-Meteo directly with the new params to confirm all four new fields return:
  ```
  curl 'https://api.open-meteo.com/v1/forecast?latitude=52.43&longitude=13.26&current=wind_speed_10m,relative_humidity_2m,apparent_temperature&daily=uv_index_max&timezone=Europe/Berlin'
  ```
- Browser console: `Alpine.store('weatherForecast').current` must show wind, humidity, feelsLike as numbers.
- Browser console: `Alpine.store('weatherForecast').weeklyHighlights` must return 4 day objects.

### 7.3 Visual regression
- Take Playwright screenshots of the new view at 3 viewport sizes. Attach to commit message.
- Verify 10-day SVG curve renders at all common data shapes:
  - Monotonic warming week (no local minima on the high curve).
  - Mixed week with sub-zero lows (freezing gridline emphasis).
  - All-weekend highlighted (no weekend case).

### 7.4 Pi performance gate (after deploy)
- `scripts/lint-css-performance.sh` → must be clean.
- Deploy via scp to `/opt/dashboard/www/`.
- After deploy, ssh to Pi:
  ```
  ssh pi@pi 'cat /sys/class/thermal/thermal_zone0/temp && \
             cat /sys/class/thermal/cooling_device0/cur_state && \
             uptime && \
             ps aux | grep -E "epiphany|WebKit" | grep -v grep'
  ```
- Thresholds (per dashboard/CLAUDE.md):
  - Temp: `< 55000` (55°C)
  - Fan state: `0` or `1`
  - Load avg: `< 2.0`
  - WebKit CPU: `< 50%`
- Idle the weather view on the kiosk for 10 minutes and re-check. CPU should stay in the low teens.
- **View-switch repaint storm test:** sequence `Transport → Weather → Lights → Weather` five times in a row while monitoring WebKit CPU via `top -p $(pgrep WebKit)`. Peak CPU during each switch must stay below 80%, and settle back under 20% within 2 seconds. This is the scenario most likely to expose layer-tear-down issues with the new SVG-heavy view.

### 7.5 Network view regression
- Weather is polled only while the tab is active. Switching to another tab must kill the poll (confirmed by `[weather-forecast] Deactivated` in the console).
- Returning must re-fetch fresh data.

---

## 8. Out of Scope (Future Extensions)

- Pressure, visibility: not shown in the 2×2 grid. Easy future additions.
- Weather radar tile: out of scope. Would need a tile provider API.
- Air-quality: would need a new data source (e.g. `air-quality-api.open-meteo.com`). Hooked to the "Air" tab if we ever bring it back.
- Locale switch: kiosk is fixed to Zehlendorf. Multi-location would be a separate feature.

---

## 9. Open Questions

None at design time. All five brainstorming questions answered before drafting:
1. Target framing → full visual adoption, strip banned CSS (Option A)
2. Device baseline → kiosk-first (1280×800 touch)
3. Section cut list → accepted (drop SkyCast, tabs, footer links)
4. Stat grid fields → Wind + Feels-like + Humidity + UV
5. Identity / location / theme → "Weather" · Zehlendorf · light+dark parity

## 10. Acceptance Criteria (Objective)

Each criterion below is a falsifiable check — either an assertion in code, a command, or a measured value.

### Data & store
- [ ] `Alpine.store('weatherForecast').current.wind`, `.feelsLike`, `.humidity` are all finite numbers after initial fetch.
- [ ] `Alpine.store('weatherForecast').daily[0].uvIndex` is a finite number 0–11.
- [ ] `Alpine.store('weatherForecast').weeklyHighlights` returns an object with exactly 4 keys (`warmest`, `coldest`, `wettest`, `bestWeekend`); each value is either `null` (bestWeekend only, if no weekend in window) or a `daily[]` entry.
- [ ] `weeklyHighlights` is a plain property, not a getter (verify via `Object.getOwnPropertyDescriptor(store, 'weeklyHighlights').get === undefined`).

### DOM / structure
- [ ] 10 day-column buttons render inside `.wx-daycols` grid.
- [ ] Hourly strip renders up to 12 cards inside `.wx-hourly-cards` with `scroll-snap-type: x mandatory` applied.
- [ ] 4 stat cards render inside `.wx-stats` with exactly one icon, one label, one value, one description each.
- [ ] Selected-day detail strip text is "Tap any day above for details" when `selectedDayIndex === 0`; switches to detail when any other column is tapped.

### Performance (Pi)
- [ ] `grep -rE "animation:[^;]*infinite" services/dashboard/www/styles/views/weather-forecast.css` returns zero matches.
- [ ] `grep -rE "backdrop-filter|filter:\s*blur" services/dashboard/www/styles/views/weather-forecast.css` returns zero matches.
- [ ] `grep -rE "preserveAspectRatio=\"none\"" services/dashboard/www/` returns zero matches inside the weather view files.
- [ ] `scripts/lint-css-performance.sh` exits with code 0 or 2 (0 = clean; 2 = warnings-only for the expected `@keyframes wx-fade` / `@keyframes wx-draw`).
- [ ] Pi thermal: `cat /sys/class/thermal/thermal_zone0/temp` < 55000 after 10 min idle on the view.
- [ ] Pi fan cooling state ≤ 1 after 10 min idle.
- [ ] WebKit CPU < 50% during idle, < 80% during view-switch sequence (§7.4).

### Visual
- [ ] Playwright screenshots at 1280×800 / 1440×900 / 375×812 committed to `services/dashboard/www/test-results/weather/` (3 files).
- [ ] Light and dark themes both render all 9 panels without invisible text (manual review of both screenshots).
- [ ] No console errors on load; no console errors after 5 view-switch cycles.
