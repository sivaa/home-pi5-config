/**
 * Thermostat Store
 * Manages SONOFF TRVZB thermostat control and event tracking
 */

// Event type definitions for thermostat timeline
const THERMOSTAT_EVENT_TYPES = {
  // IMPORTANT (full cards)
  heating_started: { icon: '🔥', color: '#ef4444', label: 'Heating Started', priority: 'important', category: 'heating' },
  heating_stopped: { icon: '❄️', color: '#3b82f6', label: 'Heating Stopped', priority: 'important', category: 'heating' },
  target_reached: { icon: '✅', color: '#22c55e', label: 'Target Reached', priority: 'important', category: 'heating' },
  device_offline: { icon: '📡', color: '#ef4444', label: 'Device Offline', priority: 'important', category: 'system' },
  low_battery: { icon: '🪫', color: '#f59e0b', label: 'Low Battery', priority: 'important', category: 'system' },

  // ACTIVITY (compact lines)
  setpoint_changed: { icon: '🎯', color: '#f59e0b', label: 'Setpoint Changed', priority: 'activity', category: 'control' },
  mode_changed: { icon: '⚙️', color: '#8b5cf6', label: 'Mode Changed', priority: 'activity', category: 'control' },
  preset_changed: { icon: '🚀', color: '#06b6d4', label: 'Preset Changed', priority: 'activity', category: 'control' },
  child_lock_changed: { icon: '🔒', color: '#64748b', label: 'Child Lock Changed', priority: 'activity', category: 'control' },

  // BACKGROUND (collapsed)
  device_online: { icon: '📡', color: '#22c55e', label: 'Device Online', priority: 'background', category: 'system' },
  battery_ok: { icon: '🔋', color: '#22c55e', label: 'Battery OK', priority: 'background', category: 'system' },
  temp_update: { icon: '🌡️', color: '#94a3b8', label: 'Temperature Update', priority: 'background', category: 'data' },

  // INITIAL STATE (activity level - shows on first connect)
  initial_state: { icon: '📍', color: '#6366f1', label: 'Initial State', priority: 'activity', category: 'system' }
};

