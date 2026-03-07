/**
 * TTS Log Store
 * Manages automation overview (from HA API) and live TTS event log (from MQTT + InfluxDB)
 *
 * Data sources:
 * - HA REST API: automation states (last_triggered, enabled/disabled)
 * - MQTT: dashboard/tts (real-time TTS events)
 * - InfluxDB: tts_events measurement (historical TTS events)
 */

export function initTtsLogStore(Alpine, CONFIG) {
  Alpine.store('ttsLog', {
    // =====================================================================
    // AUTOMATION OVERVIEW
    // =====================================================================

    // Hardcoded automation config (static metadata + live state from HA API)
    automations: [
      // CO2
      { id: 'co2_high_alert', name: 'CO2 High', category: 'co2', icon: '💨',
        triggerDesc: 'CO2 > 1200 ppm', repeatDesc: 'No (30min cooldown)', quietHours: '07:00-23:00' },
      { id: 'co2_critical_alert', name: 'CO2 Critical', category: 'co2', icon: '🚨',
        triggerDesc: 'CO2 > 1600 ppm', repeatDesc: 'Every 10 min', quietHours: '07:00-23:00' },
      { id: 'co2_good_level', name: 'CO2 Good', category: 'co2', icon: '✅',
        triggerDesc: 'CO2 < 500 ppm', repeatDesc: 'No', quietHours: '07:00-23:00' },
      { id: 'co2_high_turn_off_heaters', name: 'CO2 Heater Shutoff', category: 'co2', icon: '⚠️',
        triggerDesc: 'CO2 > 1200 ppm', repeatDesc: 'No', quietHours: 'None' },
      { id: 'co2_low_resume_heaters', name: 'CO2 Resume Heaters', category: 'co2', icon: '🔄',
        triggerDesc: 'CO2 < 1100 + windows closed', repeatDesc: 'No', quietHours: 'None' },
      { id: 'prevent_heating_if_co2_high', name: 'Prevent Heat (CO2)', category: 'co2', icon: '🛡️',
        triggerDesc: 'Heater starts + CO2 > 1200', repeatDesc: 'No', quietHours: 'None' },

      // Window/Door
      { id: 'window_open_too_long', name: 'Window Open Too Long', category: 'window', icon: '🪟',
        triggerDesc: '5min (freezing) / 10min (standard)', repeatDesc: '1-60 min (by temp)', quietHours: 'None (24/7)' },
      { id: 'main_door_open_too_long', name: 'Main Door Alert', category: 'window', icon: '🚪',
        triggerDesc: 'Door open > 3 min', repeatDesc: 'Every 5 min', quietHours: 'None (24/7)' },
      { id: 'window_open_cold_weather_alert', name: 'Cold Weather Alert', category: 'window', icon: '🥶',
        triggerDesc: 'Open > 15 min + < 18C', repeatDesc: 'Every 2 min', quietHours: 'None (24/7)' },
      { id: 'all_windows_closed_resume_heaters', name: 'Windows Closed Resume', category: 'window', icon: '🔄',
        triggerDesc: 'All sensors closed', repeatDesc: 'No', quietHours: 'None' },
      { id: 'window_open_turn_off_heaters', name: 'Window Heater Shutoff', category: 'window', icon: '⚠️',
        triggerDesc: 'Window open 30s', repeatDesc: 'No', quietHours: 'None (24/7)' },
      { id: 'door_open_turn_off_heaters', name: 'Door Heater Shutoff', category: 'window', icon: '⚠️',
        triggerDesc: 'Door open 2 min', repeatDesc: 'No', quietHours: 'None (24/7)' },
      { id: 'prevent_heating_if_window_open', name: 'Prevent Heat (Window)', category: 'window', icon: '🛡️',
        triggerDesc: 'Heater starts + window open', repeatDesc: 'No', quietHours: 'None (24/7)' },

      // Heater
      { id: 'study_heater_started', name: 'Study Started', category: 'heater', icon: '🔥',
        triggerDesc: 'hvac_action: heating', repeatDesc: 'No', quietHours: 'None' },
      { id: 'study_heater_stopped', name: 'Study Stopped', category: 'heater', icon: '❄️',
        triggerDesc: 'hvac_action: idle', repeatDesc: 'No', quietHours: 'None' },
      { id: 'living_inner_heater_started', name: 'Living Inner Started', category: 'heater', icon: '🔥',
        triggerDesc: 'hvac_action: heating', repeatDesc: 'No', quietHours: 'None' },
      { id: 'living_inner_heater_stopped', name: 'Living Inner Stopped', category: 'heater', icon: '❄️',
        triggerDesc: 'hvac_action: idle', repeatDesc: 'No', quietHours: 'None' },
      { id: 'living_outer_heater_started', name: 'Living Outer Started', category: 'heater', icon: '🔥',
        triggerDesc: 'hvac_action: heating', repeatDesc: 'No', quietHours: 'None' },
      { id: 'living_outer_heater_stopped', name: 'Living Outer Stopped', category: 'heater', icon: '❄️',
        triggerDesc: 'hvac_action: idle', repeatDesc: 'No', quietHours: 'None' },
      { id: 'bed_heater_started', name: 'Bedroom Started', category: 'heater', icon: '🔥',
        triggerDesc: 'hvac_action: heating', repeatDesc: 'No', quietHours: 'None' },
      { id: 'bed_heater_stopped', name: 'Bedroom Stopped', category: 'heater', icon: '❄️',
        triggerDesc: 'hvac_action: idle', repeatDesc: 'No', quietHours: 'None' },
      { id: 'temperature_reached_energy_cap', name: 'Energy Cap', category: 'heater', icon: '⚡',
        triggerDesc: 'Room >= 21C, setpoint > 19C', repeatDesc: 'No', quietHours: 'None' },

      // Recovery
      { id: 'thermostat_zombie_state_recovery', name: 'Zombie Recovery', category: 'recovery', icon: '🧟',
        triggerDesc: 'TRV stuck in OFF mode', repeatDesc: 'No', quietHours: 'None' },
      { id: 'thermostat_stuck_idle_recovery', name: 'Stuck-Idle Recovery', category: 'recovery', icon: '🔧',
        triggerDesc: 'Heat mode + idle > 60min', repeatDesc: 'No', quietHours: 'None' },

      // Other
      { id: 'mailbox_motion_alert', name: 'Mailbox Motion', category: 'other', icon: '📬',
        triggerDesc: 'Motion detected', repeatDesc: 'No (30s cooldown)', quietHours: '07:00-23:00' },
      { id: 'kitchen_presence_light_reminder', name: 'Kitchen Light', category: 'other', icon: '💡',
        triggerDesc: 'Light on + no presence', repeatDesc: 'Every 3 min', quietHours: '07:00-23:00' }
    ],

    // Live state from HA API (keyed by automation id)
    automationStates: {},
    automationsLoading: false,
    automationsError: null,

    // Category metadata for display
    categories: [
      { id: 'co2', name: 'CO2 Alerts', icon: '💨' },
      { id: 'window', name: 'Window & Door', icon: '🪟' },
      { id: 'heater', name: 'Heater Notifications', icon: '🔥' },
      { id: 'recovery', name: 'Recovery', icon: '🔧' },
      { id: 'other', name: 'Other', icon: '📋' }
    ],

    // =====================================================================
    // TTS EVENT LOG
    // =====================================================================

    events: [],           // TTS events (newest first)
    eventsLoading: false,
    eventsError: null,
    MAX_EVENTS: 100,

    // =====================================================================
    // PAUSE STATE
    // =====================================================================

    pausedAutomations: {},  // { [automationId]: { resumeAt: timestamp, timerId: number } }
    _pauseTick: 0,          // Incremented every 30s to drive reactive countdown updates

    // =====================================================================
    // LIFECYCLE
    // =====================================================================

    viewActive: false,
    _mqttSetup: false,
    _unsubscribeFns: [],
    _mqttRetryTimer: null,
    _pollTimer: null,
    _pauseTickTimer: null,

    // HA API config (same pattern as weather-store.js)
    haUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://pi:8123'
      : `${window.location.protocol}//${window.location.hostname}:8123`,
    haToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkZjJhY2UwMTBmNGY0Y2NiYTI0ZGZhMGUyZjg5NWYzNiIsImlhdCI6MTc2Njg1NjU1NywiZXhwIjoyMDgyMjE2NTU3fQ.2t04JrsGafT9hDhg0BniYG90i1O7a7DHqpdst9x3-no',

    activate() {
      if (this.viewActive) return;
      this.viewActive = true;
      this.restorePausedAutomations();
      this.setupMqttListeners();
      this.loadHistorical();
      this.fetchAutomationStates();
      // Poll automation states every 60s
      this._pollTimer = setInterval(() => {
        if (this.viewActive) this.fetchAutomationStates();
      }, 60000);
      // Tick every 30s to update pause countdowns
      this._pauseTickTimer = setInterval(() => {
        if (Object.keys(this.pausedAutomations).length > 0) {
          this._pauseTick++;
        }
      }, 30000);
    },

    deactivate() {
      this.viewActive = false;
      this.cleanupMqttListeners();
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
      if (this._pauseTickTimer) {
        clearInterval(this._pauseTickTimer);
        this._pauseTickTimer = null;
      }
    },

    // =====================================================================
    // HA API - AUTOMATION STATES
    // =====================================================================

    async fetchAutomationStates() {
      this.automationsLoading = true;
      this.automationsError = null;

      try {
        const response = await fetch(`${this.haUrl}/api/states`, {
          headers: {
            'Authorization': `Bearer ${this.haToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const allStates = await response.json();

        // Build set of automation entity IDs we care about
        const targetIds = new Set(this.automations.map(a => `automation.${a.id}`));

        // Filter and map
        const states = {};
        for (const entity of allStates) {
          if (targetIds.has(entity.entity_id)) {
            const id = entity.entity_id.replace('automation.', '');
            states[id] = {
              state: entity.state,  // 'on' or 'off'
              lastTriggered: entity.attributes?.last_triggered || null,
              friendlyName: entity.attributes?.friendly_name || null
            };
          }
        }

        this.automationStates = states;
        console.log(`[ttsLog] Loaded ${Object.keys(states).length} automation states`);
      } catch (err) {
        console.error('[ttsLog] Failed to fetch automation states:', err);
        this.automationsError = err.message;
      } finally {
        this.automationsLoading = false;
      }
    },

    /**
     * Get state for a specific automation
     */
    getAutomationState(id) {
      return this.automationStates[id] || { state: null, lastTriggered: null };
    },

    /**
     * Get automations grouped by category
     */
    getAutomationsByCategory() {
      return this.categories.map(cat => ({
        ...cat,
        automations: this.automations.filter(a => a.category === cat.id)
      }));
    },

    // =====================================================================
    // PAUSE / RESUME
    // =====================================================================

    async pauseAutomation(id, durationMinutes) {
      try {
        const response = await fetch(`${this.haUrl}/api/services/automation/turn_off`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.haToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ entity_id: `automation.${id}` })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const resumeAt = Date.now() + durationMinutes * 60000;
        const timerId = setTimeout(() => this.resumeAutomation(id), durationMinutes * 60000);
        this.pausedAutomations = { ...this.pausedAutomations, [id]: { resumeAt, timerId } };
        this._persistPauses();

        console.log(`[ttsLog] Paused automation.${id} for ${durationMinutes}min`);
        await this.fetchAutomationStates();
      } catch (err) {
        console.error(`[ttsLog] Failed to pause automation.${id}:`, err);
      }
    },

    async resumeAutomation(id) {
      // Clear the timer early (safe even if it already fired)
      const paused = this.pausedAutomations[id];
      if (paused?.timerId) clearTimeout(paused.timerId);

      try {
        const response = await fetch(`${this.haUrl}/api/services/automation/turn_on`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.haToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ entity_id: `automation.${id}` })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Only clear local pause state after API confirms success
        const updated = { ...this.pausedAutomations };
        delete updated[id];
        this.pausedAutomations = updated;
        this._persistPauses();

        console.log(`[ttsLog] Resumed automation.${id}`);
        await this.fetchAutomationStates();
      } catch (err) {
        console.error(`[ttsLog] Failed to resume automation.${id}:`, err);
      }
    },

    /**
     * Persist pause timestamps to localStorage so they survive page refresh.
     * Only stores { [id]: resumeAt } - timers are recreated on restore.
     */
    _persistPauses() {
      const data = {};
      for (const [id, entry] of Object.entries(this.pausedAutomations)) {
        data[id] = entry.resumeAt;
      }
      try {
        localStorage.setItem('ttsLog_pauses', JSON.stringify(data));
      } catch (e) { /* localStorage full or unavailable */ }
    },

    /**
     * Restore pauses from localStorage. Resume expired ones, restart timers for active ones.
     */
    restorePausedAutomations() {
      let data;
      try {
        data = JSON.parse(localStorage.getItem('ttsLog_pauses') || '{}');
      } catch (e) { return; }

      const now = Date.now();
      for (const [id, resumeAt] of Object.entries(data)) {
        if (resumeAt <= now) {
          // Expired while page was closed - re-enable automation
          console.log(`[ttsLog] Restoring expired pause for ${id} - resuming`);
          this.resumeAutomation(id);
        } else {
          // Still active - restart timer for remaining duration
          const remaining = resumeAt - now;
          console.log(`[ttsLog] Restoring active pause for ${id} - ${Math.round(remaining / 60000)}min left`);
          const timerId = setTimeout(() => this.resumeAutomation(id), remaining);
          this.pausedAutomations = { ...this.pausedAutomations, [id]: { resumeAt, timerId } };
        }
      }
    },

    isPaused(id) {
      return !!this.pausedAutomations[id];
    },

    getPauseRemaining(id) {
      // Reference _pauseTick to trigger Alpine reactivity on tick
      void this._pauseTick;
      const paused = this.pausedAutomations[id];
      if (!paused) return null;
      const remaining = paused.resumeAt - Date.now();
      if (remaining <= 0) return '< 1m';
      const hours = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    },

    // =====================================================================
    // MQTT LISTENERS
    // =====================================================================

    setupMqttListeners() {
      if (this._mqttSetup) return;

      const mqtt = Alpine.store('mqtt');
      if (!mqtt?.client) {
        this._mqttRetryTimer = setTimeout(() => this.setupMqttListeners(), 2000);
        return;
      }

      this._mqttSetup = true;

      const unsubTts = mqtt.registerTopicHandler('dashboard/tts', (topic, payload) => {
        this.handleTtsEvent(payload);
      });
      this._unsubscribeFns.push(unsubTts);

      console.log('[ttsLog] MQTT listeners active');
    },

    cleanupMqttListeners() {
      if (this._mqttRetryTimer) {
        clearTimeout(this._mqttRetryTimer);
        this._mqttRetryTimer = null;
      }
      this._unsubscribeFns.forEach(fn => fn());
      this._unsubscribeFns = [];
      this._mqttSetup = false;
      console.log('[ttsLog] MQTT listeners cleaned up');
    },

    // =====================================================================
    // TTS EVENT HANDLERS
    // =====================================================================

    handleTtsEvent(payload) {
      const event = {
        id: `tts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
        message: payload.message || '',
        automation: payload.automation || 'unknown',
        success: payload.success === true,
        allAvailable: payload.all_available === true,
        devices: payload.devices || []
      };

      // Insert sorted (newest first)
      const insertIdx = this.events.findIndex(e => e.timestamp < event.timestamp);
      if (insertIdx === -1) {
        this.events.push(event);
      } else {
        this.events.splice(insertIdx, 0, event);
      }

      // Trim
      if (this.events.length > this.MAX_EVENTS) {
        this.events = this.events.slice(0, this.MAX_EVENTS);
      }
    },

    // =====================================================================
    // INFLUXDB HISTORICAL LOAD
    // =====================================================================

    async loadHistorical(hours = 24) {
      this.eventsLoading = true;
      this.eventsError = null;

      try {
        const query = `SELECT * FROM "tts_events" WHERE time > now() - ${hours}h ORDER BY time DESC LIMIT ${this.MAX_EVENTS}`;
        const response = await fetch(
          `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          throw new Error(`InfluxDB query failed: ${response.status}`);
        }

        const data = await response.json();
        const series = data.results?.[0]?.series?.[0];

        if (!series?.values) {
          console.log('[ttsLog] No historical TTS events found');
          return;
        }

        const columns = series.columns;
        const timeIdx = columns.indexOf('time');
        const messageIdx = columns.indexOf('message');
        const successIdx = columns.indexOf('success');
        const allAvailableIdx = columns.indexOf('all_available');
        const automationIdx = columns.indexOf('automation');
        const devicesJsonIdx = columns.indexOf('devices_json');

        const historical = series.values.map((row, idx) => {
          let devices = [];
          try {
            if (row[devicesJsonIdx]) devices = JSON.parse(row[devicesJsonIdx]);
          } catch (e) { /* ignore parse errors */ }

          return {
            id: `tts-hist-${idx}-${new Date(row[timeIdx]).getTime()}`,
            timestamp: new Date(row[timeIdx]).getTime(),
            message: row[messageIdx] || '',
            automation: row[automationIdx] || 'unknown',
            success: row[successIdx] === true || row[successIdx] === 'true',
            allAvailable: row[allAvailableIdx] === true || row[allAvailableIdx] === 'true',
            devices: devices
          };
        });

        // Merge with any real-time events already received
        // Dedup by timestamp proximity (within 2s) + same message, since MQTT and
        // InfluxDB events have different ID formats and can't match by ID
        const merged = [...this.events];
        for (const h of historical) {
          const isDupe = merged.some(e =>
            Math.abs(e.timestamp - h.timestamp) < 2000 && e.message === h.message
          );
          if (!isDupe) {
            merged.push(h);
          }
        }
        merged.sort((a, b) => b.timestamp - a.timestamp);
        this.events = merged.slice(0, this.MAX_EVENTS);

        console.log(`[ttsLog] Loaded ${historical.length} historical TTS events`);
      } catch (err) {
        console.error('[ttsLog] Historical load error:', err);
        this.eventsError = err.message;
      } finally {
        this.eventsLoading = false;
      }
    },

    // =====================================================================
    // FORMATTING HELPERS
    // =====================================================================

    formatRelativeTime(timestamp) {
      if (!timestamp) return 'Never';
      const ts = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
      const seconds = Math.floor((Date.now() - ts) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
      }
      return date.toLocaleDateString('en-AU', {
        weekday: 'short', hour: 'numeric', minute: '2-digit'
      });
    },

    formatAutomation(automation) {
      if (!automation || automation === 'unknown' || automation === 'manual') return null;
      if (/^[0-9][0-9A-Z]{20,}$/i.test(automation)) return null;
      return automation.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  });
}
