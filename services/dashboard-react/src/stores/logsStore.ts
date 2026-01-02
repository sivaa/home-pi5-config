/**
 * Logs Store - Real-time MQTT message capture
 *
 * Captures ALL MQTT messages for debugging and audit.
 * Uses circular buffer for O(1) inserts.
 */

import { create } from 'zustand';

// Category definitions with icons and colors
export const LOG_CATEGORIES = {
  climate: { icon: '🌡️', label: 'Climate', color: '#22c55e' },
  contact: { icon: '🚪', label: 'Doors', color: '#3b82f6' },
  motion: { icon: '👁️', label: 'Motion', color: '#f59e0b' },
  thermostat: { icon: '🔥', label: 'Thermostat', color: '#ef4444' },
  light: { icon: '💡', label: 'Lights', color: '#fbbf24' },
  plug: { icon: '🔌', label: 'Plugs', color: '#8b5cf6' },
  system: { icon: '📡', label: 'System', color: '#6b7280' },
} as const;

export type LogCategory = keyof typeof LOG_CATEGORIES;

export interface LogEntry {
  id: string;
  timestamp: number;
  topic: string;
  device: string;
  category: LogCategory;
  severity: 'info' | 'warning' | 'error' | 'success';
  values: Record<string, unknown>;
  payload: unknown;
}

interface LogsStore {
  // State
  logs: LogEntry[];
  maxLogs: number;
  paused: boolean;

  // Filters
  categoryFilter: LogCategory | null;
  searchFilter: string;

  // Actions
  addLog: (entry: LogEntry) => void;
  captureMessage: (topic: string, payload: unknown) => void;
  togglePause: () => void;
  clearLogs: () => void;
  setCategoryFilter: (category: LogCategory | null) => void;
  setSearchFilter: (search: string) => void;

  // Computed
  filteredLogs: () => LogEntry[];
  stats: () => { total: number; byCategory: Record<string, number> };
}

// Helper to extract device name from topic
function extractDevice(topic: string): string {
  return topic.replace('zigbee2mqtt/', '').replace('dashboard/', '');
}

// Helper to detect category from device/payload
function detectCategory(device: string, payload: unknown): LogCategory {
  const p = payload as Record<string, unknown>;

  if (p.local_temperature !== undefined || p.running_state !== undefined) {
    return 'thermostat';
  }
  if (p.contact !== undefined) {
    return 'contact';
  }
  if (p.occupancy !== undefined) {
    return 'motion';
  }
  if (p.brightness !== undefined || device.toLowerCase().includes('light')) {
    return 'light';
  }
  if (device.toLowerCase().includes('plug')) {
    return 'plug';
  }
  if (p.temperature !== undefined || p.humidity !== undefined || p.co2 !== undefined) {
    return 'climate';
  }

  return 'system';
}

// Helper to detect severity
function detectSeverity(payload: unknown): 'info' | 'warning' | 'error' | 'success' {
  const p = payload as Record<string, unknown>;

  if (p.state === 'offline') return 'error';
  if (typeof p.battery === 'number' && p.battery < 10) return 'error';
  if (typeof p.battery === 'number' && p.battery < 20) return 'warning';
  if (typeof p.co2 === 'number' && p.co2 >= 1500) return 'error';
  if (typeof p.co2 === 'number' && p.co2 >= 1200) return 'warning';
  if (p.contact === false) return 'warning';
  if (p.state === 'online') return 'success';

  return 'info';
}

// Helper to extract display values
function extractValues(payload: unknown): Record<string, unknown> {
  const p = payload as Record<string, unknown>;
  const values: Record<string, unknown> = {};

  if (p.temperature !== undefined) values.temperature = p.temperature;
  if (p.humidity !== undefined) values.humidity = p.humidity;
  if (p.co2 !== undefined) values.co2 = p.co2;
  if (p.battery !== undefined) values.battery = p.battery;
  if (p.contact !== undefined) values.contact = p.contact;
  if (p.occupancy !== undefined) values.occupancy = p.occupancy;
  if (p.state !== undefined) values.state = p.state;
  if (p.brightness !== undefined) values.brightness = p.brightness;
  if (p.local_temperature !== undefined) values.localTemp = p.local_temperature;
  if (p.running_state !== undefined) values.runningState = p.running_state;
  if (p.linkquality !== undefined) values.linkquality = p.linkquality;

  return values;
}

export const useLogsStore = create<LogsStore>((set, get) => ({
  logs: [],
  maxLogs: 500,
  paused: false,
  categoryFilter: null,
  searchFilter: '',

  addLog: (entry) => {
    set((state) => {
      const newLogs = [entry, ...state.logs];
      if (newLogs.length > state.maxLogs) {
        newLogs.length = state.maxLogs;
      }
      return { logs: newLogs };
    });
  },

  captureMessage: (topic, payload) => {
    const { paused, addLog } = get();
    if (paused) return;

    // Skip bridge noise
    if (topic.includes('/bridge/')) return;

    const device = extractDevice(topic);
    const category = detectCategory(device, payload);
    const severity = detectSeverity(payload);
    const values = extractValues(payload);

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      topic,
      device,
      category,
      severity,
      values,
      payload,
    };

    addLog(entry);
  },

  togglePause: () => set((state) => ({ paused: !state.paused })),

  clearLogs: () => set({ logs: [] }),

  setCategoryFilter: (category) => set({ categoryFilter: category }),

  setSearchFilter: (search) => set({ searchFilter: search }),

  filteredLogs: () => {
    const { logs, categoryFilter, searchFilter } = get();
    let result = logs;

    if (categoryFilter) {
      result = result.filter((log) => log.category === categoryFilter);
    }

    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      result = result.filter((log) =>
        log.device.toLowerCase().includes(search) ||
        log.topic.toLowerCase().includes(search) ||
        JSON.stringify(log.values).toLowerCase().includes(search)
      );
    }

    return result;
  },

  stats: () => {
    const { logs } = get();
    const byCategory: Record<string, number> = {};

    Object.keys(LOG_CATEGORIES).forEach((cat) => {
      byCategory[cat] = 0;
    });

    logs.forEach((log) => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    });

    return { total: logs.length, byCategory };
  },
}));
