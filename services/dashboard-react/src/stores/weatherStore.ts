/**
 * Weather Store - Zustand store for Home Assistant weather data
 *
 * Fetches weather data from Home Assistant REST API:
 * - Temperature from weather.forecast_home entity
 * - Weather condition and icon
 * - Humidity
 */

import { create } from 'zustand';

// Weather condition to emoji mapping
const WEATHER_ICONS: Record<string, string> = {
  'clear-night': '🌙',
  cloudy: '☁️',
  fog: '🌫️',
  hail: '🌨️',
  lightning: '⚡',
  'lightning-rainy': '⛈️',
  partlycloudy: '⛅',
  pouring: '🌧️',
  rainy: '🌧️',
  snowy: '❄️',
  'snowy-rainy': '🌨️',
  sunny: '☀️',
  windy: '💨',
  'windy-variant': '💨',
  exceptional: '⚠️',
};

interface WeatherState {
  temperature: number | null;
  humidity: number | null;
  condition: string | null;
  icon: string;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface WeatherStore extends WeatherState {
  // Actions
  fetchWeather: () => Promise<void>;
  setError: (error: string) => void;
}

// Home Assistant API configuration
const HA_API_URL = 'http://pi:8123/api/states/weather.forecast_home';

export const useWeatherStore = create<WeatherStore>((set, get) => ({
  // Initial state
  temperature: null,
  humidity: null,
  condition: null,
  icon: '🌡️',
  loading: false,
  error: null,
  lastFetched: null,

  fetchWeather: async () => {
    // Skip if already loading
    if (get().loading) return;

    set({ loading: true, error: null });

    try {
      // For now, we'll try to fetch without auth (if HA allows)
      // In production, this should use proper HA long-lived access token
      const response = await fetch(HA_API_URL, {
        headers: {
          'Content-Type': 'application/json',
          // Authorization header would go here with token
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const condition = data.state || 'unknown';
      const icon = WEATHER_ICONS[condition] || '🌡️';

      set({
        temperature: data.attributes?.temperature ?? null,
        humidity: data.attributes?.humidity ?? null,
        condition,
        icon,
        loading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({
        loading: false,
        error: message,
      });
    }
  },

  setError: (error: string) => {
    set({ error, loading: false });
  },
}));
