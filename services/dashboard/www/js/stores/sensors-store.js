/**
 * Sensors Store
 * Manages sensor discovery, positions, and live data for the config page
 *
 * Data sources:
 * - zigbee2mqtt/bridge/devices: Dynamic device list from Zigbee2MQTT
 * - dashboard/sensors/positions: Persisted sensor positions (retained MQTT)
 * - zigbee2mqtt/{device}: Live sensor data
 */

// Sensor types we care about (exclude lights, remotes, plugs)
const SENSOR_FEATURES = ['temperature', 'humidity', 'co2', 'occupancy', 'contact', 'illuminance'];

/**
 * Determine sensor type from Zigbee2MQTT device definition
 */
function getSensorType(device) {
  const exposes = device.definition?.exposes || [];
  const features = exposes.flatMap(e => e.features || [e]);
  const featureNames = features.map(f => f.name);

  // Priority order: most specific first
  if (featureNames.includes('co2')) return 'co2';
  if (featureNames.includes('occupancy')) return 'motion';
  if (featureNames.includes('contact')) return 'contact';
  if (featureNames.includes('temperature') || featureNames.includes('humidity')) return 'climate';

  return null; // Not a sensor we handle
}

/**
 * Check if device is a sensor we should display
 */
function isSensor(device) {
  if (!device.definition) return false;

  const exposes = device.definition.exposes || [];
  const features = exposes.flatMap(e => e.features || [e]);
  const featureNames = features.map(f => f.name);

  return SENSOR_FEATURES.some(f => featureNames.includes(f));
}

/**
 * Initialize the sensors store
 */
