/**
 * Dashboard Configuration
 * Central configuration for the Smart Home Dashboard
 */

export const CONFIG = {
  // Detect if running locally (localhost) vs on Pi
  // Local dev: connect directly to Pi services
  // Pi deployment: use localhost (services on same machine)
  isLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',

  // Pi host - localhost uses 'localhost', Pi deployment uses 'pi' or same host
  piHost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'localhost'  // Local dev → scraper runs locally
    : 'pi',        // Pi deployment → use pi hostname

  mqttUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://pi:9001'  // Local dev → connect to Pi's MQTT WebSocket
    : window.location.port === '8888'
      ? 'ws://' + window.location.host + '/mqtt'  // Pi nginx proxy
      : 'ws://' + window.location.hostname + ':9001',
  baseTopic: 'zigbee2mqtt',
  // InfluxDB connection
  influxUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://pi:8086'  // Local dev → connect to Pi's InfluxDB
    : window.location.port === '8888'
      ? window.location.origin + '/api/influx'  // Pi nginx proxy
      : 'http://' + window.location.hostname + ':8086',
  influxDb: 'homeassistant',
  // Room configuration - isOutdoor: true excludes from home-wide averages
  // Order: bath, kitchen, hallway, study, bedroom, living, balcony
  rooms: [
    { id: 'bathroom', name: 'Bathroom', icon: '🚿', sensor: '[Bath] Temperature & Humidity', entityId: 'sensor.bath_temperature_humidity', isOutdoor: false },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', sensor: '[Kitchen] Temperature & Humidity', entityId: 'sensor.kitchen_temperature_humidity', isOutdoor: false },
    { id: 'hallway', name: 'Hallway', icon: '🚶', sensor: '[Hallway] CO2', entityId: 'sensor.hallway_co2', isOutdoor: false },
    { id: 'study', name: 'Study', icon: '📚', sensor: '[Study] Temperature & Humidity', entityId: 'sensor.study_temperature_humidity', isOutdoor: false },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', sensor: '[Bed] Temperature & Humidity', entityId: 'sensor.bed_temperature_humidity_sensor', isOutdoor: false },
    { id: 'living', name: 'Living Room', icon: '🛋️', sensor: '[Living] Temperature & Humidity', entityId: 'sensor.living_temperature_humidity', isOutdoor: false },
    { id: 'balcony', name: 'Balcony', icon: '🌿', sensor: '[Balcony] Temperature & Humidity', entityId: 'sensor.balcony_temperature_humidity', isOutdoor: true }
  ],
  staleThreshold: 5 * 60 * 1000,  // 5 minutes
  maxHistoryPoints: 500,
  historyHours: 6,

  // Thermostat configuration (SONOFF TRVZB devices)
  thermostats: [
    {
      id: 'study',
      name: 'Study',
      icon: '📚',
      sensor: '[Study] Thermostat',
      entityId: 'climate.study_thermostat',
      roomId: 'study',
      roomSensor: '[Study] Temperature & Humidity'  // Linked room temp sensor
    },
    {
      id: 'living_inner',
      name: 'Living Inner',
      icon: '🛋️',
      sensor: '[Living] Thermostat Inner',
      entityId: 'climate.living_thermostat_inner',
      roomId: 'living',
      roomSensor: '[Living] Temperature & Humidity'
    },
    {
      id: 'living_outer',
      name: 'Living Outer',
      icon: '🛋️',
      sensor: '[Living] Thermostat Outer',
      entityId: 'climate.living_thermostat_outer',
      roomId: 'living',
      roomSensor: '[Living] Temperature & Humidity'
    },
    {
      id: 'bedroom',
      name: 'Bedroom',
      icon: '🛏️',
      sensor: '[Bed] Thermostat',
      entityId: 'climate.bed_thermostat',
      roomId: 'bedroom',
      roomSensor: '[Bed] Temperature & Humidity'
    }
  ]
};

