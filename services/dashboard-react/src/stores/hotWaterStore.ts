/**
 * Hot Water Store - Zustand store for hot water usage monitoring
 *
 * Tracks water usage via vibration sensor on hot water pipe.
 * Simple state: running or idle, with last update time.
 */

import { create } from 'zustand';

interface HotWaterStore {
  // State
  isRunning: boolean;
  lastUpdate: number | null;

  // Actions
  setRunning: (running: boolean) => void;
}

export const useHotWaterStore = create<HotWaterStore>((set) => ({
  isRunning: false,
  lastUpdate: null,

  setRunning: (running: boolean) => {
    set({
      isRunning: running,
      lastUpdate: Date.now(),
    });
  },
}));
