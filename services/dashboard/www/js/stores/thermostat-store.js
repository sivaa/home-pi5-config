/**
 * Thermostat Store
 * Manages SONOFF TRVZB thermostat control and event tracking
 */

// Event type definitions for thermostat timeline
// Priority levels: alert (red, requires action) > warning (yellow, monitor) > activity (blue, normal ops) > background (gray, routine)
const THERMOSTAT_EVENT_TYPES = {
  // CRITICAL - Device left network, requires re-pairing (highest priority)
  device_leave: {
    icon: '🚨', color: '#dc2626', label: 'Device Left Network',
    priority: 'critical', category: 'system',
    action: 'Device needs to be re-paired to Zigbee network'
  },

  // ALERT - Requires immediate attention (shown prominently)
  device_offline: {
    icon: '🔴', color: '#ef4444', label: 'Device Offline',
    priority: 'alert', category: 'system',
    action: 'Check device power and Zigbee signal'
  },
  low_battery_critical: {
    icon: '🪫', color: '#ef4444', label: 'Battery Critical',
    priority: 'alert', category: 'system',
    action: 'Replace batteries immediately'
  },

  // WARNING - Should investigate (shown with less urgency)
  low_battery: {
    icon: '🔋', color: '#f59e0b', label: 'Battery Low',
    priority: 'warning', category: 'system',
    action: 'Plan to replace batteries soon'
  },
  window_detected: {
    icon: '🪟', color: '#f59e0b', label: 'Window Open',
    priority: 'warning', category: 'heating',
    action: 'Heating paused - close window to resume'
  },

  // ACTIVITY - Normal operations (compact rows)
  heating_started: { icon: '🔥', color: '#ef4444', label: 'Heating Started', priority: 'activity', category: 'heating' },
  heating_stopped: { icon: '❄️', color: '#3b82f6', label: 'Heating Stopped', priority: 'activity', category: 'heating' },
  target_reached: { icon: '✅', color: '#22c55e', label: 'Target Reached', priority: 'activity', category: 'heating' },
  setpoint_changed: { icon: '🎯', color: '#f59e0b', label: 'Setpoint Changed', priority: 'activity', category: 'control' },
  mode_changed: { icon: '⚙️', color: '#8b5cf6', label: 'Mode Changed', priority: 'activity', category: 'control' },
  preset_changed: { icon: '🚀', color: '#06b6d4', label: 'Preset Changed', priority: 'activity', category: 'control' },
  child_lock_changed: { icon: '🔒', color: '#64748b', label: 'Child Lock Changed', priority: 'activity', category: 'control' },
  initial_state: { icon: '📍', color: '#6366f1', label: 'Initial State', priority: 'activity', category: 'system' },

  // BACKGROUND - Routine events (collapsed by default)
  device_online: { icon: '📡', color: '#22c55e', label: 'Device Online', priority: 'background', category: 'system' },
  battery_ok: { icon: '🔋', color: '#22c55e', label: 'Battery OK', priority: 'background', category: 'system' },
  temp_update: { icon: '🌡️', color: '#94a3b8', label: 'Temperature Update', priority: 'background', category: 'data' }
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
      runningState: 'idle',     // 'idle' or 'heat' (system MODE, not actual heating)
      piHeatingDemand: 0,       // Valve position 0-100% (actual heating indicator)
      systemMode: 'heat',       // 'heat' or 'off'
      battery: null,
      linkquality: null,
      lastSeen: null,
      available: true,
      syncing: false,
      // Network status (for device_leave detection)
      leftNetwork: false,       // True if device left Zigbee network
      leftAt: null,             // Timestamp when device left
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

      // Subscribe to bridge events to catch device_leave
      mqtt.client.subscribe('zigbee2mqtt/bridge/event', { qos: 0 });
      console.log('[thermostat-store] Subscribed to zigbee2mqtt/bridge/event');

      // Handle incoming messages
      mqtt.client.on('message', (topic, message) => {
        // Handle bridge events (device_leave, etc.)
        if (topic === 'zigbee2mqtt/bridge/event') {
          try {
            const event = JSON.parse(message.toString());
            if (event.type === 'device_leave') {
              const thermostat = this.list.find(t => t.sensor === event.data?.friendly_name);
              if (thermostat) {
                console.warn(`[thermostat-store] 🚨 Device LEFT network: ${thermostat.name}`);
                this.handleDeviceLeave(thermostat, event.data);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
          return;
        }

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
      // Use pi_heating_demand (valve position) to detect actual heating, not running_state (system mode)
      return this.list.filter(t => t.piHeatingDemand > 0).length;
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
      if (data.pi_heating_demand !== undefined) {
        thermostat.piHeatingDemand = data.pi_heating_demand;
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

    // Handle device leaving the Zigbee network (requires re-pairing)
    handleDeviceLeave(thermostat, eventData) {
      // Mark as unavailable with special flag
      thermostat.available = false;
      thermostat.leftNetwork = true;
      thermostat.leftAt = Date.now();

      // Add high-priority critical event
      this.addEvent({
        deviceId: thermostat.id,
        deviceName: thermostat.name,
        deviceIcon: thermostat.icon,
        roomId: thermostat.roomId,
        eventType: 'device_leave',
        time: Date.now(),
        message: `${thermostat.name} LEFT THE NETWORK - requires re-pairing`,
        ieeeAddress: eventData?.ieee_address
      });

      console.error(`[thermostat-store] 🚨 CRITICAL: ${thermostat.name} has LEFT the Zigbee network!`);
      console.error(`[thermostat-store] IEEE Address: ${eventData?.ieee_address}`);
      console.error(`[thermostat-store] Device needs to be re-paired to restore functionality.`);

      // Trigger notifications
      this.sendOfflineNotifications(thermostat);
    },

    // Send multi-channel notifications when device goes offline
    async sendOfflineNotifications(thermostat) {
      const message = `🚨 ${thermostat.name} thermostat LEFT the Zigbee network and needs re-pairing!`;

      // 1. Browser Push Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Thermostat Offline Alert', {
            body: message,
            icon: '/icons/warning.png',
            tag: `offline-${thermostat.id}`,
            requireInteraction: true,
            silent: false
          });
          console.log('[thermostat-store] Browser notification sent');
        } catch (e) {
          console.warn('[thermostat-store] Browser notification failed:', e);
        }
      }

      // 2. Home Assistant Notification (via MQTT)
      const mqtt = Alpine.store('mqtt');
      if (mqtt?.client && mqtt?.connected) {
        try {
          mqtt.client.publish('homeassistant/notify', JSON.stringify({
            title: 'Thermostat Offline',
            message: message,
            data: {
              push: { sound: 'alarm' },
              urgency: 'high'
            }
          }));
          console.log('[thermostat-store] Home Assistant notification published');
        } catch (e) {
          console.warn('[thermostat-store] Home Assistant notification failed:', e);
        }

        // 3. TTS Announcement
        try {
          mqtt.client.publish('dashboard/tts', JSON.stringify({
            message: `Warning! ${thermostat.name} thermostat has disconnected and needs attention.`,
            priority: 'high'
          }));
          console.log('[thermostat-store] TTS announcement published');
        } catch (e) {
          console.warn('[thermostat-store] TTS announcement failed:', e);
        }
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

      // Low battery detection (critical <10%, warning 10-20%)
      if (thermostat.battery !== null) {
        // Critical battery (<10%) - entered critical zone
        if (thermostat.battery < 10 && (prev.battery === null || prev.battery >= 10)) {
          this.addEvent({
            ...baseEvent,
            eventType: 'low_battery_critical',
            battery: thermostat.battery
          });
        }
        // Low battery warning (10-20%) - entered warning zone
        else if (thermostat.battery < 20 && thermostat.battery >= 10 &&
                 (prev.battery === null || prev.battery >= 20)) {
          this.addEvent({
            ...baseEvent,
            eventType: 'low_battery',
            battery: thermostat.battery
          });
        }
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
      // Deduplicate: Don't add if identical event exists within 5 seconds
      const isDuplicate = this.events.some(e =>
        e.deviceId === event.deviceId &&
        e.eventType === event.eventType &&
        Math.abs(e.time - event.time) < 5000
      );

      if (isDuplicate) return;

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

      // Clamp to valid range (5-22°C) - max 22° for energy efficiency
      const clampedTemp = Math.max(5, Math.min(22, temp));

      // Optimistic update
      thermostat.pendingTarget = clampedTemp;
      thermostat.syncing = true;

      this.publishCommand(thermostat, { occupied_heating_setpoint: clampedTemp });
    },

    adjustTemp(thermostatId, delta) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat) return;

      const currentTarget = thermostat.pendingTarget ?? thermostat.targetTemp ?? 20;
      const newTarget = Math.round(currentTarget + delta);  // 1° steps
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
      const deviceEvents = this.events
        .filter(e => e.deviceId === deviceId && e.time > cutoff)
        .sort((a, b) => a.time - b.time);  // Sort ASC for correct pairing

      // Filter to only heating start/stop events and dedupe spurious consecutive STARTs
      // A heater can't "start" twice - if we see START→START, keep only the first
      const heatingEvents = deviceEvents.filter(e =>
        e.eventType === 'heating_started' || e.eventType === 'heating_stopped'
      );

      const validStarts = [];
      const validStops = [];
      let lastEventType = null;

      for (const event of heatingEvents) {
        if (event.eventType === 'heating_started') {
          // Only count this START if we're not already in "started" state
          if (lastEventType !== 'heating_started') {
            validStarts.push(event);
            lastEventType = 'heating_started';
          }
          // else: spurious duplicate START, ignore it
        } else if (event.eventType === 'heating_stopped') {
          // Only count STOP if we were in "started" state
          if (lastEventType === 'heating_started') {
            validStops.push(event);
            lastEventType = 'heating_stopped';
          }
          // else: spurious STOP without START, ignore it
        }
      }

      // Build cycle list with correct pairing (now using deduplicated events)
      const cycles = [];
      let totalHeatingMs = 0;
      let stopIndex = 0;

      for (const start of validStarts) {
        // Find next stop AFTER this start (sequential, not find())
        while (stopIndex < validStops.length && validStops[stopIndex].time <= start.time) {
          stopIndex++;
        }

        const stop = validStops[stopIndex] || null;
        const durationMs = stop ? stop.time - start.time : null;

        if (durationMs && durationMs > 0) {
          totalHeatingMs += durationMs;
          stopIndex++;  // Consume this stop event
        }

        cycles.push({
          startTime: start.time,
          endTime: stop?.time || null,
          durationMinutes: durationMs ? Math.round(durationMs / 60000) : null,
          completed: !!stop && durationMs > 0
        });
      }

      // Sort cycles DESC for display (most recent first)
      cycles.sort((a, b) => b.startTime - a.startTime);
      const completedCount = cycles.filter(c => c.completed).length;

      return {
        // Use completedCount for both - semantically correct AND math adds up
        heatingCycles: completedCount,
        heatingMinutes: Math.round(totalHeatingMs / 60000),
        avgCycleMinutes: completedCount > 0 ? Math.round(totalHeatingMs / completedCount / 60000) : 0,
        // Also expose raw data for UI if needed
        totalStarts: validStarts.length,
        incompleteCount: validStarts.length - completedCount,
        cycles: cycles,
        lastCycle: cycles[0] || null,
        setpointChanges: deviceEvents.filter(e => e.eventType === 'setpoint_changed').length,
        targetReached: deviceEvents.filter(e => e.eventType === 'target_reached').length
      };
    }
  });
}
