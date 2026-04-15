/**
 * Dashboard Configuration
 * Central configuration for the React Dashboard
 */

// Detect environment for MQTT/API URLs
const isLocalDev =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const CONFIG = {
  // MQTT WebSocket URL
  // Local dev: connect directly to Pi's MQTT WebSocket
  // Pi deployment: use same host on port 9001
  mqttUrl: isLocalDev
    ? 'ws://pi:9001'
    : `ws://${typeof window !== 'undefined' ? window.location.hostname : 'pi'}:9001`,

  baseTopic: 'zigbee2mqtt',

  // Stale data threshold (5 minutes)
  staleThreshold: 5 * 60 * 1000,
} as const;

// Light configurations
export const LIGHTS_CONFIG = [
  {
    id: 'study_light',
    name: 'Study Light',
    icon: '📚',
    topic: '[Study] IKEA Light',
  },
  {
    id: 'living_light',
    name: 'Living Room Light',
    icon: '🛋️',
    topic: '[Living] IKEA Light',
  },
  {
    id: 'bath_light',
    name: 'Bathroom Light',
    icon: '🛁',
    topic: '[Bath] Light',
  },
  {
    id: 'bed_light',
    name: 'Bedroom Light',
    icon: '🛏️',
    topic: '[Bed] Light',
  },
] as const;

// Light presets
export const LIGHT_PRESETS = {
  reading: { brightness: 254, colorTemp: 300, label: 'Reading' },
  relax: { brightness: 150, colorTemp: 400, label: 'Relax' },
  bright: { brightness: 254, colorTemp: 250, label: 'Bright' },
  night: { brightness: 30, colorTemp: 454, label: 'Night' },
} as const;

// Light scenes (apply to all lights)
export const LIGHT_SCENES = {
  movie: { state: 'ON' as const, brightness: 50, colorTemp: 400, label: 'Movie' },
  work: { state: 'ON' as const, brightness: 254, colorTemp: 280, label: 'Work' },
  evening: { state: 'ON' as const, brightness: 150, colorTemp: 380, label: 'Evening' },
  goodnight: { state: 'OFF' as const, label: 'Goodnight' },
} as const;

export type LightPreset = keyof typeof LIGHT_PRESETS;
export type LightScene = keyof typeof LIGHT_SCENES;

// Room configuration for Classic view
export interface RoomConfig {
  id: string;
  name: string;
  icon: string;
  isOutdoor: boolean;
}

export interface SensorConfig {
  name: string;
  label: string;
  isPrimary?: boolean;
}

export interface RoomSensorsConfig {
  climate: SensorConfig[];
  co2?: SensorConfig[];
}

// All rooms in the apartment (ordered for Classic view display)
export const ROOMS_CONFIG: RoomConfig[] = [
  { id: 'bathroom', name: 'Bathroom', icon: '🚿', isOutdoor: false },
  { id: 'kitchen', name: 'Kitchen', icon: '🍳', isOutdoor: false },
  { id: 'hallway', name: 'Hallway', icon: '🚶', isOutdoor: false },
  { id: 'study', name: 'Study', icon: '📚', isOutdoor: false },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', isOutdoor: false },
  { id: 'living', name: 'Living Room', icon: '🛋️', isOutdoor: false },
  { id: 'balcony', name: 'Balcony', icon: '🌿', isOutdoor: true },
];

// Multi-sensor support per room
export const ROOM_SENSORS: Record<string, RoomSensorsConfig> = {
  living: {
    climate: [
      { name: '[Living] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Living] Temperature & Humidity 6', label: 'Sensor 2' },
      { name: '[Living] Temperature & Humidity 7', label: 'Sensor 3' },
    ],
  },
  bedroom: {
    climate: [
      { name: '[Bed] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Bed] Temperature & Humidity 9', label: 'Sensor 2' },
    ],
  },
  study: {
    climate: [
      { name: '[Study] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Study] Temperature & Humidity 8', label: 'Sensor 2' },
    ],
  },
  kitchen: {
    climate: [
      { name: '[Kitchen] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Kitchen] Temperature & Humidity 10', label: 'Sensor 2' },
    ],
  },
  bathroom: {
    climate: [
      { name: '[Bath] Temperature & Humidity', label: 'Primary', isPrimary: true },
      { name: '[Bath] Temperature & Humidity 11', label: 'Sensor 2' },
    ],
  },
  balcony: {
    climate: [{ name: '[Balcony] Temperature & Humidity', label: 'Outdoor', isPrimary: true }],
  },
  hallway: {
    climate: [{ name: '[Hallway] CO2', label: 'Air Quality', isPrimary: true }],
  },
};

// Comfort level thresholds
export const COMFORT_THRESHOLDS = {
  cold: 18,
  cool: 20,
  comfortable: 22,
  warm: 25,
  hot: 28,
} as const;

export type ComfortLevel = 'cold' | 'cool' | 'comfortable' | 'warm' | 'hot';

