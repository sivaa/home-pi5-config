/**
 * MQTT Connection Store
 * Manages WebSocket connection to MQTT broker
 *
 * PERFORMANCE OPTIMIZATION (2024-12-31):
 * This is the SINGLE message handler for all MQTT traffic.
 * Other stores should NOT register their own client.on('message') handlers.
 * Instead, they subscribe to specific topics via registerTopicHandler().
 */

export function initMqttStore(Alpine, CONFIG) {
  Alpine.store('mqtt', {
    connected: false,
    connecting: true,
    client: null,
    connectionCount: 0,  // Track connection count for reconnect detection

    // Topic handlers registry: Map<pattern, Array<callback>>
    // Patterns support exact match or wildcard '*' suffix
    _topicHandlers: new Map(),

    // Performance metrics
    _metrics: {
      messagesReceived: 0,
      messagesPerSecond: 0,
      lastSecondMessages: 0,
      lastSecondTimestamp: Date.now()
    },

    /**
     * Register a handler for specific MQTT topics
     * @param {string} pattern - Topic pattern (exact or ending with *)
     * @param {function} callback - Handler function(topic, data, deviceName)
     * @returns {function} Unsubscribe function
     */
    registerTopicHandler(pattern, callback) {
      if (!this._topicHandlers.has(pattern)) {
        this._topicHandlers.set(pattern, []);
      }
      this._topicHandlers.get(pattern).push(callback);

      // Return unsubscribe function
      return () => {
        const handlers = this._topicHandlers.get(pattern);
        if (handlers) {
          const idx = handlers.indexOf(callback);
          if (idx > -1) handlers.splice(idx, 1);
        }
      };
    },

    /**
     * Dispatch message to all matching handlers
     * @private
     */
    _dispatchToHandlers(topic, data, deviceName) {
      for (const [pattern, handlers] of this._topicHandlers) {
        let matches = false;

        if (pattern.endsWith('*')) {
          // Wildcard match
          const prefix = pattern.slice(0, -1);
          matches = topic.startsWith(prefix);
        } else {
          // Exact match
          matches = topic === pattern;
        }

        if (matches) {
          for (const handler of handlers) {
            try {
              handler(topic, data, deviceName);
            } catch (e) {
              console.error(`[mqtt] Handler error for ${pattern}:`, e);
            }
          }
        }
      }
    },

    /**
     * Update performance metrics
     * @private
     */
    _updateMetrics() {
      this._metrics.messagesReceived++;
      this._metrics.lastSecondMessages++;

      const now = Date.now();
      if (now - this._metrics.lastSecondTimestamp >= 1000) {
        this._metrics.messagesPerSecond = this._metrics.lastSecondMessages;
        this._metrics.lastSecondMessages = 0;
        this._metrics.lastSecondTimestamp = now;
      }
    },

    /**
     * Get current performance metrics
     */
    getMetrics() {
      return { ...this._metrics };
    },

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

      // SINGLE message handler for all MQTT traffic
      // Other stores register via registerTopicHandler() - NO MORE client.on('message')!
      this.client.on('message', (topic, message) => {
        this._updateMetrics();

        try {
          // Parse ONCE for all handlers
          const data = JSON.parse(message.toString());
          const deviceName = topic.replace(`${CONFIG.baseTopic}/`, '');

          // 1. Capture ALL messages for logs store (first, before any routing)
          Alpine.store('logs')?.captureMessage(topic, data);

          // 2. Dispatch to registered topic handlers
          this._dispatchToHandlers(topic, data, deviceName);

          // 3. Built-in routing (kept for backward compatibility)

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
