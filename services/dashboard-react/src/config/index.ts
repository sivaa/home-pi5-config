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

// All rooms in the apartment
export const ROOMS_CONFIG: RoomConfig[] = [
  { id: 'hallway', name: 'Hallway', icon: '🚶', isOutdoor: false },
  { id: 'study', name: 'Study', icon: '📚', isOutdoor: false },
  { id: 'living', name: 'Living Room', icon: '🛋️', isOutdoor: false },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', isOutdoor: false },
  { id: 'bathroom', name: 'Bathroom', icon: '🚿', isOutdoor: false },
  { id: 'kitchen', name: 'Kitchen', icon: '🍳', isOutdoor: false },
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
    co2: [{ name: 'CO2', label: 'CO2 Monitor' }],
  },
  bedroom: {
    climate: [
      { name: '[Bed] Temperature & Humidity Sensor', label: 'Primary', isPrimary: true },
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
