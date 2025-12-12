/**
 * MQTT Client Module
 * Handles WebSocket connection to Mosquitto broker via Zigbee2MQTT
 */

export class MQTTClient {
  constructor(config) {
    this.config = {
      url: config.mqttUrl || 'ws://dietpi.local:9001',
      baseTopic: config.baseTopic || 'zigbee2mqtt',
      reconnectDelay: config.reconnectDelay || 3000,
      connectTimeout: config.connectTimeout || 10000
    };

    this.client = null;
    this.connected = false;
    this.connecting = false;
    this.listeners = new Map();
    this.statusListeners = [];
  }

  /**
   * Connect to MQTT broker
   * @returns {Promise} Resolves when connected
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.connecting = true;
      this._notifyStatus();

      console.log('MQTT: Connecting to', this.config.url);

      this.client = mqtt.connect(this.config.url, {
        clientId: 'climate-' + Math.random().toString(16).substr(2, 8),
        reconnectPeriod: this.config.reconnectDelay,
        connectTimeout: this.config.connectTimeout
      });

      this.client.on('connect', () => {
        console.log('MQTT: Connected');
        this.connected = true;
        this.connecting = false;
        this._notifyStatus();
        resolve();
      });

      this.client.on('message', (topic, message) => {
        this._handleMessage(topic, message);
      });

      this.client.on('error', (err) => {
        console.error('MQTT: Error', err);
        reject(err);
      });

      this.client.on('close', () => {
        this.connected = false;
        this.connecting = true;
        this._notifyStatus();
      });

      this.client.on('reconnect', () => {
        this.connecting = true;
        this._notifyStatus();
      });
    });
  }

  /**
   * Subscribe to a sensor topic
   * @param {string} sensorName - The sensor name (e.g., 'Living Room TRH (1)')
   * @param {function} callback - Called with parsed message data
   */
  subscribe(sensorName, callback) {
    const topic = `${this.config.baseTopic}/${sensorName}`;

    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, []);
    }
    this.listeners.get(topic).push(callback);

    if (this.client && this.connected) {
      this.client.subscribe(topic, { qos: 0 });
      console.log('MQTT: Subscribed to', topic);
    }
  }

  /**
   * Subscribe to all sensors in a list
   * @param {Array} sensors - Array of { sensor: 'name', ... }
   * @param {function} callback - Called with (sensorName, data)
   */
  subscribeAll(sensors, callback) {
    sensors.forEach(s => {
      this.subscribe(s.sensor, (data) => callback(s.sensor, data));
    });
  }

  /**
   * Add status change listener
   * @param {function} callback - Called with { connected, connecting }
   */
  onStatusChange(callback) {
    this.statusListeners.push(callback);
    // Immediately call with current status
    callback({ connected: this.connected, connecting: this.connecting });
  }

  /**
   * Get current connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      connecting: this.connecting
    };
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      this.connecting = false;
      this._notifyStatus();
    }
  }

  // Private methods

  _handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const callbacks = this.listeners.get(topic) || [];
      callbacks.forEach(cb => cb(data));
    } catch (e) {
      console.error('MQTT: Parse error', e);
    }
  }

  _notifyStatus() {
    const status = { connected: this.connected, connecting: this.connecting };
    this.statusListeners.forEach(cb => cb(status));
  }
}

/**
 * Create a global MQTT client instance
 * Used by Alpine.js store
 */
export function createMQTTClient(config) {
  return new MQTTClient(config);
}
