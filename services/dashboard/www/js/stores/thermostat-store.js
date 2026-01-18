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
      runningState: 'idle',     // 'idle' or 'heat' - only reliable indicator for SONOFF TRVZB
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

    // Heater pause state (from HA guard flags via MQTT)
    heaterPause: {
      active: false,           // true when heaters are paused by automation
      reason: 'none',          // 'window' | 'co2' | 'none'
      windowGuard: false,
      co2Guard: false,
      co2Level: null,
      openWindows: [],         // Array of window names
      changedAt: null,         // Timestamp when pause started (for timer)
      lastUpdate: null         // Last MQTT message received
    },

    // Manual overrides per thermostat { [thermostatId]: { targetTemp, expiresAt, originalTemp } }
    // NOTE: This is for local UI state only - primary state comes from MQTT (boostOverrides)
    manualOverrides: {},

    // Boost overrides from Home Assistant (via MQTT)
    // { [thermostatId]: { active, target_temp, original_temp, expires_at } }
    boostOverrides: {},

    // Global boost MODE (enables 25°C limit for all thermostats)
    // State comes from MQTT (dashboard/global-boost-mode)
    globalBoostMode: {
      active: false,
      expiresAt: null,     // When boost mode ends (ms timestamp)
      _tick: 0             // Incremented every 30s to force timer re-render
    },

    // Night mode override state (for bedroom 17°C enforcement bypass)
    // State comes from MQTT (dashboard/bedroom-night-mode), not localStorage
    nightModeOverride: {
      nightModeActive: true,   // Is 17°C cap enforced? (true = enforced, false = not enforced)
      overrideActive: false,   // Is temporary override in effect?
      expiresAt: null          // When override ends (ms timestamp), null if not active
    },

    // CO2 override state (allows heaters when CO2 is high for 6 hours)
    // State comes from MQTT (dashboard/co2-override)
    co2Override: {
      active: false,
      expiresAt: null,     // When override ends (ms timestamp)
      co2Level: null,      // CO2 level when override started
      _tick: 0             // Incremented every 30s to force timer re-render
    },

    // HA API config
    haApiUrl: '/api/ha',
    haToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkZjJhY2UwMTBmNGY0Y2NiYTI0ZGZhMGUyZjg5NWYzNiIsImlhdCI6MTc2Njg1NjU1NywiZXhwIjoyMDgyMjE2NTU3fQ.2t04JrsGafT9hDhg0BniYG90i1O7a7DHqpdst9x3-no',

    // ============================================
    // INITIALIZATION
    // ============================================

    async init() {
      // Load historical events from InfluxDB first
      await this.loadHistoricalEvents(24);

      // Night mode state comes from MQTT (server-side, no localStorage)
      // Boost override state also comes from MQTT (HA manages timers)

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

      // Subscribe to heater guard state (for pause banner)
      mqtt.client.subscribe('dashboard/heater-guard/combined', { qos: 1 });
      console.log('[thermostat-store] Subscribed to dashboard/heater-guard/combined');

      // Subscribe to bedroom night mode state (for override banner)
      mqtt.client.subscribe('dashboard/bedroom-night-mode', { qos: 1 });
      console.log('[thermostat-store] Subscribed to dashboard/bedroom-night-mode');

      // Subscribe to thermostat boost state (for all thermostats)
      ['study', 'living_inner', 'living_outer', 'bedroom'].forEach(id => {
        mqtt.client.subscribe(`dashboard/thermostat-boost/${id}`, { qos: 1 });
      });
      console.log('[thermostat-store] Subscribed to dashboard/thermostat-boost/*');

      // Subscribe to global boost mode state
      mqtt.client.subscribe('dashboard/global-boost-mode', { qos: 1 });
      console.log('[thermostat-store] Subscribed to dashboard/global-boost-mode');

      // Subscribe to CO2 override state
      mqtt.client.subscribe('dashboard/co2-override', { qos: 1 });
      console.log('[thermostat-store] Subscribed to dashboard/co2-override');

      // PERFORMANCE: Use central dispatcher instead of client.on('message')
      // This prevents duplicate JSON parsing across multiple stores

      // Handle heater guard state (for pause banner)
      mqtt.registerTopicHandler('dashboard/heater-guard/combined', (topic, data) => {
        this.handleHeaterGuardUpdate(data);
      });

      // Handle bedroom night mode state (from HA automations)
      mqtt.registerTopicHandler('dashboard/bedroom-night-mode', (topic, data) => {
        this.handleNightModeUpdate(data);
      });

      // Handle thermostat boost state (from HA scripts)
      mqtt.registerTopicHandler('dashboard/thermostat-boost/*', (topic, data) => {
        const thermostatId = topic.split('/').pop();
        this.handleBoostUpdate(thermostatId, data);
      });

      // Handle global boost mode state (from HA scripts)
      mqtt.registerTopicHandler('dashboard/global-boost-mode', (topic, data) => {
        this.handleGlobalBoostModeUpdate(data);
      });

      // Handle CO2 override state (from HA scripts)
      mqtt.registerTopicHandler('dashboard/co2-override', (topic, data) => {
        this.handleCO2OverrideUpdate(data);
      });

      // Handle bridge events (device_leave, etc.)
      mqtt.registerTopicHandler('zigbee2mqtt/bridge/event', (topic, data) => {
        if (data.type === 'device_leave') {
          const thermostat = this.list.find(t => t.sensor === data.data?.friendly_name);
          if (thermostat) {
            console.warn(`[thermostat-store] 🚨 Device LEFT network: ${thermostat.name}`);
            this.handleDeviceLeave(thermostat, data.data);
          }
        }
      });

      // Handle thermostat data updates
      mqtt.registerTopicHandler(`${CONFIG.baseTopic}/*`, (topic, data, deviceName) => {
        // Skip non-thermostat devices
        const cleanName = deviceName.replace('/availability', '');
        const thermostat = CONFIG.thermostats.find(t => t.sensor === cleanName);
        if (!thermostat) return;

        if (topic.endsWith('/availability')) {
          const isOnline = data.state === 'online' || data === 'online';
          this.updateAvailability(cleanName, isOnline);
        } else {
          this.updateThermostat(cleanName, data);
        }
      });

      // Start timer tick for boost mode and CO2 override countdowns (every 30 seconds)
      setInterval(() => {
        if (this.globalBoostMode.active) {
          this.globalBoostMode._tick++;
        }
        if (this.co2Override.active) {
          this.co2Override._tick++;
        }
      }, 30000);

      this.initializing = false;
      console.log('[thermostat-store] Initialization complete (using central dispatcher)');
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
      // SONOFF TRVZB only exposes running_state for heating detection
      // (pi_heating_demand doesn't exist, valve_opening_degree is a config limit)
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
        // Only clear pendingTarget if heater confirmed our requested value
        // (or if we weren't waiting for anything)
        if (thermostat.pendingTarget === null ||
            thermostat.pendingTarget === data.occupied_heating_setpoint) {
          thermostat.pendingTarget = null;
        }
        // else: keep pendingTarget, user tapped again and we're still waiting
      }
      if (data.running_state !== undefined) {
        thermostat.runningState = data.running_state === 'heat' ? 'heat' : 'idle';
      }
      // Note: valve_opening_degree is a config limit, not current position - not useful for heating detection
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
      // Only clear syncing if we're not waiting for a different setpoint
      if (thermostat.pendingTarget === null) {
        thermostat.syncing = false;
      }
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
    // HEATER PAUSE STATE (from HA automations)
    // ============================================

    /**
     * Handle heater guard state update from Home Assistant
     * Updates the heaterPause state for dashboard banner display
     */
    handleHeaterGuardUpdate(data) {
      const wasActive = this.heaterPause.active;
      const existingChangedAt = this.heaterPause.changedAt;

      this.heaterPause = {
        active: data.active ?? false,
        reason: data.reason ?? 'none',
        windowGuard: data.window_guard ?? false,
        co2Guard: data.co2_guard ?? false,
        co2Level: data.co2_level ?? null,
        openWindows: data.open_windows ?? [],
        changedAt: wasActive && existingChangedAt
          ? existingChangedAt  // Preserve original pause start time
          : (data.changed_at ? data.changed_at * 1000 : Date.now()),
        lastUpdate: Date.now()
      };

      // Log state changes
      if (data.active && !wasActive) {
        console.log(`[thermostat-store] Heaters PAUSED due to ${data.reason}`);
        if (data.reason === 'window') {
          console.log(`[thermostat-store] Open windows: ${data.open_windows?.join(', ') || 'Unknown'}`);
        } else if (data.reason === 'co2') {
          console.log(`[thermostat-store] CO2 level: ${data.co2_level} ppm`);
        }
      } else if (!data.active && wasActive) {
        console.log('[thermostat-store] Heaters RESUMED');
      }
    },

    /**
     * Handle bedroom night mode state update from MQTT
     * Updates nightModeOverride state for dashboard UI
     * Payload: { active: bool, override_active: bool, override_expires: string|null }
     */
    handleNightModeUpdate(data) {
      const wasOverrideActive = this.nightModeOverride.overrideActive;

      this.nightModeOverride = {
        nightModeActive: data.active ?? true,
        overrideActive: data.override_active ?? false,
        expiresAt: data.override_expires ? new Date(data.override_expires).getTime() : null
      };

      // Log state changes
      if (data.override_active && !wasOverrideActive) {
        const expiresStr = data.override_expires ? data.override_expires.substring(11, 16) : '?';
        console.log(`[thermostat-store] Night mode OVERRIDE started (expires ${expiresStr})`);
      } else if (!data.override_active && wasOverrideActive) {
        console.log('[thermostat-store] Night mode override ENDED');
      } else if (data.active) {
        console.log('[thermostat-store] Night mode ACTIVE (17°C cap enforced)');
      } else {
        console.log('[thermostat-store] Night mode INACTIVE');
      }
    },

    /**
     * Handle thermostat boost state update from MQTT
     * Updates boostOverrides state for dashboard UI
     * Payload: { active: bool, target_temp?: number, original_temp?: number, expires_at?: string }
     */
    handleBoostUpdate(thermostatId, data) {
      const wasActive = this.boostOverrides[thermostatId]?.active ?? false;

      if (data.active) {
        this.boostOverrides[thermostatId] = {
          active: true,
          targetTemp: data.target_temp ?? 22,
          originalTemp: data.original_temp ?? 17,
          expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null
        };

        if (!wasActive) {
          const expiresStr = data.expires_at ? data.expires_at.substring(11, 16) : '?';
          console.log(`[thermostat-store] Boost STARTED for ${thermostatId}: 22°C until ${expiresStr}`);
        }
      } else {
        this.boostOverrides[thermostatId] = { active: false };

        if (wasActive) {
          console.log(`[thermostat-store] Boost ENDED for ${thermostatId}`);
        }
      }
    },

    // ============================================
    // GLOBAL BOOST MODE (25°C limit for all thermostats)
    // ============================================

    /**
     * Handle global boost mode state update from MQTT
     */
    handleGlobalBoostModeUpdate(data) {
      const wasActive = this.globalBoostMode.active;

      if (data.active) {
        this.globalBoostMode = {
          active: true,
          expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null
        };

        if (!wasActive) {
          const expiresStr = data.expires_at ? data.expires_at.substring(11, 16) : '?';
          console.log(`[thermostat-store] GLOBAL Boost Mode ENABLED until ${expiresStr}`);
        }
      } else {
        this.globalBoostMode = { active: false, expiresAt: null };

        if (wasActive) {
          console.log('[thermostat-store] GLOBAL Boost Mode DISABLED');
        }
      }
    },

    /**
     * Check if global boost mode is active
     */
    isGlobalBoostModeActive() {
      return this.globalBoostMode.active ?? false;
    },

    /**
     * Get global boost mode time remaining
     * @returns {string} Formatted time remaining (e.g., "45m")
     */
    getGlobalBoostModeTimeRemaining() {
      // Reference _tick to trigger Alpine reactivity when it updates
      const _ = this.globalBoostMode._tick;

      if (!this.globalBoostMode.active || !this.globalBoostMode.expiresAt) return '';

      const remaining = this.globalBoostMode.expiresAt - Date.now();
      if (remaining <= 0) return 'Expired';

      const minutes = Math.floor(remaining / (60 * 1000));
      return `${minutes}m`;
    },

    /**
     * Enable global boost mode (calls HA script)
     */
    async enableGlobalBoostMode() {
      // Optimistically update state immediately for responsive UI
      const expiresAt = Date.now() + 60 * 60 * 1000; // 60 minutes from now
      this.globalBoostMode = {
        active: true,
        expiresAt: expiresAt
      };
      console.log('[thermostat-store] Global boost mode ENABLED (optimistic) until', new Date(expiresAt).toLocaleTimeString());

      try {
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.global_boost_mode_start'
        });
        console.log('[thermostat-store] Global boost mode confirmed by HA');
      } catch (err) {
        console.error('[thermostat-store] HA call failed (state remains optimistic):', err);
        // Keep optimistic state - MQTT will sync if HA eventually processes it
      }
    },

    /**
     * Disable global boost mode (calls HA script)
     */
    async disableGlobalBoostMode() {
      // Optimistically update state immediately for responsive UI
      this.globalBoostMode = {
        active: false,
        expiresAt: null
      };
      console.log('[thermostat-store] Global boost mode DISABLED (optimistic)');

      try {
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.global_boost_mode_cancel'
        });
        console.log('[thermostat-store] Global boost mode disable confirmed by HA');
      } catch (err) {
        console.error('[thermostat-store] HA call failed (state remains optimistic):', err);
        // Keep optimistic state - MQTT will sync if HA eventually processes it
      }
    },

    /**
     * Check if a thermostat has an active boost (from MQTT state)
     */
    hasBoostActive(thermostatId) {
      return this.boostOverrides[thermostatId]?.active ?? false;
    },

    /**
     * Get boost time remaining for a thermostat
     * @returns {string} Formatted time remaining (e.g., "45m")
     */
    getBoostTimeRemaining(thermostatId) {
      const boost = this.boostOverrides[thermostatId];
      if (!boost?.active || !boost.expiresAt) return '';

      const remaining = boost.expiresAt - Date.now();
      if (remaining <= 0) return 'Expired';

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    },

    /**
     * Request boost for a thermostat (calls HA script)
     */
    async requestBoost(thermostatId) {
      try {
        console.log(`[thermostat-store] Requesting boost for ${thermostatId}...`);
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.thermostat_boost_start',
          variables: { thermostat_id: thermostatId }
        });
        console.log(`[thermostat-store] Boost request sent for ${thermostatId}`);
      } catch (err) {
        console.error(`[thermostat-store] Failed to request boost for ${thermostatId}:`, err);
      }
    },

    /**
     * Cancel boost for a thermostat (calls HA script)
     */
    async cancelBoost(thermostatId) {
      try {
        console.log(`[thermostat-store] Canceling boost for ${thermostatId}...`);
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.thermostat_boost_cancel',
          variables: { thermostat_id: thermostatId }
        });
        console.log(`[thermostat-store] Boost cancel sent for ${thermostatId}`);
      } catch (err) {
        console.error(`[thermostat-store] Failed to cancel boost for ${thermostatId}:`, err);
      }
    },

    // ============================================
    // CO2 OVERRIDE
    // ============================================

    /**
     * Handle CO2 override state update from MQTT
     */
    handleCO2OverrideUpdate(data) {
      const wasActive = this.co2Override.active;

      if (data.active) {
        this.co2Override = {
          active: true,
          expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null,
          co2Level: data.co2_level || null,
          _tick: this.co2Override._tick || 0
        };

        if (!wasActive) {
          const expiresStr = data.expires_at ? data.expires_at.substring(11, 16) : '?';
          console.log(`[thermostat-store] CO2 Override ENABLED until ${expiresStr}`);
        }
      } else {
        this.co2Override = { active: false, expiresAt: null, co2Level: null, _tick: 0 };

        if (wasActive) {
          console.log('[thermostat-store] CO2 Override DISABLED');
        }
      }
    },

    /**
     * Check if CO2 override is active
     */
    isCO2OverrideActive() {
      return this.co2Override.active ?? false;
    },

    /**
     * Get CO2 override time remaining
     * @returns {string} Formatted time remaining (e.g., "5h 42m")
     */
    getCO2OverrideTimeRemaining() {
      // Reference _tick to trigger Alpine reactivity when it updates
      const _ = this.co2Override._tick;

      if (!this.co2Override.active || !this.co2Override.expiresAt) return '';

      const remaining = this.co2Override.expiresAt - Date.now();
      if (remaining <= 0) return 'Expired';

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    },

    /**
     * Enable CO2 override (calls HA script)
     */
    async enableCO2Override() {
      // Optimistically update state immediately for responsive UI
      const expiresAt = Date.now() + 6 * 60 * 60 * 1000; // 6 hours from now
      this.co2Override = {
        active: true,
        expiresAt: expiresAt,
        co2Level: this.heaterPause.co2Level || null,
        _tick: 0
      };
      console.log('[thermostat-store] CO2 Override ENABLED (optimistic) until', new Date(expiresAt).toLocaleTimeString());

      try {
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.co2_override_start'
        });
        console.log('[thermostat-store] CO2 Override confirmed by HA');
      } catch (err) {
        console.error('[thermostat-store] HA call failed (state remains optimistic):', err);
        // Keep optimistic state - MQTT will sync if HA eventually processes it
      }
    },

    /**
     * Disable CO2 override (calls HA script)
     */
    async disableCO2Override() {
      // Optimistically update state immediately for responsive UI
      this.co2Override = {
        active: false,
        expiresAt: null,
        co2Level: null,
        _tick: 0
      };
      console.log('[thermostat-store] CO2 Override DISABLED (optimistic)');

      try {
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.co2_override_cancel'
        });
        console.log('[thermostat-store] CO2 Override disable confirmed by HA');
      } catch (err) {
        console.error('[thermostat-store] HA call failed (state remains optimistic):', err);
        // Keep optimistic state - MQTT will sync if HA eventually processes it
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

      // Check if ANY boost is active:
      // - Per-thermostat boost (from boostOverrides)
      // - OR Global boost MODE (from globalBoostMode)
      const hasPerThermostatBoost = this.boostOverrides[thermostatId]?.active ?? false;
      const hasGlobalBoostMode = this.globalBoostMode.active ?? false;
      const hasBoost = hasPerThermostatBoost || hasGlobalBoostMode;
      const maxTemp = hasBoost ? 25 : 22;  // 25°C during boost, 22°C otherwise

      // Clamp to valid range (5-maxTemp)
      const clampedTemp = Math.max(5, Math.min(maxTemp, temp));

      // Debug logging to verify boost state detection
      console.log(`[thermostat-store] setTargetTemp: id=${thermostatId}, perBoost=${hasPerThermostatBoost}, globalBoost=${hasGlobalBoostMode}, maxTemp=${maxTemp}, requested=${temp}, clamped=${clampedTemp}`);

      // Optimistic update
      thermostat.pendingTarget = clampedTemp;
      thermostat.syncing = true;

      // Just set the temperature. HA handles all scheduling.
      // Don't use TRV internal modes (timer/boost) - they cause stale target issues.
      // See: 2026-01-18 incident where timer_mode_target_temp (23°C) overrode setpoint (18°C)
      this.publishCommand(thermostat, {
        occupied_heating_setpoint: clampedTemp
      });
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
        Alpine.store('notifications')?.error('Connection Lost', 'Cannot send command - MQTT disconnected');
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
          Alpine.store('notifications')?.error('Command Failed', `Failed to update ${thermostat.name}`);
          thermostat.syncing = false;
          thermostat.pendingTarget = null;
        } else {
          // Clear syncing after timeout if no response
          setTimeout(() => {
            if (thermostat.syncing) {
              Alpine.store('notifications')?.warning('No Response', `${thermostat.name} did not acknowledge`);
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
    // MANUAL OVERRIDE METHODS
    // ============================================

    /**
     * Set a manual temperature override for a thermostat
     * @param {string} thermostatId - The thermostat ID (e.g., 'bedroom')
     * @param {number} targetTemp - Target temperature in °C
     * @param {Date|number} expiresAt - When the override expires (Date or timestamp)
     */
    setManualOverride(thermostatId, targetTemp, expiresAt) {
      const thermostat = this.list.find(t => t.id === thermostatId);
      if (!thermostat) {
        console.error('[thermostat-store] Cannot set override: thermostat not found:', thermostatId);
        return;
      }

      // Store original temp before override
      const originalTemp = thermostat.targetTemp;
      const expiresTimestamp = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt;

      this.manualOverrides[thermostatId] = {
        targetTemp,
        expiresAt: expiresTimestamp,
        originalTemp,
        setAt: Date.now()
      };

      // If bedroom during night hours and boosting above 17°C, trigger night mode bypass
      if (thermostatId === 'bedroom' && targetTemp > 17) {
        const hour = new Date().getHours();
        if (hour >= 23 || hour < 6) {
          console.log('[thermostat-store] Bedroom boost during night mode - triggering bypass');
          this.requestNightModeOverride();
        }
      }

      // Apply the override temperature
      this.setTargetTemp(thermostatId, targetTemp);

      console.log(`[thermostat-store] Manual override set for ${thermostat.name}: ${targetTemp}°C until ${new Date(expiresTimestamp).toLocaleTimeString()}`);

      // Schedule automatic removal when override expires
      const timeUntilExpiry = expiresTimestamp - Date.now();
      if (timeUntilExpiry > 0) {
        setTimeout(() => {
          this.removeManualOverride(thermostatId, true);
        }, timeUntilExpiry);
      }
    },

    /**
     * Remove a manual override (restore original temp or keep current)
     * @param {string} thermostatId - The thermostat ID
     * @param {boolean} expired - Whether this is an automatic removal due to expiry
     */
    removeManualOverride(thermostatId, expired = false) {
      const override = this.manualOverrides[thermostatId];
      if (!override) return;

      const thermostat = this.list.find(t => t.id === thermostatId);

      // Restore original temperature if it was stored
      if (override.originalTemp !== null && override.originalTemp !== undefined) {
        this.setTargetTemp(thermostatId, override.originalTemp);
        console.log(`[thermostat-store] Override ${expired ? 'expired' : 'removed'} for ${thermostat?.name || thermostatId}, restoring to ${override.originalTemp}°C`);
      }

      delete this.manualOverrides[thermostatId];
    },

    /**
     * Check if a thermostat has an active manual override
     * @param {string} thermostatId - The thermostat ID
     * @returns {object|null} Override data or null
     */
    getManualOverride(thermostatId) {
      const override = this.manualOverrides[thermostatId];
      if (!override) return null;

      // Check if expired
      if (Date.now() > override.expiresAt) {
        this.removeManualOverride(thermostatId, true);
        return null;
      }

      return override;
    },

    /**
     * Get time remaining for an override
     * @param {string} thermostatId - The thermostat ID
     * @returns {string} Formatted time remaining (e.g., "1h 30m")
     */
    getOverrideTimeRemaining(thermostatId) {
      const override = this.getManualOverride(thermostatId);
      if (!override) return '';

      const remaining = override.expiresAt - Date.now();
      if (remaining <= 0) return 'Expired';

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    },

    // ============================================
    // HOME ASSISTANT SERVICE CALLS
    // ============================================

    /**
     * Call a Home Assistant service via the API proxy
     * @param {string} domain - Service domain (e.g., 'input_boolean')
     * @param {string} service - Service name (e.g., 'turn_off')
     * @param {object} data - Service data
     */
    async callHAService(domain, service, data = {}) {
      try {
        const response = await fetch(`${this.haApiUrl}/services/${domain}/${service}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.haToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`[thermostat-store] HA service called: ${domain}.${service}`, data);
        return await response.json();
      } catch (err) {
        console.error(`[thermostat-store] HA service call failed: ${domain}.${service}`, err);
        throw err;
      }
    },

    /**
     * Request night mode override (calls HA script)
     * Dashboard button calls this; HA handles all state management
     * The script will:
     *   1. Set input_datetime.bedroom_night_override_end to now + 90 min
     *   2. Turn off input_boolean.bedroom_night_mode_active
     *   3. Publish state to MQTT (which updates this store)
     */
    async requestNightModeOverride() {
      try {
        console.log('[thermostat-store] Requesting night mode override from HA...');
        await this.callHAService('script', 'turn_on', {
          entity_id: 'script.bedroom_night_override_start'
        });
        // UI updates automatically via MQTT when HA publishes state
        console.log('[thermostat-store] Night mode override request sent');
      } catch (err) {
        console.error('[thermostat-store] Failed to request night mode override:', err);
      }
    },

    /**
     * Get time remaining for night mode override
     * @returns {string} Formatted time remaining (e.g., "1h 30m")
     */
    getNightModeOverrideRemaining() {
      if (!this.nightModeOverride.overrideActive || !this.nightModeOverride.expiresAt) {
        return '';
      }

      const remaining = this.nightModeOverride.expiresAt - Date.now();
      if (remaining <= 0) return 'Expired';

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
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
