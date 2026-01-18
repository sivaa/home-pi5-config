/**
 * Device Health Store
 * Monitors health status of ALL Zigbee devices (39 total)
 * Identifies dead/stale devices based on last_seen timestamps
 *
 * Data sources:
 * - zigbee2mqtt/bridge/devices: Full device list with metadata
 * - zigbee2mqtt/{device}: Live data updates (battery, linkquality, values)
 */

// Health status thresholds (milliseconds)
const HEALTH_THRESHOLDS = {
  ok: 15 * 60 * 1000,           // < 15 minutes
  warning: 60 * 60 * 1000,      // 15min - 1hr
  critical: 6 * 60 * 60 * 1000  // 1hr - 6hr
  // > 6hr = dead
};

// Device type definitions with icons
const DEVICE_TYPES = {
  coordinator: { icon: '📡', label: 'Coordinator', color: '#ff6b6b' },
  climate: { icon: '🌡️', label: 'Temperature', color: '#22c55e' },
  contact: { icon: '🚪', label: 'Door/Window', color: '#3b82f6' },
  thermostat: { icon: '🔥', label: 'Thermostat', color: '#ef4444' },
  plug: { icon: '🔌', label: 'Smart Plug', color: '#8b5cf6' },
  light: { icon: '💡', label: 'Light', color: '#fbbf24' },
  remote: { icon: '🎛️', label: 'Remote', color: '#6b7280' },
  co2: { icon: '💨', label: 'CO2', color: '#06b6d4' },
  motion: { icon: '👁️', label: 'Motion', color: '#f59e0b' },
  vibration: { icon: '💧', label: 'Vibration', color: '#ec4899' },
  unknown: { icon: '❓', label: 'Unknown', color: '#9ca3af' }
};

// Define which fields count as "meaningful data" per device type
// Messages with ONLY linkquality/battery don't count as meaningful data
const MEANINGFUL_DATA_FIELDS = {
  climate: ['temperature', 'humidity'],
  contact: ['contact'],
  motion: ['occupancy'],
  thermostat: ['local_temperature', 'running_state', 'occupied_heating_setpoint'],
  plug: ['state', 'power'],
  light: ['state', 'brightness'],
  co2: ['co2'],
  vibration: ['vibration'],
  remote: ['action'],
  coordinator: []  // Coordinator never sends meaningful data
};

/**
 * Determine device type from Zigbee2MQTT device definition
 * Expanded from sensors-store.js pattern to cover ALL device types
 */
function getDeviceType(device) {
  // Coordinator is special
  if (device.type === 'Coordinator') return 'coordinator';

  // Use exposes metadata for accurate detection
  const exposes = device.definition?.exposes || [];
  const features = exposes.flatMap(e => e.features || [e]);
  const featureNames = features.map(f => f.name);

  // Priority order: most specific first
  if (featureNames.includes('co2')) return 'co2';
  if (featureNames.includes('occupancy')) return 'motion';
  if (featureNames.includes('vibration')) return 'vibration';  // Check before contact (vibration sensors also have contact)
  if (featureNames.includes('contact')) return 'contact';
  if (featureNames.includes('action')) return 'remote';  // Button presses

  // Thermostat: has both local_temperature AND heating setpoint
  if (featureNames.includes('local_temperature') &&
      featureNames.includes('occupied_heating_setpoint')) return 'thermostat';

  // Light: has brightness control
  if (featureNames.includes('brightness')) return 'light';

  // Plug: has power/energy monitoring
  if (featureNames.includes('power') || featureNames.includes('energy')) return 'plug';

  // Climate: temperature or humidity sensors
  if (featureNames.includes('temperature') || featureNames.includes('humidity')) return 'climate';

  return 'unknown';
}

/**
 * Extract room name from [Room] Device Name pattern
 */
function extractRoom(friendlyName) {
  const match = friendlyName?.match(/^\[([^\]]+)\]/);
  return match ? match[1] : 'Unknown';
}

/**
 * Initialize the device health store
 */
