/**
 * Transport Departures View
 * Full-page departure board for S-Bahn and Bus
 * Design: Train station split-flap aesthetic
 */

export function transportView() {
  return {
    // ========================================
    // STATE
    // ========================================

    countdownSeconds: 60,
    _countdownInterval: null,

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

      // Initial data fetch if store exists
      this.refresh();
    },

    destroy() {
      console.log('[transport-view] Destroying...');
      if (this._countdownInterval) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
      }
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

    get errorDetails() {
      return this.store?.errorDetails || null;
    },

    get loadingMessage() {
      const elapsed = this.store?.getElapsedSeconds?.() || 0;
      if (elapsed < 3) return 'Connecting to scraper...';
      if (elapsed < 10) return 'Browser starting...';
      if (elapsed < 20) return 'Scraping BVG + DB...';
      return `Still loading... (${elapsed}s)`;
    },

    // ========================================
    // STYLING HELPERS
    // ========================================

    getRowClass(minutes) {
      return this.store?.getStatusClass?.(minutes) || '';
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
