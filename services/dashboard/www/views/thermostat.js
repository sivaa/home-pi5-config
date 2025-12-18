/**
 * Thermostat View
 * Heater monitoring and control dashboard with event timeline
 */

// Event type definitions for thermostat timeline
const THERMOSTAT_EVENT_TYPES = {
  // IMPORTANT (full cards)
  heating_started: { icon: '🔥', color: '#ef4444', label: 'Heating Started', priority: 'important', category: 'heating' },
  heating_stopped: { icon: '❄️', color: '#3b82f6', label: 'Heating Stopped', priority: 'important', category: 'heating' },
  target_reached: { icon: '✅', color: '#22c55e', label: 'Target Reached', priority: 'important', category: 'heating' },
  device_offline: { icon: '📡', color: '#ef4444', label: 'Device Offline', priority: 'important', category: 'system' },
  low_battery: { icon: '🪫', color: '#f59e0b', label: 'Low Battery', priority: 'important', category: 'system' },

  // ACTIVITY (compact lines)
  setpoint_changed: { icon: '🎯', color: '#f59e0b', label: 'Setpoint Changed', priority: 'activity', category: 'control' },
  mode_changed: { icon: '⚙️', color: '#8b5cf6', label: 'Mode Changed', priority: 'activity', category: 'control' },
  preset_changed: { icon: '🚀', color: '#06b6d4', label: 'Preset Changed', priority: 'activity', category: 'control' },
  child_lock_changed: { icon: '🔒', color: '#64748b', label: 'Child Lock Changed', priority: 'activity', category: 'control' },

  // BACKGROUND (collapsed)
  device_online: { icon: '📡', color: '#22c55e', label: 'Device Online', priority: 'background', category: 'system' },
  battery_ok: { icon: '🔋', color: '#22c55e', label: 'Battery OK', priority: 'background', category: 'system' },
  temp_update: { icon: '🌡️', color: '#94a3b8', label: 'Temperature Update', priority: 'background', category: 'data' }
};

// Use global CONFIG defined in index.html
const CONFIG = window.CONFIG;

