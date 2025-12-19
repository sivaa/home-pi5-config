/**
 * Events Data Store
 * Manages Zigbee event history from InfluxDB and real-time MQTT
 */

export function initEventsStore(Alpine, CONFIG) {
  Alpine.store('events', {
    // All events (merged from InfluxDB + real-time MQTT)
    list: [],

    // Filters
    filters: {
      eventTypes: [],  // Empty = show all
      rooms: [],       // Empty = show all
      dateRange: 'today',  // today | yesterday | week
      deviceType: '',      // Single select: 'motion' | 'contact' | 'light' | etc
      device: ''           // Single select: specific device name
    },

    // State
    loading: false,
    lastQuery: null,
    maxEvents: 500,

    // Event type definitions with icons, colors, and priority
    // Priority: 'important' (full card), 'activity' (compact line), 'background' (collapsed)
    eventTypes: {
      // IMPORTANT - Security & alerts (full card display)
      door_opened: { icon: '🚪', color: '#ef4444', label: 'Door Opened', category: 'contact', priority: 'important' },
      air_quality_poor: { icon: '⚠️', color: '#ef4444', label: 'Air: Poor', category: 'co2', priority: 'important' },
      device_offline: { icon: '📡', color: '#ef4444', label: 'Device Offline', category: 'availability', priority: 'important' },

      // ACTIVITY - Interesting but routine (compact line display)
      motion_detected: { icon: '👁️', color: '#ffd93d', label: 'Motion Detected', category: 'motion', priority: 'activity' },
      motion_cleared: { icon: '👁️', color: '#94a3b8', label: 'Motion Cleared', category: 'motion', priority: 'activity' },
      door_closed: { icon: '🚪', color: '#22c55e', label: 'Door Closed', category: 'contact', priority: 'activity' },
      light_on: { icon: '💡', color: '#fbbf24', label: 'Light On', category: 'light', priority: 'activity' },
      light_off: { icon: '💡', color: '#64748b', label: 'Light Off', category: 'light', priority: 'activity' },
      plug_on: { icon: '🔌', color: '#22c55e', label: 'Plug On', category: 'plug', priority: 'activity' },
      plug_off: { icon: '🔌', color: '#ef4444', label: 'Plug Off', category: 'plug', priority: 'activity' },
      remote_toggle: { icon: '🎮', color: '#8b5cf6', label: 'Remote: Toggle', category: 'remote', priority: 'activity' },
      remote_brightness_up: { icon: '🎮', color: '#fbbf24', label: 'Remote: Bright+', category: 'remote', priority: 'activity' },
      remote_brightness_down: { icon: '🎮', color: '#64748b', label: 'Remote: Bright-', category: 'remote', priority: 'activity' },

      // BACKGROUND - Noise, collapse into groups
      device_online: { icon: '📡', color: '#22c55e', label: 'Device Online', category: 'availability', priority: 'background', group: 'devices' },
      air_quality_excellent: { icon: '🌿', color: '#22c55e', label: 'Air: Excellent', category: 'co2', priority: 'background', group: 'air' },
      air_quality_moderate: { icon: '💨', color: '#fbbf24', label: 'Air: Moderate', category: 'co2', priority: 'background', group: 'air' },
      co2_reading: { icon: '💨', color: '#f97316', label: 'CO2 Reading', category: 'co2', priority: 'background', group: 'air' }
    },

    // Get event info with defaults
    getEventInfo(eventType) {
      return this.eventTypes[eventType] || {
        icon: '📍',
        color: '#94a3b8',
        label: eventType,
        category: 'unknown',
        priority: 'activity',
        group: 'other'
      };
    },

    // Filtered events getter
    get filteredEvents() {
      let events = this.list;

      // Filter by event type
      if (this.filters.eventTypes.length > 0) {
        events = events.filter(e =>
          this.filters.eventTypes.includes(e.eventType)
        );
      }

      // Filter by room (single select)
      if (this.filters.rooms.length > 0) {
        events = events.filter(e =>
          this.filters.rooms.includes(e.room)
        );
      }

      // Filter by device type (single select)
      if (this.filters.deviceType) {
        events = events.filter(e => e.deviceType === this.filters.deviceType);
      }

      // Filter by specific device (single select)
      if (this.filters.device) {
        events = events.filter(e => e.deviceName === this.filters.device);
      }

      // Filter by date
      const now = Date.now();
      let startTime;
      switch (this.filters.dateRange) {
        case 'today':
          startTime = new Date().setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startTime = new Date().setHours(0, 0, 0, 0) - 86400000;
          break;
        case 'week':
          startTime = now - 7 * 86400000;
          break;
        default:
          startTime = now - 86400000;
      }

      events = events.filter(e => e.time >= startTime);

      return events;
    },

    // Get unique rooms from events
    get availableRooms() {
      const rooms = new Set(this.list.map(e => e.room).filter(r => r && r !== 'unknown'));
      return [...rooms].sort();
    },

    // Get unique event types from events
    get availableEventTypes() {
      const types = new Set(this.list.map(e => e.eventType));
      return [...types].sort();
    },

    // Get event categories for grouping
    get availableCategories() {
      const categories = new Set();
      this.list.forEach(e => {
        const info = this.getEventInfo(e.eventType);
        if (info.category) categories.add(info.category);
      });
      return [...categories].sort();
    },

    // Get unique device names from events
    get availableDevices() {
      const devices = new Set(this.list.map(e => e.deviceName).filter(d => d));
      return [...devices].sort();
    },

    // Get unique device types with labels
    get availableDeviceTypes() {
      const types = new Set(this.list.map(e => e.deviceType).filter(t => t));
      const typeLabels = {
        motion: 'Motion',
        contact: 'Door/Window',
        light: 'Light',
        plug: 'Plug',
        co2: 'CO2',
        availability: 'Availability'
      };
      return [...types].sort().map(t => ({
        id: t,
        label: typeLabels[t] || t
      }));
    },

    // Add real-time event from MQTT
    addRealTimeEvent(event) {
      // Deduplicate by timestamp + device + event type
      const exists = this.list.find(e =>
        Math.abs(e.time - event.time) < 1000 &&
        e.deviceName === event.deviceName &&
        e.eventType === event.eventType
      );

      if (!exists) {
        this.list.unshift(event);
        // Keep list bounded
        if (this.list.length > this.maxEvents) {
          this.list.pop();
        }
      }
    },

    // Load historical events from InfluxDB
    async loadHistorical(hours = 24) {
      this.loading = true;

      try {
        const query = `
          SELECT * FROM zigbee_events
          WHERE time > now() - ${hours}h
          ORDER BY time DESC
          LIMIT ${this.maxEvents}
        `;

        const url = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results?.[0]?.series?.[0]) {
          const series = data.results[0].series[0];
          const columns = series.columns;
          const values = series.values;

          // Map column names to indices
          const timeIdx = columns.indexOf('time');
          const deviceNameIdx = columns.indexOf('device_name');
          const deviceTypeIdx = columns.indexOf('device_type');
          const roomIdx = columns.indexOf('room');
          const eventTypeIdx = columns.indexOf('event_type');
          const valueIdx = columns.indexOf('value');
          const stateIdx = columns.indexOf('state');

          this.list = values.map(row => ({
            time: new Date(row[timeIdx]).getTime(),
            deviceName: row[deviceNameIdx],
            deviceType: row[deviceTypeIdx],
            room: row[roomIdx],
            eventType: row[eventTypeIdx],
            value: row[valueIdx],
            state: row[stateIdx]
          }));

          console.log(`Loaded ${this.list.length} historical events`);
        } else {
          console.log('No historical events found');
          this.list = [];
        }

        this.lastQuery = Date.now();
      } catch (err) {
        console.error('Failed to load events:', err);
      }

      this.loading = false;
    },

    // Toggle event type filter
    toggleEventType(type) {
      const idx = this.filters.eventTypes.indexOf(type);
      if (idx === -1) {
        this.filters.eventTypes.push(type);
      } else {
        this.filters.eventTypes.splice(idx, 1);
      }
    },

    // Toggle room filter
    toggleRoom(room) {
      const idx = this.filters.rooms.indexOf(room);
      if (idx === -1) {
        this.filters.rooms.push(room);
      } else {
        this.filters.rooms.splice(idx, 1);
      }
    },

    // Set date range
    setDateRange(range) {
      this.filters.dateRange = range;
    },

    // Set room filter (single select)
    setRoom(room) {
      this.filters.rooms = room ? [room] : [];
    },

    // Set device type filter
    setDeviceType(type) {
      this.filters.deviceType = type;
    },

    // Set device filter
    setDevice(device) {
      this.filters.device = device;
    },

    // Clear all filters
    clearFilters() {
      this.filters.eventTypes = [];
      this.filters.rooms = [];
      this.filters.dateRange = 'today';
      this.filters.deviceType = '';
      this.filters.device = '';
    },

    // Get stats summary
    get stats() {
      const filtered = this.filteredEvents;
      const now = Date.now();
      const lastHour = filtered.filter(e => e.time > now - 3600000);

      return {
        total: filtered.length,
        lastHour: lastHour.length,
        motionCount: filtered.filter(e => e.eventType === 'motion_detected').length,
        doorCount: filtered.filter(e => e.eventType === 'door_opened').length,
        mailboxCount: filtered.filter(e => e.eventType === 'motion_detected' && e.deviceName === '[Mailbox] Motion Sensor').length
      };
    }
  });
}