export function initDeviceHealthStore(Alpine, CONFIG) {
  Alpine.store('deviceHealth', {
    // All devices from zigbee2mqtt/bridge/devices (unfiltered)
    devices: [],

    // Health data per device: { [ieee]: { lastSeen, battery, linkquality, values, healthStatus } }
    healthData: {},

    // Debounced batch updates for performance (5-second window)
    _pendingUpdates: {},
    _updateTimer: null,

    // Filters
    filters: {
      types: [],      // Empty = all types
      statuses: [],   // Empty = all statuses: ['ok', 'warning', 'critical', 'dead']
      search: ''      // Device name search
    },

    // Sorting
    sortBy: 'health',    // 'health' | 'name' | 'type' | 'lastSeen' | 'battery'
    sortAsc: false,      // false = worst first for health

    // UI state
    loading: true,
    viewActive: false,   // Track if view is visible (for ticker optimization)
    refreshInterval: null,

    // ==========================================
    // INITIALIZATION
    // ==========================================

    /**
     * Initialize store - call after MQTT connected
     */
    init() {
      const mqttStore = Alpine.store('mqtt');

      // Wait for MQTT connection
      if (!mqttStore.client) {
        setTimeout(() => this.init(), 100);
        return;
      }

      this.subscribeToTopics(mqttStore, CONFIG);
      console.log('[device-health] Store initialized');
    },

    /**
     * Subscribe to required MQTT topics
     */
    subscribeToTopics(mqttStore, CONFIG) {
      // Device discovery (retained message)
      mqttStore.client.subscribe('zigbee2mqtt/bridge/devices', { qos: 1 });

      // Handle device list
      mqttStore.registerTopicHandler('zigbee2mqtt/bridge/devices', (topic, data) => {
        this.handleDeviceList(data);
      });

      // Handle live device data (already subscribed via mqtt-store wildcard)
      mqttStore.registerTopicHandler(`${CONFIG.baseTopic}/*`, (topic, data, deviceName) => {
        this.updateDeviceHealth(deviceName, data);
      });

      console.log('[device-health] Subscribed to device list and updates');
    },

    // ==========================================
    // VIEW LIFECYCLE
    // ==========================================

    /**
     * Called when device-health view mounts
     */
    activateView() {
      this.viewActive = true;
      this.startRefreshTicker();
      this.recalculateAllHealth();  // Recalculate status from fresh timestamps

      // Trigger Alpine reactivity by creating new object reference
      // Data was kept fresh while inactive, now UI needs to render it
      this.healthData = { ...this.healthData };

      console.log('[device-health] View activated');
    },

    /**
     * Called when device-health view unmounts
     */
    deactivateView() {
      this.viewActive = false;
      this.stopRefreshTicker();

      // Clear pending update timer
      if (this._updateTimer) {
        clearTimeout(this._updateTimer);
        this._updateTimer = null;
      }

      // Flush any pending updates before deactivating
      this._flushUpdates();

      console.log('[device-health] View deactivated');
    },

    /**
     * Start 30-second refresh ticker for relative time updates
     */
    startRefreshTicker() {
      if (this.refreshInterval) return;  // Already running

      this.refreshInterval = setInterval(() => {
        if (!this.viewActive) return;  // Safety check
        this.recalculateAllHealth();
      }, 30000);
    },

    /**
     * Stop refresh ticker
     */
    stopRefreshTicker() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    },

    // ==========================================
    // DEVICE LIST HANDLING
    // ==========================================

    /**
     * Handle device list from zigbee2mqtt/bridge/devices
     * Unlike sensors-store, we include ALL devices (no filtering)
     */
    handleDeviceList(devices) {
      // Process ALL devices
      this.devices = devices.map(device => {
        const deviceType = getDeviceType(device);
        const typeInfo = DEVICE_TYPES[deviceType] || DEVICE_TYPES.unknown;

        return {
          ieee_address: device.ieee_address,
          friendly_name: device.friendly_name,
          type: deviceType,
          typeInfo: typeInfo,
          room: extractRoom(device.friendly_name),
          model: device.definition?.model || 'Unknown',
          vendor: device.definition?.vendor || 'Unknown',
          networkType: device.type,  // Coordinator, Router, EndDevice
          isRouter: device.type === 'Router' || device.type === 'Coordinator'
        };
      });

      // Initialize health data for all devices
      this.devices.forEach(device => {
        if (!this.healthData[device.ieee_address]) {
          this.healthData[device.ieee_address] = {
            lastSeen: null,
            lastDataTime: null,  // When meaningful data VALUES last changed
            previousValues: {},  // Track previous values to detect changes
            battery: null,
            linkquality: null,
            values: {},
            healthStatus: 'unknown',
            lastSeenRelative: 'Never'
          };
        }
      });

      this.loading = false;
      console.log(`[device-health] Loaded ${this.devices.length} devices`);

      // Calculate initial health status
      this.recalculateAllHealth();
    },

    // ==========================================
    // LIVE DATA UPDATES
    // ==========================================

    /**
     * Update health data for a device
     * Data is ALWAYS updated (keeps timestamps fresh)
     * UI batching only happens when view is active
     */
    updateDeviceHealth(deviceName, data) {
      const device = this.devices.find(d => d.friendly_name === deviceName);
      if (!device) return;

      const ieee = device.ieee_address;
      const health = this.healthData[ieee] || {
        lastSeen: null,
        lastDataTime: null,
        previousValues: {},
        battery: null,
        linkquality: null,
        values: {},
        healthStatus: 'unknown',
        lastSeenRelative: 'Never'
      };

      // Update lastSeen (any communication)
      const now = Date.now();
      if (data.last_seen) {
        health.lastSeen = typeof data.last_seen === 'number'
          ? data.last_seen
          : new Date(data.last_seen).getTime();
      } else {
        // Any message counts as "seen"
        health.lastSeen = now;
      }

      // Update metrics
      if (data.battery !== undefined) health.battery = data.battery;
      if (data.linkquality !== undefined) health.linkquality = data.linkquality;

      // Update values (for display)
      const values = {};
      if (data.temperature !== undefined) values.temperature = data.temperature;
      if (data.humidity !== undefined) values.humidity = data.humidity;
      if (data.co2 !== undefined) values.co2 = data.co2;
      if (data.contact !== undefined) values.contact = data.contact;
      if (data.occupancy !== undefined) values.occupancy = data.occupancy;
      if (data.state !== undefined) values.state = data.state;
      if (data.local_temperature !== undefined) values.localTemp = data.local_temperature;
      if (data.occupied_heating_setpoint !== undefined) values.targetTemp = data.occupied_heating_setpoint;
      if (data.running_state !== undefined) values.runningState = data.running_state;
      if (data.power !== undefined) values.power = data.power;

      if (Object.keys(values).length > 0) {
        health.values = { ...health.values, ...values };
      }

      // Check if meaningful data VALUES have CHANGED (not just present in message)
      // This distinguishes actual data updates from heartbeats that repeat the same values
      const meaningfulFields = MEANINGFUL_DATA_FIELDS[device.type] || [];
      let dataChanged = false;

      // Ensure previousValues exists
      if (!health.previousValues) {
        health.previousValues = {};
      }

      for (const field of meaningfulFields) {
        if (data.hasOwnProperty(field) && data[field] !== undefined) {
          const newValue = data[field];
          const prevValue = health.previousValues[field];

          // Check if value is different from previous (or first time seeing it)
          if (prevValue === undefined || prevValue !== newValue) {
            dataChanged = true;
          }
          health.previousValues[field] = newValue;  // Store for next comparison
        }
      }

      // Only update lastDataTime when values actually CHANGED
      // IMPORTANT: Use Z2M's last_seen timestamp for consistency with lastSeen
      // (fixes bug where DATA appeared more recent than SEEN due to using `now`)
      if (dataChanged) {
        if (data.last_seen) {
          const msgLastSeen = typeof data.last_seen === 'number'
            ? data.last_seen
            : new Date(data.last_seen).getTime();
          health.lastDataTime = msgLastSeen;
        } else {
          health.lastDataTime = now;
        }
      }

      // Recalculate health status
      this.calculateHealth(health);

      // ALWAYS store updated health (keeps data fresh even when view inactive)
      // This is a mutation of existing object, won't trigger Alpine reactivity
      this.healthData[ieee] = health;

      // Only trigger UI updates when view is active
      // When inactive: data stays fresh, but no CPU spent on rendering
      if (!this.viewActive) return;

      // Queue update for batched flush (performance optimization)
      // Creates new object reference to ensure Alpine reactivity triggers
      this._pendingUpdates[ieee] = { ...health };

      // Start 5-second debounce timer if not already running
      if (!this._updateTimer) {
        this._updateTimer = setTimeout(() => {
          this._flushUpdates();
        }, 5000);
      }
    },

    /**
     * Flush all pending updates in a single batch
     * This triggers Alpine reactivity once instead of per-device
     */
    _flushUpdates() {
      const pendingCount = Object.keys(this._pendingUpdates).length;
      if (pendingCount > 0) {
        // Batch all updates into single reactivity trigger
        this.healthData = { ...this.healthData, ...this._pendingUpdates };
        this._pendingUpdates = {};
        console.log(`[device-health] Flushed ${pendingCount} device updates`);
      }
      this._updateTimer = null;
    },

    /**
     * Calculate health status based on lastSeen
     */
    calculateHealth(health) {
      if (!health.lastSeen) {
        health.healthStatus = 'unknown';
        health.lastSeenRelative = 'Never';
        return;
      }

      const age = Date.now() - health.lastSeen;

      // Determine status
      if (age < HEALTH_THRESHOLDS.ok) {
        health.healthStatus = 'ok';
      } else if (age < HEALTH_THRESHOLDS.warning) {
        health.healthStatus = 'warning';
      } else if (age < HEALTH_THRESHOLDS.critical) {
        health.healthStatus = 'critical';
      } else {
        health.healthStatus = 'dead';
      }

      // Format relative time
      health.lastSeenRelative = this.formatRelativeTime(age);
    },

    /**
     * Recalculate health for all devices
     */
    recalculateAllHealth() {
      Object.values(this.healthData).forEach(health => {
        this.calculateHealth(health);
      });
    },

    // ==========================================
    // FILTERING & SORTING
    // ==========================================

    /**
     * Get filtered and sorted devices
     */
    get filteredDevices() {
      let result = [...this.devices];

      // Filter by type
      if (this.filters.types.length > 0) {
        result = result.filter(d => this.filters.types.includes(d.type));
      }

      // Filter by health status
      if (this.filters.statuses.length > 0) {
        result = result.filter(d => {
          const health = this.healthData[d.ieee_address];
          return this.filters.statuses.includes(health?.healthStatus || 'unknown');
        });
      }

      // Filter by search
      if (this.filters.search) {
        const search = this.filters.search.toLowerCase();
        result = result.filter(d =>
          d.friendly_name.toLowerCase().includes(search) ||
          d.room.toLowerCase().includes(search) ||
          d.model.toLowerCase().includes(search)
        );
      }

      // Sort
      result.sort((a, b) => {
        const healthA = this.healthData[a.ieee_address] || {};
        const healthB = this.healthData[b.ieee_address] || {};
        let cmp = 0;

        switch (this.sortBy) {
          case 'health':
            // Priority: dead > critical > warning > ok > unknown
            const healthOrder = { dead: 0, critical: 1, warning: 2, ok: 3, unknown: 4 };
            cmp = (healthOrder[healthA.healthStatus] || 4) - (healthOrder[healthB.healthStatus] || 4);
            break;
          case 'name':
            cmp = a.friendly_name.localeCompare(b.friendly_name);
            break;
          case 'type':
            cmp = a.type.localeCompare(b.type);
            break;
          case 'lastSeen':
            cmp = (healthB.lastSeen || 0) - (healthA.lastSeen || 0);
            break;
          case 'battery':
            // Null batteries sort to end
            const batA = healthA.battery ?? 101;
            const batB = healthB.battery ?? 101;
            cmp = batA - batB;
            break;
        }

        return this.sortAsc ? cmp : -cmp;
      });

      return result;
    },

    // ==========================================
    // STATISTICS
    // ==========================================

    /**
     * Get health statistics
     */
    get stats() {
      const counts = { ok: 0, warning: 0, critical: 0, dead: 0, unknown: 0 };
      const lowBattery = [];
      const weakSignal = [];

      this.devices.forEach(d => {
        const health = this.healthData[d.ieee_address] || {};
        counts[health.healthStatus || 'unknown']++;

        if (health.battery !== null && health.battery < 20) {
          lowBattery.push(d);
        }
        if (health.linkquality !== null && health.linkquality < 50) {
          weakSignal.push(d);
        }
      });

      return {
        total: this.devices.length,
        counts,
        healthy: counts.ok,
        needsAttention: counts.warning + counts.critical + counts.dead,
        lowBattery,
        weakSignal,
        // Expose counts directly for easier template access
        ok: counts.ok,
        warning: counts.warning,
        critical: counts.critical,
        dead: counts.dead,
        unknown: counts.unknown
      };
    },

    /**
     * Get device counts by type
     */
    get countsByType() {
      const counts = {};
      this.devices.forEach(d => {
        counts[d.type] = (counts[d.type] || 0) + 1;
      });
      return counts;
    },

    // ==========================================
    // FILTER ACTIONS
    // ==========================================

    toggleTypeFilter(type) {
      const idx = this.filters.types.indexOf(type);
      if (idx === -1) {
        this.filters.types.push(type);
      } else {
        this.filters.types.splice(idx, 1);
      }
    },

    toggleStatusFilter(status) {
      const idx = this.filters.statuses.indexOf(status);
      if (idx === -1) {
        this.filters.statuses.push(status);
      } else {
        this.filters.statuses.splice(idx, 1);
      }
    },

    setSearch(query) {
      this.filters.search = query;
    },

    clearFilters() {
      this.filters.types = [];
      this.filters.statuses = [];
      this.filters.search = '';
    },

    setSortBy(field) {
      if (this.sortBy === field) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortBy = field;
        // Default sort direction per field
        this.sortAsc = ['name', 'type'].includes(field);
      }
    },

    // ==========================================
    // UTILITY
    // ==========================================

    /**
     * Format milliseconds as relative time string
     */
    formatRelativeTime(ms) {
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    /**
     * Get battery icon based on level
     */
    getBatteryIcon(level) {
      if (level === null) return '';
      if (level > 80) return '🔋';
      if (level > 20) return '🔋';
      return '🪫';
    },

    /**
     * Get CSS class for health status
     */
    getHealthClass(status) {
      return `health-${status}`;
    },

    /**
     * Format last value for display
     */
    formatLastValue(device) {
      const health = this.healthData[device.ieee_address];
      if (!health || !health.values || Object.keys(health.values).length === 0) {
        return '--';
      }

      const vals = health.values;
      const parts = [];

      // Format based on device type
      if (vals.temperature !== undefined) parts.push(`${vals.temperature.toFixed(1)}°C`);
      if (vals.humidity !== undefined) parts.push(`${vals.humidity}%`);
      if (vals.co2 !== undefined) parts.push(`${vals.co2}ppm`);
      if (vals.contact !== undefined) parts.push(vals.contact ? 'Closed' : 'Open');
      if (vals.occupancy !== undefined) parts.push(vals.occupancy ? 'Motion' : 'Clear');
      if (vals.state !== undefined) parts.push(vals.state);
      if (vals.runningState !== undefined) parts.push(vals.runningState);
      if (vals.power !== undefined) parts.push(`${vals.power.toFixed(0)}W`);

      return parts.join(' | ') || '--';
    },

    /**
     * Check if device type filter is active
     */
    isTypeActive(type) {
      return this.filters.types.length === 0 || this.filters.types.includes(type);
    },

    /**
     * Check if status filter is active
     */
    isStatusActive(status) {
      return this.filters.statuses.length === 0 || this.filters.statuses.includes(status);
    },

    /**
     * Get all device types as array for filter list
     */
    getDeviceTypes() {
      return Object.entries(DEVICE_TYPES).map(([id, info]) => ({
        id,
        ...info
      }));
    },

    /**
     * Get device type info for a specific device
     */
    getDeviceTypeInfo(device) {
      const type = device?.type || 'unknown';
      return DEVICE_TYPES[type] || DEVICE_TYPES.unknown;
    },

    /**
     * Get signal strength level for visual indicator
     * @returns 'strong' | 'medium' | 'weak' | null
     */
    getSignalLevel(device) {
      const health = this.healthData[device.ieee_address];
      const lq = health?.linkquality;
      if (lq === null || lq === undefined) return null;

      // Zigbee linkquality is 0-255
      if (lq >= 170) return 'strong';   // 67%+ = green
      if (lq >= 85) return 'medium';    // 33-66% = orange
      return 'weak';                     // <33% = red
    },

    /**
     * Format absolute time (e.g., "5:46pm")
     */
    formatAbsoluteTime(device) {
      const health = this.healthData[device.ieee_address];
      if (!health?.lastSeen) return '--';

      const date = new Date(health.lastSeen);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).toLowerCase();
    },

    /**
     * Format last data time as relative string (e.g., "45m ago")
     * Shows when meaningful sensor data was last received (not just heartbeats)
     */
    formatLastDataTime(device) {
      const health = this.healthData[device.ieee_address];
      if (!health?.lastDataTime) return '--';

      const age = Date.now() - health.lastDataTime;
      return this.formatRelativeTime(age);
    }
  });
}
