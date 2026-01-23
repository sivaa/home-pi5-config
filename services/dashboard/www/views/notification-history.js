/**
 * Notification History View
 * Displays unified timeline of mobile notifications and TTS announcements
 */

export function notificationHistoryView() {
  return {
    // Local UI state
    showFilters: false,     // Collapsed by default - list is the hero
    sortBy: 'newest',       // newest, oldest, failures
    showDateDropdown: false, // Date range dropdown state

    // Quick filters (1-click toggles in toolbar)
    failuresOnly: false,  // Show only failed TTS notifications
    highOnly: false,      // Show only high/max importance

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
      let result = this.$store.notificationHistory.filteredNotifications;

      // Apply quick filters (before sorting)
      if (this.failuresOnly) {
        result = result.filter(n => n.type === 'tts' && !n.success);
      }
      if (this.highOnly) {
        result = result.filter(n => n.importance === 'high' || n.importance === 'max');
      }

      // Apply local sorting
      if (this.sortBy === 'oldest') {
        return [...result].sort((a, b) => a.timestamp - b.timestamp);
      } else if (this.sortBy === 'failures') {
        // Failures first, then by time
        return [...result].sort((a, b) => {
          const aFailed = a.type === 'tts' && !a.success ? 1 : 0;
          const bFailed = b.type === 'tts' && !b.success ? 1 : 0;
          if (aFailed !== bFailed) return bFailed - aFailed;
          return b.timestamp - a.timestamp;
        });
      }
      // Default: newest first (already sorted by store)
      return result;
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
      // Also clear quick filters
      this.failuresOnly = false;
      this.highOnly = false;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // QUICK FILTER ACTIONS (local, 1-click toolbar toggles)
    // ═══════════════════════════════════════════════════════════════════════

    toggleFailuresOnly() {
      this.failuresOnly = !this.failuresOnly;
    },

    toggleHighOnly() {
      this.highOnly = !this.highOnly;
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
             this.filters.search.trim() !== '' ||
             this.failuresOnly ||
             this.highOnly;
    },

    /**
     * Count active filters (for "Filter (N)" display)
     */
    getActiveFilterCount() {
      let count = 0;
      if (this.filters.types.length > 0) count += this.filters.types.length;
      if (this.filters.channels.length > 0) count += this.filters.channels.length;
      if (this.filters.importance.length > 0) count += this.filters.importance.length;
      if (this.filters.dateRange !== 'today') count++;
      if (this.filters.search.trim() !== '') count++;
      // Quick filters don't count toward panel filter count (they're visible in toolbar)
      return count;
    },

    /**
     * Get total notification count before quick filters
     * (for "Showing X of Y" display)
     */
    get totalBeforeQuickFilters() {
      return this.$store.notificationHistory.filteredNotifications.length;
    },

    /**
     * Get date range label for toolbar display
     */
    getDateRangeLabel() {
      const rangeLabels = { today: 'Today', yesterday: 'Yesterday', week: 'This week', all: 'All time' };
      return rangeLabels[this.filters.dateRange] || 'Today';
    },

    /**
     * Get notification count label (ChatGPT Round 2: "N notifications" format)
     * Shows filtered count if quick filters active
     */
    getNotificationCountLabel() {
      const shown = this.notifications.length;
      const total = this.totalBeforeQuickFilters;

      if (shown === total) {
        return `${shown} notification${shown !== 1 ? 's' : ''}`;
      }
      // When quick filters reduce count, show "X of Y"
      return `${shown} of ${total}`;
    },

    /**
     * Get explicit state description (ChatGPT feedback: be explicit, not ambiguous)
     * Returns: "Showing 96 notifications" or "Showing 24 of 96"
     * @deprecated Use getNotificationCountLabel() instead (Round 2 format)
     */
    getCountDescription() {
      const shown = this.notifications.length;
      const total = this.totalBeforeQuickFilters;

      if (shown === total) {
        return `Showing ${shown}`;
      }
      return `Showing ${shown} of ${total}`;
    },

    /**
     * Get sort label for display
     */
    getSortLabel() {
      const labels = { newest: 'Newest', oldest: 'Oldest', failures: 'Failures first' };
      return labels[this.sortBy] || 'Newest';
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
     * Hides ULID-style IDs (e.g., 01KFJ50SVE5GRY5ACHPX298ERE)
     */
    formatAutomation(automation) {
      if (!automation || automation === 'unknown' || automation === 'manual') {
        return null; // Return null to hide the element entirely
      }
      // Hide ULID-style automation IDs (26 chars, starts with 01, alphanumeric)
      if (/^[0-9][0-9A-Z]{20,}$/i.test(automation)) {
        return null;
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
    },

    setSortBy(sort) {
      this.sortBy = sort;
    }
  };
}
