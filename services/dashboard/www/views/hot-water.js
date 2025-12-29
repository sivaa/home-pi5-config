/**
 * Hot Water Monitor View
 * Dashboard for tracking hot water usage via vibration sensor
 * Features: Live indicator, usage stats (today/yesterday/week), 7-day history chart
 */

export function hotWaterView() {
  return {
    // ========================================
    // STATE
    // ========================================

    // Live state from MQTT
    isRunning: false,
    lastUpdate: null,

    // Stats (seconds)
    todaySeconds: 0,
    yesterdaySeconds: 0,
    weekMinutes: 0,

    // 7-day history for chart
    dailyHistory: [],

    // Loading state
    loading: false,

    // MQTT setup tracking
    _mqttSetup: false,

    // Auto-refresh interval
    _refreshInterval: null,

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      console.log('[hot-water] Initializing...');

      // Subscribe to MQTT for live updates
      this.setupMqttListener();

      // Load stats from InfluxDB
      this.loadStats();
      this.loadDailyHistory();

      // Refresh stats every 5 minutes
      this._refreshInterval = setInterval(() => {
        this.loadStats();
        this.loadDailyHistory();
      }, 5 * 60 * 1000);
    },

    destroy() {
      if (this._refreshInterval) {
        clearInterval(this._refreshInterval);
      }
    },

    // ========================================
    // MQTT SUBSCRIPTION
    // ========================================

    setupMqttListener() {
      if (this._mqttSetup) return;

      const checkMqtt = () => {
        const mqtt = this.$store?.mqtt;
        if (!mqtt?.client || !mqtt.connected) {
          setTimeout(checkMqtt, 2000);
          return;
        }

        this._mqttSetup = true;
        const topic = 'zigbee2mqtt/Vibration Sensor';

        console.log('[hot-water] Subscribing to:', topic);
        mqtt.client.subscribe(topic, { qos: 0 });

        mqtt.client.on('message', (msgTopic, message) => {
          if (msgTopic !== topic) return;

          try {
            const payload = JSON.parse(message.toString());

            if (payload.vibration !== undefined) {
              this.isRunning = payload.vibration === true;
              this.lastUpdate = Date.now();
              console.log(`[hot-water] State: ${this.isRunning ? 'RUNNING' : 'idle'}`);
            }
          } catch (e) {
            // Parse error - ignore
          }
        });
      };

      checkMqtt();
    },

    // ========================================
    // DATA LOADING
    // ========================================

    /**
     * Calculate total duration from ON→OFF event pairs
     * @param {Array} events - Array of {time, running} objects sorted by time
     * @returns {number} Total seconds of water usage
     */
    calculateDurationFromEvents(events) {
      if (!events || events.length === 0) return 0;

      let totalSeconds = 0;
      let lastOnTime = null;

      for (const event of events) {
        if (event.running === true) {
          lastOnTime = new Date(event.time).getTime();
        } else if (event.running === false && lastOnTime !== null) {
          const offTime = new Date(event.time).getTime();
          const duration = (offTime - lastOnTime) / 1000;
          if (duration > 0 && duration < 3600) { // Sanity check: max 1 hour per event
            totalSeconds += duration;
          }
          lastOnTime = null;
        }
      }

      return Math.round(totalSeconds);
    },

    /**
     * Query all events for a time range and return as array
     */
    async queryEventsForRange(influxUrl, influxDb, startTime, endTime = null) {
      let query = `
        SELECT time, running
        FROM hot_water
        WHERE time >= '${startTime.toISOString()}'
      `;
      if (endTime) {
        query += ` AND time < '${endTime.toISOString()}'`;
      }
      query += ' ORDER BY time ASC';

      try {
        const fullUrl = `${influxUrl}/query?db=${influxDb}&q=${encodeURIComponent(query)}`;
        const response = await fetch(fullUrl);
        const data = await response.json();

        if (data.results?.[0]?.series?.[0]?.values) {
          return data.results[0].series[0].values.map(v => ({
            time: v[0],
            running: v[1]
          }));
        }
      } catch (e) {
        console.warn('[hot-water] Failed to query events:', e);
      }
      return [];
    },

    async loadStats() {
      this.loading = true;

      try {
        const config = this.$store?.config || {};
        const influxUrl = config.influxUrl || `http://${window.location.hostname}:8086`;
        const influxDb = config.influxDb || 'homeassistant';

        // Calculate time boundaries
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
        const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Query all events and calculate duration from ON→OFF pairs
        const todayEvents = await this.queryEventsForRange(influxUrl, influxDb, todayStart);
        this.todaySeconds = this.calculateDurationFromEvents(todayEvents);

        const yesterdayEvents = await this.queryEventsForRange(influxUrl, influxDb, yesterdayStart, todayStart);
        this.yesterdaySeconds = this.calculateDurationFromEvents(yesterdayEvents);

        const weekEvents = await this.queryEventsForRange(influxUrl, influxDb, weekStart);
        const weekSeconds = this.calculateDurationFromEvents(weekEvents);
        this.weekMinutes = Math.round(weekSeconds / 60);

        console.log(`[hot-water] Stats: today=${this.todaySeconds}s, yesterday=${this.yesterdaySeconds}s, week=${this.weekMinutes}m`);
      } catch (e) {
        console.error('[hot-water] Failed to load stats:', e);
      }

      this.loading = false;
    },

    async loadDailyHistory() {
      try {
        const config = this.$store?.config || {};
        const influxUrl = config.influxUrl || `http://${window.location.hostname}:8086`;
        const influxDb = config.influxDb || 'homeassistant';

        // Get all events for the past 8 days and calculate duration per day
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eightDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        const allEvents = await this.queryEventsForRange(influxUrl, influxDb, eightDaysAgo);

        // Group events by day and calculate duration for each day
        const dailyData = [];
        for (let i = 7; i >= 0; i--) {
          const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

          // Filter events for this day
          const dayEvents = allEvents.filter(e => {
            const eventTime = new Date(e.time).getTime();
            return eventTime >= dayStart.getTime() && eventTime < dayEnd.getTime();
          });

          const seconds = this.calculateDurationFromEvents(dayEvents);
          dailyData.push({
            date: dayStart,
            seconds: seconds
          });
        }

        this.dailyHistory = dailyData;
        console.log(`[hot-water] Loaded ${this.dailyHistory.length} days of history`);

        this.$nextTick(() => this.drawChart());
      } catch (e) {
        console.error('[hot-water] Failed to load history:', e);
      }
    },

    async queryInflux(url, db, query) {
      try {
        const fullUrl = `${url}/query?db=${db}&q=${encodeURIComponent(query)}`;
        const response = await fetch(fullUrl);
        const data = await response.json();

        if (data.results?.[0]?.series?.[0]?.values?.[0]) {
          const columns = data.results[0].series[0].columns;
          const values = data.results[0].series[0].values[0];
          const result = {};
          columns.forEach((col, i) => {
            result[col] = values[i];
          });
          return result;
        }
      } catch (e) {
        console.warn('[hot-water] InfluxDB query failed:', e);
      }
      return null;
    },

    // ========================================
    // COMPUTED GETTERS
    // ========================================

    get todayFormatted() {
      return this.formatDuration(this.todaySeconds);
    },

    get yesterdayFormatted() {
      return this.formatDuration(this.yesterdaySeconds);
    },

    get weekFormatted() {
      if (this.weekMinutes < 60) {
        return `${this.weekMinutes}m`;
      }
      const hours = Math.floor(this.weekMinutes / 60);
      const mins = this.weekMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    },

    get statusText() {
      return this.isRunning ? 'Water Running' : 'Idle';
    },

    get lastUpdateText() {
      if (!this.lastUpdate) return 'Waiting for data...';
      return this.formatRelativeTime(this.lastUpdate);
    },

    // ========================================
    // FORMATTING HELPERS
    // ========================================

    formatDuration(seconds) {
      if (!seconds || seconds === 0) return '0s';
      if (seconds < 60) return `${Math.round(seconds)}s`;
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      if (mins < 60) {
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
      }
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
    },

    formatRelativeTime(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    // ========================================
    // CHART DRAWING
    // ========================================

    drawChart() {
      const svg = document.getElementById('hot-water-chart');
      if (!svg) return;

      const data = this.dailyHistory;
      if (data.length === 0) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="14">No data yet</text>';
        return;
      }

      const width = svg.clientWidth || 600;
      const height = svg.clientHeight || 180;
      const padding = { top: 20, right: 20, bottom: 40, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const barWidth = Math.max(20, (chartWidth / data.length) - 8);
      const maxSeconds = Math.max(...data.map(d => d.seconds), 60);

      let svgContent = '';

      // Gradient definition
      svgContent += `
        <defs>
          <linearGradient id="water-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#38bdf8;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0ea5e9;stop-opacity:0.7" />
          </linearGradient>
        </defs>
      `;

      // Y-axis labels
      const ySteps = 4;
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (i / ySteps) * chartHeight;
        const val = maxSeconds - (i / ySteps) * maxSeconds;
        svgContent += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--color-border)" stroke-dasharray="3,3" opacity="0.5"/>`;
        svgContent += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-tertiary)" font-size="10">${this.formatDuration(val)}</text>`;
      }

      // Bars
      data.forEach((d, i) => {
        const x = padding.left + (i * (chartWidth / data.length)) + 4;
        const barHeight = Math.max(2, (d.seconds / maxSeconds) * chartHeight);
        const y = padding.top + chartHeight - barHeight;

        // Bar
        svgContent += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="url(#water-gradient)" rx="4"/>`;

        // Day label
        const dayLabel = d.date.toLocaleDateString('en-AU', { weekday: 'short' });
        svgContent += `<text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="11">${dayLabel}</text>`;
      });

      svg.innerHTML = svgContent;
    },

    // ========================================
    // ACTIONS
    // ========================================

    refresh() {
      this.loadStats();
      this.loadDailyHistory();
    }
  };
}