// Thermostat configuration (SONOFF TRVZB devices)
export interface ThermostatConfig {
  id: string;
  name: string;
  icon: string;
  sensor: string;
  roomId: string;
}

export const THERMOSTATS_CONFIG: ThermostatConfig[] = [
  { id: 'study', name: 'Study', icon: '📚', sensor: '[Study] Thermostat', roomId: 'study' },
  { id: 'living_inner', name: 'Living Inner', icon: '🛋️', sensor: '[Living] Thermostat Inner', roomId: 'living' },
  { id: 'living_outer', name: 'Living Outer', icon: '🛋️', sensor: '[Living] Thermostat Outer', roomId: 'living' },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', sensor: '[Bed] Thermostat', roomId: 'bedroom' },
];

// View configuration
export interface ViewConfig {
  id: string;
  name: string;
  icon: string;
  title: string;
  path: string;
  key: string;
}

export interface ViewCategory {
  id: string;
  name: string;
  icon: string;
  views: ViewConfig[];
}

// All dashboard views organized by category
export const VIEW_CATEGORIES: ViewCategory[] = [
  {
    id: 'display',
    name: 'Display',
    icon: '📺',
    views: [
      { id: 'classic', name: 'Classic', icon: '🃏', title: 'Classic Cards', path: '/', key: '8' },
    ],
  },
  {
    id: 'monitor',
    name: 'Monitor',
    icon: '📈',
    views: [
      { id: 'timeline', name: 'Timeline', icon: '📖', title: 'Event Timeline', path: '/timeline', key: '5' },
      { id: 'logs', name: 'Logs', icon: '📋', title: 'Activity Logs', path: '/logs', key: 'l' },
      { id: 'co2', name: 'CO2', icon: '💨', title: 'CO2 Monitor', path: '/co2', key: '0' },
      { id: 'hotwater', name: 'Hot Water', icon: '🚿', title: 'Hot Water Monitor', path: '/hotwater', key: 'w' },
    ],
  },
  {
    id: 'visualize',
    name: 'Visualize',
    icon: '👁️',
    views: [
      { id: 'network', name: 'Network', icon: '📡', title: 'Zigbee Network', path: '/network', key: 'n' },
    ],
  },
  {
    id: 'control',
    name: 'Control',
    icon: '🎛️',
    views: [
      { id: 'lights', name: 'Lights', icon: '💡', title: 'Light Control', path: '/lights', key: '7' },
      { id: 'heater', name: 'Heater', icon: '🔥', title: 'Heater Control', path: '/heater', key: 'h' },
      { id: 'mailbox', name: 'Mailbox', icon: '📬', title: 'Mailbox Monitor', path: '/mailbox', key: 'm' },
    ],
  },
];

// Flat list of all views
export const ALL_VIEWS = VIEW_CATEGORIES.flatMap((cat) => cat.views);

// Keyboard shortcut map (key -> view id)
export const KEYBOARD_SHORTCUTS = Object.fromEntries(
  ALL_VIEWS.map((v) => [v.key.toLowerCase(), v.id])
);

// Zigbee device configuration for Network view
export interface ZigbeeDevice {
  id: string;
  name: string;
  type: 'coordinator' | 'router' | 'end-device';
  icon: string;
  room: string;
  x: number; // 0-1 position within room
  z: number; // 0-1 position within room
}