// Room-to-sensors mapping for Classic view (multi-sensor support)
// Each room can have multiple climate sensors + optional CO2/motion/contact sensors
export const ROOM_SENSORS = {
  living: {
    climate: [
      { name: '[Living] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Living] Temperature & Humidity 6', label: 'Sensor 2' },
      { name: '[Living] Temperature & Humidity 7', label: 'Sensor 3' }
    ],
    presence: { name: '[Living] Human Presence' }
  },
  bedroom: {
    climate: [
      { name: '[Bed] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Bed] Temperature & Humidity 9', label: 'Sensor 2' }
    ],
    presence: { name: '[Bed] Human Presence' }
  },
  study: {
    climate: [
      { name: '[Study] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Study] Temperature & Humidity 8', label: 'Sensor 2' }
    ],
    presence: { name: '[Study] Human Presence' }
  },
  kitchen: {
    climate: [
      { name: '[Kitchen] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Kitchen] Temperature & Humidity 10', label: 'Sensor 2' }
    ],
    presence: { name: '[Kitchen] Human Presence' }
  },
  bathroom: {
    climate: [
      { name: '[Bath] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Bath] Temperature & Humidity 11', label: 'Sensor 2' }
    ],
    presence: { name: '[Bath] Human Presence' }
  },
  balcony: {
    climate: [
      { name: '[Balcony] Temperature & Humidity', label: 'Outdoor', isPrimary: true }
    ]
  },
  hallway: {
    climate: [
      { name: '[Hallway] CO2', label: 'Air Quality', isPrimary: true }
    ]
  }
};

// Thermostat event types for timeline view
export const THERMOSTAT_EVENT_TYPES = {
  // IMPORTANT - Full card display (heating state changes)
  heating_started: {
    icon: '🔥',
    color: '#ef4444',
    label: 'Heating Started',
    priority: 'important',
    category: 'heating'
  },
  heating_stopped: {
    icon: '❄️',
    color: '#3b82f6',
    label: 'Heating Stopped',
    priority: 'important',
    category: 'heating'
  },
  target_reached: {
    icon: '✅',
    color: '#22c55e',
    label: 'Target Reached',
    priority: 'important',
    category: 'heating'
  },
  device_offline: {
    icon: '📡',
    color: '#ef4444',
    label: 'Device Offline',
    priority: 'important',
    category: 'system'
  },
  low_battery: {
    icon: '🔋',
    color: '#f59e0b',
    label: 'Low Battery',
    priority: 'important',
    category: 'system'
  },

  // ACTIVITY - Compact line display (user actions)
  setpoint_changed: {
    icon: '🎯',
    color: '#f59e0b',
    label: 'Setpoint Changed',
    priority: 'activity',
    category: 'control'
  },
  mode_changed: {
    icon: '⚙️',
    color: '#8b5cf6',
    label: 'Mode Changed',
    priority: 'activity',
    category: 'control'
  },
  child_lock_changed: {
    icon: '🔒',
    color: '#6366f1',
    label: 'Child Lock Changed',
    priority: 'activity',
    category: 'control'
  },
  window_detected: {
    icon: '🪟',
    color: '#06b6d4',
    label: 'Window Detected',
    priority: 'activity',
    category: 'system'
  },

  // BACKGROUND - Collapsed display (routine events)
  device_online: {
    icon: '📡',
    color: '#22c55e',
    label: 'Device Online',
    priority: 'background',
    category: 'system'
  },
  battery_ok: {
    icon: '🔋',
    color: '#22c55e',
    label: 'Battery OK',
    priority: 'background',
    category: 'system'
  },
  calibration_changed: {
    icon: '🔧',
    color: '#94a3b8',
    label: 'Calibration Changed',
    priority: 'background',
    category: 'control'
  }
};

