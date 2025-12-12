/**
 * MQTT Connection Store
 * Manages WebSocket connection to MQTT broker
 */

export function initMqttStore(Alpine, CONFIG) {
  Alpine.store('mqtt', {
    connected: false,
    connecting: true,
    client: null,

    connect() {
      this.connecting = true;

      this.client = mqtt.connect(CONFIG.mqttUrl, {
        clientId: 'climate-' + Math.random().toString(16).substr(2, 8),
        reconnectPeriod: 3000,
        connectTimeout: 10000
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.connecting = false;

        // Subscribe to room sensors
        CONFIG.rooms.forEach(room => {
          this.client.subscribe(`${CONFIG.baseTopic}/${room.sensor}`, { qos: 0 });
        });

        // Subscribe to light topics and their availability
        Alpine.store('lights').list.forEach(light => {
          this.client.subscribe(`${CONFIG.baseTopic}/${light.topic}`, { qos: 0 });
          this.client.subscribe(`${CONFIG.baseTopic}/${light.topic}/availability`, { qos: 0 });
        });
      });

      this.client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          const deviceName = topic.replace(`${CONFIG.baseTopic}/`, '');

          // Check if it's an availability message
          if (deviceName.endsWith('/availability')) {
            const lightTopic = deviceName.replace('/availability', '');
            console.log('📡 Availability:', lightTopic, '→', data.state);
            Alpine.store('lights').updateAvailability(lightTopic, data);
            return;
          }

          // Check if it's a room sensor
          const roomConfig = CONFIG.rooms.find(r => r.sensor === deviceName);
          if (roomConfig) {
            Alpine.store('rooms').updateRoom(deviceName, data);
            return;
          }

          // Check if it's a light
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
