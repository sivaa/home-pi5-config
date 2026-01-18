/**
 * System Metrics Store
 * Alpine.js store for Pi system performance monitoring
 *
 * Data sources:
 * - MQTT: pi/system/metrics (real-time updates every 60s)
 * - InfluxDB: system_metrics (30-day historical data)
 */

export function initSystemStore(Alpine, CONFIG) {
  Alpine.store('system', {
    // ========================================
    // STATE - Live metrics from MQTT
    // ========================================
    cpu_percent: null,
    cpu_temp: null,
    mem_percent: null,
    mem_used_mb: null,
    mem_total_mb: null,
    fan_rpm: null,
    fan_pwm_percent: null,
    fan_state: null,  // Pi 5 cooling state: 0=off, 1=low, 2=medium, 3=high, 4=max
    load_1m: null,
    load_5m: null,
    load_15m: null,
    lastUpdate: null,

    // ========================================
    // STATE - Historical data from InfluxDB
    // ========================================
    cpuHistory: [],
    tempHistory: [],
    memHistory: [],
    fanRpmHistory: [],
    fanStateHistory: [],

    // ========================================
    // STATE - UI controls
    // ========================================
    timeRanges: [
      { id: '15m', label: '15m', minutes: 15, groupBy: '15s' },
      { id: '1h', label: '1h', minutes: 60, groupBy: '1m' },
      { id: '6h', label: '6h', minutes: 360, groupBy: '5m' },
      { id: '24h', label: '24h', minutes: 1440, groupBy: '15m' },
      { id: '7d', label: '7d', minutes: 10080, groupBy: '1h' },
      { id: '30d', label: '30d', minutes: 43200, groupBy: '4h' }
    ],
    selectedRange: '6h',
    loading: false,

    // ========================================
    // INTERNAL - MQTT tracking
    // ========================================
    _mqttSetup: false,
    _unsubscribeMqtt: null,
    viewActive: false,

    // ========================================
    // GETTERS
    // ========================================

    get currentRange() {
      return this.timeRanges.find(r => r.id === this.selectedRange) || this.timeRanges[2];
    },

    get lastUpdateText() {
      if (!this.lastUpdate) return 'Waiting for data...';
      const seconds = Math.floor((Date.now() - this.lastUpdate) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      return `${Math.floor(seconds / 3600)}h ago`;
    },

    // ========================================
    // LIFECYCLE
    // ========================================

    activateView() {
      console.log('[system] View activated');
      this.viewActive = true;
      this.setupMqttListener();
      this.loadHistoricalData();
    },

    deactivateView() {
      console.log('[system] View deactivated');
      this.viewActive = false;
      // Keep MQTT subscription active for data freshness
    },

    // ========================================
    // MQTT SUBSCRIPTION
    // ========================================

    setupMqttListener() {
      if (this._mqttSetup) return;

      let retryCount = 0;
      const maxRetries = 30; // Give up after 60 seconds (30 * 2000ms)

      const checkMqtt = () => {
        const mqtt = Alpine.store('mqtt');
        if (!mqtt?.client || !mqtt.connected) {
          if (++retryCount > maxRetries) {
            console.warn('[system] MQTT connection timeout after 60s - giving up');
            return;
          }
          setTimeout(checkMqtt, 2000);
          return;
        }

        this._mqttSetup = true;
        const topic = 'pi/system/metrics';

        console.log('[system] Subscribing to:', topic);
        mqtt.client.subscribe(topic, { qos: 0 });

        // Use central dispatcher for efficient message handling
        this._unsubscribeMqtt = mqtt.registerTopicHandler(topic, (msgTopic, payload) => {
          this._handleMqttMessage(payload);
        });
      };

      checkMqtt();
    },

    _handleMqttMessage(payload) {
      // Update live values
      this.cpu_percent = payload.cpu_percent;
      this.cpu_temp = payload.cpu_temp;
      this.mem_percent = payload.mem_percent;
      this.mem_used_mb = payload.mem_used_mb;
      this.mem_total_mb = payload.mem_total_mb;
      this.fan_rpm = payload.fan_rpm;
      this.fan_pwm_percent = payload.fan_pwm_percent;
      this.fan_state = payload.fan_state;
      this.load_1m = payload.load_1m;
      this.load_5m = payload.load_5m;
      this.load_15m = payload.load_15m;
      this.lastUpdate = Date.now();

      console.log(
        `[system] MQTT: CPU=${this.cpu_percent}%, Temp=${this.cpu_temp}°C, ` +
        `Mem=${this.mem_percent}%, Fan=${this.fan_rpm}RPM (state=${this.fan_state})`
      );
    },

    // ========================================
    // HISTORICAL DATA LOADING
    // ========================================

    async loadHistoricalData() {
      if (this.loading) return;
      this.loading = true;

      try {
        const config = Alpine.store('config') || {};
        const influxUrl = config.influxUrl || CONFIG?.influxUrl || `http://${window.location.hostname}:8086`;
        const influxDb = config.influxDb || CONFIG?.influxDb || 'homeassistant';

        const range = this.currentRange;
        const groupBy = range.groupBy;

        console.log(`[system] Loading history: ${range.id} (GROUP BY ${groupBy})`);

        // Query all metrics with downsampling
        const query = `
          SELECT
            MEAN(cpu_percent) as cpu_percent,
            MEAN(cpu_temp) as cpu_temp,
            MEAN(mem_percent) as mem_percent,
            MEAN(fan_rpm) as fan_rpm,
            MAX(fan_state) as fan_state
          FROM system_metrics
          WHERE time > now() - ${range.minutes}m
          GROUP BY time(${groupBy}) fill(none)
          ORDER BY time ASC
        `.trim().replace(/\s+/g, ' ');

        const url = `${influxUrl}/query?db=${influxDb}&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`InfluxDB returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        if (data.results?.[0]?.series?.[0]?.values) {
          const values = data.results[0].series[0].values;
          const columns = data.results[0].series[0].columns;

          // Find column indices
          const timeIdx = columns.indexOf('time');
          const cpuIdx = columns.indexOf('cpu_percent');
          const tempIdx = columns.indexOf('cpu_temp');
          const memIdx = columns.indexOf('mem_percent');
          const fanRpmIdx = columns.indexOf('fan_rpm');
          const fanStateIdx = columns.indexOf('fan_state');

          // Parse into separate history arrays
          this.cpuHistory = values
            .filter(v => v[cpuIdx] !== null)
            .map(v => ({ time: new Date(v[timeIdx]).getTime(), value: v[cpuIdx] }));

          this.tempHistory = values
            .filter(v => v[tempIdx] !== null)
            .map(v => ({ time: new Date(v[timeIdx]).getTime(), value: v[tempIdx] }));

          this.memHistory = values
            .filter(v => v[memIdx] !== null)
            .map(v => ({ time: new Date(v[timeIdx]).getTime(), value: v[memIdx] }));

          this.fanRpmHistory = values
            .filter(v => v[fanRpmIdx] !== null)
            .map(v => ({ time: new Date(v[timeIdx]).getTime(), value: v[fanRpmIdx] }));

          this.fanStateHistory = values
            .filter(v => v[fanStateIdx] !== null)
            .map(v => ({ time: new Date(v[timeIdx]).getTime(), value: v[fanStateIdx] }));

          console.log(
            `[system] Loaded history: CPU=${this.cpuHistory.length}, ` +
            `Temp=${this.tempHistory.length}, Mem=${this.memHistory.length}, ` +
            `FanRPM=${this.fanRpmHistory.length}, FanState=${this.fanStateHistory.length} points`
          );
        } else {
          console.log('[system] No historical data found');
          this.cpuHistory = [];
          this.tempHistory = [];
          this.memHistory = [];
          this.fanRpmHistory = [];
          this.fanStateHistory = [];
        }

      } catch (e) {
        console.error('[system] Failed to load history:', e);
      }

      this.loading = false;
    },

    async setTimeRange(rangeId) {
      this.selectedRange = rangeId;
      await this.loadHistoricalData();
    },

    // ========================================
    // CLEANUP
    // ========================================

    cleanup() {
      if (this._unsubscribeMqtt) {
        this._unsubscribeMqtt();
        this._unsubscribeMqtt = null;
      }
      this._mqttSetup = false;
    }
  });
}
