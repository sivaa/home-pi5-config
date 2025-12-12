/**
 * Dashboard Configuration
 * Central configuration for the Smart Home Dashboard
 */

export const CONFIG = {
  mqttUrl: 'ws://dietpi.local:9001',
  baseTopic: 'zigbee2mqtt',
  influxUrl: '/api/influx',
  influxDb: 'homeassistant',
  rooms: [
    { id: 'living', name: 'Living Room', icon: '🛋️', sensor: 'Living Room TRH (1)', entityId: 'sensor.living_room_trh_1' },
    { id: 'bedroom', name: 'Bedroom', icon: '🛏️', sensor: 'Bed Room TRH (2)', entityId: 'sensor.bed_room_trh_2' },
    { id: 'study', name: 'Study', icon: '📚', sensor: 'Study Room TRH (3)', entityId: 'sensor.study_room_trh_3' },
    { id: 'kitchen', name: 'Kitchen', icon: '🍳', sensor: 'Kitchen TRH (4)', entityId: 'sensor.kitchen_trh_4' },
    { id: 'bathroom', name: 'Bathroom', icon: '🚿', sensor: 'Bath Room TRH (5)', entityId: 'sensor.bath_room_trh_5' }
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
