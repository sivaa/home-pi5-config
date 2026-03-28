/**
 * Transport Departures View
 * Full-page departure board for S-Bahn and Bus
 * Design: Train station split-flap aesthetic
 *
 * Manual refresh only - no auto-polling to avoid IP blocks from
 * BVG's Link11 DDoS protection. User taps refresh button.
 *
 * Auto-switch: After 20 minutes, switches to heater view automatically.
 */

export function transportView() {
  return {
    // ========================================
    // STATE
    // ========================================

    _viewTimeout: null,
    _initialized: false,  // Guard against x-init re-running on x-show toggle

    // View timeout: auto-switch to heater after 20 minutes
    VIEW_TIMEOUT_MS: 20 * 60 * 1000,  // 20 minutes

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      // Skip if already active (e.g. duplicate event)
      if (this._initialized) return;
      this._initialized = true;

      console.log('[transport-view] Initializing...');

      // Auto-switch to heater view after 20 minutes
      this._viewTimeout = setTimeout(() => {
        console.log('[transport-view] 20-min timeout - auto-switching to heater view');
        this.switchToHeater();
      }, this.VIEW_TIMEOUT_MS);

      // Fetch fresh data on every view open
      this.refresh();
    },

    destroy() {
      console.log('[transport-view] Destroying...');
      if (this._viewTimeout) {
        clearTimeout(this._viewTimeout);
        this._viewTimeout = null;
      }
      this._initialized = false;  // Reset for next mount after destroy
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

    get stats() {
      return this.store?.stats || null;
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
