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
