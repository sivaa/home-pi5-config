/**
 * System Performance View
 * Dashboard view for Pi system metrics (CPU, Memory, Fan, Temperature)
 * Features: Live indicators, time range selector, SVG line charts
 *
 * Note: SVG innerHTML is safe here - all data comes from InfluxDB numeric values,
 * not user input. This pattern matches hot-water.js chart rendering.
 */

export function systemView() {
  return {
    // ========================================
    // STATE
    // ========================================

    loading: false,
    _refreshInterval: null,
    _visibilityInterval: null,
    _initialized: false,
    _viewActive: false,

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      // Guard against double-init
      if (this._initialized) return;
      this._initialized = true;
      console.log('[system-view] Initializing...');

      // Wait for system store to be available (it's registered async)
      let storeRetries = 0;
      const maxStoreRetries = 50; // Give up after 5 seconds (50 * 100ms)

      const waitForStore = () => {
        if (!Alpine.store('system')) {
          if (++storeRetries > maxStoreRetries) {
            console.error('[system-view] System store not found after 5s - giving up');
            return;
          }
          setTimeout(waitForStore, 100);
          return;
        }
        this._setupWatchers();
      };
      waitForStore();
    },

    _setupWatchers() {
      console.log('[system-view] Store ready, setting up watchers...');

      // Watch for data changes to redraw charts
      this.$watch('$store.system.cpuHistory', () => {
        if (this._isVisible()) {
          this.drawAllCharts();
        }
      });

      // Monitor visibility changes using polling (since no 'app' store exists)
      this._visibilityInterval = setInterval(() => {
        const visible = this._isVisible();
        if (visible && !this._viewActive) {
          this._activateView();
        } else if (!visible && this._viewActive) {
          this._deactivateView();
        }
      }, 500);

      // Check initial visibility
      if (this._isVisible()) {
        this._activateView();
      }
    },

    _isVisible() {
      // Check if component element is displayed (x-show sets display:none when hidden)
      return this.$el && this.$el.offsetParent !== null;
    },

    _activateView() {
      if (this._viewActive) return;
      this._viewActive = true;
      console.log('[system-view] Activating...');

      // Activate store (subscribes to MQTT, loads history)
      this.$store.system.activateView();

      // Refresh charts every 5 minutes
      this._refreshInterval = setInterval(() => {
        this.$store.system.loadHistoricalData();
        this.drawAllCharts();
      }, 5 * 60 * 1000);

      // Draw charts after data loads
      this._unwatchLoading = this.$watch('$store.system.loading', (loading) => {
        if (!loading && this.$store.system.cpuHistory.length > 0) {
          this.$nextTick(() => this.drawAllCharts());
        }
      });
    },

    _deactivateView() {
      if (!this._viewActive) return;
      this._viewActive = false;
      console.log('[system-view] Deactivating...');

      if (this._refreshInterval) {
        clearInterval(this._refreshInterval);
        this._refreshInterval = null;
      }
      if (this._unwatchLoading) {
        this._unwatchLoading();
        this._unwatchLoading = null;
      }
      this.$store.system?.deactivateView();
    },

    destroy() {
      this._deactivateView();
      if (this._visibilityInterval) {
        clearInterval(this._visibilityInterval);
        this._visibilityInterval = null;
      }
    },

    // ========================================
    // COMPUTED GETTERS
    // Uses optional chaining since store may not be ready on first render
    // ========================================

    get cpuPercent() {
      const val = this.$store.system?.cpu_percent;
      return val != null ? val.toFixed(1) : '--';
    },

    get cpuTemp() {
      const val = this.$store.system?.cpu_temp;
      return val != null ? val.toFixed(1) : '--';
    },

    get memPercent() {
      const val = this.$store.system?.mem_percent;
      return val != null ? val.toFixed(1) : '--';
    },

    get memUsed() {
      const used = this.$store.system?.mem_used_mb;
      const total = this.$store.system?.mem_total_mb;
      if (used == null || total == null) return '--';
      return `${(used / 1024).toFixed(1)} / ${(total / 1024).toFixed(1)} GB`;
    },

    get fanRpm() {
      const val = this.$store.system?.fan_rpm;
      return val != null ? val : '--';
    },

    get fanPwmPercent() {
      const val = this.$store.system?.fan_pwm_percent;
      return val != null ? val.toFixed(0) : '--';
    },

    get fanState() {
      const state = this.$store.system?.fan_state;
      return state != null ? state : '--';
    },

    get fanStateLabel() {
      const state = this.$store.system?.fan_state;
      if (state == null) return '';
      // Pi 5 cooling states: 0=off, 1=low, 2=medium, 3=high
      const labels = ['Off', 'Low', 'Medium', 'High', 'Max'];
      return labels[state] || `State ${state}`;
    },

    get loadAvg() {
      const load = this.$store.system?.load_1m;
      return load != null ? load.toFixed(2) : '--';
    },

    get lastUpdate() {
      return this.$store.system?.lastUpdateText || 'Waiting for data...';
    },

    get timeRanges() {
      return this.$store.system?.timeRanges || [];
    },

    get selectedRange() {
      return this.$store.system?.selectedRange || '6h';
    },

    get isLoading() {
      return this.$store.system?.loading || false;
    },

    // ========================================
    // ACTIONS
    // ========================================

    async setTimeRange(rangeId) {
      if (!this.$store.system) return;
      await this.$store.system.setTimeRange(rangeId);
      this.$nextTick(() => this.drawAllCharts());
    },

    async refresh() {
      if (!this.$store.system) return;
      await this.$store.system.loadHistoricalData();
      this.drawAllCharts();
    },

    // ========================================
    // CHART DRAWING (Hand-written SVG)
    // Uses innerHTML with trusted numeric data from InfluxDB.
    // This pattern matches hot-water.js chart rendering.
    // ========================================

    drawAllCharts() {
      if (!this.$store.system) return;
      // New design has 2 charts: CPU (Processor card) and Thermal (Temp + Fan State)
      // Memory is now a progress bar, fan RPM shown in metric card only
      // Include threshold bands for warning zones
      this.drawChart('system-cpu-chart', this.$store.system.cpuHistory, '%', '#3b82f6', 0, 100, [
        { min: 70, max: 90, color: '#f59e0b', label: 'High' },    // Warning zone
        { min: 90, max: 100, color: '#ef4444', label: 'Critical' } // Critical zone
      ]);
      // Thermal chart with dual Y-axis: Temperature (left) + Fan State (right)
      this.drawThermalChart(
        'system-temp-chart',
        this.$store.system.tempHistory,
        this.$store.system.fanStateHistory
      );
    },

    /**
     * Draw a line chart with filled area and threshold bands
     * @param {string} svgId - DOM ID of the SVG element
     * @param {Array} data - Array of {time, value} objects (trusted InfluxDB data)
     * @param {string} unit - Y-axis unit label
     * @param {string} color - Line/fill color (hex)
     * @param {number} minVal - Optional fixed min value
     * @param {number} maxVal - Optional fixed max value
     * @param {Array} thresholds - Optional array of {min, max, color, label} for warning bands
     */
    drawChart(svgId, data, unit, color, minVal = null, maxVal = null, thresholds = []) {
      const svg = document.getElementById(svgId);
      if (!svg) return;

      if (!data || data.length === 0) {
        // Safe: static string, no user input
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="14">No data yet</text>';
        return;
      }

      const width = svg.clientWidth || 400;
      const height = svg.clientHeight || 200;
      const padding = { top: 15, right: 15, bottom: 30, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      // Calculate value range from numeric data
      const values = data.map(d => d.value);
      const dataMin = Math.min(...values);
      const dataMax = Math.max(...values);

      // Use fixed or data-driven range
      const yMin = minVal !== null ? minVal : Math.floor(dataMin - (dataMax - dataMin) * 0.1);
      const yMax = maxVal !== null ? maxVal : Math.ceil(dataMax + (dataMax - dataMin) * 0.1);
      const yRange = yMax - yMin || 1;

      // Time range
      const times = data.map(d => d.time);
      const tMin = Math.min(...times);
      const tMax = Math.max(...times);
      const tRange = tMax - tMin || 1;

      // Scale functions
      const xScale = (t) => padding.left + ((t - tMin) / tRange) * chartWidth;
      const yScale = (v) => padding.top + (1 - (v - yMin) / yRange) * chartHeight;

      // Build SVG content from numeric values only
      const svgParts = [];

      // Draw threshold bands FIRST (behind everything)
      for (const threshold of thresholds) {
        const bandTop = yScale(Math.min(threshold.max, yMax));
        const bandBottom = yScale(Math.max(threshold.min, yMin));
        const bandHeight = bandBottom - bandTop;
        if (bandHeight > 0) {
          svgParts.push(`<rect x="${padding.left}" y="${bandTop}" width="${chartWidth}" height="${bandHeight}" fill="${threshold.color}" opacity="0.1"/>`);
        }
      }

      // Grid lines (4 horizontal)
      const ySteps = 4;
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (i / ySteps) * chartHeight;
        const val = yMax - (i / ySteps) * yRange;
        svgParts.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--color-border)" stroke-dasharray="2,2" opacity="0.3"/>`);
        svgParts.push(`<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-secondary)" font-size="12" font-weight="500">${Math.round(val)}</text>`);
      }

      // Draw threshold lines
      for (const threshold of thresholds) {
        const thresholdY = yScale(threshold.min);
        if (thresholdY >= padding.top && thresholdY <= height - padding.bottom) {
          svgParts.push(`<line x1="${padding.left}" y1="${thresholdY}" x2="${width - padding.right}" y2="${thresholdY}" stroke="${threshold.color}" stroke-width="1" stroke-dasharray="4,4" opacity="0.6"/>`);
        }
      }

      // X-axis time labels (show 5 labels max)
      const xLabelCount = Math.min(5, data.length);
      for (let i = 0; i < xLabelCount; i++) {
        const idx = Math.floor(i * (data.length - 1) / (xLabelCount - 1));
        const point = data[idx];
        const x = xScale(point.time);
        const label = this.formatTimeLabel(point.time);
        svgParts.push(`<text x="${x}" y="${height - 8}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="11">${label}</text>`);
      }

      // Build path points (all numeric)
      const linePoints = data.map(d => `${xScale(d.time)},${yScale(d.value)}`).join(' ');

      // Filled area
      const areaPoints = [
        `${xScale(data[0].time)},${yScale(yMin)}`,
        ...data.map(d => `${xScale(d.time)},${yScale(d.value)}`),
        `${xScale(data[data.length - 1].time)},${yScale(yMin)}`
      ].join(' ');

      svgParts.push(`<polygon points="${areaPoints}" fill="${color}" opacity="0.12"/>`);
      svgParts.push(`<polyline points="${linePoints}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`);

      // Current value indicator (larger for kiosk)
      const last = data[data.length - 1];
      svgParts.push(`<circle cx="${xScale(last.time)}" cy="${yScale(last.value)}" r="6" fill="${color}"/>`);
      svgParts.push(`<circle cx="${xScale(last.time)}" cy="${yScale(last.value)}" r="3" fill="white"/>`);

      // Set innerHTML with trusted SVG content (all values are numbers from InfluxDB)
      svg.innerHTML = svgParts.join('');
    },

    /**
     * Draw Thermal chart with dual Y-axis: Temperature (left) + Fan State (right)
     * Fan state: 0=Off, 1=Low, 2=Med, 3=High, 4=Max
     */
    drawThermalChart(svgId, tempData, fanStateData) {
      const svg = document.getElementById(svgId);
      if (!svg) return;

      if (!tempData || tempData.length === 0) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="14">No data yet</text>';
        return;
      }

      const width = svg.clientWidth || 400;
      const height = svg.clientHeight || 200;
      const padding = { top: 15, right: 45, bottom: 30, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      // Temperature Y-axis (left): 40-85°C
      const tempMin = 40, tempMax = 85;
      const tempRange = tempMax - tempMin;
      const tempScale = (v) => padding.top + (1 - (v - tempMin) / tempRange) * chartHeight;

      // Fan State Y-axis (right): 0-4
      const fanMin = 0, fanMax = 4;
      const fanRange = fanMax - fanMin;
      const fanScale = (v) => padding.top + (1 - (v - fanMin) / fanRange) * chartHeight;

      // Time range (from temp data)
      const times = tempData.map(d => d.time);
      const tMin = Math.min(...times);
      const tMax = Math.max(...times);
      const tRange = tMax - tMin || 1;
      const xScale = (t) => padding.left + ((t - tMin) / tRange) * chartWidth;

      const svgParts = [];

      // Threshold bands for temperature
      const thresholds = [
        { min: 60, max: 70, color: '#f59e0b' },  // Warm
        { min: 70, max: 85, color: '#ef4444' }   // Hot
      ];
      for (const threshold of thresholds) {
        const bandTop = tempScale(Math.min(threshold.max, tempMax));
        const bandBottom = tempScale(Math.max(threshold.min, tempMin));
        const bandHeight = bandBottom - bandTop;
        if (bandHeight > 0) {
          svgParts.push(`<rect x="${padding.left}" y="${bandTop}" width="${chartWidth}" height="${bandHeight}" fill="${threshold.color}" opacity="0.1"/>`);
        }
      }

      // Left Y-axis grid lines (Temperature)
      const tempSteps = 4;
      for (let i = 0; i <= tempSteps; i++) {
        const y = padding.top + (i / tempSteps) * chartHeight;
        const val = tempMax - (i / tempSteps) * tempRange;
        svgParts.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--color-border)" stroke-dasharray="2,2" opacity="0.3"/>`);
        svgParts.push(`<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-secondary)" font-size="12" font-weight="500">${Math.round(val)}</text>`);
      }

      // Right Y-axis labels (Fan State)
      const fanLabels = ['OFF', 'LOW', 'MED', 'HIGH', 'MAX'];
      for (let i = 0; i <= fanMax; i++) {
        const y = fanScale(i);
        svgParts.push(`<text x="${width - padding.right + 8}" y="${y + 4}" text-anchor="start" fill="#8b5cf6" font-size="10" font-weight="500">${fanLabels[i]}</text>`);
      }

      // X-axis time labels
      const xLabelCount = Math.min(5, tempData.length);
      for (let i = 0; i < xLabelCount; i++) {
        const idx = Math.floor(i * (tempData.length - 1) / (xLabelCount - 1));
        const point = tempData[idx];
        const x = xScale(point.time);
        const label = this.formatTimeLabel(point.time);
        svgParts.push(`<text x="${x}" y="${height - 8}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="11">${label}</text>`);
      }

      // Temperature filled area and line
      const tempLinePoints = tempData.map(d => `${xScale(d.time)},${tempScale(d.value)}`).join(' ');
      const tempAreaPoints = [
        `${xScale(tempData[0].time)},${tempScale(tempMin)}`,
        ...tempData.map(d => `${xScale(d.time)},${tempScale(d.value)}`),
        `${xScale(tempData[tempData.length - 1].time)},${tempScale(tempMin)}`
      ].join(' ');
      svgParts.push(`<polygon points="${tempAreaPoints}" fill="#ef4444" opacity="0.12"/>`);
      svgParts.push(`<polyline points="${tempLinePoints}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/>`);

      // Fan State step line (if data available)
      if (fanStateData && fanStateData.length > 0) {
        // Draw as step line (since fan state is discrete)
        let fanPathParts = [];
        for (let i = 0; i < fanStateData.length; i++) {
          const d = fanStateData[i];
          const x = xScale(d.time);
          const y = fanScale(d.value);
          if (i === 0) {
            fanPathParts.push(`M ${x} ${y}`);
          } else {
            // Step: horizontal then vertical
            const prevY = fanScale(fanStateData[i - 1].value);
            fanPathParts.push(`H ${x} V ${y}`);
          }
        }
        svgParts.push(`<path d="${fanPathParts.join(' ')}" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-opacity="0.8"/>`);
      }

      // Current value indicators
      const lastTemp = tempData[tempData.length - 1];
      svgParts.push(`<circle cx="${xScale(lastTemp.time)}" cy="${tempScale(lastTemp.value)}" r="6" fill="#ef4444"/>`);
      svgParts.push(`<circle cx="${xScale(lastTemp.time)}" cy="${tempScale(lastTemp.value)}" r="3" fill="white"/>`);

      if (fanStateData && fanStateData.length > 0) {
        const lastFan = fanStateData[fanStateData.length - 1];
        svgParts.push(`<circle cx="${xScale(lastFan.time)}" cy="${fanScale(lastFan.value)}" r="5" fill="#8b5cf6"/>`);
        svgParts.push(`<circle cx="${xScale(lastFan.time)}" cy="${fanScale(lastFan.value)}" r="2" fill="white"/>`);
      }

      svg.innerHTML = svgParts.join('');
    },

    /**
     * Format time for X-axis labels based on range
     */
    formatTimeLabel(timestamp) {
      const date = new Date(timestamp);
      const range = this.$store.system?.currentRange || { minutes: 360 };

      if (range.minutes <= 60) {
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (range.minutes <= 1440) {
        return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
      } else if (range.minutes <= 10080) {
        return date.toLocaleDateString('en-AU', { weekday: 'short' }) + ' ' +
               date.toLocaleTimeString('en-AU', { hour: 'numeric', hour12: true });
      } else {
        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      }
    },

    // ========================================
    // STATUS HELPERS
    // ========================================

    getTempStatus() {
      const temp = this.$store.system?.cpu_temp;
      if (temp == null) return '';
      if (temp >= 70) return 'status-critical';
      if (temp >= 60) return 'status-warning';
      return 'status-ok';
    },

    getCpuStatus() {
      const cpu = this.$store.system?.cpu_percent;
      if (cpu == null) return '';
      if (cpu >= 90) return 'status-critical';
      if (cpu >= 70) return 'status-warning';
      return 'status-ok';
    },

    getMemStatus() {
      const mem = this.$store.system?.mem_percent;
      if (mem == null) return '';
      if (mem >= 90) return 'status-critical';
      if (mem >= 75) return 'status-warning';
      return 'status-ok';
    },

    getFanStatus() {
      const rpm = this.$store.system?.fan_rpm;
      if (rpm == null) return '';
      if (rpm >= 4000) return 'status-warning';
      if (rpm >= 3000) return 'status-active';
      return 'status-ok';
    },

    // ========================================
    // STATUS LABELS (for pills)
    // ========================================

    getCpuStatusLabel() {
      const cpu = this.$store.system?.cpu_percent;
      if (cpu == null) return 'Loading';
      if (cpu >= 90) return 'Critical';
      if (cpu >= 70) return 'High';
      return 'Normal';
    },

    getTempStatusLabel() {
      const temp = this.$store.system?.cpu_temp;
      if (temp == null) return 'Loading';
      if (temp >= 70) return 'Hot';
      if (temp >= 60) return 'Warm';
      return 'Cool';
    },

    getMemStatusLabel() {
      const mem = this.$store.system?.mem_percent;
      if (mem == null) return 'Loading';
      if (mem >= 90) return 'Critical';
      if (mem >= 75) return 'High';
      return 'Normal';
    },

    getFanStatusLabel() {
      const rpm = this.$store.system?.fan_rpm;
      if (rpm == null) return 'Loading';
      if (rpm >= 4000) return 'High';
      if (rpm >= 3000) return 'Active';
      if (rpm > 0) return 'Low';
      return 'Off';
    },

    /**
     * Get temperature status label (deprecated - use getTempStatusLabel)
     */
    getTempLabel() {
      return this.getTempStatusLabel();
    }
  };
}
