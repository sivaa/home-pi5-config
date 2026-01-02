/**
 * CO2 Store - Zustand store for CO2 air quality monitoring
 *
 * Manages state for the NOUS E10 CO2 sensor:
 * - CO2 level (ppm)
 * - Temperature and humidity
 * - Air quality level calculation
 * - Device air quality string
 */

import { create } from 'zustand';
import { CONFIG } from '@/config';

// CO2 thresholds in ppm
const CO2_THRESHOLDS = {
  excellent: 600,
  good: 1000,
  moderate: 1500,
  poor: 2000,
} as const;

export type AirQualityLevel = 'excellent' | 'good' | 'moderate' | 'poor' | 'bad' | 'unknown';

interface CO2State {
  // Live values
  co2: number | null;
  temperature: number | null;
  humidity: number | null;
  deviceAirQuality: string | null;
  battery: number | null;
  // Status
  lastSeen: number | null;
  isStale: boolean;
  initializing: boolean;
}

interface CO2Store extends CO2State {
  // Computed
  airQualityLevel: () => AirQualityLevel;
  co2Color: () => string;
  co2Percent: () => number;

  // Actions
  updateCO2: (data: Partial<CO2State>) => void;
  checkStale: () => void;
}

// Get air quality level from CO2 value
function getAirQualityLevel(co2: number | null): AirQualityLevel {
  if (co2 === null) return 'unknown';
  if (co2 < CO2_THRESHOLDS.excellent) return 'excellent';
  if (co2 < CO2_THRESHOLDS.good) return 'good';
  if (co2 < CO2_THRESHOLDS.moderate) return 'moderate';
  if (co2 < CO2_THRESHOLDS.poor) return 'poor';
  return 'bad';
}

// Get color for air quality level
function getCO2Color(level: AirQualityLevel): string {
  const colors: Record<AirQualityLevel, string> = {
    excellent: '#34C759',
    good: '#30D158',
    moderate: '#FFD60A',
    poor: '#FF9500',
    bad: '#FF3B30',
    unknown: '#AEAEB2',
  };
  return colors[level];
}

export const useCO2Store = create<CO2Store>((set, get) => ({
  // Initial state
  co2: null,
  temperature: null,
  humidity: null,
  deviceAirQuality: null,
  battery: null,
  lastSeen: null,
  isStale: false,
  initializing: true,

  // Computed
  airQualityLevel: () => getAirQualityLevel(get().co2),
  co2Color: () => getCO2Color(get().airQualityLevel()),
  co2Percent: () => {
    const co2 = get().co2;
    if (co2 === null) return 0;
    const maxPPM = 2500;
    return Math.min(100, (co2 / maxPPM) * 100);
  },

  // Actions
  updateCO2: (data) => {
    set((state) => ({
      ...state,
      ...data,
      lastSeen: Date.now(),
      isStale: false,
      initializing: false,
    }));
  },

  checkStale: () => {
    const { lastSeen } = get();
    if (lastSeen === null) return;
    const isStale = Date.now() - lastSeen > CONFIG.staleThreshold;
    set({ isStale });
  },
}));
