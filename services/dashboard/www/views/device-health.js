/**
 * Device Health View
 * Displays health status of all Zigbee devices with filtering and sorting
 */

export function deviceHealthView() {
  return {
    // Local UI state
    searchQuery: '',
    searchDebounce: null,
    showFilters: true,

    // ==========================================
    // LIFECYCLE
    // ==========================================

    init() {
      // Initialize store if needed
      this.$store.deviceHealth?.init?.();
      // Activate view (starts ticker)
      this.$store.deviceHealth.activateView();

      // Return cleanup function - Alpine calls this when x-if removes the element
      return () => {
        // Critical: Stop updates when leaving view
        this.$store.deviceHealth.deactivateView();

        // Clear search debounce
        if (this.searchDebounce) {
          clearTimeout(this.searchDebounce);
          this.searchDebounce = null;
        }

        console.log('[device-health-view] Destroyed via cleanup');
      };
    },

    // ==========================================
    // COMPUTED PROPERTIES
    // ==========================================

    get devices() {
      return this.$store.deviceHealth.filteredDevices;
    },

    get stats() {
      return this.$store.deviceHealth.stats;
    },

    get countsByType() {
      return this.$store.deviceHealth.countsByType;
    },

    get isLoading() {
      return this.$store.deviceHealth.loading;
    },

    get sortBy() {
      return this.$store.deviceHealth.sortBy;
    },

    get sortAsc() {
      return this.$store.deviceHealth.sortAsc;
    },

    get filters() {
      return this.$store.deviceHealth.filters;
    },

    get deviceTypes() {
      return this.$store.deviceHealth.getDeviceTypes();
    },

    // ==========================================
    // ACTIONS
    // ==========================================

    toggleType(type) {
      this.$store.deviceHealth.toggleTypeFilter(type);
    },

    toggleStatus(status) {
      this.$store.deviceHealth.toggleStatusFilter(status);
    },

    setSortBy(field) {
      this.$store.deviceHealth.setSortBy(field);
    },

    clearFilters() {
      this.$store.deviceHealth.clearFilters();
      this.searchQuery = '';
    },

    onSearchInput() {
      clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => {
        this.$store.deviceHealth.setSearch(this.searchQuery);
      }, 300);
    },

    toggleFilters() {
      this.showFilters = !this.showFilters;
    },

    // ==========================================
    // DISPLAY HELPERS
    // ==========================================

    getHealthClass(device) {
      const health = this.$store.deviceHealth.healthData[device.ieee_address];
      return `health-${health?.healthStatus || 'unknown'}`;
    },

    getHealthStatus(device) {
      const health = this.$store.deviceHealth.healthData[device.ieee_address];
      return health?.healthStatus || 'unknown';
    },

    getLastSeen(device) {
      const health = this.$store.deviceHealth.healthData[device.ieee_address];
      return health?.lastSeenRelative || 'Never';
    },

    getBattery(device) {
      const health = this.$store.deviceHealth.healthData[device.ieee_address];
      return health?.battery;
    },

    getLinkQuality(device) {
      const health = this.$store.deviceHealth.healthData[device.ieee_address];
      return health?.linkquality;
    },

    getLastValue(device) {
      return this.$store.deviceHealth.formatLastValue(device);
    },

    getBatteryIcon(level) {
      return this.$store.deviceHealth.getBatteryIcon(level);
    },

    isTypeActive(type) {
      return this.$store.deviceHealth.isTypeActive(type);
    },

    isStatusActive(status) {
      return this.$store.deviceHealth.isStatusActive(status);
    },

    getStatusLabel(status) {
      const labels = {
        ok: 'OK',
        warning: 'Warn',
        critical: 'Crit',
        dead: 'Dead',
        unknown: '?'
      };
      return labels[status] || status;
    },

    isSortedBy(field) {
      return this.sortBy === field;
    },

    getSortIcon(field) {
      if (this.sortBy !== field) return '';
      return this.sortAsc ? '▲' : '▼';
    },

    // Battery display helpers
    hasBattery(device) {
      const battery = this.getBattery(device);
      return battery !== null && battery !== undefined;
    },

    isBatteryLow(device) {
      const battery = this.getBattery(device);
      return battery !== null && battery < 20;
    },

    // Signal display helpers
    hasSignal(device) {
      // Coordinator doesn't report signal
      if (device.type === 'coordinator') return false;
      const lq = this.getLinkQuality(device);
      return lq !== null && lq !== undefined;
    },

    isSignalWeak(device) {
      const lq = this.getLinkQuality(device);
      return lq !== null && lq < 50;
    },

    // New helpers for single-line layout
    getAbsoluteTime(device) {
      return this.$store.deviceHealth.formatAbsoluteTime(device);
    },

    getSignalLevel(device) {
      return this.$store.deviceHealth.getSignalLevel(device);
    },

    /**
     * Get last meaningful data time (not just heartbeat)
     */
    getLastDataTime(device) {
      return this.$store.deviceHealth.formatLastDataTime(device);
    }
  };
}
