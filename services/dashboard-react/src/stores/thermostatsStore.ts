/**
 * Thermostats Store - Zustand store for SONOFF TRVZB thermostats
 *
 * Tracks thermostat state and provides control commands.
 * Uses MQTT for real-time updates and commands.
 */

import { create } from 'zustand';
import { THERMOSTATS_CONFIG, ThermostatConfig } from '@/config';

export interface ThermostatState {
  id: string;
  name: string;
  icon: string;
  sensor: string;
  roomId: string;
  // Current state
  localTemp: number | null;
  targetTemp: number | null;
  runningState: 'idle' | 'heat';
  systemMode: 'heat' | 'off';
  battery: number | null;
  linkquality: number | null;
  available: boolean;
  lastSeen: number | null;
  // UI state
  syncing: boolean;
  pendingTarget: number | null;
}

interface ThermostatsStore {
  // State
  thermostats: ThermostatState[];

  // Actions
  updateThermostat: (sensor: string, data: Record<string, unknown>) => void;
  updateAvailability: (sensor: string, isOnline: boolean) => void;
  setTargetTemp: (id: string, temp: number, publish: (topic: string, payload: unknown) => void) => void;
  adjustTemp: (id: string, delta: number, publish: (topic: string, payload: unknown) => void) => void;
  togglePower: (id: string, publish: (topic: string, payload: unknown) => void) => void;

  // Getters
  getThermostat: (id: string) => ThermostatState | undefined;
  activeHeatingCount: () => number;
  offlineCount: () => number;
}

// Initialize thermostats from config
function initThermostats(): ThermostatState[] {
  return THERMOSTATS_CONFIG.map((config: ThermostatConfig) => ({
    ...config,
    localTemp: null,
    targetTemp: null,
    runningState: 'idle' as const,
    systemMode: 'heat' as const,
    battery: null,
    linkquality: null,
    available: true,
    lastSeen: null,
    syncing: false,
    pendingTarget: null,
  }));
}

export const useThermostatsStore = create<ThermostatsStore>((set, get) => ({
  thermostats: initThermostats(),

  updateThermostat: (sensor, data) => {
    set((state) => ({
      thermostats: state.thermostats.map((t) => {
        if (t.sensor !== sensor) return t;

        const updates: Partial<ThermostatState> = {
          lastSeen: Date.now(),
          syncing: false,
        };

        if (data.local_temperature !== undefined) {
          updates.localTemp = data.local_temperature as number;
        }
        if (data.occupied_heating_setpoint !== undefined) {
          updates.targetTemp = data.occupied_heating_setpoint as number;
          updates.pendingTarget = null; // Clear optimistic update
        }
        if (data.running_state !== undefined) {
          updates.runningState = data.running_state === 'heat' ? 'heat' : 'idle';
        }
        if (data.system_mode !== undefined) {
          updates.systemMode = data.system_mode as 'heat' | 'off';
        }
        if (data.battery !== undefined) {
          updates.battery = data.battery as number;
        }
        if (data.linkquality !== undefined) {
          updates.linkquality = data.linkquality as number;
        }

        return { ...t, ...updates };
      }),
    }));
  },

  updateAvailability: (sensor, isOnline) => {
    set((state) => ({
      thermostats: state.thermostats.map((t) =>
        t.sensor === sensor ? { ...t, available: isOnline } : t
      ),
    }));
  },

  setTargetTemp: (id, temp, publish) => {
    const thermostat = get().thermostats.find((t) => t.id === id);
    if (!thermostat || !thermostat.available) return;

    // Clamp to valid range (5-22°C)
    const clampedTemp = Math.max(5, Math.min(22, temp));

    // Optimistic update
    set((state) => ({
      thermostats: state.thermostats.map((t) =>
        t.id === id ? { ...t, pendingTarget: clampedTemp, syncing: true } : t
      ),
    }));

    // Publish command
    const topic = `zigbee2mqtt/${thermostat.sensor}/set`;
    publish(topic, { occupied_heating_setpoint: clampedTemp });

    // Clear syncing after timeout
    setTimeout(() => {
      set((state) => ({
        thermostats: state.thermostats.map((t) =>
          t.id === id && t.syncing ? { ...t, syncing: false, pendingTarget: null } : t
        ),
      }));
    }, 5000);
  },

  adjustTemp: (id, delta, publish) => {
    const thermostat = get().thermostats.find((t) => t.id === id);
    if (!thermostat) return;

    const currentTarget = thermostat.pendingTarget ?? thermostat.targetTemp ?? 20;
    const newTarget = Math.round(currentTarget + delta);
    get().setTargetTemp(id, newTarget, publish);
  },

  togglePower: (id, publish) => {
    const thermostat = get().thermostats.find((t) => t.id === id);
    if (!thermostat || !thermostat.available) return;

    const newMode = thermostat.systemMode === 'off' ? 'heat' : 'off';

    // Optimistic update
    set((state) => ({
      thermostats: state.thermostats.map((t) =>
        t.id === id ? { ...t, syncing: true } : t
      ),
    }));

    // Publish command
    const topic = `zigbee2mqtt/${thermostat.sensor}/set`;
    publish(topic, { system_mode: newMode });

    // Clear syncing after timeout
    setTimeout(() => {
      set((state) => ({
        thermostats: state.thermostats.map((t) =>
          t.id === id && t.syncing ? { ...t, syncing: false } : t
        ),
      }));
    }, 5000);
  },

  getThermostat: (id) => get().thermostats.find((t) => t.id === id),

  activeHeatingCount: () => get().thermostats.filter((t) => t.runningState === 'heat').length,

  offlineCount: () => get().thermostats.filter((t) => !t.available).length,
}));