export const ZIGBEE_DEVICES: ZigbeeDevice[] = [
  // Coordinator
  { id: 'coordinator', name: 'Sonoff Dongle V2', type: 'coordinator', icon: '📡', room: 'living', x: 0.5, z: 0.4 },

  // Routers (mains-powered)
  { id: 'plug1', name: 'Smart Plug [1]', type: 'router', icon: '🔌', room: 'living', x: 0.3, z: 0.3 },
  { id: 'plug2', name: 'Smart Plug [2]', type: 'router', icon: '🔌', room: 'study', x: 0.8, z: 0.2 },
  { id: 'plug3', name: 'Smart Plug [3]', type: 'router', icon: '🔌', room: 'kitchen', x: 0.6, z: 0.1 },
  { id: 'study-light', name: '[Study] IKEA Light', type: 'router', icon: '💡', room: 'study', x: 0.85, z: 0.25 },
  { id: 'living-light', name: '[Living] IKEA Light', type: 'router', icon: '💡', room: 'living', x: 0.4, z: 0.35 },
  { id: 'bath-light', name: '[Bath] Light', type: 'router', icon: '💡', room: 'bathroom', x: 0.80, z: 0.05 },
  { id: 'bed-light', name: '[Bed] Light', type: 'router', icon: '💡', room: 'bedroom', x: 0.50, z: 0.50 },
  { id: 'co2', name: '[Hallway] CO2', type: 'router', icon: '🌬️', room: 'hallway', x: 0.5, z: 0.5 },

  // End devices (battery-powered)
  { id: 'temp-balcony', name: '[Balcony] Temperature', type: 'end-device', icon: '🌡️', room: 'balcony', x: 0.1, z: 0.4 },
  { id: 'temp-study', name: '[Study] Temperature', type: 'end-device', icon: '🌡️', room: 'study', x: 0.9, z: 0.2 },
  { id: 'temp-living', name: '[Living] Temperature', type: 'end-device', icon: '🌡️', room: 'living', x: 0.35, z: 0.4 },
  { id: 'temp-kitchen', name: '[Kitchen] Temperature', type: 'end-device', icon: '🌡️', room: 'kitchen', x: 0.65, z: 0.15 },
  { id: 'temp-bath', name: '[Bath] Temperature', type: 'end-device', icon: '🌡️', room: 'bathroom', x: 0.85, z: 0.1 },
  { id: 'temp-bed', name: '[Bed] Temperature', type: 'end-device', icon: '🌡️', room: 'bedroom', x: 0.2, z: 0.15 },

  // Contact sensors
  { id: 'contact-bath', name: '[Bath] Window', type: 'end-device', icon: '🪟', room: 'bathroom', x: 0.95, z: 0.08 },
  { id: 'contact-bed', name: '[Bed] Window', type: 'end-device', icon: '🪟', room: 'bedroom', x: 0.1, z: 0.1 },
  { id: 'contact-kitchen', name: '[Kitchen] Window', type: 'end-device', icon: '🪟', room: 'kitchen', x: 0.7, z: 0.05 },
  { id: 'contact-study-lg', name: '[Study] Window Large', type: 'end-device', icon: '🪟', room: 'study', x: 0.95, z: 0.18 },
  { id: 'contact-living-door', name: '[Living] Balcony Door', type: 'end-device', icon: '🚪', room: 'living', x: 0.2, z: 0.5 },
  { id: 'contact-main-door', name: '[Hallway] Main Door', type: 'end-device', icon: '🚪', room: 'hallway', x: 0.5, z: 0.55 },

  // Thermostats
  { id: 'thermo-study', name: '[Study] Thermostat', type: 'end-device', icon: '🔥', room: 'study', x: 0.7, z: 0.25 },
  { id: 'thermo-bed', name: '[Bed] Thermostat', type: 'end-device', icon: '🔥', room: 'bedroom', x: 0.05, z: 0.18 },
  { id: 'thermo-living-inner', name: '[Living] Thermostat', type: 'end-device', icon: '🔥', room: 'living', x: 0.3, z: 0.25 },
  { id: 'thermo-living-outer', name: '[Living] Thermostat', type: 'end-device', icon: '🔥', room: 'living', x: 0.4, z: 0.5 },

  // Mailbox motion sensor
  { id: 'motion-mailbox', name: '[Mailbox] Motion Sensor', type: 'end-device', icon: '📬', room: 'mailbox', x: 0.5, z: 0.5 },

  // Vibration sensor
  { id: 'vibration', name: 'Vibration Sensor', type: 'end-device', icon: '💧', room: 'bathroom', x: 0.88, z: 0.12 },
];

// Floor plan room positions (for 2D SVG layout)
export interface FloorPlanRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FLOOR_PLAN_ROOMS: FloorPlanRoom[] = [
  { id: 'bathroom', name: 'Bath', x: 0, y: 0, width: 80, height: 50 },
  { id: 'kitchen', name: 'Kitchen', x: 0, y: 50, width: 80, height: 60 },
  { id: 'hallway', name: 'Hall', x: 80, y: 0, width: 60, height: 110 },
  { id: 'bedroom', name: 'Bedroom', x: 0, y: 110, width: 100, height: 90 },
  { id: 'study', name: 'Study', x: 140, y: 0, width: 100, height: 100 },
  { id: 'living', name: 'Living', x: 100, y: 100, width: 140, height: 100 },
  { id: 'balcony', name: 'Balcony', x: 0, y: 200, width: 60, height: 40 },
];

// Contact sensor configuration (doors and windows)
export interface ContactSensorConfig {
  name: string;
  type: 'door' | 'window';
  shortName: string;
}

export const CONTACT_SENSORS: ContactSensorConfig[] = [
  { name: '[Bath] Window Contact Sensor', type: 'window', shortName: 'Bath Window' },
  { name: '[Bed] Window Contact Sensor', type: 'window', shortName: 'Bed Window' },
  { name: '[Kitchen] Window Contact Sensor', type: 'window', shortName: 'Kitchen Window' },
  { name: '[Study] Window Contact Sensor - Large', type: 'window', shortName: 'Study Big' },
  { name: '[Study] Window Contact Sensor - Small', type: 'window', shortName: 'Study Small' },
  { name: '[Living] Window Contact Sensor - Balcony Door', type: 'door', shortName: 'Balcony Door' },
  { name: '[Living] Window Contact Sensor - Window', type: 'window', shortName: 'Living Window' },
  { name: '[Hallway] Window Contact Sensor - Main Door', type: 'door', shortName: 'Main Door' },
];
