/**
 * Notification History Store
 * Manages unified timeline of mobile notifications and TTS announcements
 *
 * Data sources:
 * - MQTT: dashboard/notify (real-time mobile notifications)
 * - MQTT: dashboard/tts (real-time TTS events)
 * - InfluxDB: notifications measurement (historical mobile)
 * - InfluxDB: tts_events measurement (historical TTS)
 */

export function initNotificationHistoryStore(Alpine, CONFIG) {
  Alpine.store('notificationHistory', {
    // Data
    list: [],          // All notifications (newest first)
    loading: false,
    error: null,

    // View lifecycle state
    viewActive: false,
    _mqttSetup: false,
    _unsubscribeFns: [],
    _mqttRetryTimer: null,

    // Constants
    MAX_NOTIFICATIONS: 500,

    // Channel/Type configuration
    channels: {
      Critical: { icon: '🚨', color: '#ef4444', label: 'Critical' },
      Alerts: { icon: '⚠️', color: '#f59e0b', label: 'Alerts' },
      Warning: { icon: '⚡', color: '#f97316', label: 'Warning' },
      Heater: { icon: '🔥', color: '#ef4444', label: 'Heater' },
      Info: { icon: 'ℹ️', color: '#3b82f6', label: 'Info' },
      TTS: { icon: '🔊', color: '#8b5cf6', label: 'TTS' },
      Default: { icon: '📋', color: '#6b7280', label: 'Default' }
    },

    types: {
      mobile: { icon: '📱', label: 'Mobile' },
      tts: { icon: '🔊', label: 'TTS' }
    },

    // Filters
    filters: {
      types: [],          // ['mobile', 'tts'] - empty = all
      channels: [],       // ['Critical', 'Alerts'] - empty = all
      importance: [],     // ['max', 'high', 'default', 'low'] - empty = all
      dateRange: 'today', // 'today' | 'yesterday' | 'week' | 'all'
      search: ''          // Free text search
    },

    // ═══════════════════════════════════════════════════════════════════════
    // LIFECYCLE METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Activate the store when view becomes visible
     */
    activate() {
      this.viewActive = true;
      this.setupMqttListeners();
      this.loadHistorical();
    },

    /**
     * Deactivate the store when view is hidden
     */
    deactivate() {
      this.viewActive = false;
      this.cleanupMqttListeners();
    },

    /**
     * Set up MQTT handlers for real-time updates
     */
    setupMqttListeners() {
      if (this._mqttSetup) return;

      const mqtt = Alpine.store('mqtt');
      if (!mqtt?.client) {
        // Retry after MQTT connects (store timer ID to allow cleanup)
        this._mqttRetryTimer = setTimeout(() => this.setupMqttListeners(), 2000);
        return;
      }

      this._mqttSetup = true;

      // Subscribe to mobile notifications
      const unsubNotify = mqtt.registerTopicHandler('dashboard/notify', (topic, payload) => {
        this.handleMobileNotification(payload);
      });
      this._unsubscribeFns.push(unsubNotify);

      // Subscribe to TTS events
      const unsubTts = mqtt.registerTopicHandler('dashboard/tts', (topic, payload) => {
        this.handleTtsEvent(payload);
      });
      this._unsubscribeFns.push(unsubTts);

      console.log('[notificationHistory] MQTT listeners active');
    },

    /**
     * Clean up MQTT handlers
     */
    cleanupMqttListeners() {
      // Clear any pending retry timer
      if (this._mqttRetryTimer) {
        clearTimeout(this._mqttRetryTimer);
        this._mqttRetryTimer = null;
      }
      this._unsubscribeFns.forEach(fn => fn());
      this._unsubscribeFns = [];
      this._mqttSetup = false;
      console.log('[notificationHistory] MQTT listeners cleaned up');
    },

    // ═══════════════════════════════════════════════════════════════════════
    // MQTT HANDLERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Handle incoming mobile notification from MQTT
     */
    handleMobileNotification(payload) {
      const notification = {
        id: `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
        type: 'mobile',
        title: payload.title || 'Notification',
        message: payload.message || '',
        channel: payload.channel || 'Default',
        importance: payload.importance || 'default',
        tag: payload.tag || '',
        automation: payload.automation || 'manual'
      };

      this.addNotification(notification);
    },

    /**
     * Handle incoming TTS event from MQTT
     */
    handleTtsEvent(payload) {
      const notification = {
        id: `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
        type: 'tts',
        title: 'TTS Announcement',
        message: payload.message || '',
        channel: 'TTS',
        importance: 'default',
        automation: payload.automation || 'unknown',
        // TTS-specific fields
        success: payload.success === true,
        allAvailable: payload.all_available === true,
        devices: payload.devices || []
      };

      this.addNotification(notification);
    },

    /**
     * Add a notification to the list (maintains sort order and max size)
     */
    addNotification(notification) {
      // Insert at correct position (sorted by timestamp descending)
      const insertIdx = this.list.findIndex(n => n.timestamp < notification.timestamp);
      if (insertIdx === -1) {
        this.list.push(notification);
      } else {
        this.list.splice(insertIdx, 0, notification);
      }

      // Trim to max size
      if (this.list.length > this.MAX_NOTIFICATIONS) {
        this.list = this.list.slice(0, this.MAX_NOTIFICATIONS);
      }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Load historical notifications from InfluxDB
     */
    async loadHistorical(hours = 168) { // Default: 7 days
      this.loading = true;
      this.error = null;

      try {
        // Load both mobile notifications and TTS events in parallel
        const [mobileResults, ttsResults] = await Promise.all([
          this.queryInflux('notifications', hours),
          this.queryInflux('tts_events', hours)
        ]);

        // Parse mobile notifications
        const mobileNotifications = this.parseMobileResults(mobileResults);

        // Parse TTS events
        const ttsNotifications = this.parseTtsResults(ttsResults);

        // Merge and sort (newest first)
        const allNotifications = [...mobileNotifications, ...ttsNotifications];
        allNotifications.sort((a, b) => b.timestamp - a.timestamp);

        // Replace list (historical load replaces real-time data)
        this.list = allNotifications.slice(0, this.MAX_NOTIFICATIONS);

        console.log(`[notificationHistory] Loaded ${this.list.length} notifications ` +
                    `(${mobileNotifications.length} mobile, ${ttsNotifications.length} TTS)`);
      } catch (err) {
        console.error('[notificationHistory] Load error:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    /**
     * Query InfluxDB for a measurement
     */
    async queryInflux(measurement, hours) {
      const query = `SELECT * FROM "${measurement}" WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT 500`;
      const response = await fetch(
        `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`InfluxDB query failed: ${response.status}`);
      }

      const data = await response.json();
      return data.results?.[0]?.series?.[0] || null;
    },

    /**
     * Parse mobile notification results from InfluxDB
     */
    parseMobileResults(series) {
      if (!series?.values) return [];

      const columns = series.columns;
      const timeIdx = columns.indexOf('time');
      const titleIdx = columns.indexOf('title');
      const messageIdx = columns.indexOf('message');
      const typeIdx = columns.indexOf('type');
      const channelIdx = columns.indexOf('channel');
      const importanceIdx = columns.indexOf('importance');
      const automationIdx = columns.indexOf('automation');
      const tagIdx = columns.indexOf('tag');

      return series.values.map((row, idx) => ({
        id: `mobile-hist-${idx}-${new Date(row[timeIdx]).getTime()}`,
        timestamp: new Date(row[timeIdx]).getTime(),
        type: row[typeIdx] || 'mobile',
        title: row[titleIdx] || 'Notification',
        message: row[messageIdx] || '',
        channel: row[channelIdx] || 'Default',
        importance: row[importanceIdx] || 'default',
        automation: row[automationIdx] || 'unknown',
        tag: row[tagIdx] || ''
      }));
    },

    /**
     * Parse TTS event results from InfluxDB
     */
    parseTtsResults(series) {
      if (!series?.values) return [];

      const columns = series.columns;
      const timeIdx = columns.indexOf('time');
      const messageIdx = columns.indexOf('message');
      const successIdx = columns.indexOf('success');
      const allAvailableIdx = columns.indexOf('all_available');
      const automationIdx = columns.indexOf('automation');
      const statusIdx = columns.indexOf('status');
      const devicesJsonIdx = columns.indexOf('devices_json');

      return series.values.map((row, idx) => {
        let devices = [];
        try {
          if (row[devicesJsonIdx]) {
            devices = JSON.parse(row[devicesJsonIdx]);
          }
        } catch (e) { /* ignore parse errors */ }

        return {
          id: `tts-hist-${idx}-${new Date(row[timeIdx]).getTime()}`,
          timestamp: new Date(row[timeIdx]).getTime(),
          type: 'tts',
          title: 'TTS Announcement',
          message: row[messageIdx] || '',
          channel: 'TTS',
          importance: 'default',
          automation: row[automationIdx] || 'unknown',
          success: row[successIdx] === true || row[successIdx] === 'true',
          allAvailable: row[allAvailableIdx] === true || row[allAvailableIdx] === 'true',
          status: row[statusIdx] || 'unknown',
          devices: devices
        };
      });
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FILTERED DATA
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get filtered notifications based on current filter state
     * Filter logic: OR within category, AND across categories
     */
    get filteredNotifications() {
      let notifications = this.list;

      // TYPE FILTER (OR within category, case-insensitive)
      if (this.filters.types.length > 0) {
        const normalizedTypes = this.filters.types.map(t => t.toLowerCase());
        notifications = notifications.filter(n =>
          normalizedTypes.includes((n.type || '').toLowerCase())
        );
      }

      // CHANNEL FILTER (OR within category, case-insensitive)
      if (this.filters.channels.length > 0) {
        const normalizedChannels = this.filters.channels.map(c => c.toLowerCase());
        notifications = notifications.filter(n =>
          normalizedChannels.includes((n.channel || '').toLowerCase())
        );
      }

      // IMPORTANCE FILTER (OR within category)
      if (this.filters.importance.length > 0) {
        notifications = notifications.filter(n =>
          this.filters.importance.includes(n.importance)
        );
      }

      // DATE RANGE FILTER
      const now = Date.now();
      const todayStart = new Date().setHours(0, 0, 0, 0);

      switch (this.filters.dateRange) {
        case 'today':
          notifications = notifications.filter(n => n.timestamp >= todayStart);
          break;
        case 'yesterday':
          const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
          notifications = notifications.filter(n =>
            n.timestamp >= yesterdayStart && n.timestamp < todayStart
          );
          break;
        case 'week':
          const weekStart = now - (7 * 24 * 60 * 60 * 1000);
          notifications = notifications.filter(n => n.timestamp >= weekStart);
          break;
        case 'all':
        default:
          // No time filter
          break;
      }

      // TEXT SEARCH FILTER
      const searchTerm = (this.filters.search || '').toLowerCase().trim();
      if (searchTerm) {
        notifications = notifications.filter(n =>
          (n.title || '').toLowerCase().includes(searchTerm) ||
          (n.message || '').toLowerCase().includes(searchTerm) ||
          (n.automation || '').toLowerCase().includes(searchTerm)
        );
      }

      return notifications;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FILTER METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Toggle a type filter (mobile/tts)
     */
    toggleType(type) {
      const idx = this.filters.types.indexOf(type);
      if (idx === -1) {
        this.filters.types.push(type);
      } else {
        this.filters.types.splice(idx, 1);
      }
    },

    /**
     * Toggle a channel filter
     */
    toggleChannel(channel) {
      const idx = this.filters.channels.indexOf(channel);
      if (idx === -1) {
        this.filters.channels.push(channel);
      } else {
        this.filters.channels.splice(idx, 1);
      }
    },

    /**
     * Set date range filter
     */
    setDateRange(range) {
      this.filters.dateRange = range;
    },

    /**
     * Set search filter
     */
    setSearch(term) {
      this.filters.search = term;
    },

    /**
     * Clear all filters
     */
    clearFilters() {
      this.filters.types = [];
      this.filters.channels = [];
      this.filters.importance = [];
      this.filters.dateRange = 'today';
      this.filters.search = '';
    },

    // ═══════════════════════════════════════════════════════════════════════
    // COMPUTED STATS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get stats for the filtered notifications
     */
    get stats() {
      const filtered = this.filteredNotifications;
      const hourAgo = Date.now() - (60 * 60 * 1000);

      return {
        total: filtered.length,
        lastHour: filtered.filter(n => n.timestamp > hourAgo).length,
        byType: {
          mobile: filtered.filter(n => n.type === 'mobile').length,
          tts: filtered.filter(n => n.type === 'tts').length
        },
        byChannel: Object.keys(this.channels).reduce((acc, channel) => {
          acc[channel] = filtered.filter(n =>
            (n.channel || '').toLowerCase() === channel.toLowerCase()
          ).length;
          return acc;
        }, {})
      };
    },

    /**
     * Get available channels from current data
     */
    get availableChannels() {
      const channelsInData = new Set(this.list.map(n => n.channel || 'Default'));
      return Object.keys(this.channels).filter(c => channelsInData.has(c));
    },

    // ═══════════════════════════════════════════════════════════════════════
    // FORMATTING HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Format timestamp to relative time
     */
    formatRelativeTime(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    /**
     * Format timestamp to time string
     */
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
      }
      return date.toLocaleDateString('en-AU', {
        weekday: 'short', hour: 'numeric', minute: '2-digit'
      });
    },

    /**
     * Get channel info (icon, color, label)
     */
    getChannelInfo(channel) {
      return this.channels[channel] || this.channels.Default;
    },

    /**
     * Get type info (icon, label)
     */
    getTypeInfo(type) {
      return this.types[type] || this.types.mobile;
    }
  });
}
