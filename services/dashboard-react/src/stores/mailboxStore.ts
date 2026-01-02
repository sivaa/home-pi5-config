/**
 * mailboxStore - State management for mailbox motion sensor
 *
 * Features:
 * - Motion event tracking from [Mailbox] Motion Sensor
 * - Delivery statistics (today, week)
 * - Signal health monitoring
 * - Real-time MQTT updates
 */

import { create } from 'zustand';

// Motion event from mailbox sensor
export interface MailboxEvent {
  id: string;
  time: number;
  eventType: 'motion_detected' | 'motion_cleared' | 'device_online' | 'device_offline';
  battery?: number;
  linkquality?: number;
}

// MQTT payload from motion sensor
interface MotionSensorPayload {
  occupancy?: boolean;
  battery?: number;
  linkquality?: number;
  tamper?: boolean;
  battery_low?: boolean;
}

interface MailboxStore {
  // State
  events: MailboxEvent[];
  maxEvents: number;
  lastBattery: number | null;
  lastLinkquality: number | null;
  lastSeen: number | null;
  available: boolean;

  // Actions
  processMessage: (payload: MotionSensorPayload) => void;
  updateAvailability: (online: boolean) => void;
  clearEvents: () => void;

  // Computed (as functions for Zustand)
  getTodayEvents: () => MailboxEvent[];
  getWeekEvents: () => MailboxEvent[];
  hasMailToday: () => boolean;
  lastDelivery: () => MailboxEvent | null;
  stats: () => {
    todayCount: number;
    weekCount: number;
    totalCount: number;
    avgDeliveryHour: number | null;
  };
  signalHealth: () => {
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    label: string;
    uptimePercent: number;
  };
}

// Generate unique ID for events
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Helper to check if timestamp is today
const isToday = (timestamp: number): boolean => {
  const today = new Date();
  const date = new Date(timestamp);
  return date.toDateString() === today.toDateString();
};

// Helper to check if timestamp is within last 7 days
const isThisWeek = (timestamp: number): boolean => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return timestamp >= weekAgo;
};

export const useMailboxStore = create<MailboxStore>((set, get) => ({
  // Initial state
  events: [],
  maxEvents: 200,
  lastBattery: null,
  lastLinkquality: null,
  lastSeen: null,
  available: false,

  // Process MQTT message from motion sensor
  processMessage: (payload) => {
    const now = Date.now();
    const updates: Partial<MailboxStore> = {
      lastSeen: now,
    };

    // Update battery and signal
    if (payload.battery !== undefined) {
      updates.lastBattery = payload.battery;
    }
    if (payload.linkquality !== undefined) {
      updates.lastLinkquality = payload.linkquality;
    }

    set(updates);

    // Create motion events
    if (payload.occupancy !== undefined) {
      const eventType = payload.occupancy ? 'motion_detected' : 'motion_cleared';

      // Check for duplicate within 1 second
      const { events, maxEvents } = get();
      const isDuplicate = events.some(
        (e) => Math.abs(e.time - now) < 1000 && e.eventType === eventType
      );

      if (!isDuplicate) {
        const newEvent: MailboxEvent = {
          id: generateId(),
          time: now,
          eventType,
          battery: payload.battery,
          linkquality: payload.linkquality,
        };

        set((state) => ({
          events: [newEvent, ...state.events].slice(0, maxEvents),
        }));
      }
    }
  },

  // Update availability status
  updateAvailability: (online) => {
    const now = Date.now();
    const { events, maxEvents } = get();

    // Add availability event
    const newEvent: MailboxEvent = {
      id: generateId(),
      time: now,
      eventType: online ? 'device_online' : 'device_offline',
    };

    set({
      available: online,
      lastSeen: online ? now : get().lastSeen,
      events: [newEvent, ...events].slice(0, maxEvents),
    });
  },

  // Clear all events
  clearEvents: () => {
    set({ events: [] });
  },

  // Get today's events
  getTodayEvents: () => {
    return get().events.filter((e) => isToday(e.time));
  },

  // Get this week's events
  getWeekEvents: () => {
    return get().events.filter((e) => isThisWeek(e.time));
  },

  // Check if mail arrived today
  hasMailToday: () => {
    return get().events.some(
      (e) => e.eventType === 'motion_detected' && isToday(e.time)
    );
  },

  // Get last delivery event
  lastDelivery: () => {
    return get().events.find((e) => e.eventType === 'motion_detected') || null;
  },

  // Calculate statistics
  stats: () => {
    const events = get().events;
    const deliveries = events.filter((e) => e.eventType === 'motion_detected');

    const todayDeliveries = deliveries.filter((e) => isToday(e.time));
    const weekDeliveries = deliveries.filter((e) => isThisWeek(e.time));

    // Calculate average delivery hour
    let avgDeliveryHour: number | null = null;
    if (weekDeliveries.length > 0) {
      const hours = weekDeliveries.map((e) => new Date(e.time).getHours());
      avgDeliveryHour = Math.round(
        hours.reduce((a, b) => a + b, 0) / hours.length
      );
    }

    return {
      todayCount: todayDeliveries.length,
      weekCount: weekDeliveries.length,
      totalCount: deliveries.length,
      avgDeliveryHour,
    };
  },

  // Calculate signal health
  signalHealth: () => {
    const { available, lastSeen, lastLinkquality, events } = get();
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000;

    // Check if offline
    const timeSinceLastSeen = lastSeen ? now - lastSeen : Infinity;
    const isOffline = !available || timeSinceLastSeen > thirtyMinutes;

    // Calculate recent activity
    const recentEvents = events.filter((e) => now - e.time < 24 * 60 * 60 * 1000);

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';
    let label = 'Healthy';
    let uptimePercent = 100;

    if (isOffline) {
      status = 'critical';
      label = 'Offline';
      uptimePercent = 0;
    } else if (lastLinkquality !== null && lastLinkquality < 50) {
      status = 'warning';
      label = 'Weak Signal';
      uptimePercent = 50;
    } else if (recentEvents.length === 0) {
      status = 'unknown';
      label = 'No Data';
      uptimePercent = 0;
    } else {
      // Calculate uptime based on event frequency
      const expectedEvents = 24 * 2; // At least 2 events per hour expected
      uptimePercent = Math.min(
        100,
        Math.round((recentEvents.length / expectedEvents) * 100)
      );
    }

    return { status, label, uptimePercent };
  },
}));
