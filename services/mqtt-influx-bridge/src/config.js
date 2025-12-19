// Device-to-room mapping based on docs/05-zigbee-devices.md
export const DEVICE_ROOMS = {
  // Lights
  '[Study] IKEA Light': 'study',
  '[Living] IKEA Light': 'living',

  // Temperature sensors
  '[Study] Temperature & Humidity': 'study',
  '[Living] Temperature & Humidity': 'living',
  '[Kitchen] Temperature & Humidity': 'kitchen',
  '[Bath] Temperature & Humidity': 'bathroom',
  '[Bed] Temperature & Humidity Sensor': 'bedroom',
  '[Balcony] Temperature & Humidity': 'balcony',
  '[Living] Temperature & Humidity 6': 'living',
  '[Living] Temperature & Humidity 7': 'living',
  '[Study] Temperature & Humidity 8': 'study',
  '[Bed] Temperature & Humidity Sensor 9': 'bedroom',
  '[Kitchen] Temperature & Humidity 10': 'kitchen',
  '[Bath] Temperature & Humidity 11': 'bathroom',

  // Special sensors
  '[Mailbox] Motion Sensor': 'mailbox',
  'CO2': 'living',
  'Motion Detector': 'unknown',
  'Contact Sensor 1': 'unknown',
  'Smart Plug 1': 'unknown',

  // Remotes
  '[Study] Light Remote': 'study',
  '[Living] Light Remote': 'living',

  // Thermostats (SONOFF TRVZB)
  '[Study] Thermostat': 'study',
  '[Living] Thermostat Inner': 'living',
  '[Living] Thermostat Outer': 'living',
  '[Bed] Thermostat': 'bedroom'
};

// Device type detection based on payload properties
export const DEVICE_TYPE_DETECTORS = {
  occupancy: 'motion',
  contact: 'contact',
  co2: 'co2',
  state: 'switch',  // Could be light or plug
  brightness: 'light',
  color_temp: 'light',
  temperature: 'climate',
  humidity: 'climate',
  action: 'remote',
  running_state: 'thermostat',
  occupied_heating_setpoint: 'thermostat',
  system_mode: 'thermostat'
};

// Event type mappings
export const EVENT_MAPPINGS = {
  // Motion sensor
  occupancy: {
    getEvent: (value) => value ? 'motion_detected' : 'motion_cleared',
    deviceType: 'motion'
  },

  // Contact sensor (door/window)
  contact: {
    getEvent: (value) => value ? 'door_closed' : 'door_opened',
    deviceType: 'contact'
  },

  // CO2 sensor - only log significant changes
  co2: {
    getEvent: () => 'co2_reading',
    deviceType: 'co2',
    minChange: 50  // Only log if CO2 changes by at least 50ppm
  },

  // Air quality changes
  air_quality: {
    getEvent: (value) => `air_quality_${value}`,
    deviceType: 'co2'
  },

  // Thermostat - heating state (most important)
  running_state: {
    getEvent: (value) => value === 'heat' ? 'heating_started' : 'heating_stopped',
    deviceType: 'thermostat'
  },

  // Thermostat - setpoint changes
  occupied_heating_setpoint: {
    getEvent: () => 'setpoint_changed',
    deviceType: 'thermostat',
    minChange: 0.5  // Only log if setpoint changes by 0.5°C or more
  },

  // Thermostat - mode changes (heat/off)
  system_mode: {
    getEvent: (value) => `mode_changed_${value}`,
    deviceType: 'thermostat'
  }
};

// Topics to ignore (bridge internal messages)
export const IGNORED_TOPICS = [
  'zigbee2mqtt/bridge/state',
  'zigbee2mqtt/bridge/info',
  'zigbee2mqtt/bridge/logging',
  'zigbee2mqtt/bridge/extensions',
  'zigbee2mqtt/bridge/groups',
  'zigbee2mqtt/bridge/definitions'
];

// Debounce settings (ms) - prevent duplicate events
export const DEBOUNCE_MS = {
  motion: 5000,      // 5 seconds between motion events
  contact: 1000,     // 1 second between door events
  co2: 60000,        // 1 minute between CO2 readings
  climate: 60000,    // 1 minute between temp/humidity readings
  light: 500,        // 500ms between light events
  plug: 500,         // 500ms between plug events
  remote: 100,       // 100ms between remote button presses
  thermostat: 1000   // 1 second between thermostat events
};

// Environment config
export const CONFIG = {
  mqtt: {
    url: process.env.MQTT_URL,
    topic: 'zigbee2mqtt/#'
  },
  influx: {
    url: process.env.INFLUX_URL || 'http://localhost:8086',
    database: process.env.INFLUX_DB || 'homeassistant',
    measurement: 'zigbee_events'
  },
  logLevel: process.env.LOG_LEVEL || 'info'
};
