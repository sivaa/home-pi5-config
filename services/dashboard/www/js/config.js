/**
 * Dashboard Configuration
 * Central configuration for the Smart Home Dashboard
 */

export const CONFIG = {
  // Use nginx proxy when accessed via dashboard port
  mqttUrl: window.location.port === '8888'
    ? 'ws://' + window.location.host + '/mqtt'
    : 'ws://' + window.location.hostname + ':9001',
  baseTopic: 'zigbee2mqtt',
  // Use nginx proxy for InfluxDB to avoid CORS issues
  influxUrl: window.location.port === '8888'
    ? window.location.origin + '/api/influx'
    : 'http://' + window.location.hostname + ':8086',
  influxDb: 'homeassistant',
  rooms: [
    { id: 'living', name: 'Living Room', icon: '🛋️', sensor: '[Living] Temperature & Humidity', entityId: 'sensor.living_temperature_humidity' },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', sensor: '[Bed] Temperature & Humidity Sensor', entityId: 'sensor.bed_temperature_humidity_sensor' },
    { id: 'study', name: 'Study', icon: '📚', sensor: '[Study] Temperature & Humidity', entityId: 'sensor.study_temperature_humidity' },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', sensor: '[Kitchen] Temperature & Humidity', entityId: 'sensor.kitchen_temperature_humidity' },
    { id: 'bathroom', name: 'Bathroom', icon: '🚿', sensor: '[Bath] Temperature & Humidity', entityId: 'sensor.bath_temperature_humidity' },
    { id: 'balcony', name: 'Balcony', icon: '🌿', sensor: '[Balcony] Temperature & Humidity', entityId: 'sensor.balcony_temperature_humidity' }
  ],
  staleThreshold: 5 * 60 * 1000,  // 5 minutes
  maxHistoryPoints: 500,
  historyHours: 6
};

// Floor plan configuration for 3D view - exact apartment dimensions
export const FLOOR_PLAN_CONFIG = {
  apartmentWidth: 9.239,
  apartmentDepth: 7.665,
  wallHeight: 2.0,
  wallThickness: 0.15,
  rooms: [
    { id: 'study', name: 'Study', icon: '📚', x: 2.4425, z: 1.8485, width: 4.885, depth: 3.697, color: 0x60a5fa, labelY: 3 },
    { id: 'living', name: 'Living Room', icon: '🛋️', x: 2.954, z: 5.681, width: 5.908, depth: 3.968, color: 0x34d399, labelY: 3 },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', x: 6.9945, z: 5.976, width: 4.489, depth: 3.378, color: 0xfbbf24, labelY: 4 },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', x: 7.5735, z: 3.218, width: 3.331, depth: 2.138, color: 0xf87171, labelY: 3 },
    { id: 'bathroom', name: 'Bathroom', icon: '🚿', x: 7.664, z: 0.712, width: 3.15, depth: 1.424, color: 0xa78bfa, labelY: 2 }
  ],
  balcony: { x: -0.525, z: 7.065, width: 1.050, depth: 1.200, color: 0x93c5fd },
  hallway: { x: 5.4, z: 2.0, width: 1.5, depth: 2.5, color: 0x94a3b8 },
  doors: [
    { x: 0, z: 6.465, rotation: Math.PI/2, type: 'french', swingDirection: 'inward' },  // Balcony ↔ Living (double glass French doors at west wall)
    { x: 5.533, z: 3.697, rotation: 0, swingDirection: 'south' },           // Living ↔ Hallway
    { x: 4.885, z: 1.848, rotation: Math.PI/2, swingDirection: 'east' },    // Study ↔ Hallway
    { x: 6.105, z: 3.697, rotation: 0, swingDirection: 'south' },           // Bedroom ↔ Hallway
    { x: 5.908, z: 2.818, rotation: Math.PI/2, swingDirection: 'east' },    // Hallway ↔ Kitchen
    { x: 5.908, z: 1.338, rotation: Math.PI/2, swingDirection: 'east' },    // Hallway ↔ Bathroom
    { x: 9.239, z: 4.8, rotation: Math.PI/2, type: 'entry', swingDirection: 'west' }  // Main entry door (east wall)
  ],
  windows: [
    { x: 0, z: 1.848, rotation: Math.PI/2, size: 2.5 },       // Study left
    { x: 0, z: 5.681, rotation: Math.PI/2, size: 2.5 },       // Living left
    { x: 9.239, z: 5.976, rotation: Math.PI/2, size: 2.5 },   // Bedroom right
    { x: 9.239, z: 3.218, rotation: Math.PI/2, size: 1.8 },   // Kitchen right
    { x: 9.239, z: 1.487, rotation: Math.PI/2, size: 1.2 }    // Bathroom right
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
