/**
 * TTS Log View
 * Automation overview cards + live TTS event log
 */

export function ttsLogView() {
  return {
    // Local UI state
    pauseMenuOpen: null,  // automation ID whose pause menu is showing

    // =====================================================================
    // LIFECYCLE
    // =====================================================================

    init() {
      this.$store.ttsLog.activate();
    },

    destroy() {
      this.$store.ttsLog.deactivate();
    },

    // =====================================================================
    // DATA ACCESSORS (delegate to store)
    // =====================================================================

    get automationsByCategory() {
      return this.$store.ttsLog.getAutomationsByCategory();
    },

    get events() {
      return this.collapseRepeats(this.$store.ttsLog.events);
    },

    // Collapse consecutive identical messages into one row with a count
    collapseRepeats(events) {
      if (!events.length) return events;
      const collapsed = [];
      for (const e of events) {
        const prev = collapsed[collapsed.length - 1];
        if (prev && prev.message === e.message && prev.automation === e.automation) {
          prev._repeatCount = (prev._repeatCount || 1) + 1;
          prev._lastTimestamp = e.timestamp;
        } else {
          collapsed.push({ ...e, _repeatCount: 1, _lastTimestamp: null });
        }
      }
      return collapsed;
    },

    get eventsLoading() {
      return this.$store.ttsLog.eventsLoading;
    },

    get eventsError() {
      return this.$store.ttsLog.eventsError;
    },

    get summary() {
      return this.$store.ttsLog.getSummary();
    },

    get automationsLoading() {
      return this.$store.ttsLog.automationsLoading;
    },

    get automationsError() {
      return this.$store.ttsLog.automationsError;
    },

    // =====================================================================
    // AUTOMATION HELPERS
    // =====================================================================

    getState(id) {
      return this.$store.ttsLog.getAutomationState(id);
    },

    isEnabled(id) {
      return this.getState(id).state === 'on';
    },

    getLastTriggered(id) {
      const state = this.getState(id);
      return this.$store.ttsLog.formatRelativeTime(state.lastTriggered);
    },

    getStatusClass(id) {
      const state = this.getState(id);
      if (state.state === null) return 'status-unknown';
      return state.state === 'on' ? 'status-enabled' : 'status-disabled';
    },

    // =====================================================================
    // EVENT HELPERS
    // =====================================================================

    formatTime(timestamp) {
      return this.$store.ttsLog.formatTime(timestamp);
    },

    formatRelativeTime(timestamp) {
      return this.$store.ttsLog.formatRelativeTime(timestamp);
    },

    formatAutomation(automation) {
      return this.$store.ttsLog.formatAutomation(automation);
    },

    getEventStatusClass(event) {
      if (!event.success) return 'event-failed';
      if (!event.allAvailable) return 'event-partial';
      return 'event-success';
    },

    getEventStatusText(event) {
      if (!event.success) return 'Failed';
      if (!event.allAvailable) return 'Partial';
      return 'OK';
    },

    getDeviceStatusIcon(device) {
      if (device.success === false) return '✕';
      return '✓';
    },

    // =====================================================================
    // PAUSE HELPERS
    // =====================================================================

    isPaused(id) {
      return this.$store.ttsLog.isPaused(id);
    },

    getPauseRemaining(id) {
      return this.$store.ttsLog.getPauseRemaining(id);
    },

    togglePauseMenu(id) {
      this.pauseMenuOpen = this.pauseMenuOpen === id ? null : id;
    },

    closePauseMenu() {
      this.pauseMenuOpen = null;
    },

    async pauseAutomation(id, minutes) {
      this.pauseMenuOpen = null;
      await this.$store.ttsLog.pauseAutomation(id, minutes);
    },

    async cancelPause(id) {
      await this.$store.ttsLog.resumeAutomation(id);
    },

    // =====================================================================
    // ACTIONS
    // =====================================================================

    refresh() {
      this.$store.ttsLog.fetchAutomationStates();
      this.$store.ttsLog.loadHistorical();
    }
  };
}