// Apartment layout configuration - used by network 3D view
export const FLOOR_PLAN_CONFIG = {
  apartmentWidth: 9.239,
  apartmentDepth: 6.665,
  wallHeight: 2.0,
  wallThickness: 0.15,
  rooms: [
    { id: 'study', name: 'Study', icon: '📚', x: 7.285, z: 1.8485, width: 3.908, depth: 3.697, color: 0x60a5fa, labelY: 3 },
    { id: 'living', name: 'Living Room', icon: '🛋️', x: 6.864, z: 5.181, width: 4.750, depth: 2.968, color: 0x34d399, labelY: 3 },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', x: 2.2445, z: 5.476, width: 4.489, depth: 2.378, color: 0xfbbf24, labelY: 4 },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', x: 1.6655, z: 2.8957, width: 3.331, depth: 2.7827, color: 0xf87171, labelY: 3 },
    { id: 'bathroom', name: 'Bathroom', icon: '🚿', x: 1.6985, z: 0.7522, width: 3.397, depth: 1.5043, color: 0xa78bfa, labelY: 2 },
    { id: 'hallway', name: 'Hallway', icon: '🚶', x: 3.839, z: 2.0, width: 1.5, depth: 2.5, color: 0x94a3b8, labelY: 2 }
  ],
  balcony: { x: 9.764, z: 7.065, width: 1.050, depth: 1.200, color: 0x93c5fd },
  hallway: { x: 3.839, z: 2.0, width: 1.5, depth: 2.5, color: 0x94a3b8 },
  balconyNotch: {
    width: 1.0,
    depth: 1.5,
    hasRailing: true,
    floorColor: 0xC0C0C2
  },
  doors: [
    { x: 9.239, z: 6.465, rotation: Math.PI/2, type: 'french', swingDirection: 'inward' },
    { x: 3.706, z: 3.697, rotation: 0, swingDirection: 'south' },
    { x: 4.354, z: 1.848, rotation: Math.PI/2, swingDirection: 'east' },
    { x: 3.134, z: 3.697, rotation: 0, swingDirection: 'south' },
    { x: 3.331, z: 2.818, rotation: Math.PI/2, swingDirection: 'east' },
    { x: 3.331, z: 1.338, rotation: Math.PI/2, swingDirection: 'east' },
    { x: 0, z: 4.8, rotation: Math.PI/2, type: 'entry', swingDirection: 'east' }
  ],
  windows: [
    { x: 9.239, z: 1.848, rotation: Math.PI/2, size: 2.5 },
    { x: 9.239, z: 4.2, rotation: Math.PI/2, size: 2.5 },
    { x: 0, z: 5.976, rotation: Math.PI/2, size: 2.5 },
    { x: 0, z: 3.218, rotation: Math.PI/2, size: 1.8 },
    { x: 0, z: 1.487, rotation: Math.PI/2, size: 1.2 }
  ],
  furniture: [
    { type: 'bed', room: 'bedroom', width: 1.8, depth: 2.0, height: 0.6 }
  ]
};

// Temperature color scale for visualizations
export const TEMP_COLORS = [
  { value: 18, color: 0x90CAF9 },  // Cold
  { value: 22, color: 0xA5D6A7 },  // Cool
  { value: 24, color: 0x81C784 },  // Comfortable
  { value: 26, color: 0xFFE082 },  // Warm
  { value: 28, color: 0xFFAB91 },  // Hot
  { value: 32, color: 0xEF5350 }   // Very hot
];

// Humidity color scale for visualizations
export const HUMIDITY_COLORS = [
  { value: 30, color: 0xFFCC80 },  // Dry
  { value: 40, color: 0xA5D6A7 },  // Ideal low
  { value: 50, color: 0x81C784 },  // Perfect
  { value: 60, color: 0xA5D6A7 },  // Ideal high
  { value: 70, color: 0x90CAF9 },  // Humid
  { value: 85, color: 0x5C6BC0 }   // Very humid
];

// ========================================
// VIEW CATEGORIES (Navigation)
// Single source of truth for all dashboard views
// ========================================
export const VIEW_CATEGORIES = [
  {
    id: 'monitor',
    name: 'Monitor',
    icon: '📈',
    views: [
      { id: 'timeline', name: 'Timeline', icon: '📖', title: 'Event Timeline', key: '5' },
      { id: 'logs', name: 'Logs', icon: '📋', title: 'Activity Logs', key: 'L' },
      { id: 'device-health', name: 'Health', icon: '💚', title: 'Device Health', key: 'D' },
      { id: 'co2', name: 'CO2', icon: '💨', title: 'CO2 Monitor', key: '0' },
      { id: 'hotwater', name: 'Hot Water', icon: '🚿', title: 'Hot Water Monitor', key: 'W', primary: true },
      { id: 'system', name: 'System', icon: '💻', title: 'System Health', key: 'S' }
    ]
  },
  {
    id: 'visualize',
    name: 'Visualize',
    icon: '👁️',
    views: [
      { id: 'network', name: 'Network', icon: '📡', title: 'Zigbee Network', key: 'N' }
    ]
  },
  {
    id: 'control',
    name: 'Control',
    icon: '🎛️',
    views: [
      { id: 'lights', name: 'Lights', icon: '💡', title: 'Light Control', key: '7', primary: true },
      { id: 'heater', name: 'Heater', icon: '🔥', title: 'Heater Control', key: 'H' },
      { id: 'mailbox', name: 'Mailbox', icon: '📬', title: 'Mailbox Monitor', key: 'M' }
    ]
  },
  {
    id: 'display',
    name: 'Display',
    icon: '📺',
    views: [
      { id: 'classic', name: 'Classic', icon: '🃏', title: 'Classic Cards', key: '8' }
    ]
  }
];