export function thermostatView() {
  return {
    // ============================================
    // STATE
    // ============================================

    activeTab: 'overview',       // 'overview' | 'timeline' | 'trends' | 'efficiency'
    timeRange: '24h',
    showBackground: false,       // Toggle for background events
    filterRoom: '',
    filterEventType: '',

    // Historical data
    tempHistory: {},             // { [deviceId]: [] }
    loading: false,
    chartUpdateInterval: null,

    // ============================================
    // LIFECYCLE
    // ============================================

    init() {
      // Set up MQTT listeners for thermostats
      this.setupMqttListener();

      // Load historical data when trends tab is selected
      this.$watch('activeTab', (tab) => {
        if (tab === 'trends') {
          this.loadHistoricalData();
        }
      });

      // Auto-refresh charts
      this.chartUpdateInterval = setInterval(() => {
        if (this.activeTab === 'trends') {
          this.drawCharts();
        }
      }, 60000);
    },

    destroy() {
      if (this.chartUpdateInterval) {
        clearInterval(this.chartUpdateInterval);
      }
    },

    setupMqttListener() {
      const mqtt = this.$store.mqtt;
      if (!mqtt?.client) {
        setTimeout(() => this.setupMqttListener(), 2000);
        return;
      }

      // Subscribe to thermostat topics
      CONFIG.thermostats.forEach(t => {
        mqtt.client.subscribe(`zigbee2mqtt/${t.sensor}`, { qos: 0 });
        mqtt.client.subscribe(`zigbee2mqtt/${t.sensor}/availability`, { qos: 0 });
      });

      // Handle messages
      mqtt.client.on('message', (topic, message) => {
        if (!topic.startsWith('zigbee2mqtt/')) return;

        try {
          const data = JSON.parse(message.toString());
          const deviceName = topic.replace('zigbee2mqtt/', '').replace('/availability', '');

          // Check if this is a thermostat
          const thermostat = CONFIG.thermostats.find(t => t.sensor === deviceName);
          if (!thermostat) return;

          if (topic.endsWith('/availability')) {
            this.$store.thermostats.updateAvailability(deviceName, data);
          } else {
            this.$store.thermostats.updateThermostat(deviceName, data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
    },

    // ============================================
    // GETTERS
    // ============================================

    get thermostats() {
      return this.$store.thermostats.list;
    },

    get events() {
      let events = [...this.$store.thermostats.events];

      // Apply filters
      if (this.filterRoom) {
        events = events.filter(e => e.roomId === this.filterRoom);
      }
      if (this.filterEventType) {
        events = events.filter(e => e.eventType === this.filterEventType);
      }

      return events;
    },

    get importantEvents() {
      return this.events.filter(e => e.info?.priority === 'important').slice(0, 10);
    },

    get activityEvents() {
      return this.events.filter(e => e.info?.priority === 'activity').slice(0, 20);
    },

    get backgroundEvents() {
      return this.events.filter(e => e.info?.priority === 'background');
    },

    get stats() {
      return this.$store.thermostats.getStats(24);
    },

    get activeHeatingCount() {
      return this.$store.thermostats.activeHeatingCount;
    },

    get offlineCount() {
      return this.$store.thermostats.offlineCount;
    },

    get uniqueRooms() {
      const rooms = new Set(this.events.map(e => e.roomId));
      return [...rooms].filter(r => r);
    },

    get uniqueEventTypes() {
      const types = new Set(this.events.map(e => e.eventType));
      return [...types].filter(t => t);
    },

    // ============================================
    // CONTROL METHODS
    // ============================================

    adjustTemp(thermostatId, delta) {
      this.$store.thermostats.adjustTemp(thermostatId, delta);
    },

    setTargetTemp(thermostatId, temp) {
      this.$store.thermostats.setTargetTemp(thermostatId, parseFloat(temp));
    },

    togglePower(thermostatId) {
      this.$store.thermostats.togglePower(thermostatId);
    },

    setMode(thermostatId, mode) {
      this.$store.thermostats.setMode(thermostatId, mode);
    },

    toggleChildLock(thermostatId) {
      const t = this.$store.thermostats.getThermostat(thermostatId);
      if (t) {
        this.$store.thermostats.setChildLock(thermostatId, t.childLock === 'UNLOCK');
      }
    },

    // ============================================
    // UI HELPER METHODS
    // ============================================

    getDisplayTemp(thermostat) {
      return this.$store.thermostats.getDisplayTemp(thermostat);
    },

    getHeatingColor(thermostat) {
      if (thermostat.systemMode === 'off') return 'var(--color-text-tertiary)';
      if (thermostat.runningState === 'heat') return 'var(--color-danger)';
      return 'var(--color-success)';
    },

    getStatusText(thermostat) {
      if (!thermostat.available) return 'Offline';
      if (thermostat.systemMode === 'off') return 'Off';
      if (thermostat.runningState === 'heat') return 'Heating';
      return 'Idle';
    },

    getStatusIcon(thermostat) {
      if (!thermostat.available) return '📡';
      if (thermostat.systemMode === 'off') return '⏹️';
      if (thermostat.runningState === 'heat') return '🔥';
      return '❄️';
    },

    getProgressPercent(thermostat) {
      if (!thermostat.localTemp || !thermostat.targetTemp) return 0;
      if (thermostat.runningState !== 'heat') return 100;

      // Progress from base temp (15) to target
      const baseTemp = 15;
      const progress = (thermostat.localTemp - baseTemp) / (thermostat.targetTemp - baseTemp);
      return Math.min(100, Math.max(0, Math.round(progress * 100)));
    },

    getBatteryColor(battery) {
      if (battery === null) return 'var(--color-text-tertiary)';
      if (battery < 20) return 'var(--color-danger)';
      if (battery < 50) return 'var(--color-warning)';
      return 'var(--color-success)';
    },

    getBatteryIcon(battery) {
      if (battery === null) return '🔋';
      if (battery < 20) return '🪫';
      if (battery < 50) return '🔋';
      return '🔋';
    },

    formatTemp(temp) {
      if (temp === null || temp === undefined) return '--';
      return temp.toFixed(1);
    },

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

    formatRelativeTime(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    formatDuration(minutes) {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    },

    getEventInfo(eventType) {
      return THERMOSTAT_EVENT_TYPES[eventType] || {
        icon: '📝',
        color: '#94a3b8',
        label: eventType,
        priority: 'background'
      };
    },

    // ============================================
    // TAB METHODS
    // ============================================

    setTab(tab) {
      this.activeTab = tab;
    },

    setTimeRange(range) {
      this.timeRange = range;
      if (this.activeTab === 'trends') {
        this.loadHistoricalData();
      }
    },

    clearFilters() {
      this.filterRoom = '';
      this.filterEventType = '';
    },

    // ============================================
    // EFFICIENCY CALCULATIONS
    // ============================================

    getDeviceStats(deviceId) {
      return this.$store.thermostats.getStatsByDevice(deviceId, 24);
    },

    getComparisonStats() {
      const todayStats = this.$store.thermostats.getStats(24);
      // For yesterday comparison, we'd need historical data from InfluxDB
      // For now, return placeholder data
      return {
        today: todayStats,
        yesterday: {
          heatingCycles: todayStats.heatingCycles + 2,
          setpointChanges: todayStats.setpointChanges + 1
        }
      };
    },

    // ============================================
    // HISTORICAL DATA (InfluxDB)
    // ============================================

    async loadHistoricalData() {
      this.loading = true;

      try {
        for (const thermostat of this.thermostats) {
          await this.loadThermostatHistory(thermostat);
        }
      } catch (e) {
        console.error('[thermostat-view] Failed to load historical data:', e);
      }

      this.loading = false;
      await this.$nextTick();
      this.drawCharts();
    },

    async loadThermostatHistory(thermostat) {
      try {
        const timeRangeMap = {
          '15m': '15m', '30m': '30m', '1h': '1h', '3h': '3h',
          '6h': '6h', '12h': '12h', '24h': '24h', '3d': '3d', '7d': '7d'
        };
        const range = timeRangeMap[this.timeRange] || '24h';

        // Query temperature from linked room sensor
        const room = CONFIG.rooms.find(r => r.id === thermostat.roomId);
        if (!room) return;

        const query = `
          SELECT mean("value") AS temp
          FROM "°C"
          WHERE entity_id = '${room.entityId}_temperature'
            AND time > now() - ${range}
          GROUP BY time(5m)
          ORDER BY time ASC
        `;

        const url = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results?.[0]?.series?.[0]?.values) {
          this.tempHistory[thermostat.id] = data.results[0].series[0].values
            .filter(v => v[1] !== null)
            .map(v => ({
              time: new Date(v[0]).getTime(),
              value: v[1]
            }));
        }
      } catch (e) {
        console.error(`[thermostat-view] Failed to load history for ${thermostat.id}:`, e);
      }
    },

    // ============================================
    // CHART DRAWING (SVG)
    // ============================================

    drawCharts() {
      this.thermostats.forEach(t => {
        this.drawThermostatChart(t.id);
      });
    },

    drawThermostatChart(thermostatId) {
      const container = document.getElementById(`chart-${thermostatId}`);
      if (!container) return;

      const data = this.tempHistory[thermostatId] || [];
      if (data.length === 0) {
        container.innerHTML = '<div class="chart-empty">No data available</div>';
        return;
      }

      const width = container.clientWidth || 400;
      const height = 120;
      const padding = { top: 10, right: 40, bottom: 20, left: 10 };

      // Calculate ranges
      const temps = data.map(d => d.value);
      const minTemp = Math.floor(Math.min(...temps) - 1);
      const maxTemp = Math.ceil(Math.max(...temps) + 1);
      const minTime = data[0].time;
      const maxTime = data[data.length - 1].time;

      // Scale functions
      const xScale = (t) => padding.left + ((t - minTime) / (maxTime - minTime)) * (width - padding.left - padding.right);
      const yScale = (temp) => height - padding.bottom - ((temp - minTemp) / (maxTemp - minTemp)) * (height - padding.top - padding.bottom);

      // Build path
      const pathPoints = data.map((d, i) => {
        const x = xScale(d.time);
        const y = yScale(d.value);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).join(' ');

      // Get target temp for reference line
      const thermostat = this.$store.thermostats.getThermostat(thermostatId);
      const targetY = thermostat?.targetTemp ? yScale(thermostat.targetTemp) : null;

      // Build SVG
      container.innerHTML = `
        <svg width="${width}" height="${height}" class="temp-chart">
          <!-- Grid lines -->
          ${[minTemp, (minTemp + maxTemp) / 2, maxTemp].map(temp => `
            <line x1="${padding.left}" y1="${yScale(temp)}" x2="${width - padding.right}" y2="${yScale(temp)}"
                  stroke="var(--color-border)" stroke-dasharray="2,2" opacity="0.3"/>
            <text x="${width - padding.right + 4}" y="${yScale(temp) + 4}"
                  fill="var(--color-text-tertiary)" font-size="10">${temp}°</text>
          `).join('')}

          <!-- Target line -->
          ${targetY !== null ? `
            <line x1="${padding.left}" y1="${targetY}" x2="${width - padding.right}" y2="${targetY}"
                  stroke="var(--color-warning)" stroke-dasharray="4,4" opacity="0.7"/>
            <text x="${width - padding.right + 4}" y="${targetY + 4}"
                  fill="var(--color-warning)" font-size="9" font-weight="500">Target</text>
          ` : ''}

          <!-- Temperature line -->
          <path d="${pathPoints}" fill="none" stroke="var(--color-primary)" stroke-width="2"/>

          <!-- Area fill -->
          <path d="${pathPoints} L ${xScale(maxTime)} ${height - padding.bottom} L ${xScale(minTime)} ${height - padding.bottom} Z"
                fill="url(#gradient-${thermostatId})" opacity="0.2"/>

          <!-- Gradient definition -->
          <defs>
            <linearGradient id="gradient-${thermostatId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-primary)"/>
              <stop offset="100%" stop-color="transparent"/>
            </linearGradient>
          </defs>
        </svg>
      `;
    }
  };
}