export function initSensorsStore(Alpine, CONFIG) {
  Alpine.store('sensors', {
    // All discovered sensors from Zigbee2MQTT
    devices: [],

    // Sensor positions: { [ieeeAddress]: { x, y, z, roomId, updatedAt } }
    positions: {},

    // Live sensor data: { [ieeeAddress]: { temperature, humidity, ... } }
    liveData: {},

    // Track when contact sensors were opened: { [ieeeAddress]: timestamp }
    openedAt: {},

    // Tick counter for duration updates (triggers reactivity)
    durationTick: 0,

    // Prevent concurrent InfluxDB timestamp loads
    _loadingTimestamps: false,

    // State
    loading: true,
    selectedSensorId: null,
    showMotionCoverage: false,

    // Browser ID for conflict debugging
    browserId: 'browser-' + Math.random().toString(36).substr(2, 9),

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

      this.subscribeToTopics(mqttStore.client, CONFIG);
    },

    /**
     * Subscribe to required MQTT topics
     * PERFORMANCE: Uses central dispatcher instead of client.on('message')
     */
    subscribeToTopics(client, CONFIG) {
      const mqtt = Alpine.store('mqtt');

      // Device discovery
      client.subscribe('zigbee2mqtt/bridge/devices', { qos: 1 });

      // Position persistence
      client.subscribe('dashboard/sensors/positions', { qos: 1 });

      // PERFORMANCE: Use central dispatcher instead of client.on('message')
      // This prevents duplicate JSON parsing across multiple stores

      // Handle device list from bridge
      mqtt.registerTopicHandler('zigbee2mqtt/bridge/devices', (topic, data) => {
        this.handleDeviceList(data);
      });

      // Handle position updates
      mqtt.registerTopicHandler('dashboard/sensors/positions', (topic, data) => {
        this.handlePositionUpdate(data);
      });

      // Handle live sensor data
      mqtt.registerTopicHandler(`${CONFIG.baseTopic}/*`, (topic, data, deviceName) => {
        const sensor = this.devices.find(d => d.friendly_name === deviceName);
        if (sensor) {
          this.updateLiveData(sensor.ieee_address, data);
        }
      });

      console.log('[sensors-store] Subscribed to device discovery and positions (using central dispatcher)');
    },

    /**
     * Handle device list from zigbee2mqtt/bridge/devices
     */
    handleDeviceList(devices) {
      // Filter to only sensors
      const sensors = devices.filter(isSensor);

      // Clean up timers for devices that were REMOVED from zigbee2mqtt
      // (not just sleeping - battery sensors can be quiet for 30+ minutes)
      const currentIeees = new Set(sensors.map(s => s.ieee_address));
      Object.keys(this.openedAt).forEach(ieee => {
        if (!currentIeees.has(ieee)) {
          delete this.openedAt[ieee];
          console.log(`[sensors-store] Removed timer for deleted device ${ieee}`);
        }
      });

      // Enrich with type information
      this.devices = sensors.map(device => ({
        ...device,
        sensorType: getSensorType(device),
        model: device.definition?.model || 'Unknown',
        vendor: device.definition?.vendor || 'Unknown'
      }));

      this.loading = false;
      console.log(`[sensors-store] Discovered ${this.devices.length} sensors`);

      // Subscribe to each sensor's topic for live data
      const mqttStore = Alpine.store('mqtt');
      if (mqttStore.client) {
        this.devices.forEach(sensor => {
          mqttStore.client.subscribe(`zigbee2mqtt/${sensor.friendly_name}`, { qos: 0 });
        });
      }
    },

    /**
     * Handle position update from dashboard/sensors/positions
     */
    handlePositionUpdate(data) {
      if (data.positions) {
        this.positions = data.positions;
        console.log(`[sensors-store] Loaded ${Object.keys(this.positions).length} sensor positions`);
      }
    },

    /**
     * Update live data for a sensor
     */
    updateLiveData(ieeeAddress, data) {
      // Track contact sensor state transitions for open duration
      if (data.contact !== undefined) {
        const prevContact = this.liveData[ieeeAddress]?.contact;

        // Transition from closed to open - record exact time
        if (prevContact === true && data.contact === false) {
          this.openedAt[ieeeAddress] = Date.now();
        }

        // Ensure open door always has a timer (fallback for initial discovery,
        // MQTT reconnect, sensor offline/online cycles)
        // InfluxDB query will correct the timestamp later
        if (data.contact === false && !this.openedAt[ieeeAddress]) {
          this.openedAt[ieeeAddress] = Date.now();
          console.log(`[sensors-store] Door ${ieeeAddress} open without timer, setting fallback`);
        }

        // Transition from open to closed - remove timer
        if (data.contact === true) {
          delete this.openedAt[ieeeAddress];
        }
      }

      this.liveData[ieeeAddress] = {
        ...this.liveData[ieeeAddress],
        ...data,
        lastUpdate: Date.now()
      };
    },

    /**
     * Save sensor position to MQTT (retained)
     */
    savePosition(ieeeAddress, position, roomId) {
      // Optimistic update
      this.positions[ieeeAddress] = {
        x: position.x,
        y: position.y,
        z: position.z,
        roomId: roomId,
        updatedAt: new Date().toISOString(),
        updatedBy: this.browserId
      };

      // Publish to MQTT (retained)
      const mqttStore = Alpine.store('mqtt');
      if (mqttStore.client) {
        const payload = JSON.stringify({
          version: 2,
          positions: this.positions
        });

        mqttStore.client.publish('dashboard/sensors/positions', payload, {
          retain: true,
          qos: 1
        });

        console.log(`[sensors-store] Saved position for ${ieeeAddress}`);
      }
    },

    /**
     * Remove sensor position
     */
    removePosition(ieeeAddress) {
      delete this.positions[ieeeAddress];

      // Publish update
      const mqttStore = Alpine.store('mqtt');
      if (mqttStore.client) {
        const payload = JSON.stringify({
          version: 2,
          positions: this.positions
        });

        mqttStore.client.publish('dashboard/sensors/positions', payload, {
          retain: true,
          qos: 1
        });

        console.log(`[sensors-store] Removed position for ${ieeeAddress}`);
      }
    },

    /**
     * Reset all positions
     */
    resetAllPositions() {
      this.positions = {};

      const mqttStore = Alpine.store('mqtt');
      if (mqttStore.client) {
        const payload = JSON.stringify({
          version: 2,
          positions: {}
        });

        mqttStore.client.publish('dashboard/sensors/positions', payload, {
          retain: true,
          qos: 1
        });

        console.log('[sensors-store] Reset all positions');
      }
    },

    /**
     * Get sensor by IEEE address
     */
    getSensor(ieeeAddress) {
      return this.devices.find(d => d.ieee_address === ieeeAddress);
    },

    /**
     * Get sensor by friendly name
     */
    getSensorByName(friendlyName) {
      return this.devices.find(d => d.friendly_name === friendlyName);
    },

    /**
     * Get live data for a sensor
     */
    getLiveData(ieeeAddress) {
      return this.liveData[ieeeAddress] || null;
    },

    /**
     * Check if sensor data is stale (> 5 minutes old)
     */
    isStale(ieeeAddress) {
      const data = this.liveData[ieeeAddress];
      if (!data || !data.lastUpdate) return true;
      return Date.now() - data.lastUpdate > 5 * 60 * 1000;
    },

    /**
     * Get position for a sensor
     */
    getPosition(ieeeAddress) {
      return this.positions[ieeeAddress] || null;
    },

    /**
     * Check if sensor is placed
     */
    isPlaced(ieeeAddress) {
      return !!this.positions[ieeeAddress];
    },

    /**
     * Get count of placed sensors
     */
    get placedCount() {
      return Object.keys(this.positions).length;
    },

    /**
     * Get total sensor count
     */
    get totalCount() {
      return this.devices.length;
    },

    /**
     * Get sensors grouped by type
     */
    get sensorsByType() {
      const grouped = {
        climate: [],
        co2: [],
        motion: [],
        contact: []
      };

      this.devices.forEach(sensor => {
        if (grouped[sensor.sensorType]) {
          grouped[sensor.sensorType].push(sensor);
        }
      });

      return grouped;
    },

    /**
     * Select a sensor for editing
     */
    selectSensor(ieeeAddress) {
      this.selectedSensorId = ieeeAddress;
    },

    /**
     * Deselect sensor
     */
    deselectSensor() {
      this.selectedSensorId = null;
    },

    /**
     * Toggle motion coverage visibility
     */
    toggleMotionCoverage() {
      this.showMotionCoverage = !this.showMotionCoverage;
    },

    /**
     * Get formatted duration string for an open contact sensor
     * @param {string} ieeeAddress - Sensor IEEE address
     * @returns {string} Duration string like "5m 32s", "2h 15m", or "2d 03h"
     */
    getOpenDuration(ieeeAddress) {
      const openedAt = this.openedAt[ieeeAddress];
      if (!openedAt) return '';

      // Reference durationTick for Alpine reactivity
      const _ = this.durationTick;

      const totalSeconds = Math.floor((Date.now() - openedAt) / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;

      if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, '0')}h`;
      }
      if (hours > 0) {
        return `${hours}h ${mins.toString().padStart(2, '0')}m`;
      }
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    },

    /**
     * Start the duration ticker (call once after init)
     * PERFORMANCE: Reduced from 1s to 5s - exact seconds aren't critical for door open durations
     */
    startDurationTicker() {
      setInterval(() => {
        this.durationTick = Date.now();
      }, 5000);
    },

    /**
     * Check if an error is transient and worth retrying
     * @param {Error} err - The error to check
     * @returns {boolean} True if error is transient (timeout, network, 5xx)
     */
    _isTransientError(err) {
      // Retry: timeouts, network errors, server errors
      if (err.name === 'AbortError') return true;           // Timeout
      if (err.name === 'TypeError') return true;            // Network failure
      if (err.message?.includes('HTTP 5')) return true;     // 500, 502, 503, 504
      if (err.message?.includes('HTTP 429')) return true;   // Rate limited

      // Don't retry: client errors, auth errors, syntax errors
      // HTTP 400, 401, 403, 404, InfluxDB syntax errors
      return false;
    },

    /**
     * Load open timestamps from InfluxDB for sensors that are already open on page load
     * Corrects fallback timestamps set by updateLiveData() with actual open times
     * @param {object} CONFIG - App configuration with influxUrl and influxDb
     * @param {number} attempt - Current retry attempt (0-based)
     */
    async loadOpenSensorTimestamps(CONFIG, attempt = 0) {
      const MAX_ATTEMPTS = 3;
      const FETCH_TIMEOUT = 5000; // 5 seconds

      // Prevent concurrent loads
      if (this._loadingTimestamps) {
        console.log('[sensors-store] Timestamp load already in progress, skipping');
        return;
      }

      this._loadingTimestamps = true;

      try {
        // Wait a bit to ensure liveData is populated from MQTT
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 500));
        }

        // Find all contact sensors that are currently open
        const contactSensors = this.sensorsByType?.contact || [];
        const openSensors = contactSensors.filter(
          s => this.liveData[s.ieee_address]?.contact === false
        );

        if (openSensors.length === 0) {
          console.log('[sensors-store] No open sensors to load timestamps for');
          return;
        }

        console.log(`[sensors-store] Loading open timestamps for ${openSensors.length} sensors from InfluxDB (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);

        const failedSensors = [];

        // Query InfluxDB for each open sensor's last "opened" event
        for (const sensor of openSensors) {
          let timeoutId;
          try {
            // Query for the most recent door_opened event
            const query = `
              SELECT * FROM zigbee_events
              WHERE device_name = '${sensor.friendly_name}'
                AND event_type = 'door_opened'
              ORDER BY time DESC
              LIMIT 1
            `;
            const url = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`;

            // Add timeout with AbortController
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            if (data.results?.[0]?.series?.[0]?.values?.[0]) {
              const columns = data.results[0].series[0].columns;
              const values = data.results[0].series[0].values[0];
              const timeIdx = columns.indexOf('time');
              const openedTime = new Date(values[timeIdx]).getTime();

              // Only update if we got a valid time from InfluxDB
              if (openedTime > 0) {
                this.openedAt[sensor.ieee_address] = openedTime;
                console.log(`[sensors-store] Corrected open time for ${sensor.friendly_name}: ${new Date(openedTime).toLocaleTimeString()}`);
              }
            } else {
              console.log(`[sensors-store] No InfluxDB record for ${sensor.friendly_name}, keeping fallback time`);
            }
          } catch (err) {
            clearTimeout(timeoutId);

            if (err.name === 'AbortError') {
              console.warn(`[sensors-store] Timeout querying ${sensor.friendly_name} (>${FETCH_TIMEOUT}ms)`);
            } else {
              console.warn(`[sensors-store] Failed to load timestamp for ${sensor.friendly_name}:`, err.message);
            }

            // Only retry transient errors
            if (this._isTransientError(err)) {
              failedSensors.push(sensor);
            } else {
              console.error(`[sensors-store] Non-retryable error for ${sensor.friendly_name}:`, err.message);
            }
          }
        }

        // Retry failed sensors with exponential backoff
        if (failedSensors.length > 0 && attempt < MAX_ATTEMPTS - 1) {
          const delay = Math.pow(2, attempt) * 1000;  // 1s, 2s, 4s
          console.log(`[sensors-store] Retrying ${failedSensors.length} sensors in ${delay}ms (attempt ${attempt + 2}/${MAX_ATTEMPTS})`);

          // Release lock before scheduling retry
          this._loadingTimestamps = false;

          setTimeout(() => {
            this._retryFailedSensors(CONFIG, failedSensors, attempt + 1);
          }, delay);
          return;
        }

        if (failedSensors.length > 0) {
          console.warn(`[sensors-store] ${failedSensors.length} sensors failed after ${MAX_ATTEMPTS} attempts, keeping fallback times`);
        }
      } finally {
        this._loadingTimestamps = false;
      }
    },

    /**
     * Retry loading timestamps for specific failed sensors
     * @param {object} CONFIG - App configuration
     * @param {Array} sensors - Sensors to retry
     * @param {number} attempt - Current attempt number
     */
    async _retryFailedSensors(CONFIG, sensors, attempt) {
      if (this._loadingTimestamps) {
        console.log('[sensors-store] Retry skipped - another load in progress');
        return;
      }

      this._loadingTimestamps = true;
      const MAX_ATTEMPTS = 3;
      const FETCH_TIMEOUT = 5000;

      try {
        console.log(`[sensors-store] Retrying ${sensors.length} failed sensors (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);

        const stillFailed = [];

        for (const sensor of sensors) {
          let timeoutId;
          try {
            const query = `
              SELECT * FROM zigbee_events
              WHERE device_name = '${sensor.friendly_name}'
                AND event_type = 'door_opened'
              ORDER BY time DESC
              LIMIT 1
            `;
            const url = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`;

            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            if (data.results?.[0]?.series?.[0]?.values?.[0]) {
              const columns = data.results[0].series[0].columns;
              const values = data.results[0].series[0].values[0];
              const timeIdx = columns.indexOf('time');
              const openedTime = new Date(values[timeIdx]).getTime();

              if (openedTime > 0) {
                this.openedAt[sensor.ieee_address] = openedTime;
                console.log(`[sensors-store] Corrected open time for ${sensor.friendly_name}: ${new Date(openedTime).toLocaleTimeString()}`);
              }
            }
          } catch (err) {
            clearTimeout(timeoutId);
            if (this._isTransientError(err)) {
              stillFailed.push(sensor);
            }
            console.warn(`[sensors-store] Retry failed for ${sensor.friendly_name}:`, err.message);
          }
        }

        // Schedule another retry if needed
        if (stillFailed.length > 0 && attempt < MAX_ATTEMPTS - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          this._loadingTimestamps = false;

          setTimeout(() => {
            this._retryFailedSensors(CONFIG, stillFailed, attempt + 1);
          }, delay);
          return;
        }

        if (stillFailed.length > 0) {
          console.warn(`[sensors-store] ${stillFailed.length} sensors failed after all retries`);
        }
      } finally {
        this._loadingTimestamps = false;
      }
    }
  });
}
