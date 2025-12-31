/**
 * Mailbox Monitor View
 * Dedicated dashboard for mailbox motion sensor monitoring
 * Features: Event timeline, delivery patterns, signal health, real-time updates
 */

import { CONFIG } from '../js/config.js';

export function mailboxView() {
  return {
    // ========================================
    // STATE
    // ========================================

    // Device identifier
    deviceName: '[Mailbox] Motion Sensor',

    // Time range filter
    dateRange: 'today',

    // Pattern view mode
    patternMode: 'hourly',

    // Historical data
    mailboxEvents: [],

    // Loading state
    loading: false,

    // Real-time event tracking
    _mqttSetup: false,

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      console.log('[mailbox-view] Initializing...');

      // Load historical data
      this.loadMailboxEvents();

      // Set up MQTT listener for real-time updates
      this.setupMqttListener();

      // Refresh data every 5 minutes
      this._refreshInterval = setInterval(() => {
        this.loadMailboxEvents();
      }, 5 * 60 * 1000);
    },

    destroy() {
      if (this._refreshInterval) {
        clearInterval(this._refreshInterval);
      }
      // Clean up MQTT handler to prevent memory leak
      if (this._unsubscribeMqtt) {
        this._unsubscribeMqtt();
        this._unsubscribeMqtt = null;
      }
      this._mqttSetup = false;
    },

    // ========================================
    // MQTT REAL-TIME LISTENER
    // ========================================

    setupMqttListener() {
      if (this._mqttSetup) return;

      const checkMqtt = () => {
        const mqtt = Alpine.store('mqtt');
        if (!mqtt?.client || !mqtt.connected) {
          setTimeout(checkMqtt, 2000);
          return;
        }

        this._mqttSetup = true;
        const topic = `${CONFIG.baseTopic}/${this.deviceName}`;

        console.log('[mailbox-view] Subscribing to:', topic);
        mqtt.client.subscribe(topic, { qos: 0 });

        // PERFORMANCE: Use central dispatcher instead of client.on('message')
        // This prevents duplicate JSON parsing across multiple handlers
        // Store unsubscribe function for cleanup in destroy()
        this._unsubscribeMqtt = mqtt.registerTopicHandler(topic, (msgTopic, payload) => {
          const now = Date.now();

          // Handle motion event
          if (payload.occupancy === true) {
            this.addLiveEvent({
              time: now,
              eventType: 'motion_detected',
              deviceName: this.deviceName,
              value: 1
            });
          } else if (payload.occupancy === false) {
            this.addLiveEvent({
              time: now,
              eventType: 'motion_cleared',
              deviceName: this.deviceName,
              value: 0
            });
          }

          // Handle availability
          if (payload.availability !== undefined) {
            this.addLiveEvent({
              time: now,
              eventType: payload.availability === 'online' ? 'device_online' : 'device_offline',
              deviceName: this.deviceName,
              value: payload.availability === 'online' ? 1 : 0
            });
          }
        });
      };

      checkMqtt();
    },

    addLiveEvent(event) {
      // Avoid duplicates within 1 second
      const isDuplicate = this.mailboxEvents.some(e =>
        Math.abs(e.time - event.time) < 1000 && e.eventType === event.eventType
      );

      if (!isDuplicate) {
        this.mailboxEvents.unshift(event);
        console.log('[mailbox-view] Live event:', event.eventType);

        // Keep list bounded
        if (this.mailboxEvents.length > 500) {
          this.mailboxEvents.pop();
        }
      }
    },

    // ========================================
    // DATA LOADING
    // ========================================

    async loadMailboxEvents() {
      this.loading = true;

      try {
        const influxUrl = CONFIG.influxUrl || `http://${window.location.hostname}:8086`;
        const influxDb = CONFIG.influxDb || 'homeassistant';

        // Query mailbox-specific events (motion + availability)
        const query = `
          SELECT * FROM zigbee_events
          WHERE device_name = '${this.deviceName}'
            AND time > now() - 7d
          ORDER BY time DESC
          LIMIT 500
        `;

        const url = `${influxUrl}/query?db=${influxDb}&q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results?.[0]?.series?.[0]) {
          const series = data.results[0].series[0];
          const columns = series.columns;
          const values = series.values;

          const timeIdx = columns.indexOf('time');
          const eventTypeIdx = columns.indexOf('event_type');
          const deviceNameIdx = columns.indexOf('device_name');
          const valueIdx = columns.indexOf('value');

          this.mailboxEvents = values.map(row => ({
            time: new Date(row[timeIdx]).getTime(),
            eventType: row[eventTypeIdx],
            deviceName: row[deviceNameIdx],
            value: row[valueIdx]
          }));

          console.log(`[mailbox-view] Loaded ${this.mailboxEvents.length} events`);
        }
      } catch (e) {
        console.error('[mailbox-view] Failed to load events:', e);
      }

      this.loading = false;
    },

    // ========================================
    // COMPUTED GETTERS
    // ========================================

    // Filter events by date range
    get filteredEvents() {
      const now = Date.now();
      let startTime;
      let endTime = now;

      switch (this.dateRange) {
        case 'today':
          startTime = new Date().setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          startTime = yesterday.setHours(0, 0, 0, 0);
          endTime = new Date().setHours(0, 0, 0, 0);
          break;
        case 'week':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = new Date().setHours(0, 0, 0, 0);
      }

      return this.mailboxEvents.filter(e =>
        e.time >= startTime && e.time <= endTime
      );
    },

    // Get only delivery events (motion_detected)
    get deliveryEvents() {
      return this.filteredEvents.filter(e => e.eventType === 'motion_detected');
    },

    // Last delivery info
    get lastDelivery() {
      const deliveries = this.mailboxEvents.filter(e => e.eventType === 'motion_detected');
      if (deliveries.length === 0) return null;
      return deliveries[0]; // Already sorted DESC
    },

    // Has mail today?
    get hasMailToday() {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      return this.mailboxEvents.some(e =>
        e.eventType === 'motion_detected' && e.time >= todayStart
      );
    },

    // ========================================
    // STATISTICS
    // ========================================

    get stats() {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const allDeliveries = this.mailboxEvents.filter(e => e.eventType === 'motion_detected');
      const todayDeliveries = allDeliveries.filter(e => e.time >= todayStart);
      const weekDeliveries = allDeliveries.filter(e => e.time >= weekStart);

      // Calculate average delivery hour
      const deliveryHours = weekDeliveries.map(e => new Date(e.time).getHours());
      const avgHour = deliveryHours.length > 0
        ? Math.round(deliveryHours.reduce((a, b) => a + b, 0) / deliveryHours.length)
        : null;

      return {
        todayCount: todayDeliveries.length,
        weekCount: weekDeliveries.length,
        totalCount: allDeliveries.length,
        avgDeliveryHour: avgHour,
        avgDeliveryTime: avgHour !== null ? this.formatHour(avgHour) : '--'
      };
    },

    // ========================================
    // SIGNAL HEALTH
    // ========================================

    get signalHealth() {
      const now = Date.now();
      const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

      // Get all events in last 24h
      const recentEvents = this.mailboxEvents.filter(e => e.time >= twentyFourHoursAgo);

      // Get online/offline events
      const onlineEvents = recentEvents
        .filter(e => e.eventType === 'device_online')
        .sort((a, b) => b.time - a.time);

      const offlineEvents = recentEvents
        .filter(e => e.eventType === 'device_offline')
        .sort((a, b) => b.time - a.time);

      // Calculate gaps (periods without any events for >30 min)
      let gaps = 0;
      const thirtyMinutes = 30 * 60 * 1000;

      const sortedEvents = [...recentEvents].sort((a, b) => b.time - a.time);
      for (let i = 0; i < sortedEvents.length - 1; i++) {
        const gap = sortedEvents[i].time - sortedEvents[i + 1].time;
        if (gap > thirtyMinutes) gaps++;
      }

      // Check last seen
      const lastEvent = sortedEvents[0];
      const lastSeen = lastEvent?.time || null;
      const timeSinceLastSeen = lastSeen ? now - lastSeen : Infinity;
      const isOffline = timeSinceLastSeen > thirtyMinutes;

      // Calculate uptime percentage (rough estimate)
      const expectedEvents = 24 * 2; // Expect at least 2 events per hour
      const actualEvents = recentEvents.length;
      const uptimePercent = Math.min(100, Math.round((actualEvents / expectedEvents) * 100));

      // Determine status
      let status = 'healthy';
      let label = 'Healthy';

      if (isOffline || offlineEvents.length > onlineEvents.length) {
        status = 'critical';
        label = 'Offline';
      } else if (gaps > 3 || uptimePercent < 50) {
        status = 'warning';
        label = 'Intermittent';
      } else if (recentEvents.length === 0) {
        status = 'unknown';
        label = 'No Data';
      }

      return {
        status,
        label,
        lastSeen,
        uptimePercent,
        gaps,
        eventCount: recentEvents.length
      };
    },

    // ========================================
    // PATTERN ANALYSIS
    // ========================================

    get hourlyPattern() {
      const hours = new Array(24).fill(0);
      const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

      this.mailboxEvents
        .filter(e => e.eventType === 'motion_detected' && e.time >= weekStart)
        .forEach(e => {
          const hour = new Date(e.time).getHours();
          hours[hour]++;
        });

      const max = Math.max(...hours, 1);
      return hours.map((count, hour) => ({
        hour,
        count,
        height: (count / max) * 100,
        label: this.formatHourShort(hour),
        isEmpty: count === 0
      }));
    },

    get dailyPattern() {
      const days = new Array(7).fill(0);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthStart = Date.now() - 30 * 24 * 60 * 60 * 1000;

      this.mailboxEvents
        .filter(e => e.eventType === 'motion_detected' && e.time >= monthStart)
        .forEach(e => {
          const day = new Date(e.time).getDay();
          days[day]++;
        });

      const max = Math.max(...days, 1);
      return days.map((count, day) => ({
        day,
        count,
        height: (count / max) * 100,
        label: dayNames[day],
        isEmpty: count === 0
      }));
    },

    get patternData() {
      return this.patternMode === 'hourly' ? this.hourlyPattern : this.dailyPattern;
    },

    // ========================================
    // FORMATTING HELPERS
    // ========================================

    formatTime(timestamp) {
      if (!timestamp) return '--';
      return new Date(timestamp).toLocaleTimeString('de-DE', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    },

    formatDate(timestamp) {
      if (!timestamp) return '--';
      return new Date(timestamp).toLocaleDateString('de-DE', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    },

    formatDateTime(timestamp) {
      if (!timestamp) return '--';
      return new Date(timestamp).toLocaleString('de-DE', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    },

    formatRelativeTime(timestamp) {
      if (!timestamp) return '--';
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    formatHour(hour) {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:00 ${period}`;
    },

    formatHourShort(hour) {
      if (hour === 0) return '12a';
      if (hour === 12) return '12p';
      if (hour < 12) return `${hour}a`;
      return `${hour - 12}p`;
    },

    // ========================================
    // EVENT HELPERS
    // ========================================

    getEventIcon(eventType) {
      const icons = {
        motion_detected: '1f4ec',  // open mailbox with raised flag
        motion_cleared: '1f4ed',   // open mailbox with lowered flag
        device_online: '1f4e1',    // satellite antenna
        device_offline: '26a0'     // warning
      };
      const code = icons[eventType] || '1f4cd';
      return String.fromCodePoint(parseInt(code, 16));
    },

    getEventLabel(eventType) {
      const labels = {
        motion_detected: 'Mail Arrived',
        motion_cleared: 'Motion Cleared',
        device_online: 'Sensor Online',
        device_offline: 'Sensor Offline'
      };
      return labels[eventType] || eventType;
    },

    getEventClass(eventType) {
      return eventType.replace(/_/g, '-');
    },

    // ========================================
    // ACTIONS
    // ========================================

    setDateRange(range) {
      this.dateRange = range;
    },

    setPatternMode(mode) {
      this.patternMode = mode;
    },

    refresh() {
      this.loadMailboxEvents();
    }
  };
}
