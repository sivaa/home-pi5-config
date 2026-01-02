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
