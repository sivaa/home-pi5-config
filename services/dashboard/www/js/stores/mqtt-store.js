/**
 * MQTT Connection Store
 * Manages WebSocket connection to MQTT broker
 */

export function initMqttStore(Alpine, CONFIG) {
  Alpine.store('mqtt', {
    connected: false,
    connecting: true,
    client: null,
    connectionCount: 0,  // Track connection count for reconnect detection

    connect() {
      this.connecting = true;

      this.client = mqtt.connect(CONFIG.mqttUrl, {
        clientId: 'climate-' + Math.random().toString(16).substr(2, 8),
        reconnectPeriod: 3000,
        connectTimeout: 10000
      });

      this.client.on('connect', () => {
        const isReconnect = this.connectionCount > 0;
        this.connectionCount++;
        this.connected = true;
        this.connecting = false;

        // Subscribe to ALL zigbee2mqtt topics (for logs view)
        this.client.subscribe(`${CONFIG.baseTopic}/#`, { qos: 0 });
        console.log(`📋 Subscribed to ${CONFIG.baseTopic}/# (all topics for logs)`);

        // Subscribe to dashboard audit topics
        this.client.subscribe('dashboard/#', { qos: 0 });

        // Note: Individual sensor/light subscriptions now covered by wildcard
        const sensorTopics = Alpine.store('rooms').getAllSensorTopics();
        console.log(`📡 Tracking ${sensorTopics.length} sensors via wildcard`);

        // On reconnect, reload open timestamps from InfluxDB
        // This fixes timer disappearing after MQTT disconnect/reconnect
        if (isReconnect) {
          console.log('[mqtt] Reconnected - reloading open sensor timestamps');
          setTimeout(() => {
            const sensorsStore = Alpine.store('sensors');
            sensorsStore?.loadOpenSensorTimestamps?.(CONFIG);
          }, 5000);  // Wait for sensors to send current state
        }
      });

      this.client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());

          // Capture ALL messages for logs store (first, before any routing)
          Alpine.store('logs')?.captureMessage(topic, data);

          const deviceName = topic.replace(`${CONFIG.baseTopic}/`, '');

          // Check if it's an availability message
          if (deviceName.endsWith('/availability')) {
            const lightTopic = deviceName.replace('/availability', '');
            console.log('📡 Availability:', lightTopic, '→', data.state);
            Alpine.store('lights').updateAvailability(lightTopic, data);
            return;
          }

          // Route to rooms store - handles both primary and additional sensors
          Alpine.store('rooms').handleSensorMessage(deviceName, data);

          // Also check if it's a light
          Alpine.store('lights').updateLight(deviceName, data);
        } catch (e) {
          console.error('MQTT parse error:', e);
        }
      });

      this.client.on('error', (err) => console.error('MQTT Error:', err));
      this.client.on('close', () => { this.connected = false; this.connecting = true; });
      this.client.on('reconnect', () => { this.connecting = true; });
    }
  });
}
