/**
 * eventsStore - State management for Timeline events
 *
 * Captures events from multiple sources:
 * - Motion sensors (occupancy)
 * - Contact sensors (doors/windows)
 * - Lights (on/off)
 * - Plugs (on/off)
 * - Thermostats (mode changes)
 */

import { create } from 'zustand';

// Event types with their display info
export const EVENT_TYPES = {
  // Motion
  motion_detected: { icon: '👁️', label: 'Motion Detected', category: 'motion', priority: 'activity' },
  motion_cleared: { icon: '👁️', label: 'Motion Cleared', category: 'motion', priority: 'background' },

  // Contact (doors/windows)
  door_opened: { icon: '🚪', label: 'Door Opened', category: 'contact', priority: 'important' },
  door_closed: { icon: '🚪', label: 'Door Closed', category: 'contact', priority: 'activity' },

  // Lights
  light_on: { icon: '💡', label: 'Light On', category: 'light', priority: 'activity' },
  light_off: { icon: '💡', label: 'Light Off', category: 'light', priority: 'activity' },

  // Plugs
  plug_on: { icon: '🔌', label: 'Plug On', category: 'plug', priority: 'activity' },
  plug_off: { icon: '🔌', label: 'Plug Off', category: 'plug', priority: 'activity' },

  // Mailbox
  vibration_detected: { icon: '📬', label: 'Mail Arrived', category: 'vibration', priority: 'important' },

  // Device availability
  device_online: { icon: '📡', label: 'Device Online', category: 'availability', priority: 'background' },
  device_offline: { icon: '⚠️', label: 'Device Offline', category: 'availability', priority: 'important' },
} as const;

export type EventType = keyof typeof EVENT_TYPES;
export type Category = 'motion' | 'contact' | 'light' | 'plug' | 'vibration' | 'availability';

// Timeline event
export interface TimelineEvent {
  id: string;
  time: number;
  eventType: EventType;
  deviceName: string;
  room: string;
  value?: number;
  battery?: number;
  linkquality?: number;
}

// Filter state
interface EventFilters {
  categories: Category[];
  rooms: string[];
  dateRange: 'today' | 'yesterday' | 'week' | 'all';
  searchText: string;
}

interface EventsStore {
  // State
  events: TimelineEvent[];
  maxEvents: number;
  filters: EventFilters;

  // Actions
  addEvent: (event: Omit<TimelineEvent, 'id'>) => void;
  clearEvents: () => void;

  // Filter actions
  toggleCategory: (category: Category) => void;
  toggleRoom: (room: string) => void;
  setDateRange: (range: EventFilters['dateRange']) => void;
  setSearchText: (text: string) => void;
  clearFilters: () => void;

  // Computed
  getFilteredEvents: () => TimelineEvent[];
  getCategoryStats: () => Record<Category, number>;
  getAvailableRooms: () => string[];
  getStats: () => {
    motionCount: number;
    doorCount: number;
    mailboxCount: number;
    totalCount: number;
  };
}

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Extract room from device name like "[Study] Light"
const extractRoom = (deviceName: string): string => {
  const match = deviceName.match(/^\[([^\]]+)\]/);
  return match ? match[1].toLowerCase() : 'unknown';
};

// Get start of today
const getTodayStart = (): number => new Date().setHours(0, 0, 0, 0);

// Get start of yesterday
const getYesterdayStart = (): number => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.setHours(0, 0, 0, 0);
};

// Get date range filter
const getDateRangeStart = (range: EventFilters['dateRange']): number => {
  switch (range) {
    case 'today':
      return getTodayStart();
    case 'yesterday':
      return getYesterdayStart();
    case 'week':
      return Date.now() - 7 * 24 * 60 * 60 * 1000;
    case 'all':
    default:
      return 0;
  }
};

