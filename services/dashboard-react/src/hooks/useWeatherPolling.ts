/**
 * useWeatherPolling - Hook to poll Home Assistant for weather data
 *
 * Fetches weather every 5 minutes from HA REST API.
 * Should be called once at the app level.
 */

import { useEffect } from 'react';
import { useWeatherStore } from '@/stores/weatherStore';

// Poll interval: 5 minutes
const POLL_INTERVAL = 5 * 60 * 1000;

export function useWeatherPolling() {
  const fetchWeather = useWeatherStore((state) => state.fetchWeather);

  useEffect(() => {
    // Initial fetch
    fetchWeather();

    // Set up polling interval
    const intervalId = setInterval(() => {
      fetchWeather();
    }, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchWeather]);
}
