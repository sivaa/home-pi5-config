/**
 * Timeline View
 * Displays all Zigbee events in a filterable timeline
 */

export function timelineView() {
  return {
    showFilters: false,
    selectedCategories: [],  // For category-based filtering
    selectedRoom: '',
    selectedDeviceType: '',
    selectedDevice: '',

    init() {
      // Events are loaded by app.js on init
      // Set up real-time MQTT listener for live events
      this.setupMqttListener();
    },

    // Set up MQTT listener for real-time events
    setupMqttListener() {
      const mqtt = this.$store.mqtt;
      if (!mqtt?.client) {
        // Retry after MQTT connects
        setTimeout(() => this.setupMqttListener(), 2000);
        return;
      }

      // Listen for zigbee device messages
      mqtt.client.on('message', (topic, message) => {
        if (!topic.startsWith('zigbee2mqtt/') || topic.includes('/bridge/')) return;

        try {
          const payload = JSON.parse(message.toString());
          const deviceName = topic.replace('zigbee2mqtt/', '');

          // Process relevant events
          const event = this.processLiveEvent(deviceName, payload);
          if (event) {
            this.$store.events.addRealTimeEvent(event);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
    },

    // Process live MQTT message into event
    processLiveEvent(deviceName, payload) {
      const now = Date.now();
      const room = this.extractRoom(deviceName);

      // Motion
      if (payload.occupancy !== undefined) {
        return {
          time: now,
          deviceName,
          deviceType: 'motion',
          room,
          eventType: payload.occupancy ? 'motion_detected' : 'motion_cleared',
          value: payload.occupancy ? 1 : 0,
          state: String(payload.occupancy)
        };
      }

      // Contact (door/window)
      if (payload.contact !== undefined) {
        return {
          time: now,
          deviceName,
          deviceType: 'contact',
          room,
          eventType: payload.contact ? 'door_closed' : 'door_opened',
          value: payload.contact ? 0 : 1,
          state: String(payload.contact)
        };
      }

      // Vibration (mailbox)
      if (payload.vibration !== undefined && payload.vibration === true) {
        return {
          time: now,
          deviceName,
          deviceType: 'vibration',
          room,
          eventType: 'vibration_detected',
          value: 1,
          state: 'true'
        };
      }

      // Light/plug state changes (only on actual change)
      if (payload.state !== undefined) {
        const isLight = payload.brightness !== undefined || deviceName.toLowerCase().includes('light');
        return {
          time: now,
          deviceName,
          deviceType: isLight ? 'light' : 'plug',
          room,
          eventType: payload.state === 'ON'
            ? (isLight ? 'light_on' : 'plug_on')
            : (isLight ? 'light_off' : 'plug_off'),
          value: payload.state === 'ON' ? 1 : 0,
          state: payload.state
        };
      }

      return null;
    },

    // Extract room from device name
    extractRoom(deviceName) {
      const match = deviceName.match(/^\[([^\]]+)\]/);
      return match ? match[1].toLowerCase() : 'unknown';
    },

    // Get filtered events from store
    get events() {
      return this.$store.events.filteredEvents;
    },

    // Get event info (icon, color, label)
    getEventInfo(eventType) {
      return this.$store.events.getEventInfo(eventType);
    },

    // Format timestamp
    formatTime(timestamp) {
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

    // Format relative time
    formatRelativeTime(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    },

    // Get event CSS class
    getEventClass(eventType) {
      const info = this.getEventInfo(eventType);
      return `event-${info.category || 'default'}`;
    },

    // Filter toggles
    toggleCategory(category) {
      const idx = this.selectedCategories.indexOf(category);
      if (idx === -1) {
        this.selectedCategories.push(category);
        // Also update store filters
        const types = Object.entries(this.$store.events.eventTypes)
          .filter(([, info]) => info.category === category)
          .map(([type]) => type);
        types.forEach(t => {
          if (!this.$store.events.filters.eventTypes.includes(t)) {
            this.$store.events.filters.eventTypes.push(t);
          }
        });
      } else {
        this.selectedCategories.splice(idx, 1);
        // Remove from store filters
        const types = Object.entries(this.$store.events.eventTypes)
          .filter(([, info]) => info.category === category)
          .map(([type]) => type);
        this.$store.events.filters.eventTypes = this.$store.events.filters.eventTypes
          .filter(t => !types.includes(t));
      }
    },

    toggleRoom(room) {
      this.$store.events.toggleRoom(room);
    },

    setDateRange(range) {
      this.$store.events.setDateRange(range);
    },

    clearFilters() {
      this.selectedCategories = [];
      this.selectedRoom = '';
      this.selectedDeviceType = '';
      this.selectedDevice = '';
      this.$store.events.clearFilters();
    },

    // Dropdown filter methods
    setRoom(room) {
      this.selectedRoom = room;
      this.$store.events.setRoom(room);
    },

    setDeviceType(type) {
      this.selectedDeviceType = type;
      this.$store.events.setDeviceType(type);
    },

    setDevice(device) {
      this.selectedDevice = device;
      this.$store.events.setDevice(device);
    },

    // Get available device types from store
    get availableDeviceTypes() {
      return this.$store.events.availableDeviceTypes;
    },

    // Get available devices from store
    get availableDevices() {
      return this.$store.events.availableDevices;
    },

    // Get available categories with counts
    get categories() {
      const counts = {};
      this.$store.events.list.forEach(e => {
        const info = this.getEventInfo(e.eventType);
        const cat = info.category || 'unknown';
        counts[cat] = (counts[cat] || 0) + 1;
      });

      return [
        { id: 'motion', icon: '👁️', label: 'Motion', count: counts.motion || 0 },
        { id: 'contact', icon: '🚪', label: 'Doors', count: counts.contact || 0 },
        { id: 'vibration', icon: '📬', label: 'Mailbox', count: counts.vibration || 0 },
        { id: 'light', icon: '💡', label: 'Lights', count: counts.light || 0 },
        { id: 'plug', icon: '🔌', label: 'Plugs', count: counts.plug || 0 },
        { id: 'co2', icon: '💨', label: 'CO2', count: counts.co2 || 0 },
        { id: 'availability', icon: '📡', label: 'Devices', count: counts.availability || 0 }
      ].filter(c => c.count > 0);
    },

    // Get stats
    get stats() {
      return this.$store.events.stats;
    },

    // Get available rooms
    get availableRooms() {
      return this.$store.events.availableRooms;
    },

    // Check if category is selected
    isCategorySelected(category) {
      return this.selectedCategories.includes(category);
    },

    // Check if room is selected
    isRoomSelected(room) {
      return this.$store.events.filters.rooms.includes(room);
    },

    // Get current date range
    get currentDateRange() {
      return this.$store.events.filters.dateRange;
    },

    // Open room detail (for temperature events)
    openRoom(roomName) {
      const room = this.$store.rooms.list.find(r =>
        r.name.toLowerCase() === roomName.toLowerCase()
      );
      if (room) this.$store.roomDetail.open(room);
    },

    // Reload events
    refresh() {
      this.$store.events.loadHistorical(24);
    }
  };
}
