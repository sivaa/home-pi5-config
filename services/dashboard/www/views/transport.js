/**
 * Transport Departures View
 * Full-page departure board for S-Bahn and Bus
 * Design: Train station split-flap aesthetic
 *
 * Auto-switch: After 20 minutes, switches to heater view automatically
 * to prevent indefinite transport polling and reduce Pi CPU usage.
 */

export function transportView() {
  return {
    // ========================================
    // STATE
    // ========================================

    countdownSeconds: 60,
    _countdownInterval: null,
    _viewTimeout: null,

    // View timeout: auto-switch to heater after 20 minutes
    VIEW_TIMEOUT_MS: 20 * 60 * 1000,  // 20 minutes

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      console.log('[transport-view] Initializing...');

      // Start countdown to next refresh
      this.resetCountdown();
      this._countdownInterval = setInterval(() => {
        this.countdownSeconds--;
        if (this.countdownSeconds <= 0) {
          this.refresh();
          this.resetCountdown();
        }
      }, 1000);

      // Auto-switch to heater view after 20 minutes
      // This prevents indefinite transport polling and reduces CPU usage
      this._viewTimeout = setTimeout(() => {
        console.log('[transport-view] 20-min timeout - auto-switching to heater view');
        this.switchToHeater();
      }, this.VIEW_TIMEOUT_MS);

      // Initial data fetch if store exists
      this.refresh();
    },

    destroy() {
      console.log('[transport-view] Destroying...');
      if (this._countdownInterval) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
      }
      if (this._viewTimeout) {
        clearTimeout(this._viewTimeout);
        this._viewTimeout = null;
      }
    },

    // ========================================
    // AUTO-SWITCH
    // ========================================

    switchToHeater() {
      // Clean up this view first
      this.destroy();
      // Dispatch event to switch views
      window.dispatchEvent(new CustomEvent('force-view-change', {
        detail: { view: 'heater' }
      }));
    },

    // ========================================
    // COUNTDOWN
    // ========================================

    resetCountdown() {
      this.countdownSeconds = 60;
    },

    // ========================================
    // DATA ACCESS (from transport store)
    // ========================================

    get store() {
      return Alpine.store('transport');
    },

    get sbahnDepartures() {
      return this.store?.departures?.sbahn || [];
    },

    get busDepartures() {
      return this.store?.departures?.bus || [];
    },

    get isLoading() {
      return this.store?.loading || false;
    },

    get isError() {
      return this.store?.error || false;
    },

    get lastUpdated() {
      return this.store?.lastUpdated || '--:--';
    },

    // ========================================
    // STYLING HELPERS
    // ========================================

    getRowClass(minutes) {
      return this.store?.getStatusClass?.(minutes) || '';
    },

    getBusLineClass(line) {
      // X lines (express) = red, M lines (metro) = cyan, regular = purple
      if (line && line.startsWith('X')) return 'bus bus-express';
      if (line && line.startsWith('M')) return 'bus bus-metro';
      return 'bus';
    },

    formatDelay(delay) {
      if (!delay || delay === 0) return '';
      return `+${delay}`;
    },

    // ========================================
    // ACTIONS
    // ========================================

    refresh() {
      this.store?.fetchDepartures?.();
    }
  };
}