export const useEventsStore = create<EventsStore>((set, get) => ({
  // Initial state
  events: [],
  maxEvents: 500,
  filters: {
    categories: [],
    rooms: [],
    dateRange: 'today',
    searchText: '',
  },

  // Add new event
  addEvent: (event) => {
    const { events, maxEvents } = get();

    // Check for duplicate within 1 second
    const isDuplicate = events.some(
      (e) =>
        Math.abs(e.time - event.time) < 1000 &&
        e.eventType === event.eventType &&
        e.deviceName === event.deviceName
    );

    if (!isDuplicate) {
      const newEvent: TimelineEvent = {
        ...event,
        id: generateId(),
        room: event.room || extractRoom(event.deviceName),
      };

      set({
        events: [newEvent, ...events].slice(0, maxEvents),
      });
    }
  },

  // Clear all events
  clearEvents: () => {
    set({ events: [] });
  },

  // Toggle category filter
  toggleCategory: (category) => {
    set((state) => {
      const { categories } = state.filters;
      const newCategories = categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category];
      return {
        filters: { ...state.filters, categories: newCategories },
      };
    });
  },

  // Toggle room filter
  toggleRoom: (room) => {
    set((state) => {
      const { rooms } = state.filters;
      const newRooms = rooms.includes(room)
        ? rooms.filter((r) => r !== room)
        : [...rooms, room];
      return {
        filters: { ...state.filters, rooms: newRooms },
      };
    });
  },

  // Set date range
  setDateRange: (range) => {
    set((state) => ({
      filters: { ...state.filters, dateRange: range },
    }));
  },

  // Set search text
  setSearchText: (text) => {
    set((state) => ({
      filters: { ...state.filters, searchText: text },
    }));
  },

  // Clear all filters
  clearFilters: () => {
    set({
      filters: {
        categories: [],
        rooms: [],
        dateRange: 'today',
        searchText: '',
      },
    });
  },

  // Get filtered events
  getFilteredEvents: () => {
    const { events, filters } = get();
    const { categories, rooms, dateRange, searchText } = filters;

    const startTime = getDateRangeStart(dateRange);
    const endTime = dateRange === 'yesterday' ? getTodayStart() : Date.now();
    const searchLower = searchText.toLowerCase();

    return events.filter((event) => {
      // Date range filter
      if (event.time < startTime || event.time > endTime) return false;

      // Category filter (if any selected)
      if (categories.length > 0) {
        const eventCategory = EVENT_TYPES[event.eventType]?.category;
        if (!categories.includes(eventCategory)) return false;
      }

      // Room filter (if any selected)
      if (rooms.length > 0 && !rooms.includes(event.room)) return false;

      // Search filter
      if (searchText && !event.deviceName.toLowerCase().includes(searchLower)) {
        return false;
      }

      return true;
    });
  },

  // Get category stats
  getCategoryStats: () => {
    const events = get().events;
    const stats: Record<Category, number> = {
      motion: 0,
      contact: 0,
      light: 0,
      plug: 0,
      vibration: 0,
      availability: 0,
    };

    events.forEach((event) => {
      const category = EVENT_TYPES[event.eventType]?.category;
      if (category) {
        stats[category]++;
      }
    });

    return stats;
  },

  // Get available rooms from events
  getAvailableRooms: () => {
    const events = get().events;
    const rooms = new Set<string>();
    events.forEach((e) => {
      if (e.room && e.room !== 'unknown') {
        rooms.add(e.room);
      }
    });
    return Array.from(rooms).sort();
  },

  // Get summary stats
  getStats: () => {
    const events = get().events;
    const todayStart = getTodayStart();

    const todayEvents = events.filter((e) => e.time >= todayStart);

    return {
      motionCount: todayEvents.filter((e) => e.eventType === 'motion_detected').length,
      doorCount: todayEvents.filter(
        (e) => e.eventType === 'door_opened' || e.eventType === 'door_closed'
      ).length,
      mailboxCount: todayEvents.filter((e) => e.eventType === 'vibration_detected').length,
      totalCount: todayEvents.length,
    };
  },
}));
