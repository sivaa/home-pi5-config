/**
 * Thermostat View
 * Heater monitoring and control dashboard with event timeline
 */

// Event type definitions for thermostat timeline
// Priority levels: critical (device left) > alert (red, requires action) > warning (yellow, monitor) > activity (blue, normal ops) > background (gray, routine)
const THERMOSTAT_EVENT_TYPES = {
  // CRITICAL - Device left network, requires re-pairing (highest priority)
  device_leave: {
    icon: '🚨', color: '#dc2626', label: 'Device Left Network',
    priority: 'critical', category: 'system',
    action: 'Device needs to be re-paired to Zigbee network'
  },

  // ALERT - Requires immediate attention (shown prominently)
  device_offline: {
    icon: '🔴', color: '#ef4444', label: 'Device Offline',
    priority: 'alert', category: 'system',
    action: 'Check device power and Zigbee signal'
  },
  low_battery_critical: {
    icon: '🪫', color: '#ef4444', label: 'Battery Critical',
    priority: 'alert', category: 'system',
    action: 'Replace batteries immediately'
  },

  // WARNING - Should investigate (shown with less urgency)
  low_battery: {
    icon: '🔋', color: '#f59e0b', label: 'Battery Low',
    priority: 'warning', category: 'system',
    action: 'Plan to replace batteries soon'
  },
  window_detected: {
    icon: '🪟', color: '#f59e0b', label: 'Window Open',
    priority: 'warning', category: 'heating',
    action: 'Heating paused - close window to resume'
  },

  // ACTIVITY - Normal operations (compact rows)
  heating_started: { icon: '🔥', color: '#ef4444', label: 'Heating Started', priority: 'activity', category: 'heating' },
  heating_stopped: { icon: '❄️', color: '#3b82f6', label: 'Heating Stopped', priority: 'activity', category: 'heating' },
  target_reached: { icon: '✅', color: '#22c55e', label: 'Target Reached', priority: 'activity', category: 'heating' },
  setpoint_changed: { icon: '🎯', color: '#f59e0b', label: 'Setpoint Changed', priority: 'activity', category: 'control' },
  mode_changed: { icon: '⚙️', color: '#8b5cf6', label: 'Mode Changed', priority: 'activity', category: 'control' },
  preset_changed: { icon: '🚀', color: '#06b6d4', label: 'Preset Changed', priority: 'activity', category: 'control' },
  child_lock_changed: { icon: '🔒', color: '#64748b', label: 'Child Lock Changed', priority: 'activity', category: 'control' },
  initial_state: { icon: '📍', color: '#6366f1', label: 'Initial State', priority: 'activity', category: 'system' },

  // BACKGROUND - Routine events (collapsed by default)
  device_online: { icon: '📡', color: '#22c55e', label: 'Device Online', priority: 'background', category: 'system' },
  battery_ok: { icon: '🔋', color: '#22c55e', label: 'Battery OK', priority: 'background', category: 'system' },
  temp_update: { icon: '🌡️', color: '#94a3b8', label: 'Temperature Update', priority: 'background', category: 'data' }
};

// Time range presets for timeline filtering
const TIME_RANGE_PRESETS = {
  '1h': { label: '1h', ms: 60 * 60 * 1000 },
  '6h': { label: '6h', ms: 6 * 60 * 60 * 1000 },
  'today': { label: 'Today', ms: null },  // Special: start of day
  '24h': { label: '24h', ms: 24 * 60 * 60 * 1000 },
  '7d': { label: '7d', ms: 7 * 24 * 60 * 60 * 1000 }
};

// Use global CONFIG defined in index.html
const CONFIG = window.CONFIG;