// Flat list of all views for lookups - Classic first per user preference
export const ALL_VIEWS = (() => {
  const all = VIEW_CATEGORIES.flatMap(cat => cat.views);
  const classic = all.find(v => v.id === 'classic');
  return classic ? [classic, ...all.filter(v => v.id !== 'classic')] : all;
})();

// Primary views shown in main nav bar
export const PRIMARY_VIEWS = ALL_VIEWS.filter(v => v.primary);

// Overflow views shown in "More" dropdown (non-primary, grouped by category)
export const OVERFLOW_CATEGORIES = VIEW_CATEGORIES.map(cat => ({
  ...cat,
  views: cat.views.filter(v => !v.primary)
})).filter(cat => cat.views.length > 0);

// Keyboard shortcut map
export const KEYBOARD_SHORTCUTS = Object.fromEntries(
  ALL_VIEWS.map(v => [v.key, v.id])
);

// Contact sensor short names for sidebar display
// Maps friendly_name patterns to short display names
export const CONTACT_SENSOR_SHORT_NAMES = {
  '[Bath] Window Contact Sensor': 'Bath Window',
  '[Bed] Window Contact Sensor': 'Bed Window',
  '[Kitchen] Window Contact Sensor': 'Kitchen Window',
  '[Study] Window Contact Sensor - Large': 'Study Big',
  '[Study] Window Contact Sensor - Small': 'Study Small',
  '[Living] Window Contact Sensor - Balcony Door': 'Balcony Door',
  '[Living] Window Contact Sensor - Window': 'Living Window',
  '[Hallway] Window Contact Sensor - Main Door': 'Main Door'
};

// Sensor visual properties for 3D config view
export const SENSOR_VISUALS = {
  climate: {
    shape: 'cube',
    size: { width: 0.12, height: 0.06, depth: 0.12 },
    color: 0x34d399,        // Emerald green
    emissive: 0x34d399,
    emissiveIntensity: 0.2,
    icon: '🌡️',
    label: 'Climate',
    heightAboveFloor: 1.5   // Wall-mounted height (meters)
  },
  co2: {
    shape: 'cylinder',
    size: { radius: 0.06, height: 0.10 },
    color: 0xff6b6b,        // Coral red
    emissive: 0xff6b6b,
    emissiveIntensity: 0.2,
    icon: '💨',
    label: 'CO2',
    heightAboveFloor: 1.2
  },
  motion: {
    shape: 'sphere',
    size: { radius: 0.05 },
    color: 0xffd93d,        // Gold
    emissive: 0xffd93d,
    emissiveIntensity: 0.3,
    icon: '👁️',
    label: 'Motion',
    heightAboveFloor: 2.2,  // Ceiling mount
    // Detection cone properties (SONOFF SNZB-03P specs)
    fov: 110,               // Field of view in degrees
    range: 6                // Detection range in meters
  },
  contact: {
    shape: 'box',
    size: { width: 0.045, height: 0.027, depth: 0.016 },
    color: 0x38bdf8,        // Sky blue
    emissive: 0x38bdf8,
    emissiveIntensity: 0.2,
    icon: '🚪',
    label: 'Contact',
    heightAboveFloor: 1.8,
    // Magnet piece (second part of contact sensor)
    magnetSize: { width: 0.012, height: 0.025, depth: 0.008 },
    magnetOffset: 0.03      // Gap between sensor and magnet when closed
  }
};