export function initThermostatStore(Alpine, CONFIG) {
  Alpine.store('thermostats', {
    // ============================================
    // STATE
    // ============================================

    list: CONFIG.thermostats.map(t => ({
      ...t,
      // Current state from MQTT
      localTemp: null,          // Current temperature at valve
      targetTemp: null,         // Setpoint (occupied_heating_setpoint)
      runningState: 'idle',     // 'idle' or 'heat'
      systemMode: 'heat',       // 'heat' or 'off'
      battery: null,
      linkquality: null,
      lastSeen: null,
      available: true,
      syncing: false,
      // Extra TRV features
      childLock: 'UNLOCK',
      openWindow: false,
      localTempCalibration: 0,
      // UI state
      pendingTarget: null       // Optimistic update value
    })),

    events: [],                  // Recent events for timeline
    maxEvents: 200,
    initializing: true,
    firstMessageReceived: {},    // Track which devices have recorded initial state

    // ============================================
    // INITIALIZATION
    // ============================================

    async init() {
      // Load historical events from InfluxDB first
      await this.loadHistoricalEvents(24);

      const mqtt = Alpine.store('mqtt');
      if (!mqtt?.client) {
        console.log('[thermostat-store] MQTT not ready, retrying...');
        setTimeout(() => this.init(), 1000);
        return;
      }

      console.log('[thermostat-store] Subscribing to thermostat topics...');

      // Subscribe to each thermostat topic
      CONFIG.thermostats.forEach(t => {
        const topic = `${CONFIG.baseTopic}/${t.sensor}`;
        mqtt.client.subscribe(topic, { qos: 0 });
        console.log(`[thermostat-store] Subscribed to ${topic}`);
      });

      // Handle incoming messages
      mqtt.client.on('message', (topic, message) => {
        if (!topic.startsWith(CONFIG.baseTopic + '/')) return;

        const deviceName = topic.replace(CONFIG.baseTopic + '/', '').replace('/availability', '');
        const thermostat = CONFIG.thermostats.find(t => t.sensor === deviceName);
        if (!thermostat) return;

        try {
          if (topic.endsWith('/availability')) {
            const isOnline = message.toString() === 'online' ||
              (JSON.parse(message.toString()).state === 'online');
            this.updateAvailability(deviceName, isOnline);
          } else {
            const data = JSON.parse(message.toString());
            this.updateThermostat(deviceName, data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      this.initializing = false;
      console.log('[thermostat-store] Initialization complete');
    },

    // ============================================
    // HISTORICAL DATA FROM INFLUXDB
    // ============================================

    async loadHistoricalEvents(hours = 24) {
      try {
        console.log(`[thermostat-store] Loading ${hours}h of historical events from InfluxDB...`);

        // Query InfluxDB for thermostat events
        const query = `SELECT * FROM zigbee_events WHERE device_type = 'thermostat' AND time > now() - ${hours}h ORDER BY time DESC LIMIT 200`;
        const url = `http://pi:8086/query?db=homeassistant&q=${encodeURIComponent(query)}`;

        const response = await fetch(url);
        if (!response.ok) {
          console.warn('[thermostat-store] InfluxDB query failed:', response.status);
          return;
        }

        const data = await response.json();

        // Parse InfluxDB response
        if (!data.results?.[0]?.series?.[0]) {
          console.log('[thermostat-store] No historical events found');
          return;
        }

        const series = data.results[0].series[0];
        const columns = series.columns;
        const values = series.values;

        // Map column indices
        const colIdx = {};
        columns.forEach((col, i) => colIdx[col] = i);

        // Convert to our event format
        const historicalEvents = values.map(row => {
          const deviceName = row[colIdx.device_name];
          const eventType = row[colIdx.event_type];
          const time = new Date(row[colIdx.time]).getTime();
          const state = row[colIdx.state];
          const room = row[colIdx.room];

          // Find matching thermostat config
          const thermostat = CONFIG.thermostats.find(t => t.sensor === deviceName);

          // Normalize event type (mode_changed_heat -> mode_changed)
          let normalizedType = eventType;
          if (eventType?.startsWith('mode_changed_')) {
            normalizedType = 'mode_changed';
          }

          return {
            deviceId: thermostat?.id || room,
            deviceName: thermostat?.name || deviceName,
            deviceIcon: thermostat?.icon || '🌡️',
            roomId: thermostat?.roomId || room,
            eventType: normalizedType,
            time: time,
            state: state,
            info: THERMOSTAT_EVENT_TYPES[normalizedType] || {
              icon: '📝',
              color: '#94a3b8',
              label: eventType,
              priority: 'activity'
            }
          };
        });

        // Add historical events to the store (they're already sorted DESC)
        this.events = historicalEvents;
        console.log(`[thermostat-store] Loaded ${historicalEvents.length} historical events`);

      } catch (err) {
        console.warn('[thermostat-store] Failed to load historical events:', err.message);
      }
    },

    // ============================================
    // COMPUTED GETTERS
    // ============================================

    get activeHeatingCount() {
      return this.list.filter(t => t.runningState === 'heat').length;
    },

    get offlineCount() {
      return this.list.filter(t => !t.available).length;
    },

    get anySyncing() {
      return this.list.some(t => t.syncing);
    },

    get lowBatteryCount() {
      return this.list.filter(t => t.battery !== null && t.battery < 20).length;
    },

    // ============================================
    // MQTT UPDATE HANDLERS
    // ============================================

    updateThermostat(topic, data) {
      const thermostat = this.list.find(t => t.sensor === topic);
      if (!thermostat) return;

      const prevState = {
        runningState: thermostat.runningState,
        targetTemp: thermostat.targetTemp,
        systemMode: thermostat.systemMode,
        childLock: thermostat.childLock,
        localTemp: thermostat.localTemp,
        battery: thermostat.battery,
        available: thermostat.available
      };

      // Update current values from MQTT payload
      // SONOFF TRVZB uses these field names in Zigbee2MQTT
      if (data.local_temperature !== undefined) {
        thermostat.localTemp = data.local_temperature;
      }
      if (data.occupied_heating_setpoint !== undefined) {
        thermostat.targetTemp = data.occupied_heating_setpoint;
        thermostat.pendingTarget = null;  // Clear optimistic update
      }
      if (data.running_state !== undefined) {
        thermostat.runningState = data.running_state === 'heat' ? 'heat' : 'idle';
      }
      if (data.system_mode !== undefined) {
        thermostat.systemMode = data.system_mode;
      }
      if (data.battery !== undefined) {
        thermostat.battery = data.battery;
      }
      if (data.linkquality !== undefined) {
        thermostat.linkquality = data.linkquality;
      }
      if (data.child_lock !== undefined) {
        thermostat.childLock = data.child_lock;
      }
      if (data.open_window !== undefined) {
        thermostat.openWindow = data.open_window;
      }
      if (data.local_temperature_calibration !== undefined) {
        thermostat.localTempCalibration = data.local_temperature_calibration;
      }

      thermostat.lastSeen = Date.now();
      thermostat.syncing = false;
      this.initializing = false;

      // Record initial state on first message from this device
      if (!this.firstMessageReceived[thermostat.id]) {
        this.firstMessageReceived[thermostat.id] = true;
        this.addEvent({
          deviceId: thermostat.id,
          deviceName: thermostat.name,
          deviceIcon: thermostat.icon,
          roomId: thermostat.roomId,
          eventType: 'initial_state',
          time: Date.now(),
          currentTemp: thermostat.localTemp,
          targetTemp: thermostat.targetTemp,
          runningState: thermostat.runningState,
          systemMode: thermostat.systemMode,
          battery: thermostat.battery
        });
        console.log(`[thermostat-store] Initial state recorded for ${thermostat.name}`);
      }

      // Detect and log state changes
      this.detectEvents(thermostat, prevState);
    },

    updateAvailability(topic, isOnline) {
      const thermostat = this.list.find(t => t.sensor === topic);
      if (!thermostat) return;

      const wasAvailable = thermostat.available;
      thermostat.available = isOnline;  // Direct boolean assignment

      // Log availability change
      if (wasAvailable !== thermostat.available) {
        this.addEvent({
          deviceId: thermostat.id,
          deviceName: thermostat.name,
          deviceIcon: thermostat.icon,
          roomId: thermostat.roomId,
          eventType: thermostat.available ? 'device_online' : 'device_offline',
          time: Date.now()
        });
      }
    },

    // ============================================
    // EVENT DETECTION
    // ============================================

    detectEvents(thermostat, prev) {
      const now = Date.now();
      const baseEvent = {
        deviceId: thermostat.id,
        deviceName: thermostat.name,
        deviceIcon: thermostat.icon,
        roomId: thermostat.roomId,
        time: now
      };

      // Heating state changed
      if (prev.runningState !== thermostat.runningState) {
        if (thermostat.runningState === 'heat') {
          this.addEvent({
            ...baseEvent,
            eventType: 'heating_started',
            currentTemp: thermostat.localTemp,
            targetTemp: thermostat.targetTemp
          });
        } else {
          this.addEvent({
            ...baseEvent,
            eventType: 'heating_stopped',
            currentTemp: thermostat.localTemp,
            targetTemp: thermostat.targetTemp
          });

          // Check if target was reached
          if (thermostat.localTemp !== null && thermostat.targetTemp !== null &&
              thermostat.localTemp >= thermostat.targetTemp - 0.5) {
            this.addEvent({
              ...baseEvent,
              eventType: 'target_reached',
              currentTemp: thermostat.localTemp,
              targetTemp: thermostat.targetTemp
            });
          }
        }
      }

      // Setpoint changed
      if (prev.targetTemp !== null && prev.targetTemp !== thermostat.targetTemp) {
        this.addEvent({
          ...baseEvent,
          eventType: 'setpoint_changed',
          previousValue: prev.targetTemp,
          newValue: thermostat.targetTemp
        });
      }

      // Mode changed
      if (prev.systemMode !== thermostat.systemMode) {
        this.addEvent({
          ...baseEvent,
          eventType: 'mode_changed',
          previousValue: prev.systemMode,
          newValue: thermostat.systemMode
        });
      }

      // Child lock changed
      if (prev.childLock !== thermostat.childLock) {
        this.addEvent({
          ...baseEvent,
          eventType: 'child_lock_changed',
          previousValue: prev.childLock,
          newValue: thermostat.childLock
        });
      }

      // Low battery warning
      if (thermostat.battery !== null && thermostat.battery < 20 &&
          (prev.battery === null || prev.battery >= 20)) {
        this.addEvent({
          ...baseEvent,
          eventType: 'low_battery',
          battery: thermostat.battery
        });
      }

      // Open window detected
      if (thermostat.openWindow && !prev.openWindow) {
        this.addEvent({
          ...baseEvent,
          eventType: 'window_detected'
        });
      }
    },

    addEvent(event) {
      // Add event info from config
      const eventInfo = THERMOSTAT_EVENT_TYPES[event.eventType] || {
        icon: '📝',
        color: '#94a3b8',
        label: event.eventType,
        priority: 'background'
      };
      event.info = eventInfo;

      this.events.unshift(event);

      // Keep max events
      while (this.events.length > this.maxEvents) {
        this.events.pop();
      }
    },

    // ============================================
    // CONTROL COMMANDS
    // ============================================

    setTargetTemp(thermostatId, temp) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat || !thermostat.available) return;

      // Clamp to valid range (5-30°C)
      const clampedTemp = Math.max(5, Math.min(30, temp));

      // Optimistic update
      thermostat.pendingTarget = clampedTemp;
      thermostat.syncing = true;

      this.publishCommand(thermostat, { occupied_heating_setpoint: clampedTemp });
    },

    adjustTemp(thermostatId, delta) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat) return;

      const currentTarget = thermostat.pendingTarget ?? thermostat.targetTemp ?? 20;
      const newTarget = Math.round((currentTarget + delta) * 2) / 2;  // 0.5° steps
      this.setTargetTemp(thermostatId, newTarget);
    },

    setMode(thermostatId, mode) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat || !thermostat.available) return;

      thermostat.syncing = true;
      this.publishCommand(thermostat, { system_mode: mode });
    },

    togglePower(thermostatId) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat || !thermostat.available) return;

      const newMode = thermostat.systemMode === 'off' ? 'heat' : 'off';
      thermostat.syncing = true;
      this.publishCommand(thermostat, { system_mode: newMode });
    },

    setChildLock(thermostatId, locked) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat || !thermostat.available) return;

      thermostat.syncing = true;
      this.publishCommand(thermostat, { child_lock: locked ? 'LOCK' : 'UNLOCK' });
    },

    publishCommand(thermostat, payload) {
      const client = Alpine.store('mqtt').client;
      if (!client || !Alpine.store('mqtt').connected) {
        console.error('[thermostat-store] MQTT not connected');
        thermostat.syncing = false;
        return;
      }

      // Publish audit event BEFORE sending the actual command
      // This allows mqtt-influx-bridge to track the source of changes
      const auditPayload = {
        device: thermostat.sensor,
        deviceId: thermostat.id,
        deviceName: thermostat.name,
        action: this.getActionType(payload),
        source: 'Dashboard',
        payload: payload,
        timestamp: Date.now()
      };
      client.publish('dashboard/audit/thermostat', JSON.stringify(auditPayload), { qos: 0 });
      console.log('[thermostat-store] Audit published:', auditPayload);

      const topic = `zigbee2mqtt/${thermostat.sensor}/set`;
      client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
        if (err) {
          console.error('[thermostat-store] Publish failed:', err);
          thermostat.syncing = false;
          thermostat.pendingTarget = null;
        } else {
          // Clear syncing after timeout if no response
          setTimeout(() => {
            if (thermostat.syncing) {
              thermostat.syncing = false;
              thermostat.pendingTarget = null;
            }
          }, 5000);
        }
      });
    },

    getActionType(payload) {
      if (payload.occupied_heating_setpoint !== undefined) return 'setpoint_change';
      if (payload.system_mode !== undefined) return 'mode_change';
      if (payload.child_lock !== undefined) return 'child_lock_change';
      return 'unknown';
    },

    // ============================================
    // HELPER METHODS
    // ============================================

    getThermostat(id) {
      return this.list.find(t => t.id === id);
    },

    getDisplayTemp(thermostat) {
      return thermostat.pendingTarget ?? thermostat.targetTemp;
    },

    isStale(thermostat) {
      if (!thermostat.lastSeen) return true;
      return Date.now() - thermostat.lastSeen > CONFIG.staleThreshold;
    },

    getEventsByDevice(deviceId) {
      return this.events.filter(e => e.deviceId === deviceId);
    },

    getEventsByPriority(priority) {
      return this.events.filter(e => e.info?.priority === priority);
    },

    clearEvents() {
      this.events = [];
    },

    // ============================================
    // STATISTICS
    // ============================================

    getStats(hours = 24) {
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      const recentEvents = this.events.filter(e => e.time > cutoff);

      const heatingStarted = recentEvents.filter(e => e.eventType === 'heating_started').length;
      const setpointChanges = recentEvents.filter(e => e.eventType === 'setpoint_changed').length;

      return {
        heatingCycles: heatingStarted,
        setpointChanges,
        totalEvents: recentEvents.length
      };
    },

    getStatsByDevice(deviceId, hours = 24) {
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      const deviceEvents = this.events.filter(e => e.deviceId === deviceId && e.time > cutoff);

      const heatingStarted = deviceEvents.filter(e => e.eventType === 'heating_started');
      const heatingStopped = deviceEvents.filter(e => e.eventType === 'heating_stopped');

      // Calculate heating duration
      let totalHeatingMs = 0;
      for (let i = 0; i < heatingStarted.length; i++) {
        const start = heatingStarted[i];
        const stop = heatingStopped.find(s => s.time > start.time);
        if (stop) {
          totalHeatingMs += stop.time - start.time;
        }
      }

      return {
        heatingCycles: heatingStarted.length,
        heatingMinutes: Math.round(totalHeatingMs / 60000),
        setpointChanges: deviceEvents.filter(e => e.eventType === 'setpoint_changed').length,
        targetReached: deviceEvents.filter(e => e.eventType === 'target_reached').length
      };
    }
  });
}
