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
     */
    subscribeToTopics(client, CONFIG) {
      // Device discovery
      client.subscribe('zigbee2mqtt/bridge/devices', { qos: 1 });

      // Position persistence
      client.subscribe('dashboard/sensors/positions', { qos: 1 });

      // Add message handler (alongside existing handlers)
      client.on('message', (topic, message) => {
        this.handleMessage(topic, message, CONFIG);
      });

      console.log('[sensors-store] Subscribed to device discovery and positions');
    },

    /**
     * Handle incoming MQTT messages
     */
    handleMessage(topic, message, CONFIG) {
      try {
        const data = JSON.parse(message.toString());

        // Device list from bridge
        if (topic === 'zigbee2mqtt/bridge/devices') {
          this.handleDeviceList(data);
          return;
        }

        // Position updates
        if (topic === 'dashboard/sensors/positions') {
          this.handlePositionUpdate(data);
          return;
        }

        // Live sensor data
        const deviceName = topic.replace(`${CONFIG.baseTopic}/`, '');
        const sensor = this.devices.find(d => d.friendly_name === deviceName);
        if (sensor) {
          this.updateLiveData(sensor.ieee_address, data);
        }
      } catch (e) {
        // Ignore parse errors for non-JSON messages
      }
    },

    /**
     * Handle device list from zigbee2mqtt/bridge/devices
     */
    handleDeviceList(devices) {
      // Filter to only sensors
      const sensors = devices.filter(isSensor);

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
    }
  });
}
