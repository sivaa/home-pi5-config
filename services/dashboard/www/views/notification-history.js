/**
 * Notification History View
 * Displays unified timeline of mobile notifications and TTS announcements
 */

export function notificationHistoryView() {
  return {
    // Local UI state
    showFilters: false,

    // ═══════════════════════════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    init() {
      // Activate store (sets up MQTT listeners, loads historical data)
      this.$store.notificationHistory.activate();
    },

    destroy() {
      // Deactivate store (cleans up MQTT listeners)
      this.$store.notificationHistory.deactivate();
    },

    // ═══════════════════════════════════════════════════════════════════════
    // DATA ACCESSORS (delegate to store)
    // ═══════════════════════════════════════════════════════════════════════

    get notifications() {
      return this.$store.notificationHistory.filteredNotifications;
    },

    get stats() {
      return this.$store.notificationHistory.stats;
    },

    get loading() {
      return this.$store.notificationHistory.loading;
    },

    get error() {
      return this.$store.notificationHistory.error;
    },

    get availableChannels() {
      return this.$store.notificationHistory.availableChannels;
    },

    get filters() {
      return this.$store.notificationHistory.filters;
    },

    get channels() {
      return this.$store.notificationHistory.channels;
    },

    get types() {
      return this.$store.notificationHistory.types;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FILTER ACTIONS (delegate to store)
    // ═══════════════════════════════════════════════════════════════════════

    toggleType(type) {
      this.$store.notificationHistory.toggleType(type);
    },

    toggleChannel(channel) {
      this.$store.notificationHistory.toggleChannel(channel);
    },

    setDateRange(range) {
      this.$store.notificationHistory.setDateRange(range);
    },

    setSearch(term) {
      this.$store.notificationHistory.setSearch(term);
    },

    clearFilters() {
      this.$store.notificationHistory.clearFilters();
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FILTER STATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    isTypeActive(type) {
      // Empty array = all types shown (none explicitly selected)
      // If types array has items, check if this type is in it
      return this.filters.types.length === 0 || this.filters.types.includes(type);
    },

    isTypeSelected(type) {
      return this.filters.types.includes(type);
    },

    isChannelSelected(channel) {
      return this.filters.channels.includes(channel);
    },

    isDateRangeActive(range) {
      return this.filters.dateRange === range;
    },

    hasActiveFilters() {
      return this.filters.types.length > 0 ||
             this.filters.channels.length > 0 ||
             this.filters.importance.length > 0 ||
             this.filters.dateRange !== 'today' ||
             this.filters.search.trim() !== '';
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FORMATTING (delegate to store)
    // ═══════════════════════════════════════════════════════════════════════

    formatRelativeTime(timestamp) {
      return this.$store.notificationHistory.formatRelativeTime(timestamp);
    },

    formatTime(timestamp) {
      return this.$store.notificationHistory.formatTime(timestamp);
    },

    getChannelInfo(channel) {
      return this.$store.notificationHistory.getChannelInfo(channel);
    },

    getTypeInfo(type) {
      return this.$store.notificationHistory.getTypeInfo(type);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // NOTIFICATION DISPLAY HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get CSS class for importance level
     */
    getImportanceClass(importance) {
      const classes = {
        'max': 'importance-max',
        'high': 'importance-high',
        'default': 'importance-default',
        'low': 'importance-low'
      };
      return classes[importance] || 'importance-default';
    },

    /**
     * Get icon for notification type
     */
    getTypeIcon(type) {
      return type === 'tts' ? '🔊' : '📱';
    },

    /**
     * Get TTS status text
     */
    getTtsStatus(notification) {
      if (notification.type !== 'tts') return '';
      if (!notification.success) return 'Failed';
      if (!notification.allAvailable) return 'Partial';
      return 'OK';
    },

    /**
     * Get TTS status class
     */
    getTtsStatusClass(notification) {
      if (notification.type !== 'tts') return '';
      if (!notification.success) return 'tts-failed';
      if (!notification.allAvailable) return 'tts-partial';
      return 'tts-success';
    },

    /**
     * Truncate message for display
     */
    truncateMessage(message, maxLength = 100) {
      if (!message || message.length <= maxLength) return message;
      return message.substring(0, maxLength) + '...';
    },

    /**
     * Format automation name for display
     */
    formatAutomation(automation) {
      if (!automation || automation === 'unknown' || automation === 'manual') {
        return 'Manual';
      }
      // Convert snake_case to Title Case
      return automation
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    refresh() {
      this.$store.notificationHistory.loadHistorical();
    },

    toggleFilters() {
      this.showFilters = !this.showFilters;
    }
  };
}
