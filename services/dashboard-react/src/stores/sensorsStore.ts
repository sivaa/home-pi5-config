/**
 * Sensors Store - Zustand store for door/window contact sensors
 *
 * Manages state for SONOFF SNZB-04P contact sensors:
 * - Door/window open/closed state
 * - Battery level
 * - Time since opened (for open sensors)
 */

import { create } from 'zustand';
import type { ContactSensorConfig } from '@/config';

// Sensor state in store
export interface ContactSensorState {
  id: string;
  friendlyName: string;
  shortName: string;
  type: 'door' | 'window';
  contact: boolean | null; // true = closed, false = open
  battery: number | null;
  linkquality: number | null;
  openedAt: number | null; // timestamp when opened
  lastSeen: number | null;
}

// MQTT message from contact sensor
export interface ContactMQTTMessage {
  contact?: boolean;
  battery?: number;
  linkquality?: number;
}

interface SensorsStore {
  // State
  sensors: ContactSensorState[];
  initializing: boolean;

  // Getters
  openDoors: () => ContactSensorState[];
  openWindows: () => ContactSensorState[];
  openDoorCount: () => number;
  openWindowCount: () => number;
  allDoorsSecure: () => boolean;
  allWindowsSecure: () => boolean;

  // Actions
  updateSensor: (friendlyName: string, data: ContactMQTTMessage) => void;
  initializeSensors: (configs: ContactSensorConfig[]) => void;
}

export const useSensorsStore = create<SensorsStore>((set, get) => ({
  sensors: [],
  initializing: true,

  // Getters
  openDoors: () =>
    get().sensors.filter((s) => s.type === 'door' && s.contact === false),

  openWindows: () =>
    get().sensors.filter((s) => s.type === 'window' && s.contact === false),

  openDoorCount: () => get().openDoors().length,

  openWindowCount: () => get().openWindows().length,

  allDoorsSecure: () => {
    const doors = get().sensors.filter((s) => s.type === 'door');
    return doors.length > 0 && doors.every((d) => d.contact === true);
  },

  allWindowsSecure: () => {
    const windows = get().sensors.filter((s) => s.type === 'window');
    return windows.length > 0 && windows.every((w) => w.contact === true);
  },

  // Actions
  updateSensor: (friendlyName: string, data: ContactMQTTMessage) => {
    set((state) => ({
      sensors: state.sensors.map((sensor) => {
        if (sensor.friendlyName !== friendlyName) return sensor;

        const wasOpen = sensor.contact === false;
        const isNowOpen = data.contact === false;

        // Track when door/window was opened
        let openedAt = sensor.openedAt;
        if (!wasOpen && isNowOpen) {
          // Just opened
          openedAt = Date.now();
        } else if (data.contact === true) {
          // Just closed
          openedAt = null;
        }

        return {
          ...sensor,
          contact: data.contact ?? sensor.contact,
          battery: data.battery ?? sensor.battery,
          linkquality: data.linkquality ?? sensor.linkquality,
          openedAt,
          lastSeen: Date.now(),
        };
      }),
      initializing: false,
    }));
  },

  initializeSensors: (configs: ContactSensorConfig[]) => {
    const sensors: ContactSensorState[] = configs.map((config, index) => ({
      id: `sensor-${index}`,
      friendlyName: config.name,
      shortName: config.shortName,
      type: config.type,
      contact: null,
      battery: null,
      linkquality: null,
      openedAt: null,
      lastSeen: null,
    }));

    set({ sensors, initializing: true });
  },
}));
