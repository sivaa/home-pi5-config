/**
 * CO2 Monitor View
 * Dedicated dashboard view for air quality monitoring
 * Features: Giant gauge, air quality dashboard, history chart, ambient mode
 */

export function co2View() {
  return {
    // ========================================
    // STATE
    // ========================================

    // CO2 Thresholds (ppm)
    thresholds: {
      excellent: 600,
      good: 1000,
      moderate: 1500,
      poor: 2000
    },

    // Chart state
    timeRange: '6h',
    timeRanges: ['15m', '30m', '1h', '3h', '6h', '12h', '24h', '3d', '7d'],
    loading: false,

    // Historical data
    co2History: [],
    tempHistory: [],
    humidHistory: [],

    // Trend
    trendDirection: 'stable',
    trendValue: 0,

    // Ambient mode
    ambientMode: false,

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      // Load historical data on init
      this.loadHistoricalData();

      // Watch for live data changes to recalculate trend
      this.$watch('liveData', () => {
        this.calculateTrend();
      });

      // Keyboard shortcut for ambient mode (press 'a')
      this._keydownHandler = (e) => {
        if (e.key === 'a' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const activeEl = document.activeElement;
          if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
            this.toggleAmbient();
          }
        }
        // Escape to exit ambient mode
        if (e.key === 'Escape' && this.ambientMode) {
          this.ambientMode = false;
        }
      };
      document.addEventListener('keydown', this._keydownHandler);
    },

    /**
     * Cleanup when component is destroyed
     */
    destroy() {
      if (this._keydownHandler) {
        document.removeEventListener('keydown', this._keydownHandler);
      }
    },

    // ========================================
    // GETTERS - Live Data from Sensors Store
    // ========================================

    /**
     * Find CO2 sensor by name pattern
     */
    get co2Sensor() {
      const sensors = this.$store?.sensors;
      if (!sensors?.devices) return null;

      // Look for CO2 sensor (typically named with "CO2" in friendly name)
      return sensors.devices.find(d =>
        d.friendly_name?.toLowerCase().includes('co2') &&
        d.sensorType === 'co2'
      );
    },

    /**
     * Get live data from MQTT for the CO2 sensor
     */
    get liveData() {
      if (!this.co2Sensor) return null;
      return this.$store?.sensors?.getLiveData?.(this.co2Sensor.ieee_address) ?? null;
    },

    /**
     * Current CO2 value in ppm
     */
    get co2Value() {
      return this.liveData?.co2 ?? null;
    },

    /**
     * Current temperature from CO2 sensor
     */
    get temperature() {
      return this.liveData?.temperature ?? null;
    },

    /**
     * Current humidity from CO2 sensor
     */
    get humidity() {
      return this.liveData?.humidity ?? null;
    },

    /**
     * Device-reported air quality (from NOUS E10)
     */
    get deviceAirQuality() {
      return this.liveData?.air_quality ?? null;
    },

    /**
     * Air quality level based on thresholds
     */
    get airQualityLevel() {
      const co2 = this.co2Value;
      if (co2 === null) return 'unknown';
      if (co2 < this.thresholds.excellent) return 'excellent';
      if (co2 < this.thresholds.good) return 'good';
      if (co2 < this.thresholds.moderate) return 'moderate';
      if (co2 < this.thresholds.poor) return 'poor';
      return 'bad';
    },

    /**
     * Color for current air quality level
     */
    get co2Color() {
      const colors = {
        excellent: '#34C759',
        good: '#30D158',
        moderate: '#FFD60A',
        poor: '#FF9500',
        bad: '#FF3B30',
        unknown: '#AEAEB2'
      };
      return colors[this.airQualityLevel];
    },

    /**
     * Gauge arc calculation (SVG stroke-dasharray)
     * Scale: 0-2500 ppm mapped to 0-100%
     */
    get gaugeArc() {
      const maxPPM = 2500;
      const value = Math.min(this.co2Value || 0, maxPPM);
      const percent = value / maxPPM;
      const circumference = 2 * Math.PI * 90;
      return `${percent * circumference} ${circumference}`;
    },

    /**
     * Temperature comfort level
     */
    get tempLevel() {
      const temp = this.temperature;
      if (temp === null) return 'unknown';
      if (temp < 18) return 'cold';
      if (temp < 20) return 'cool';
      if (temp <= 26) return 'comfortable';
      if (temp <= 28) return 'warm';
      return 'hot';
    },

    /**
     * Temperature color
     */
    get tempColor() {
      const colors = {
        cold: '#90CAF9',
        cool: '#A5D6A7',
        comfortable: '#81C784',
        warm: '#FFE082',
        hot: '#EF5350',
        unknown: '#AEAEB2'
      };
      return colors[this.tempLevel];
    },

    /**
     * Humidity comfort level
     */
    get humidityLevel() {
      const h = this.humidity;
      if (h === null) return 'unknown';
      if (h < 30) return 'dry';
      if (h < 40) return 'low';
      if (h <= 60) return 'optimal';
      if (h <= 70) return 'high';
      return 'humid';
    },

    /**
     * Humidity color
     */
    get humidityColor() {
      const colors = {
        dry: '#FFCC80',
        low: '#A5D6A7',
        optimal: '#81C784',
        high: '#90CAF9',
        humid: '#5C6BC0',
        unknown: '#AEAEB2'
      };
      return colors[this.humidityLevel];
    },

    /**
     * Check if sensor data is stale (> 5 min)
     */
    get isStale() {
      if (!this.co2Sensor) return true;
      return this.$store?.sensors?.isStale?.(this.co2Sensor.ieee_address) ?? true;
    },

    /**
     * Trend arrow symbol
     */
    get trendArrow() {
      if (this.trendDirection === 'rising') return '↑';
      if (this.trendDirection === 'falling') return '↓';
      return '→';
    },

    /**
     * Sensor room location
     */
    get sensorRoom() {
      if (!this.co2Sensor) return 'Unknown';
      const name = this.co2Sensor.friendly_name || '';
      // Extract room from name like "[Living] CO2" -> "Living Room"
      const match = name.match(/\[([^\]]+)\]/);
      return match ? match[1] + ' Room' : 'Room';
    },

    // ========================================
    // METHODS - Data Loading
    // ========================================

    /**
     * Load historical data from InfluxDB
     */
    async loadHistoricalData() {
      this.loading = true;

      try {
        const config = this.$store?.config || {};
        const influxUrl = config.influxUrl || `http://${window.location.hostname}:8086`;
        const influxDb = config.influxDb || 'homeassistant';

        // CO2 entity ID pattern (based on Zigbee2MQTT naming)
        // Could be: sensor.living_co2_co2, sensor.0x..._co2, etc.
        // We'll try multiple patterns

        // Load CO2 history
        const co2Query = `SELECT value FROM "ppm" WHERE time > now() - ${this.timeRange} ORDER BY time ASC`;
        this.co2History = await this.queryInflux(influxUrl, influxDb, co2Query);

        // If no ppm measurement, try "co2" measurement
        if (this.co2History.length === 0) {
          const co2Query2 = `SELECT value FROM "co2" WHERE time > now() - ${this.timeRange} ORDER BY time ASC`;
          this.co2History = await this.queryInflux(influxUrl, influxDb, co2Query2);
        }

        // Load temperature history (from CO2 sensor)
        const tempQuery = `SELECT value FROM "°C" WHERE entity_id =~ /co2.*temperature/ AND time > now() - ${this.timeRange} ORDER BY time ASC`;
        this.tempHistory = await this.queryInflux(influxUrl, influxDb, tempQuery);

        // Load humidity history (from CO2 sensor)
        const humidQuery = `SELECT value FROM "%" WHERE entity_id =~ /co2.*humidity/ AND time > now() - ${this.timeRange} ORDER BY time ASC`;
        this.humidHistory = await this.queryInflux(influxUrl, influxDb, humidQuery);

        console.log(`[co2-view] Loaded ${this.co2History.length} CO2, ${this.tempHistory.length} temp, ${this.humidHistory.length} humid points`);

        // Calculate trend from history
        this.calculateTrend();

      } catch (e) {
        console.error('[co2-view] Failed to load historical data:', e);
      }

      this.loading = false;
      await this.$nextTick();
      this.drawChart();
    },

    /**
     * Query InfluxDB and parse results
     */
    async queryInflux(url, db, query) {
      try {
        const fullUrl = `${url}/query?db=${db}&q=${encodeURIComponent(query)}`;
        const response = await fetch(fullUrl);
        const data = await response.json();

        if (data.results?.[0]?.series?.[0]?.values) {
          return data.results[0].series[0].values.map(v => ({
            time: new Date(v[0]).getTime(),
            value: v[1]
          }));
        }
      } catch (e) {
        console.warn('[co2-view] InfluxDB query failed:', e);
      }
      return [];
    },

    /**
     * Change time range and reload data
     */
    async setTimeRange(range) {
      this.timeRange = range;
      await this.loadHistoricalData();
    },

    // ========================================
    // METHODS - Chart Drawing
    // ========================================

    /**
     * Draw SVG chart with threshold zones
     */
    drawChart() {
      const svg = document.getElementById('co2-history-chart');
      if (!svg) return;

      const data = this.co2History;
      if (data.length === 0) {
        svg.innerHTML = '';
        return;
      }

      const width = svg.clientWidth || 700;
      const height = svg.clientHeight || 240;
      const padding = { top: 20, right: 50, bottom: 35, left: 55 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const values = data.map(d => d.value);
      const times = data.map(d => d.time);

      // Fixed scale: 400-2500 ppm to show threshold zones properly
      const minVal = 400;
      const maxVal = 2500;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const valueRange = maxVal - minVal;
      const timeRange = maxTime - minTime || 1;

      let svgContent = '';

      // Draw threshold zone backgrounds
      svgContent += this.drawThresholdZones(padding, chartWidth, chartHeight, minVal, maxVal, valueRange);

      // Grid lines (horizontal)
      const ySteps = 5;
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (i / ySteps) * chartHeight;
        const val = maxVal - (i / ySteps) * valueRange;
        svgContent += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-dasharray="3,3"/>`;
        svgContent += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-tertiary)" font-size="10">${Math.round(val)}</text>`;
      }

      // Grid lines (vertical) - time labels
      const xSteps = Math.min(6, data.length);
      for (let i = 0; i <= xSteps; i++) {
        const x = padding.left + (i / xSteps) * chartWidth;
        const time = new Date(minTime + (i / xSteps) * timeRange);
        const label = this.formatTimeLabel(time);
        svgContent += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#e0e0e0" stroke-dasharray="3,3"/>`;
        svgContent += `<text x="${x}" y="${height - 10}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="10">${label}</text>`;
      }

      // Axis lines
      svgContent += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--color-text-tertiary)"/>`;
      svgContent += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--color-text-tertiary)"/>`;

      // Y-axis label
      svgContent += `<text x="15" y="${height / 2}" transform="rotate(-90, 15, ${height / 2})" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="10">ppm</text>`;

      // Data line
      if (data.length >= 2) {
        const points = data.map(d => {
          const x = padding.left + ((d.time - minTime) / timeRange) * chartWidth;
          const y = padding.top + ((maxVal - d.value) / valueRange) * chartHeight;
          return `${x},${y}`;
        }).join(' ');

        // Area fill
        const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`;
        svgContent += `<polygon fill="#ff6b6b" opacity="0.15" points="${areaPoints}"/>`;

        // Line
        svgContent += `<polyline fill="none" stroke="#ff6b6b" stroke-width="2.5" points="${points}"/>`;

        // Current value dot
        const lastPoint = data[data.length - 1];
        const lastX = padding.left + ((lastPoint.time - minTime) / timeRange) * chartWidth;
        const lastY = padding.top + ((maxVal - lastPoint.value) / valueRange) * chartHeight;
        svgContent += `<circle cx="${lastX}" cy="${lastY}" r="5" fill="#ff6b6b"/>`;
        svgContent += `<circle cx="${lastX}" cy="${lastY}" r="8" fill="none" stroke="#ff6b6b" stroke-width="2" opacity="0.3"/>`;
      }

      svg.innerHTML = svgContent;
    },

    /**
     * Draw threshold zone backgrounds
     */
    drawThresholdZones(padding, chartWidth, chartHeight, minVal, maxVal, valueRange) {
      let zones = '';

      // Define zones from bottom to top
      const zoneData = [
        { min: 0, max: 600, color: 'rgba(52, 199, 89, 0.08)' },      // Excellent
        { min: 600, max: 1000, color: 'rgba(48, 209, 88, 0.06)' },   // Good
        { min: 1000, max: 1500, color: 'rgba(255, 214, 10, 0.08)' }, // Moderate
        { min: 1500, max: 2000, color: 'rgba(255, 149, 0, 0.08)' },  // Poor
        { min: 2000, max: 3000, color: 'rgba(255, 59, 48, 0.08)' }   // Bad
      ];

      for (const zone of zoneData) {
        const y1 = padding.top + ((maxVal - Math.min(zone.max, maxVal)) / valueRange) * chartHeight;
        const y2 = padding.top + ((maxVal - Math.max(zone.min, minVal)) / valueRange) * chartHeight;
        const height = y2 - y1;

        if (height > 0) {
          zones += `<rect x="${padding.left}" y="${y1}" width="${chartWidth}" height="${height}" fill="${zone.color}"/>`;
        }
      }

      // Threshold lines with labels
      const thresholdLines = [
        { value: 600, label: 'Excellent', color: '#34C759' },
        { value: 1000, label: 'Good', color: '#30D158' },
        { value: 1500, label: 'Moderate', color: '#FFD60A' },
        { value: 2000, label: 'Poor', color: '#FF9500' }
      ];

      for (const line of thresholdLines) {
        if (line.value >= minVal && line.value <= maxVal) {
          const y = padding.top + ((maxVal - line.value) / valueRange) * chartHeight;
          zones += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="${line.color}" stroke-width="1" stroke-dasharray="5,5" opacity="0.5"/>`;
        }
      }

      return zones;
    },

    /**
     * Format time label based on range
     */
    formatTimeLabel(time) {
      const hours = parseInt(this.timeRange);
      if (this.timeRange.includes('d')) {
        return time.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      }
      if (hours >= 12) {
        return time.toLocaleTimeString('en-AU', { hour: 'numeric', hour12: true });
      }
      return time.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    },

    // ========================================
    // METHODS - Trend Calculation
    // ========================================

    /**
     * Calculate trend from recent history
     */
    calculateTrend() {
      // Use history data if available, otherwise can't determine trend
      if (this.co2History.length < 5) {
        this.trendDirection = 'stable';
        this.trendValue = 0;
        return;
      }

      // Compare last 10 readings
      const recent = this.co2History.slice(-10);
      const first = recent[0].value;
      const last = recent[recent.length - 1].value;
      const diff = last - first;

      // Threshold for significant change: 50 ppm
      if (diff > 50) {
        this.trendDirection = 'rising';
        this.trendValue = Math.round(diff);
      } else if (diff < -50) {
        this.trendDirection = 'falling';
        this.trendValue = Math.round(Math.abs(diff));
      } else {
        this.trendDirection = 'stable';
        this.trendValue = 0;
      }
    },

    // ========================================
    // METHODS - Stats & Formatting
    // ========================================

    /**
     * Get min/max CO2 values from history
     */
    get minMax() {
      if (this.co2History.length === 0) return { min: '--', max: '--' };
      const values = this.co2History.map(d => d.value);
      return {
        min: Math.round(Math.min(...values)),
        max: Math.round(Math.max(...values))
      };
    },

    /**
     * Get average CO2 from history
     */
    get avgCo2() {
      if (this.co2History.length === 0) return '--';
      const sum = this.co2History.reduce((acc, d) => acc + d.value, 0);
      return Math.round(sum / this.co2History.length);
    },

    /**
     * Format last update time
     */
    formatLastUpdate() {
      const lastUpdate = this.liveData?.lastUpdate;
      if (!lastUpdate) return 'No data';
      const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m ago`;
    },

    /**
     * Get CO2 bar percentage (0-100 for progress bar)
     */
    get co2Percent() {
      const maxPPM = 2500;
      return Math.min(100, ((this.co2Value || 0) / maxPPM) * 100);
    },

    /**
     * Get temperature bar percentage
     */
    get tempPercent() {
      // Scale: 15-35°C
      const temp = this.temperature || 20;
      return Math.min(100, Math.max(0, ((temp - 15) / 20) * 100));
    },

    /**
     * Get humidity bar percentage
     */
    get humidityPercent() {
      return Math.min(100, Math.max(0, this.humidity || 0));
    },

    // ========================================
    // METHODS - Ambient Mode
    // ========================================

    /**
     * Toggle ambient mode
     */
    toggleAmbient() {
      this.ambientMode = !this.ambientMode;
    }
  };
}
