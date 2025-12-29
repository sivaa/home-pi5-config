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

    // Chart history data
    chartHistory: [],

    // Time range options for chart
    timeRanges: [
      { id: '15m', label: '15m', minutes: 15 },
      { id: '1h', label: '1h', minutes: 60 },
      { id: '3h', label: '3h', minutes: 180 },
      { id: '6h', label: '6h', minutes: 360 },
      { id: '12h', label: '12h', minutes: 720 },
      { id: '24h', label: '24h', minutes: 1440 },
      { id: '2d', label: '2d', minutes: 2880 },
      { id: '4d', label: '4d', minutes: 5760 },
      { id: '7d', label: '7d', minutes: 10080 }
    ],
    selectedRange: '7d',

    // Loading state
    loading: false,

    // Tooltip state
    tooltipVisible: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipContent: '',

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
      this.loadChartHistory();

      // Refresh stats every 5 minutes
      this._refreshInterval = setInterval(() => {
        this.loadStats();
        this.loadChartHistory();
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

    async loadChartHistory() {
      try {
        const config = this.$store?.config || {};
        const influxUrl = config.influxUrl || `http://${window.location.hostname}:8086`;
        const influxDb = config.influxDb || 'homeassistant';

        const range = this.timeRanges.find(r => r.id === this.selectedRange) || this.timeRanges[8];
        const now = new Date();
        const startTime = new Date(now.getTime() - range.minutes * 60 * 1000);

        const allEvents = await this.queryEventsForRange(influxUrl, influxDb, startTime);

        // Determine bucket size based on range
        let bucketMs, bucketCount;
        if (range.minutes <= 60) {
          // 15m-1h: 5-minute buckets
          bucketMs = 5 * 60 * 1000;
          bucketCount = Math.ceil(range.minutes / 5);
        } else if (range.minutes <= 360) {
          // 3h-6h: 15-minute buckets
          bucketMs = 15 * 60 * 1000;
          bucketCount = Math.ceil(range.minutes / 15);
        } else if (range.minutes <= 1440) {
          // 12h-24h: 1-hour buckets
          bucketMs = 60 * 60 * 1000;
          bucketCount = Math.ceil(range.minutes / 60);
        } else {
          // 2d-7d: daily buckets
          bucketMs = 24 * 60 * 60 * 1000;
          bucketCount = Math.ceil(range.minutes / 1440);
        }

        // Group events into buckets
        const chartData = [];
        for (let i = bucketCount - 1; i >= 0; i--) {
          const bucketEnd = new Date(now.getTime() - i * bucketMs);
          const bucketStart = new Date(bucketEnd.getTime() - bucketMs);

          // Filter events for this bucket
          const bucketEvents = allEvents.filter(e => {
            const eventTime = new Date(e.time).getTime();
            return eventTime >= bucketStart.getTime() && eventTime < bucketEnd.getTime();
          });

          const seconds = this.calculateDurationFromEvents(bucketEvents);
          chartData.push({
            start: bucketStart,
            end: bucketEnd,
            seconds: seconds,
            bucketMs: bucketMs
          });
        }

        this.chartHistory = chartData;
        console.log(`[hot-water] Loaded ${this.chartHistory.length} buckets for ${this.selectedRange}`);

        this.$nextTick(() => this.drawChart());
      } catch (e) {
        console.error('[hot-water] Failed to load history:', e);
      }
    },

    setTimeRange(rangeId) {
      this.selectedRange = rangeId;
      this.loadChartHistory();
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

      const data = this.chartHistory;
      if (data.length === 0) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="14">No data yet</text>';
        return;
      }

      const width = svg.clientWidth || 600;
      const height = svg.clientHeight || 180;
      const padding = { top: 20, right: 20, bottom: 40, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const barGap = data.length > 20 ? 2 : (data.length > 10 ? 4 : 8);
      const barWidth = Math.max(8, (chartWidth / data.length) - barGap);
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

      // Bars with dynamic labels
      const labelFrequency = data.length > 20 ? 4 : (data.length > 10 ? 2 : 1);
      data.forEach((d, i) => {
        const x = padding.left + (i * (chartWidth / data.length)) + barGap / 2;
        const barHeight = Math.max(2, (d.seconds / maxSeconds) * chartHeight);
        const y = padding.top + chartHeight - barHeight;

        // Bar with hover area (invisible rect for better touch/hover target)
        const hoverHeight = chartHeight;
        const hoverY = padding.top;
        svgContent += `<rect class="hot-water-bar-hover" data-index="${i}" x="${x}" y="${hoverY}" width="${barWidth}" height="${hoverHeight}" fill="transparent" style="cursor: pointer"/>`;

        // Visible bar
        svgContent += `<rect class="hot-water-bar" data-index="${i}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="url(#water-gradient)" rx="${Math.min(4, barWidth / 2)}" style="pointer-events: none"/>`;

        // Label (show every Nth label based on data density)
        if (i % labelFrequency === 0 || i === data.length - 1) {
          const label = this.formatBucketLabel(d);
          svgContent += `<text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="10">${label}</text>`;
        }
      });

      svg.innerHTML = svgContent;

      // Add hover event listeners
      this.attachBarHoverEvents(svg, data);
    },

    attachBarHoverEvents(svg, data) {
      const hoverBars = svg.querySelectorAll('.hot-water-bar-hover');
      const self = this;

      hoverBars.forEach(bar => {
        bar.addEventListener('mouseenter', function(e) {
          const index = parseInt(this.dataset.index);
          const d = data[index];
          if (d) {
            self.showTooltip(e, d);
          }
        });

        bar.addEventListener('mousemove', function(e) {
          self.moveTooltip(e);
        });

        bar.addEventListener('mouseleave', function() {
          self.hideTooltip();
        });

        // Touch support
        bar.addEventListener('touchstart', function(e) {
          const index = parseInt(this.dataset.index);
          const d = data[index];
          if (d) {
            self.showTooltip(e.touches[0], d);
          }
        }, { passive: true });

        bar.addEventListener('touchend', function() {
          setTimeout(() => self.hideTooltip(), 1500);
        }, { passive: true });
      });
    },

    showTooltip(e, bucket) {
      const startTime = this.formatTooltipTime(bucket.start);
      const endTime = this.formatTooltipTime(bucket.end);
      const duration = this.formatDuration(bucket.seconds);

      this.tooltipContent = `${startTime} → ${endTime}\n${duration}`;
      this.tooltipX = e.clientX;
      this.tooltipY = e.clientY;
      this.tooltipVisible = true;
    },

    moveTooltip(e) {
      this.tooltipX = e.clientX;
      this.tooltipY = e.clientY;
    },

    hideTooltip() {
      this.tooltipVisible = false;
    },

    formatTooltipTime(date) {
      const bucketMs = this.chartHistory[0]?.bucketMs || 0;

      if (bucketMs >= 24 * 60 * 60 * 1000) {
        // Daily: show date
        return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
      } else {
        // Hourly/minute: show time
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    },

    formatBucketLabel(bucket) {
      const bucketMs = bucket.bucketMs;
      const date = bucket.end;

      if (bucketMs >= 24 * 60 * 60 * 1000) {
        // Daily: show day name
        return date.toLocaleDateString('en-AU', { weekday: 'short' });
      } else if (bucketMs >= 60 * 60 * 1000) {
        // Hourly: show hour
        return date.toLocaleTimeString('en-AU', { hour: 'numeric', hour12: true });
      } else {
        // Minutes: show HH:MM
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
    },

    // ========================================
    // ACTIONS
    // ========================================

    refresh() {
      this.loadStats();
      this.loadChartHistory();
    },

    get chartTitleText() {
      const range = this.timeRanges.find(r => r.id === this.selectedRange);
      if (!range) return 'History';
      if (range.minutes >= 1440) {
        const days = Math.round(range.minutes / 1440);
        return `${days}-Day History`;
      } else if (range.minutes >= 60) {
        const hours = Math.round(range.minutes / 60);
        return `${hours}-Hour History`;
      } else {
        return `${range.minutes}-Min History`;
      }
    }
  };
}
