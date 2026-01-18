/**
 * Zigbee Device Configuration
 * Device layout for network visualization
 *
 * Total Devices: 39 (including coordinator)
 * Last Updated: 2026-01-17
 */

export const ZIGBEE_DEVICES = [
  // Coordinator
  { id: 'coordinator', name: 'Sonoff Dongle V2', type: 'coordinator', icon: '📡', room: 'living', x: 0.5, z: 0.4 },

  // === ROUTERS (Mains-powered devices) ===
  // Smart Plugs (act as mesh routers)
  { id: 'plug1', name: 'Smart Plug [1]', type: 'router', icon: '🔌', room: 'living', x: 0.3, z: 0.3 },
  { id: 'plug2', name: 'Smart Plug [2]', type: 'router', icon: '🔌', room: 'study', x: 0.8, z: 0.2 },
  { id: 'plug3', name: 'Smart Plug [3]', type: 'router', icon: '🔌', room: 'kitchen', x: 0.6, z: 0.1 },

  // IKEA Lights (mains-powered routers)
  { id: 'study-light', name: '[Study] IKEA Light', type: 'router', icon: '💡', room: 'study', x: 0.85, z: 0.25 },
  { id: 'living-light', name: '[Living] IKEA Light', type: 'router', icon: '💡', room: 'living', x: 0.4, z: 0.35 },

  // CO2 Sensor (USB-powered router)
  { id: 'co2', name: '[Hallway] CO2', type: 'router', icon: '🌬️', room: 'hallway', x: 0.5, z: 0.5 },

  // Light Switches (mains-powered routers) - SONOFF ZBM5-1C-80/86
  { id: 'light-switch-study', name: '[Study] Light Switch', type: 'router', icon: '🔘', room: 'study', x: 0.78, z: 0.18 },
  { id: 'light-switch-bed', name: '[Bed] Light Switch', type: 'router', icon: '🔘', room: 'bedroom', x: 0.12, z: 0.22 },
  { id: 'light-switch-living', name: '[Living] Light Switch', type: 'router', icon: '🔘', room: 'living', x: 0.32, z: 0.42 },

  // === END DEVICES (Battery-powered) ===

  // Temperature Sensors
  { id: 'temp-balcony', name: '[Balcony] Temperature & Humidity', type: 'end-device', icon: '🌡️', room: 'balcony', x: 0.1, z: 0.4 },
  { id: 'temp-study', name: '[Study] Temperature & Humidity', type: 'end-device', icon: '🌡️', room: 'study', x: 0.9, z: 0.2 },
  { id: 'temp-study-8', name: '[Study] Temperature & Humidity 8', type: 'end-device', icon: '🌡️', room: 'study', x: 0.75, z: 0.15 },
  { id: 'temp-living', name: '[Living] Temperature & Humidity', type: 'end-device', icon: '🌡️', room: 'living', x: 0.35, z: 0.4 },
  { id: 'temp-living-6', name: '[Living] Temperature & Humidity 6', type: 'end-device', icon: '🌡️', room: 'living', x: 0.45, z: 0.35 },
  { id: 'temp-living-7', name: '[Living] Temperature & Humidity 7', type: 'end-device', icon: '🌡️', room: 'living', x: 0.25, z: 0.45 },
  { id: 'temp-kitchen', name: '[Kitchen] Temperature & Humidity', type: 'end-device', icon: '🌡️', room: 'kitchen', x: 0.65, z: 0.15 },
  { id: 'temp-kitchen-10', name: '[Kitchen] Temperature & Humidity 10', type: 'end-device', icon: '🌡️', room: 'kitchen', x: 0.55, z: 0.08 },
  { id: 'temp-bath', name: '[Bath] Temperature & Humidity', type: 'end-device', icon: '🌡️', room: 'bathroom', x: 0.85, z: 0.1 },
  { id: 'temp-bath-11', name: '[Bath] Temperature & Humidity 11', type: 'end-device', icon: '🌡️', room: 'bathroom', x: 0.9, z: 0.05 },
  { id: 'temp-bed', name: '[Bed] Temperature & Humidity', type: 'end-device', icon: '🌡️', room: 'bedroom', x: 0.2, z: 0.15 },
  { id: 'temp-bed-9', name: '[Bed] Temperature & Humidity 9', type: 'end-device', icon: '🌡️', room: 'bedroom', x: 0.15, z: 0.2 },

  // Contact Sensors (8 total)
  { id: 'contact-bath', name: '[Bath] Window Contact Sensor', type: 'end-device', icon: '🪟', room: 'bathroom', x: 0.95, z: 0.08 },
  { id: 'contact-bed', name: '[Bed] Window Contact Sensor', type: 'end-device', icon: '🪟', room: 'bedroom', x: 0.1, z: 0.1 },
  { id: 'contact-kitchen', name: '[Kitchen] Window Contact Sensor', type: 'end-device', icon: '🪟', room: 'kitchen', x: 0.7, z: 0.05 },
  { id: 'contact-study-lg', name: '[Study] Window Contact Sensor - Large', type: 'end-device', icon: '🪟', room: 'study', x: 0.95, z: 0.18 },
  { id: 'contact-study-sm', name: '[Study] Window Contact Sensor - Small', type: 'end-device', icon: '🪟', room: 'study', x: 0.92, z: 0.28 },
  { id: 'contact-living-balcony', name: '[Living] Window Contact Sensor - Balcony Door', type: 'end-device', icon: '🚪', room: 'living', x: 0.2, z: 0.5 },
  { id: 'contact-living-window', name: '[Living] Window Contact Sensor - Window', type: 'end-device', icon: '🪟', room: 'living', x: 0.5, z: 0.48 },
  { id: 'contact-main-door', name: '[Hallway] Window Contact Sensor - Main Door', type: 'end-device', icon: '🚪', room: 'hallway', x: 0.5, z: 0.55 },

  // Thermostats (4 total)
  { id: 'thermo-study', name: '[Study] Thermostat', type: 'end-device', icon: '🔥', room: 'study', x: 0.7, z: 0.25 },
  { id: 'thermo-bed', name: '[Bed] Thermostat', type: 'end-device', icon: '🔥', room: 'bedroom', x: 0.05, z: 0.18 },
  { id: 'thermo-living-inner', name: '[Living] Thermostat Inner', type: 'end-device', icon: '🔥', room: 'living', x: 0.3, z: 0.25 },
  { id: 'thermo-living-outer', name: '[Living] Thermostat Outer', type: 'end-device', icon: '🔥', room: 'living', x: 0.4, z: 0.5 },

  // Motion Sensor (Mailbox)
  { id: 'motion-mailbox', name: '[Mailbox] Motion Sensor', type: 'end-device', icon: '📬', room: 'mailbox', x: 0.05, z: 0.5 },

  // IKEA Remotes
  { id: 'remote-study', name: '[Study] Light Remote', type: 'end-device', icon: '🎛️', room: 'study', x: 0.82, z: 0.22 },
  { id: 'remote-living', name: '[Living] Light Remote', type: 'end-device', icon: '🎛️', room: 'living', x: 0.38, z: 0.38 },

  // Vibration Sensor (Hot Water)
  { id: 'vibration', name: 'Vibration Sensor', type: 'end-device', icon: '💧', room: 'bathroom', x: 0.88, z: 0.12 },

  // Fingerbot (Tuya TS0001_fingerbot)
  { id: 'fingerbot', name: 'Fingerbot', type: 'end-device', icon: '🤖', room: 'hallway', x: 0.52, z: 0.52 },
];
