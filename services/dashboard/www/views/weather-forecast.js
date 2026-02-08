/**
 * Weather Forecast View Controller — Mock D Design
 * Side-by-side hero + alert cards, Apple-style hourly strip,
 * ruler-style daily temp bars with global min/max scale
 *
 * Lifecycle:
 *   init() → activate store (starts fetching)
 *   destroy() → deactivate store (stops polling)
 */

export function weatherForecastView() {
  return {
    _initialized: false,

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      if (this._initialized) return;
      this._initialized = true;
      console.log('[weather-forecast-view] Initializing...');
      if (!this.$store.weatherForecast) {
        console.error('[weather-forecast-view] Store not found! Check script loading order.');
        return;
      }
      this.$store.weatherForecast.activate();
    },

    destroy() {
      console.log('[weather-forecast-view] Destroying...');
      this.$store.weatherForecast?.deactivate();
      this._initialized = false;
    },

    // ========================================
    // STORE ACCESS
    // ========================================

    get store() { return this.$store.weatherForecast; },
    get current() { return this.store?.current; },
    get hourly() { return this.store?.hourly || []; },
    get daily() { return this.store?.daily || []; },
    get alertText() { return this.store?.alertText; },
    get isLoading() { return this.store?.loading; },
    get hasError() { return this.store?.error && !this.store?.daily?.length; },
    get isStale() { return this.store?.error && this.store?.daily?.length > 0; },

    // ========================================
    // HERO CARD
    // ========================================

    get heroTemp() {
      return this.current ? String(this.current.temp) : '--';
    },

    get heroDescription() {
      return this.current?.description || 'Loading...';
    },

    get heroEmoji() {
      return this.current?.emoji || '...';
    },

    get heroSub() {
      if (!this.daily.length) return '';
      const today = this.daily[0];
      const hi = Number.isFinite(today.tempMax) ? today.tempMax : '--';
      const lo = Number.isFinite(today.tempMin) ? today.tempMin : '--';
      return `H: ${hi}° \u00B7 L: ${lo}°`;
    },

    // ========================================
    // ALERT CARD
    // Derives type from alertText emoji, then maps to icon/title
    // ========================================

    // Alert type → display properties lookup
    //   type detection: which emoji in alertText triggers this type
    //   icon/title: what to show in the alert card
    _ALERT_MAP: {
      rain:  { match: ['\u{1F327}'],              icon: '\u{1F327}\uFE0F', title: 'Rain Expected' },
      cold:  { match: ['\u2744', '\u{1F328}'],    icon: '\u2744\uFE0F',    title: 'Freezing Temperatures' },
      heat:  { match: ['\u{1F525}'],              icon: '\u{1F525}',       title: 'Heat Alert' },
    },

    get alertInfo() {
      const text = this.alertText || '';
      for (const [type, cfg] of Object.entries(this._ALERT_MAP)) {
        if (cfg.match.some(ch => text.includes(ch))) {
          return { type, icon: cfg.icon, title: cfg.title };
        }
      }
      return {
        type: 'clear',
        icon: this.current?.emoji || '\u2600\uFE0F',
        title: 'Clear Conditions'
      };
    },

    getAlertType() { return this.alertInfo.type; },
    getAlertIcon() { return this.alertInfo.icon; },
    getAlertTitle() { return this.alertInfo.title; },

    getAlertDescription() {
      if (!this.alertText) return '';
      return this.alertText.replace(/^[\u{1F300}-\u{1F9FF}\u2600-\u26FF\u2744\uFE0F\u{1F525}]+\s*/u, '');
    },

    // ========================================
    // HOURLY STRIP
    // Formats hour labels for Apple-style columns
    // ========================================

    formatHour(h, index) {
      if (index === 0) return 'Now';
      const hr = h.hour;
      if (hr === 0) return '12a';
      if (hr === 12) return '12p';
      return hr > 12 ? `${hr - 12}p` : `${hr}a`;
    },

    getPrecipDisplay(precipProb) {
      const prob = Number(precipProb) || 0;
      if (prob < 10) return '';
      return `${prob}%`;
    },

    // ========================================
    // DAILY TEMP BAR (Ruler Style)
    // Global min anchors left, global max anchors right
    // Each day's colored bar positioned within the ruler
    // ========================================

    get globalTempRange() {
      if (!this.daily.length) return { min: 0, max: 20 };
      const mins = this.daily.map(d => d.tempMin).filter(Number.isFinite);
      const maxs = this.daily.map(d => d.tempMax).filter(Number.isFinite);
      if (!mins.length || !maxs.length) return { min: 0, max: 20 };
      return {
        min: Math.min(...mins),
        max: Math.max(...maxs)
      };
    },

    getTempBarStyle(day) {
      if (!Number.isFinite(day.tempMin) || !Number.isFinite(day.tempMax)) return 'display: none';
      const range = this.globalTempRange;
      const totalRange = range.max - range.min || 1;
      const left = Math.max(0, Math.min(100, ((day.tempMin - range.min) / totalRange) * 100));
      const rawWidth = ((day.tempMax - day.tempMin) / totalRange) * 100;
      const width = Math.max(4, Math.min(100 - left, rawWidth));
      const bgPos = Math.round(left);
      return `left: ${left.toFixed(1)}%; width: ${width.toFixed(1)}%; background-position: ${bgPos}% 0`;
    },

    // ── Ruler Scale Ticks ──
    // Every 5° with freezing flag at 0°C
    // Used for both header ticks and vertical gridlines
    getRulerTicks() {
      const range = this.globalTempRange;
      const totalRange = range.max - range.min;
      if (!Number.isFinite(totalRange) || totalRange <= 0) return [];

      const step = 5;
      const startTick = Math.ceil(range.min / step) * step;
      const ticks = [];

      for (let val = startTick; val <= range.max && ticks.length < 20; val += step) {
        const pct = ((val - range.min) / totalRange) * 100;
        ticks.push({
          value: `${val}\u00B0`,
          left: `${pct.toFixed(1)}%`,
          isFreezing: val === 0
        });
      }
      return ticks;
    },

    // ========================================
    // PRECIPITATION
    // ========================================

    getPrecipText(day) {
      if (day.precipProb <= 5) return '';
      if (day.precipProb >= 50) return `${day.precipProb}%\u{1F327}\uFE0F`;
      return `${day.precipProb}%`;
    },

    isPrecipRainy(day) {
      return day.precipProb >= 50;
    },

    // ========================================
    // FOOTER
    // ========================================

    getLastUpdateText() {
      const ts = this.store?.lastUpdate;
      if (!ts) return 'Never';
      const secs = Math.floor((Date.now() - ts) / 1000);
      if (secs < 60) return 'Just now';
      if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
      return `${Math.floor(secs / 3600)}h ago`;
    },

    // ========================================
    // ACTIONS
    // ========================================

    refresh() {
      this.store?.fetchForecast();
    }
  };
}
