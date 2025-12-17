import { DEVICE_ROOMS, EVENT_MAPPINGS, DEBOUNCE_MS, IGNORED_TOPICS } from './config.js';

export class EventProcessor {
  constructor() {
    // Track last event times for debouncing
    this.lastEvents = new Map();
    // Track last values for change detection
    this.lastValues = new Map();
  }

  /**
   * Process an MQTT message and extract events
   * @param {string} topic - MQTT topic
   * @param {object} payload - Parsed JSON payload
   * @returns {Array} Array of events to write to InfluxDB
   */
  processMessage(topic, payload) {
    // Skip ignored topics
    if (IGNORED_TOPICS.some(ignored => topic.startsWith(ignored))) {
      return [];
    }

    // Skip bridge topics (devices list, etc)
    if (topic.includes('/bridge/')) {
      return [];
    }

    // Skip availability messages (handled separately)
    if (topic.endsWith('/availability')) {
      return this.processAvailability(topic, payload);
    }

    // Skip set commands
    if (topic.endsWith('/set') || topic.endsWith('/get')) {
      return [];
    }

    // Extract device name from topic: zigbee2mqtt/[Device Name]
    const deviceName = topic.replace('zigbee2mqtt/', '');
    if (!deviceName) return [];

    const events = [];
    const room = this.getRoom(deviceName);
    const timestamp = Date.now();

    // Process each relevant property in the payload
    for (const [property, value] of Object.entries(payload)) {
      const event = this.processProperty(deviceName, property, value, room, timestamp, payload);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  /**
   * Process a single property from the payload
   */
  processProperty(deviceName, property, value, room, timestamp, fullPayload) {
    // Handle state changes (lights, plugs)
    if (property === 'state') {
      return this.processStateChange(deviceName, value, room, timestamp, fullPayload);
    }

    // Handle mapped event types
    const mapping = EVENT_MAPPINGS[property];
    if (!mapping) return null;

    // Check debounce
    const debounceKey = `${deviceName}:${property}`;
    const lastTime = this.lastEvents.get(debounceKey) || 0;
    const debounceMs = DEBOUNCE_MS[mapping.deviceType] || 1000;

    if (timestamp - lastTime < debounceMs) {
      return null;  // Skip - too soon
    }

    // Check for minimum change (e.g., CO2)
    if (mapping.minChange) {
      const lastValue = this.lastValues.get(debounceKey);
      if (lastValue !== undefined && Math.abs(value - lastValue) < mapping.minChange) {
        return null;  // Skip - change too small
      }
      this.lastValues.set(debounceKey, value);
    } else {
      // For all other events, only log if value actually changed
      const lastValue = this.lastValues.get(debounceKey);
      if (lastValue !== undefined && lastValue === value) {
        return null;  // Skip - no change
      }
      this.lastValues.set(debounceKey, value);
    }

    // Update last event time
    this.lastEvents.set(debounceKey, timestamp);

    return {
      measurement: 'zigbee_events',
      tags: {
        device_name: deviceName,
        device_type: mapping.deviceType,
        room: room,
        event_type: mapping.getEvent(value)
      },
      fields: {
        value: typeof value === 'boolean' ? (value ? 1 : 0) : (typeof value === 'number' ? value : 0),
        state: String(value)
      },
      timestamp: timestamp * 1000000  // InfluxDB expects nanoseconds
    };
  }

  /**
   * Process state changes for lights and plugs
   */
  processStateChange(deviceName, state, room, timestamp, fullPayload) {
    // Determine if it's a light or plug
    const isLight = fullPayload.brightness !== undefined ||
                    fullPayload.color_temp !== undefined ||
                    deviceName.toLowerCase().includes('light');

    const deviceType = isLight ? 'light' : 'plug';
    const eventType = state === 'ON'
      ? (isLight ? 'light_on' : 'plug_on')
      : (isLight ? 'light_off' : 'plug_off');

    // Check debounce
    const debounceKey = `${deviceName}:state`;
    const lastTime = this.lastEvents.get(debounceKey) || 0;
    const debounceMs = DEBOUNCE_MS[deviceType] || 500;

    if (timestamp - lastTime < debounceMs) {
      return null;
    }

    // Check if state actually changed
    const lastState = this.lastValues.get(debounceKey);
    if (lastState === state) {
      return null;  // No change
    }

    this.lastEvents.set(debounceKey, timestamp);
    this.lastValues.set(debounceKey, state);

    return {
      measurement: 'zigbee_events',
      tags: {
        device_name: deviceName,
        device_type: deviceType,
        room: room,
        event_type: eventType
      },
      fields: {
        value: state === 'ON' ? 1 : 0,
        state: state,
        brightness: fullPayload.brightness || 0
      },
      timestamp: timestamp * 1000000
    };
  }

  /**
   * Process availability messages
   */
  processAvailability(topic, payload) {
    // Topic format: zigbee2mqtt/[Device Name]/availability
    const deviceName = topic.replace('zigbee2mqtt/', '').replace('/availability', '');
    const isOnline = payload === 'online' || payload?.state === 'online';
    const room = this.getRoom(deviceName);

    // Only log if availability actually changed
    const availKey = `${deviceName}:availability`;
    const lastAvail = this.lastValues.get(availKey);
    if (lastAvail !== undefined && lastAvail === isOnline) {
      return [];  // No change
    }
    this.lastValues.set(availKey, isOnline);

    return [{
      measurement: 'zigbee_events',
      tags: {
        device_name: deviceName,
        device_type: 'availability',
        room: room,
        event_type: isOnline ? 'device_online' : 'device_offline'
      },
      fields: {
        value: isOnline ? 1 : 0,
        state: isOnline ? 'online' : 'offline'
      },
      timestamp: Date.now() * 1000000
    }];
  }

  /**
   * Process remote button actions
   */
  processRemoteAction(deviceName, action, room, timestamp) {
    // Check debounce
    const debounceKey = `${deviceName}:action`;
    const lastTime = this.lastEvents.get(debounceKey) || 0;

    if (timestamp - lastTime < DEBOUNCE_MS.remote) {
      return null;
    }

    this.lastEvents.set(debounceKey, timestamp);

    return {
      measurement: 'zigbee_events',
      tags: {
        device_name: deviceName,
        device_type: 'remote',
        room: room,
        event_type: `remote_${action}`
      },
      fields: {
        value: 1,
        state: action
      },
      timestamp: timestamp * 1000000
    };
  }

  /**
   * Get room for a device
   */
  getRoom(deviceName) {
    // Direct mapping
    if (DEVICE_ROOMS[deviceName]) {
      return DEVICE_ROOMS[deviceName];
    }

    // Try to extract from device name pattern: [Room] Device Name
    const roomMatch = deviceName.match(/^\[([^\]]+)\]/);
    if (roomMatch) {
      return roomMatch[1].toLowerCase();
    }

    return 'unknown';
  }

  /**
   * Get device type from payload
   */
  getDeviceType(payload) {
    if (payload.occupancy !== undefined) return 'motion';
    if (payload.contact !== undefined) return 'contact';
    if (payload.vibration !== undefined) return 'vibration';
    if (payload.co2 !== undefined) return 'co2';
    if (payload.brightness !== undefined) return 'light';
    if (payload.state !== undefined) return 'switch';
    if (payload.temperature !== undefined) return 'climate';
    if (payload.action !== undefined) return 'remote';
    return 'unknown';
  }
}