export function thermostatView() {
  return {
    // ============================================
    // STATE
    // ============================================

    activeTab: 'overview',       // 'overview' | 'timeline' | 'trends' | 'efficiency'
    timeRange: '24h',            // For trends tab
    timelineTimeRange: '24h',    // For timeline tab (event filtering)
    showBackground: false,       // Toggle for background events
    filterRoom: '',
    filterEventType: '',

    // Historical data
    tempHistory: {},             // { [deviceId]: [] }
    loading: false,
    chartUpdateInterval: null,

    // Heater pause banner timer
    pauseTimerTick: 0,           // Forces reactivity for live duration
    pauseTimerInterval: null,

    // ============================================
    // LIFECYCLE
    // ============================================

    init() {
      // PERFORMANCE: Thermostat MQTT handling is done by thermostat-store
      // This view just reads from the store - no need for its own handler

      // Load historical data when trends tab is selected
      this.$watch('activeTab', (tab) => {
        if (tab === 'trends') {
          this.loadHistoricalData();
        }
      });

      // Auto-refresh charts (only when heater view is active AND trends tab selected)
      // CPU OPTIMIZATION: Skip when view is hidden
      this.chartUpdateInterval = setInterval(() => {
        if (Alpine.store('app')?.currentView === 'heater' && this.activeTab === 'trends') {
          this.drawCharts();
        }
      }, 60000);

      // PERFORMANCE: Reduce pause banner timer from 1s to 5s
      // The exact second isn't critical for displaying "paused for X minutes"
      // CPU OPTIMIZATION: Only tick when heater view is active
      this.pauseTimerInterval = setInterval(() => {
        if (Alpine.store('app')?.currentView === 'heater' && this.$store.thermostats?.heaterPause?.active) {
          this.pauseTimerTick = Date.now();
        }
      }, 5000);  // Was 1000ms, now 5000ms
    },

    destroy() {
      if (this.chartUpdateInterval) {
        clearInterval(this.chartUpdateInterval);
      }
      if (this.pauseTimerInterval) {
        clearInterval(this.pauseTimerInterval);
      }
    },

    // ============================================
    // GETTERS
    // ============================================

    get thermostats() {
      return this.$store.thermostats.list;
    },

    // Get time cutoff based on selected timeline range
    getTimelineCutoff() {
      const now = Date.now();
      const preset = TIME_RANGE_PRESETS[this.timelineTimeRange];

      if (!preset) return now - (24 * 60 * 60 * 1000); // Default 24h

      if (this.timelineTimeRange === 'today') {
        // Start of today (midnight)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.getTime();
      }

      return now - preset.ms;
    },

    get events() {
      let events = [...this.$store.thermostats.events];

      // Apply time filter first
      const cutoff = this.getTimelineCutoff();
      events = events.filter(e => e.time >= cutoff);

      // Apply room filter
      if (this.filterRoom) {
        events = events.filter(e => e.roomId === this.filterRoom);
      }

      // Apply event type filter
      if (this.filterEventType) {
        events = events.filter(e => e.eventType === this.filterEventType);
      }

      return events;
    },

    // ALERTS - Critical issues requiring immediate action
    get alertEvents() {
      return this.events.filter(e => e.info?.priority === 'alert');
    },

    // WARNINGS - Issues to monitor
    get warningEvents() {
      return this.events.filter(e => e.info?.priority === 'warning');
    },

    // Combined critical, alerts & warnings for the "Alerts & Warnings" section
    get alertsAndWarnings() {
      return this.events.filter(e =>
        e.info?.priority === 'critical' || e.info?.priority === 'alert' || e.info?.priority === 'warning'
      ).slice(0, 10);
    },

    // CRITICAL - Device left network events (highest priority)
    get criticalEvents() {
      return this.events.filter(e => e.info?.priority === 'critical');
    },

    // ACTIVITY - Normal operations (demoted from "important")
    get activityEvents() {
      return this.events.filter(e => e.info?.priority === 'activity').slice(0, 30);
    },

    // BACKGROUND - Routine events (collapsed)
    get backgroundEvents() {
      return this.events.filter(e => e.info?.priority === 'background');
    },

    // Check if there are any active alerts or critical events (for badge display)
    get hasActiveAlerts() {
      return this.criticalEvents.length > 0 || this.alertEvents.length > 0;
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
      // Return pending target (optimistic) or actual target temp
      const temp = thermostat?.pendingTarget ?? thermostat?.targetTemp;
      return temp;
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
      // Show actual temperature ratio regardless of heating state
      const progress = (thermostat.localTemp / thermostat.targetTemp) * 100;
      return Math.min(100, Math.max(0, Math.round(progress)));
    },

    getProgressLabel(thermostat) {
      if (!thermostat?.localTemp || !thermostat?.targetTemp) return 'Unknown';
      if (thermostat?.runningState === 'heat') return 'Heating...';
      // Check if within 0.5° of target (either direction)
      if (Math.abs(thermostat.localTemp - thermostat.targetTemp) <= 0.5) return 'At target';
      if (thermostat.localTemp > thermostat.targetTemp) return 'Above target';
      return 'Below target';
    },

    // Temperature Progress Bar Helpers
    getTempProgressLabel(t) {
      if (!t?.localTemp || !t?.targetTemp) return 'Unknown';
      if (t?.runningState === 'heat') return 'Heating...';
      if (Math.abs(t.localTemp - t.targetTemp) <= 0.5) return 'At target';
      if (t.localTemp > t.targetTemp) return 'Above target';
      return 'Below target';
    },

    getTempProgressPercent(t) {
      if (!t?.localTemp || !t?.targetTemp) return 0;
      const percent = (t.localTemp / t.targetTemp) * 100;
      return Math.min(100, Math.max(0, Math.round(percent)));
    },

    getTempProgressColor(t) {
      if (!t?.localTemp || !t?.targetTemp) return '#666';
      const percent = (t.localTemp / t.targetTemp) * 100;

      if (percent >= 100) {
        // At or above target = solid green
        return '#22c55e';
      } else if (percent >= 90) {
        // 90-100% = yellow to green gradient
        return 'linear-gradient(90deg, #eab308, #22c55e)';
      } else if (percent >= 70) {
        // 70-90% = orange to yellow to green gradient
        return 'linear-gradient(90deg, #f97316, #eab308, #22c55e)';
      } else {
        // Below 70% = red to orange to yellow to green gradient
        return 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e)';
      }
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

    // Get offline duration text for overlay display
    getOfflineDuration(thermostat) {
      if (!thermostat?.leftAt) return '';
      const seconds = Math.floor((Date.now() - thermostat.leftAt) / 1000);
      if (seconds < 60) return 'Left just now';
      if (seconds < 3600) return `Left ${Math.floor(seconds / 60)} minutes ago`;
      if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        return `Left ${hours} hour${hours > 1 ? 's' : ''} ago`;
      }
      const days = Math.floor(seconds / 86400);
      return `Left ${days} day${days > 1 ? 's' : ''} ago`;
    },

    formatDuration(minutes) {
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    },

    // Split temp into whole and decimal parts for styling
    tempParts(temp) {
      if (temp == null) return { whole: '--', decimal: '' };
      const fixed = temp.toFixed(1);
      const [whole, decimal] = fixed.split('.');
      return { whole, decimal: '.' + decimal };
    },

    // ============================================
    // HEATER PAUSE BANNER HELPERS
    // ============================================

    /**
     * Get pause duration string (reactive via pauseTimerTick)
     * @returns {string} Duration like "5m 32s" or "1h 15m"
     */
    getPauseDuration() {
      // Reference tick for reactivity
      const _ = this.pauseTimerTick;

      const pause = this.$store.thermostats?.heaterPause;
      if (!pause?.active || !pause?.changedAt) return '';

      const totalSeconds = Math.floor((Date.now() - pause.changedAt) / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;

      if (hours > 0) {
        return `${hours}h ${mins.toString().padStart(2, '0')}m`;
      }
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    },

    /**
     * Get banner icon based on pause reason
     */
    getPauseIcon() {
      const reason = this.$store.thermostats?.heaterPause?.reason;
      if (reason === 'window') return '🪟';
      if (reason === 'co2') return '💨';
      return '⏸️';
    },

    /**
     * Get banner title based on pause reason
     */
    getPauseTitle() {
      const reason = this.$store.thermostats?.heaterPause?.reason;
      if (reason === 'window') return 'Heaters Paused - Window Open';
      if (reason === 'co2') return 'Heaters Paused - High CO2';
      return 'Heaters Paused';
    },

    /**
     * Get the heater pause state from store
     */
    get heaterPause() {
      return this.$store.thermostats?.heaterPause ?? { active: false };
    },

    // ============================================
    // HEATER STATS HELPERS (Pill Display)
    // ============================================

    getLastCycleText(t) {
      const stats = this.$store.thermostats?.getStatsByDevice?.(t.id, 24);
      if (!stats?.cycles?.length) return 'No cycle data';

      const isHeating = t.runningState === 'heat';
      const mostRecent = stats.cycles[0];

      // Currently heating - show live duration
      if (isHeating && mostRecent && !mostRecent.completed) {
        const runningMins = Math.round((Date.now() - mostRecent.startTime) / 60000);
        return `Running ${runningMins}m...`;
      }

      // Find most recent COMPLETED cycle
      const lastCompleted = stats.cycles.find(c => c.completed);
      if (lastCompleted) {
        const endTime = lastCompleted.endTime ? this.formatRelativeTime(lastCompleted.endTime) : '?';
        const duration = lastCompleted.durationMinutes ?? '?';
        return `${endTime} • ran ${duration}m`;
      }

      // No completed cycles
      if (mostRecent) {
        return `Started ${this.formatRelativeTime(mostRecent.startTime)}`;
      }

      return 'No cycle data';
    },

    getCycleCount(t) {
      const stats = this.$store.thermostats?.getStatsByDevice?.(t.id, 24);
      return stats?.heatingCycles ?? 0;
    },

    getTotalTime(t) {
      const stats = this.$store.thermostats?.getStatsByDevice?.(t.id, 24);
      if (!stats?.heatingMinutes) return '--';
      return this.formatDuration(stats.heatingMinutes);
    },

    getAvgTime(t) {
      const stats = this.$store.thermostats?.getStatsByDevice?.(t.id, 24);
      if (!stats?.avgCycleMinutes || stats.avgCycleMinutes === 0) return null;
      return `${stats.avgCycleMinutes}m`;
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

    setTimelineTimeRange(range) {
      this.timelineTimeRange = range;
    },

    // Get available time range presets for UI
    getTimeRangePresets() {
      return Object.entries(TIME_RANGE_PRESETS).map(([key, val]) => ({
        key,
        label: val.label
      }));
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

// ============================================
// GLOBAL HELPER FUNCTIONS
// Exposed on window for nested x-data scopes
// ============================================

window.getOfflineDuration = function(thermostat) {
  if (!thermostat?.leftAt) return '';
  const seconds = Math.floor((Date.now() - thermostat.leftAt) / 1000);
  if (seconds < 60) return 'Left just now';
  if (seconds < 3600) return `Left ${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `Left ${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(seconds / 86400);
  return `Left ${days} day${days > 1 ? 's' : ''} ago`;
};

window.getTempProgressLabel = function(t) {
  if (!t?.localTemp || !t?.targetTemp) return 'Unknown';
  if (t?.runningState === 'heat') return 'Heating...';
  if (Math.abs(t.localTemp - t.targetTemp) <= 0.5) return 'At target';
  if (t.localTemp > t.targetTemp) return 'Above target';
  return 'Below target';
};

window.getTempProgressPercent = function(t) {
  if (!t?.localTemp || !t?.targetTemp) return 0;
  const percent = (t.localTemp / t.targetTemp) * 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
};

window.getTempProgressColor = function(t) {
  if (!t?.localTemp || !t?.targetTemp) return '#666';
  const percent = (t.localTemp / t.targetTemp) * 100;

  if (percent >= 100) return '#22c55e';
  else if (percent >= 90) return 'linear-gradient(90deg, #eab308, #22c55e)';
  else if (percent >= 70) return 'linear-gradient(90deg, #f97316, #eab308, #22c55e)';
  else return 'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e)';
};

window.getStatusIcon = function(thermostat) {
  if (!thermostat.available) return '📡';
  if (thermostat.systemMode === 'off') return '⏹️';
  if (thermostat.runningState === 'heat') return '🔥';
  return '❄️';
};

window.getStatusText = function(thermostat) {
  if (!thermostat.available) return 'Offline';
  if (thermostat.systemMode === 'off') return 'Off';
  if (thermostat.runningState === 'heat') return 'Heating';
  return 'Idle';
};

window.tempParts = function(temp) {
  if (temp == null) return { whole: '--', decimal: '' };
  const fixed = temp.toFixed(1);
  const [whole, decimal] = fixed.split('.');
  return { whole, decimal: '.' + decimal };
};
