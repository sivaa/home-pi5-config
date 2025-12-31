/**
 * Activity Logs Store
 * Captures ALL MQTT messages for debugging, audit, and pattern analysis
 */

export function initLogsStore(Alpine, CONFIG) {
  Alpine.store('logs', {
    // ============================================
    // DATA - O(1) Circular Buffer Implementation
    // ============================================
    // Internal circular buffer storage
    _buffer: [],
    _head: 0,       // Next write position
    _count: 0,      // Items in buffer
    maxLogs: 1000,  // Buffer capacity

    // Previous state for change detection
    previousState: {},  // device -> { values, timestamp }

    // Anomaly thresholds (user-configurable via localStorage)
    thresholds: {
      tempDelta: 3,           // °C change to flag as anomaly
      tempDeltaWindow: 600000, // 10 minutes in ms
      doorOpenDuration: 1800000, // 30 minutes in ms
      co2Warning: 1200,       // ppm
      co2Critical: 1500,      // ppm
      lowBattery: 20          // %
    },

    // ============================================
    // FILTERS
    // ============================================
    filters: {
      timeRange: 'live',      // live|1h|6h|24h
      categories: [],         // Multi-select: climate, contact, motion, thermostat, light, plug, system
      devices: [],            // Specific device names
      search: '',             // Text search
      anomaliesOnly: false,   // Show only flagged entries
      severities: []          // error, warning, info
    },

    // ============================================
    // UI STATE
    // ============================================
    paused: false,
    loading: false,
    expandedLogId: null,      // Currently expanded log entry

    // ============================================
    // CATEGORY DEFINITIONS
    // ============================================
    categories: {
      climate: { icon: '🌡️', label: 'Climate', color: '#22c55e' },
      contact: { icon: '🚪', label: 'Doors/Windows', color: '#3b82f6' },
      motion: { icon: '👁️', label: 'Motion', color: '#f59e0b' },
      thermostat: { icon: '🔥', label: 'Thermostat', color: '#ef4444' },
      light: { icon: '💡', label: 'Lights', color: '#fbbf24' },
      plug: { icon: '🔌', label: 'Plugs', color: '#8b5cf6' },
      tts: { icon: '🔊', label: 'TTS Notifications', color: '#ec4899' },
      system: { icon: '📡', label: 'System', color: '#6b7280' },
      command: { icon: '🎮', label: 'Commands', color: '#06b6d4' }
    },

    // ============================================
    // INITIALIZATION
    // ============================================
    init() {
      // Pre-allocate buffer for O(1) operations
      this._buffer = new Array(this.maxLogs).fill(null);
      this._head = 0;
      this._count = 0;

      // Load saved thresholds from localStorage
      const saved = localStorage.getItem('logs-thresholds');
      if (saved) {
        try {
          Object.assign(this.thresholds, JSON.parse(saved));
        } catch (e) {
          console.warn('Failed to parse saved thresholds:', e);
        }
      }
    },

    // ============================================
    // CIRCULAR BUFFER ACCESSORS
    // ============================================

    // O(1) insert at head of buffer
    addLog(entry) {
      this._buffer[this._head] = entry;
      this._head = (this._head + 1) % this.maxLogs;
      if (this._count < this.maxLogs) this._count++;
    },

    // Get logs in display order (newest first) - O(n) but only on read
    get logs() {
      if (this._count === 0) return [];

      const result = [];
      for (let i = 0; i < this._count; i++) {
        // Read backwards from head (newest to oldest)
        const idx = (this._head - 1 - i + this.maxLogs) % this.maxLogs;
        if (this._buffer[idx]) result.push(this._buffer[idx]);
      }
      return result;
    },

    // Setter for bulk operations (loadHistorical, clearLogs)
    set logs(newLogs) {
      // Reset buffer
      this._buffer = new Array(this.maxLogs).fill(null);
      this._head = 0;
      this._count = 0;

      // Add logs in reverse order (oldest first) so newest ends up at head
      const toAdd = newLogs.slice(0, this.maxLogs).reverse();
      for (const log of toAdd) {
        this.addLog(log);
      }
    },

    // ============================================
    // MESSAGE CAPTURE (Called from mqtt-store)
    // ============================================
    captureMessage(topic, payload) {
      if (this.paused) return;

      // Filter out bridge noise
      if (topic.includes('/bridge/')) return;

      // Generate log entry
      const entry = this.createLogEntry(topic, payload);
      if (!entry) return;

      // Check for anomalies
      entry.isAnomaly = this.detectAnomaly(entry);

      // O(1) circular buffer insert (replaces O(n) unshift/pop)
      this.addLog(entry);

      // Update previous state for change detection
      this.previousState[entry.device] = {
        values: { ...entry.values },
        timestamp: entry.timestamp
      };
    },

    // ============================================
    // LOG ENTRY CREATION
    // ============================================
    createLogEntry(topic, payload) {
      const timestamp = Date.now();
      const device = topic.replace('zigbee2mqtt/', '').replace('dashboard/', '');
      const roomId = this.extractRoomId(device);
      const category = this.detectCategory(device, payload);
      const eventType = this.detectEventType(payload);
      const severity = this.detectSeverity(payload, category);

      // Extract meaningful values
      const values = {
        temperature: payload.temperature,
        humidity: payload.humidity,
        co2: payload.co2,
        contact: payload.contact,
        occupancy: payload.occupancy,
        battery: payload.battery,
        state: payload.state,
        linkquality: payload.linkquality,
        // Thermostat-specific
        localTemperature: payload.local_temperature,
        targetTemperature: payload.occupied_heating_setpoint,
        runningState: payload.running_state,
        systemMode: payload.system_mode
      };

      // Clean undefined values
      Object.keys(values).forEach(key => {
        if (values[key] === undefined) delete values[key];
      });

      return {
        id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        source: 'mqtt',
        topic,
        device,
        category,
        eventType,
        severity,
        payload,
        values,
        roomId,
        isAnomaly: false
      };
    },

    // ============================================
    // DETECTION HELPERS
    // ============================================
    extractRoomId(device) {
      const match = device.match(/^\[([^\]]+)\]/);
      return match ? match[1].toLowerCase() : 'unknown';
    },

    detectCategory(device, payload) {
      // Check for TTS notifications (from dashboard/tts topic)
      if (device === 'tts' || payload.event === 'tts_call') {
        return 'tts';
      }

      // Check for thermostat
      if (payload.local_temperature !== undefined ||
          payload.running_state !== undefined ||
          device.toLowerCase().includes('thermostat')) {
        return 'thermostat';
      }

      // Check for contact sensor
      if (payload.contact !== undefined) {
        return 'contact';
      }

      // Check for motion sensor
      if (payload.occupancy !== undefined) {
        return 'motion';
      }

      // Check for CO2 sensor
      if (payload.co2 !== undefined) {
        return 'climate';  // CO2 is part of climate category
      }

      // Check for light
      if (payload.brightness !== undefined ||
          device.toLowerCase().includes('light')) {
        return 'light';
      }

      // Check for plug
      if (device.toLowerCase().includes('plug') ||
          (payload.state !== undefined && !payload.brightness && !payload.temperature)) {
        return 'plug';
      }

      // Check for climate sensor
      if (payload.temperature !== undefined || payload.humidity !== undefined) {
        return 'climate';
      }

      // Check for availability
      if (payload.state === 'online' || payload.state === 'offline') {
        return 'system';
      }

      // Check for commands
      if (device.startsWith('audit/')) {
        return 'command';
      }

      return 'system';
    },

    detectEventType(payload) {
      // Availability
      if (payload.state === 'online' || payload.state === 'offline') {
        return 'availability';
      }

      // State changes (light/plug on/off)
      if (payload.state === 'ON' || payload.state === 'OFF') {
        return 'state_change';
      }

      // Contact state
      if (payload.contact !== undefined) {
        return 'state_change';
      }

      // Motion
      if (payload.occupancy !== undefined) {
        return 'state_change';
      }

      // Thermostat state changes
      if (payload.running_state !== undefined) {
        return 'state_change';
      }

      // Default to reading
      return 'reading';
    },

    detectSeverity(payload, category) {
      // Error conditions
      if (payload.state === 'offline') return 'error';
      if (payload.battery !== undefined && payload.battery < 10) return 'error';

      // Warning conditions
      if (payload.battery !== undefined && payload.battery < this.thresholds.lowBattery) return 'warning';
      if (payload.co2 !== undefined && payload.co2 >= this.thresholds.co2Critical) return 'error';
      if (payload.co2 !== undefined && payload.co2 >= this.thresholds.co2Warning) return 'warning';
      if (payload.contact === false) return 'warning';  // Door/window open

      // Success conditions
      if (payload.state === 'online') return 'success';

      return 'info';
    },

    // ============================================
    // ANOMALY DETECTION
    // ============================================
    detectAnomaly(entry) {
      // Always flag errors
      if (entry.severity === 'error') return true;

      // Temperature rapid change
      if (entry.values.temperature !== undefined) {
        const prev = this.previousState[entry.device];
        if (prev && prev.values.temperature !== undefined) {
          const delta = Math.abs(entry.values.temperature - prev.values.temperature);
          const timeDiff = entry.timestamp - prev.timestamp;
          if (delta >= this.thresholds.tempDelta && timeDiff <= this.thresholds.tempDeltaWindow) {
            return true;
          }
        }
      }

      // High CO2
      if (entry.values.co2 !== undefined && entry.values.co2 >= this.thresholds.co2Critical) {
        return true;
      }

      // Low battery
      if (entry.values.battery !== undefined && entry.values.battery < this.thresholds.lowBattery) {
        return true;
      }

      return false;
    },

    // ============================================
    // FILTERING
    // ============================================
    get filteredLogs() {
      let result = this.logs;

      // Time range filter (for live, show all in buffer)
      if (this.filters.timeRange !== 'live') {
        const now = Date.now();
        const hours = {
          '1h': 1,
          '6h': 6,
          '24h': 24
        }[this.filters.timeRange] || 24;
        const cutoff = now - (hours * 60 * 60 * 1000);
        result = result.filter(log => log.timestamp >= cutoff);
      }

      // Category filter
      if (this.filters.categories.length > 0) {
        result = result.filter(log => this.filters.categories.includes(log.category));
      }

      // Device filter
      if (this.filters.devices.length > 0) {
        result = result.filter(log => this.filters.devices.includes(log.device));
      }

      // Severity filter
      if (this.filters.severities.length > 0) {
        result = result.filter(log => this.filters.severities.includes(log.severity));
      }

      // Anomalies only
      if (this.filters.anomaliesOnly) {
        result = result.filter(log => log.isAnomaly);
      }

      // Search filter
      if (this.filters.search) {
        const search = this.filters.search.toLowerCase();
        result = result.filter(log =>
          log.device.toLowerCase().includes(search) ||
          log.topic.toLowerCase().includes(search) ||
          JSON.stringify(log.values).toLowerCase().includes(search)
        );
      }

      return result;
    },

    // ============================================
    // STATISTICS
    // ============================================
    get stats() {
      const logs = this.filteredLogs;
      const now = Date.now();
      const oneHourAgo = now - 3600000;

      // Count by category
      const byCategory = {};
      Object.keys(this.categories).forEach(cat => byCategory[cat] = 0);
      logs.forEach(log => {
        if (byCategory[log.category] !== undefined) {
          byCategory[log.category]++;
        }
      });

      // Count by device (top 5)
      const byDevice = {};
      logs.forEach(log => {
        byDevice[log.device] = (byDevice[log.device] || 0) + 1;
      });
      const topDevices = Object.entries(byDevice)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Messages per hour (last 6 hours, bucketed by hour)
      const hourlyBuckets = Array(6).fill(0);
      logs.forEach(log => {
        const hoursAgo = Math.floor((now - log.timestamp) / 3600000);
        if (hoursAgo < 6) {
          hourlyBuckets[hoursAgo]++;
        }
      });

      // Error/warning counts
      const errors = logs.filter(log => log.severity === 'error').length;
      const warnings = logs.filter(log => log.severity === 'warning').length;
      const anomalies = logs.filter(log => log.isAnomaly).length;

      return {
        total: logs.length,
        lastHour: logs.filter(log => log.timestamp >= oneHourAgo).length,
        byCategory,
        topDevices,
        hourlyBuckets: hourlyBuckets.reverse(),  // Oldest to newest
        errors,
        warnings,
        anomalies
      };
    },

    // ============================================
    // AVAILABLE FILTERS
    // ============================================
    get availableDevices() {
      const devices = new Set(this.logs.map(log => log.device));
      return [...devices].sort();
    },

    get availableRooms() {
      const rooms = new Set(this.logs.map(log => log.roomId).filter(r => r !== 'unknown'));
      return [...rooms].sort();
    },

    // ============================================
    // FILTER ACTIONS
    // ============================================
    toggleCategory(category) {
      const idx = this.filters.categories.indexOf(category);
      if (idx === -1) {
        this.filters.categories.push(category);
      } else {
        this.filters.categories.splice(idx, 1);
      }
    },

    toggleSeverity(severity) {
      const idx = this.filters.severities.indexOf(severity);
      if (idx === -1) {
        this.filters.severities.push(severity);
      } else {
        this.filters.severities.splice(idx, 1);
      }
    },

    setTimeRange(range) {
      this.filters.timeRange = range;
      if (range !== 'live') {
        this.loadHistorical(parseInt(range) || 24);
      }
    },

    setSearch(query) {
      this.filters.search = query;
    },

    clearFilters() {
      this.filters.timeRange = 'live';
      this.filters.categories = [];
      this.filters.devices = [];
      this.filters.search = '';
      this.filters.anomaliesOnly = false;
      this.filters.severities = [];
    },

    // ============================================
    // HISTORICAL DATA (InfluxDB)
    // ============================================
    async loadHistorical(hours = 24) {
      // Prevent race conditions from multiple rapid clicks (Bug #7)
      if (this.loading) return;

      this.loading = true;
      const wasPaused = this.paused;
      this.paused = true;  // Pause live capture during historical load (Bug #4)

      try {
        // Query multiple measurements in parallel
        const [events, temps, humidity, co2, tts] = await Promise.all([
          this.queryInflux(`SELECT * FROM zigbee_events WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT 1000`),
          this.queryInflux(`SELECT * FROM "°C" WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT 500`),
          this.queryInflux(`SELECT * FROM "%" WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT 500`),
          this.queryInflux(`SELECT * FROM ppm WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT 200`),
          this.queryInflux(`SELECT * FROM tts_events WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT 100`)
        ]);

        // Convert to log entries
        const historicalLogs = [
          ...this.convertEventsToLogs(events),
          ...this.convertReadingsToLogs(temps, 'temperature', '°C'),
          ...this.convertReadingsToLogs(humidity, 'humidity', '%'),
          ...this.convertReadingsToLogs(co2, 'co2', 'ppm'),
          ...this.convertTTSToLogs(tts)
        ];

        // Deduplicate using both ID and device+timestamp (Bug #1, #3)
        const existingIds = new Set(this.logs.map(log => log.id));
        const existingDeviceTimestamps = new Set(
          this.logs.map(log => `${log.device}:${log.timestamp}`)
        );

        const uniqueHistorical = historicalLogs.filter(log =>
          !existingIds.has(log.id) &&
          !existingDeviceTimestamps.has(`${log.device}:${log.timestamp}`)
        );

        // Merge and re-sort to maintain DESC order (Bug #5, #8)
        this.logs = [...this.logs, ...uniqueHistorical]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, this.maxLogs);

        console.log(`📊 Loaded ${uniqueHistorical.length} historical entries`);
      } catch (err) {
        console.error('Failed to load historical logs:', err);
      } finally {
        this.loading = false;
        this.paused = wasPaused;  // Restore pause state
      }
    },

    async queryInflux(query) {
      try {
        const url = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();
        return data.results?.[0]?.series?.[0] || null;
      } catch (e) {
        console.warn('InfluxDB query failed:', e);
        return null;
      }
    },

    convertEventsToLogs(series) {
      if (!series) return [];
      const columns = series.columns;
      const values = series.values || [];

      return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => obj[col] = row[idx]);

        return {
          id: `hist-${new Date(obj.time).getTime()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(obj.time).getTime(),
          source: 'history',
          topic: '',
          device: obj.device_name || 'unknown',
          category: obj.device_type || 'system',
          eventType: obj.event_type || 'state_change',
          severity: 'info',
          payload: null,
          values: { state: obj.state, value: obj.value },
          roomId: obj.room || 'unknown',
          isAnomaly: false
        };
      });
    },

    convertReadingsToLogs(series, valueKey, unit) {
      if (!series) return [];
      const columns = series.columns;
      const values = series.values || [];

      return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => obj[col] = row[idx]);

        const value = obj.value !== undefined ? obj.value : obj[valueKey];
        const device = obj.entity_id || obj.device || 'sensor';

        return {
          id: `hist-${new Date(obj.time).getTime()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(obj.time).getTime(),
          source: 'history',
          topic: '',
          device,
          category: 'climate',
          eventType: 'reading',
          severity: 'info',
          payload: null,
          values: { [valueKey]: value },
          roomId: this.extractRoomId(device),
          isAnomaly: false
        };
      });
    },

    convertTTSToLogs(series) {
      if (!series) return [];
      const columns = series.columns;
      const values = series.values || [];

      return values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => obj[col] = row[idx]);

        // Parse devices JSON if present
        let devices = [];
        try {
          devices = obj.devices_json ? JSON.parse(obj.devices_json) : [];
        } catch (e) {
          devices = [];
        }

        // Determine severity from status tag
        let severity = 'info';
        if (obj.status === 'all_failed') severity = 'error';
        else if (obj.status === 'partial') severity = 'warning';

        return {
          id: `tts-${new Date(obj.time).getTime()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(obj.time).getTime(),
          source: 'history',
          topic: 'dashboard/tts',
          device: 'tts',
          category: 'tts',
          eventType: 'tts_call',
          severity,
          payload: {
            message: obj.message,
            devices,
            success: obj.success,
            all_available: obj.all_available,
            automation: obj.automation
          },
          values: {
            message: obj.message,
            devicesAvailable: obj.devices_available,
            devicesTotal: obj.devices_total
          },
          roomId: 'system',
          isAnomaly: obj.status === 'all_failed'
        };
      });
    },

    // ============================================
    // UTILITY
    // ============================================
    clearLogs() {
      // Reset circular buffer
      this._buffer = new Array(this.maxLogs).fill(null);
      this._head = 0;
      this._count = 0;
      this.previousState = {};
    },

    togglePause() {
      this.paused = !this.paused;
    },

    expandLog(id) {
      this.expandedLogId = this.expandedLogId === id ? null : id;
    },

    saveThresholds() {
      localStorage.setItem('logs-thresholds', JSON.stringify(this.thresholds));
    },

    // Format timestamp for display
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      return date.toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
    },

    // Format relative time
    formatRelativeTime(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    // Get severity color
    getSeverityColor(severity) {
      const colors = {
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        success: '#22c55e'
      };
      return colors[severity] || colors.info;
    },

    // Format log values for display
    formatValues(values) {
      const parts = [];
      if (values.temperature !== undefined) parts.push(`${values.temperature.toFixed(1)}°C`);
      if (values.humidity !== undefined) parts.push(`${values.humidity}%`);
      if (values.co2 !== undefined) parts.push(`${values.co2}ppm`);
      if (values.battery !== undefined) parts.push(`🔋${values.battery}%`);
      if (values.contact !== undefined) parts.push(values.contact ? 'closed' : 'open');
      if (values.occupancy !== undefined) parts.push(values.occupancy ? 'motion' : 'clear');
      if (values.state !== undefined) parts.push(values.state);
      if (values.runningState !== undefined) parts.push(values.runningState);
      if (values.targetTemperature !== undefined) parts.push(`→${values.targetTemperature}°C`);
      if (values.linkquality !== undefined) parts.push(`📶${values.linkquality}`);
      return parts.join(' | ') || 'no values';
    }
  });
}
