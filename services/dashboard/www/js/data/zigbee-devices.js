/**
 * Zigbee Device Configuration
 * Device layout for network visualization
 */

export const ZIGBEE_DEVICES = [
  { id: 'coordinator', name: 'ZBBridge-P', type: 'coordinator', icon: '📡', room: 'living', x: 0.5, z: 0.4 },
  { id: 'router1', name: 'S60ZBTPF', type: 'router', icon: '📢', room: 'study', x: 0.8, z: 0.2 },
  { id: 'router2', name: 'S60ZBTPF', type: 'router', icon: '📢', room: 'living', x: 0.3, z: 0.3 },
  { id: 'sensor1', name: 'SNZB-02P', type: 'end-device', icon: '🌡️', room: 'bedroom', x: 0.2, z: 0.15 },
  { id: 'sensor2', name: 'SNZB-03P', type: 'end-device', icon: '🚶', room: 'kitchen', x: 0.5, z: 0.1 },
  { id: 'sensor3', name: 'SNZB-04P', type: 'end-device', icon: '🚪', room: 'bathroom', x: 0.85, z: 0.1 },
  { id: 'trv', name: 'TRVZB', type: 'end-device', icon: '🔥', room: 'bedroom', x: 0.1, z: 0.25 },
];
