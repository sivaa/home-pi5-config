/**
 * Timeline View
 * Displays all Zigbee events in a filterable timeline
 */

export function timelineView() {
  return {
    showFilters: false,
    showBackground: false,  // Toggle for background events section
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

    // ========================================
    // PRIORITY-BASED GROUPING (UX OVERHAUL)
    // ========================================

    // Get event priority from store
    getPriority(event) {
      const info = this.getEventInfo(event.eventType);
      return info.priority || 'activity';
    },

    // Get event group for background collapsing
    getGroup(event) {
      const info = this.getEventInfo(event.eventType);
      return info.group || 'other';
    },

    // Events grouped by priority tier
    get groupedEvents() {
      const events = this.events;
      return {
        important: events.filter(e => this.getPriority(e) === 'important'),
        activity: events.filter(e => this.getPriority(e) === 'activity'),
        background: this.collapseBackground(
          events.filter(e => this.getPriority(e) === 'background')
        )
      };
    },

    // Collapse background events into groups
    collapseBackground(events) {
      const groups = {};
      events.forEach(e => {
        const group = this.getGroup(e);
        if (!groups[group]) groups[group] = [];
        groups[group].push(e);
      });
      return groups;
    },

    // Get total background event count
    get backgroundCount() {
      const bg = this.groupedEvents.background;
      return Object.values(bg).reduce((sum, arr) => sum + arr.length, 0);
    },

    // Get icon for a background group
    getGroupIcon(group) {
      const icons = {
        air: '🌿',
        devices: '📡',
        other: '📋'
      };
      return icons[group] || '📋';
    },

    // Get label for a background group
    getGroupLabel(group) {
      const labels = {
        air: 'Air Quality',
        devices: 'Device Status',
        other: 'Other'
      };
      return labels[group] || group;
    },

    // Get summary text for a background group
    getGroupSummary(group, events) {
      if (group === 'air') {
        const excellent = events.filter(e => e.eventType === 'air_quality_excellent').length;
        const moderate = events.filter(e => e.eventType === 'air_quality_moderate').length;
        const rooms = [...new Set(events.map(e => e.room).filter(r => r && r !== 'unknown'))];
        if (excellent > 0 && moderate === 0) {
          return `All excellent (${rooms.join(', ')})`;
        }
        return rooms.length > 0 ? rooms.join(', ') : 'Various rooms';
      }
      if (group === 'devices') {
        return 'All sensors reporting OK';
      }
      return '';
    },

    // ========================================
    // HUMAN-READABLE DESCRIPTIONS
    // ========================================

    // Get human-friendly description for an event
    getHumanDescription(event) {
      switch (event.eventType) {
        case 'door_opened':
          return this.formatDeviceName(event.deviceName);
        case 'door_closed':
          const duration = this.getDoorDuration(event);
          return duration ? `Open for ${duration}` : this.formatDeviceName(event.deviceName);
        case 'motion_detected':
          return this.formatDeviceName(event.deviceName);
        case 'motion_cleared':
          const motionDuration = this.getMotionDuration(event);
          return motionDuration ? `was active ${motionDuration}` : '';
        case 'vibration_detected':
          return 'Mail arrived!';
        case 'light_on':
        case 'light_off':
        case 'plug_on':
        case 'plug_off':
          return this.formatDeviceName(event.deviceName);
        default:
          return '';
      }
    },

    // Format device name to be more readable
    formatDeviceName(deviceName) {
      if (!deviceName) return '';
      // Remove room prefix like "[Living]"
      let name = deviceName.replace(/^\[[^\]]+\]\s*/, '');
      // Shorten common suffixes
      name = name.replace(/\s*(Temperature & Humidity|Contact Sensor|Motion Sensor|Vibration Sensor)\s*/gi, '');
      name = name.replace(/\s*Sensor\s*/gi, '');
      return name.trim() || deviceName;
    },

    // Try to calculate door open duration
    getDoorDuration(closeEvent) {
      if (closeEvent.eventType !== 'door_closed') return null;
      // Find the matching door_opened event
      const openEvent = this.events.find(e =>
        e.eventType === 'door_opened' &&
        e.deviceName === closeEvent.deviceName &&
        e.time < closeEvent.time &&
        (closeEvent.time - e.time) < 3600000 // Within 1 hour
      );
      if (!openEvent) return null;
      return this.formatDuration(closeEvent.time - openEvent.time);
    },

    // Try to calculate motion active duration
    getMotionDuration(clearEvent) {
      if (clearEvent.eventType !== 'motion_cleared') return null;
      // Find the matching motion_detected event
      const detectEvent = this.events.find(e =>
        e.eventType === 'motion_detected' &&
        e.deviceName === clearEvent.deviceName &&
        e.time < clearEvent.time &&
        (clearEvent.time - e.time) < 3600000 // Within 1 hour
      );
      if (!detectEvent) return null;
      return this.formatDuration(clearEvent.time - detectEvent.time);
    },

    // Format duration in human-readable form
    formatDuration(ms) {
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (minutes < 60) {
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
      }
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    },

    // ========================================
    // DAILY SUMMARY
    // ========================================

    // Generate natural language summary of the day
    get dailySummary() {
      const stats = this.stats;
      const hour = new Date().getHours();
      const parts = [];

      // Time of day greeting
      let timeOfDay = 'day';
      if (hour < 12) timeOfDay = 'morning';
      else if (hour < 17) timeOfDay = 'afternoon';
      else timeOfDay = 'evening';

      // Activity level
      if (stats.doorCount === 0 && stats.motionCount < 5) {
        parts.push(`A quiet ${timeOfDay}`);
      } else if (stats.motionCount > 20) {
        parts.push(`An active ${timeOfDay}`);
      } else {
        parts.push(`A typical ${timeOfDay}`);
      }

      // Door activity
      if (stats.doorCount > 0) {
        parts.push(`door opened ${stats.doorCount} time${stats.doorCount > 1 ? 's' : ''}`);
      }

      // Mail
      if (stats.mailboxCount > 0) {
        parts.push('mail arrived');
      }

      // Air quality
      const airEvents = this.events.filter(e =>
        e.eventType === 'air_quality_excellent' ||
        e.eventType === 'air_quality_moderate' ||
        e.eventType === 'air_quality_poor'
      );
      if (airEvents.length > 0) {
        const poor = airEvents.filter(e => e.eventType === 'air_quality_poor').length;
        if (poor > 0) {
          parts.push('air quality needs attention');
        } else {
          parts.push('air quality excellent');
        }
      }

      return parts.join(', ') + '.';
    },

    // Get air quality status for summary
    get airQualityStatus() {
      const airEvents = this.events.filter(e =>
        e.eventType === 'air_quality_excellent' ||
        e.eventType === 'air_quality_moderate' ||
        e.eventType === 'air_quality_poor'
      );
      if (airEvents.length === 0) return '🌿 Good';
      const poor = airEvents.filter(e => e.eventType === 'air_quality_poor').length;
      if (poor > 0) return '⚠️ Poor';
      const moderate = airEvents.filter(e => e.eventType === 'air_quality_moderate').length;
      if (moderate > airEvents.length / 2) return '💨 Moderate';
      return '🌿 Excellent';
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
