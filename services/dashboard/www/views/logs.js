/**
 * Activity Logs View
 * Comprehensive log viewer for all MQTT messages
 */

export function logsView() {
  return {
    // Local UI state
    showFilters: true,
    showStats: true,
    searchQuery: '',
    searchDebounce: null,

    // Pagination
    visibleCount: 100,
    loadMoreStep: 100,

    // ============================================
    // LIFECYCLE
    // ============================================
    init() {
      // Initialize logs store if needed
      this.$store.logs?.init?.();
    },

    // ============================================
    // COMPUTED PROPERTIES
    // ============================================
    get logs() {
      return this.$store.logs.filteredLogs.slice(0, this.visibleCount);
    },

    get totalLogs() {
      return this.$store.logs.filteredLogs.length;
    },

    get hasMore() {
      return this.visibleCount < this.totalLogs;
    },

    get stats() {
      return this.$store.logs.stats;
    },

    get categories() {
      return this.$store.logs.categories;
    },

    get availableDevices() {
      return this.$store.logs.availableDevices;
    },

    get isPaused() {
      return this.$store.logs.paused;
    },

    get isLoading() {
      return this.$store.logs.loading;
    },

    get filters() {
      return this.$store.logs.filters;
    },

    get timeRange() {
      return this.$store.logs.filters.timeRange;
    },

    // ============================================
    // ACTIONS
    // ============================================
    loadMore() {
      this.visibleCount += this.loadMoreStep;
    },

    togglePause() {
      this.$store.logs.togglePause();
    },

    clearLogs() {
      if (confirm('Clear all logs? This cannot be undone.')) {
        this.$store.logs.clearLogs();
      }
    },

    setTimeRange(range) {
      this.$store.logs.setTimeRange(range);
    },

    toggleCategory(category) {
      this.$store.logs.toggleCategory(category);
    },

    toggleSeverity(severity) {
      this.$store.logs.toggleSeverity(severity);
    },

    toggleAnomaliesOnly() {
      this.$store.logs.filters.anomaliesOnly = !this.$store.logs.filters.anomaliesOnly;
    },

    setDevice(device) {
      if (device) {
        this.$store.logs.filters.devices = [device];
      } else {
        this.$store.logs.filters.devices = [];
      }
    },

    clearFilters() {
      this.$store.logs.clearFilters();
      this.searchQuery = '';
    },

    onSearchInput() {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.$store.logs.setSearch(this.searchQuery);
      }, 300);
    },

    expandLog(id) {
      this.$store.logs.expandLog(id);
    },

    isExpanded(id) {
      return this.$store.logs.expandedLogId === id;
    },

    copyPayload(log) {
      const text = JSON.stringify(log.payload, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        // Could show a toast here
        console.log('Copied payload to clipboard');
      });
    },

    // ============================================
    // DISPLAY HELPERS
    // ============================================
    getCategoryInfo(category) {
      return this.categories[category] || { icon: '📋', label: category, color: '#6b7280' };
    },

    formatTime(timestamp) {
      return this.$store.logs.formatTime(timestamp);
    },

    formatRelativeTime(timestamp) {
      return this.$store.logs.formatRelativeTime(timestamp);
    },

    formatValues(values) {
      return this.$store.logs.formatValues(values);
    },

    getSeverityColor(severity) {
      return this.$store.logs.getSeverityColor(severity);
    },

    getSeverityBadge(severity) {
      const badges = {
        error: { icon: '🔴', label: 'Error' },
        warning: { icon: '🟠', label: 'Warning' },
        info: { icon: '🔵', label: 'Info' },
        success: { icon: '🟢', label: 'Success' }
      };
      return badges[severity] || badges.info;
    },

    formatPayload(payload) {
      if (!payload) return 'No payload';
      return JSON.stringify(payload, null, 2);
    },

    isCategoryActive(category) {
      return this.filters.categories.length === 0 || this.filters.categories.includes(category);
    },

    isSeverityActive(severity) {
      return this.filters.severities.length === 0 || this.filters.severities.includes(severity);
    },

    // Quick filter presets
    applyPreset(preset) {
      this.clearFilters();
      switch (preset) {
        case 'errors':
          this.$store.logs.filters.severities = ['error'];
          break;
        case 'warnings':
          this.$store.logs.filters.severities = ['error', 'warning'];
          break;
        case 'doors':
          this.$store.logs.filters.categories = ['contact'];
          break;
        case 'heating':
          this.$store.logs.filters.categories = ['thermostat'];
          break;
        case 'lights':
          this.$store.logs.filters.categories = ['light', 'plug'];
          break;
        case 'anomalies':
          this.$store.logs.filters.anomaliesOnly = true;
          break;
      }
    },

    // Statistics helpers
    getCategoryPercentage(category) {
      const total = this.stats.total || 1;
      const count = this.stats.byCategory[category] || 0;
      return Math.round((count / total) * 100);
    },

    getHourlySparkline() {
      const buckets = this.stats.hourlyBuckets || [];
      const max = Math.max(...buckets, 1);
      return buckets.map(v => Math.round((v / max) * 100));
    }
  };
}
