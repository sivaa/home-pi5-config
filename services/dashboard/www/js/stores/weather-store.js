/**
 * Weather Store
 * Fetches weather data from Home Assistant REST API
 */

export function initWeatherStore(Alpine, CONFIG) {
  Alpine.store('weather', {
    // Current weather data
    temperature: null,
    humidity: null,
    condition: null,
    conditionIcon: null,

    // Status
    loading: false,
    lastUpdate: null,
    error: null,

    // Home Assistant API config
    haUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://pi:8123'
      : `${window.location.protocol}//${window.location.hostname}:8123`,
    entityId: 'weather.forecast_home',
    haToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkZjJhY2UwMTBmNGY0Y2NiYTI0ZGZhMGUyZjg5NWYzNiIsImlhdCI6MTc2Njg1NjU1NywiZXhwIjoyMDgyMjE2NTU3fQ.2t04JrsGafT9hDhg0BniYG90i1O7a7DHqpdst9x3-no',

    // Polling interval (5 minutes)
    pollInterval: 5 * 60 * 1000,
    pollTimer: null,

    async init() {
      console.log('Weather store: Initializing...');
      await this.fetchWeather();
      // Start polling
      this.pollTimer = setInterval(() => this.fetchWeather(), this.pollInterval);
    },

    async fetchWeather() {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(
          `${this.haUrl}/api/states/${this.entityId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.haToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Update current weather
        this.temperature = data.attributes.temperature;
        this.humidity = data.attributes.humidity;
        this.condition = data.state;
        this.conditionIcon = this.getConditionIcon(data.state);

        this.lastUpdate = Date.now();
        console.log('Weather store: Updated', { temp: this.temperature, condition: this.condition });
      } catch (e) {
        console.error('Weather store: Fetch error:', e);
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    },

    // Map weather condition to emoji
    getConditionIcon(condition) {
      const iconMap = {
        'sunny': '☀️',
        'clear-night': '🌙',
        'partlycloudy': '⛅',
        'cloudy': '☁️',
        'rainy': '🌧️',
        'pouring': '🌧️',
        'snowy': '🌨️',
        'snowy-rainy': '🌨️',
        'fog': '🌫️',
        'hail': '🌨️',
        'lightning': '⚡',
        'lightning-rainy': '⛈️',
        'windy': '💨',
        'windy-variant': '💨',
        'exceptional': '⚠️'
      };
      return iconMap[condition] || '🌡️';
    },

    destroy() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
      }
    }
  });
}
