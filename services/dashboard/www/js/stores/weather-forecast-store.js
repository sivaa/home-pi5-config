/**
 * Weather Forecast Store
 * Fetches 10-day forecast from Open-Meteo API (free, no API key)
 * Lazy lifecycle: only fetches when view is active
 *
 * Data flow:
 *   View opens → activate() → fetchForecast() → poll every 30min
 *   View closes → deactivate() → clear timer, keep last data
 *
 * Location: Zehlendorf, Berlin (from HA MET config)
 */

// WMO Weather Interpretation Codes → emoji + description
// https://open-meteo.com/en/docs#weathervariables
const WMO_CODES = {
  0:  { day: '☀️', night: '🌙', desc: 'Clear sky' },
  1:  { day: '🌤️', night: '🌙', desc: 'Mainly clear' },
  2:  { day: '⛅', night: '☁️', desc: 'Partly cloudy' },
  3:  { day: '☁️', night: '☁️', desc: 'Overcast' },
  45: { day: '🌫️', night: '🌫️', desc: 'Fog' },
  48: { day: '🌫️', night: '🌫️', desc: 'Rime fog' },
  51: { day: '🌦️', night: '🌧️', desc: 'Light drizzle' },
  53: { day: '🌦️', night: '🌧️', desc: 'Drizzle' },
  55: { day: '🌧️', night: '🌧️', desc: 'Heavy drizzle' },
  56: { day: '🌧️', night: '🌧️', desc: 'Freezing drizzle' },
  57: { day: '🌧️', night: '🌧️', desc: 'Heavy freezing drizzle' },
  61: { day: '🌧️', night: '🌧️', desc: 'Light rain' },
  63: { day: '🌧️', night: '🌧️', desc: 'Rain' },
  65: { day: '🌧️', night: '🌧️', desc: 'Heavy rain' },
  66: { day: '🌧️', night: '🌧️', desc: 'Freezing rain' },
  67: { day: '🌧️', night: '🌧️', desc: 'Heavy freezing rain' },
  71: { day: '🌨️', night: '🌨️', desc: 'Light snow' },
  73: { day: '❄️', night: '❄️', desc: 'Snow' },
  75: { day: '❄️', night: '❄️', desc: 'Heavy snow' },
  77: { day: '🌨️', night: '🌨️', desc: 'Snow grains' },
  80: { day: '🌦️', night: '🌧️', desc: 'Light showers' },
  81: { day: '🌧️', night: '🌧️', desc: 'Showers' },
  82: { day: '⛈️', night: '⛈️', desc: 'Heavy showers' },
  85: { day: '🌨️', night: '🌨️', desc: 'Light snow showers' },
  86: { day: '❄️', night: '❄️', desc: 'Snow showers' },
  95: { day: '⛈️', night: '⛈️', desc: 'Thunderstorm' },
  96: { day: '⛈️', night: '⛈️', desc: 'Thunderstorm with hail' },
  99: { day: '⛈️', night: '⛈️', desc: 'Thunderstorm with heavy hail' }
};

export function initWeatherForecastStore(Alpine) {
  Alpine.store('weatherForecast', {
    // Current conditions (from Open-Meteo current block)
    current: null,  // { temp, emoji, description, isDay }

    // Hourly forecast (next 24 hours)
    hourly: [],  // [{ hour, temp, precipProb, emoji, isDay }]

    // Daily forecast (10 days)
    daily: [],  // [{ dayName, date, emoji, desc, tempMax, tempMin, precipProb, precipSum }]

    // Contextual alert text (derived from hourly data)
    alertText: null,

    // Derived highlights (computed once per fetch, see _computeHighlights)
    weeklyHighlights: null,

    // Status
    loading: false,
    error: null,
    lastUpdate: null,

    // Config
    API_URL: 'https://api.open-meteo.com/v1/forecast',
    LATITUDE: 52.4319,
    LONGITUDE: 13.2599,
    TIMEZONE: 'Europe/Berlin',

    // Polling (30 min, only while active)
    POLL_MS: 30 * 60 * 1000,
    _pollTimer: null,
    _active: false,

    // ========================================
    // LIFECYCLE (lazy - view controls)
    // ========================================

    activate() {
      if (this._active) return;
      this._active = true;
      console.log('[weather-forecast] Activated');
      this.fetchForecast();
      this._pollTimer = setInterval(() => this.fetchForecast(), this.POLL_MS);
    },

    deactivate() {
      if (!this._active) return;
      this._active = false;
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
      console.log('[weather-forecast] Deactivated (data preserved)');
    },

    // ========================================
    // API FETCH
    // ========================================

    async fetchForecast() {
      this.loading = true;

      const params = new URLSearchParams({
        latitude: this.LATITUDE,
        longitude: this.LONGITUDE,
        timezone: this.TIMEZONE,
        forecast_days: 10,
        current: [
          'temperature_2m',
          'weather_code',
          'is_day',
          'wind_speed_10m',
          'wind_direction_10m',
          'relative_humidity_2m',
          'apparent_temperature'
        ].join(','),
        hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
        daily: [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'precipitation_sum',
          'sunrise',
          'sunset',
          'uv_index_max'
        ].join(',')
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(
          `${this.API_URL}?${params}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Parse into temps first, then commit atomically
        // (avoids partial state if one parser throws)
        try {
          const newCurrent = this._parseCurrent(data.current);
          const newHourly = this._parseHourly(data.hourly);
          const newDaily = this._parseDaily(data.daily);
          const newAlert = this._generateAlert(newHourly, newDaily);

          this.current = newCurrent;
          this.hourly = newHourly;
          this.daily = newDaily;
          this.alertText = newAlert;
          this.weeklyHighlights = this._computeHighlights(newDaily);
        } catch (parseErr) {
          console.error('[weather-forecast] Parse error:', parseErr.message, 'Data keys:', Object.keys(data));
          this.error = `Forecast parse error: ${parseErr.message}`;
          return;
        }

        this.error = null;
        this.lastUpdate = Date.now();

        console.log('[weather-forecast] Updated', {
          current: this.current?.temp,
          hourly: this.hourly.length,
          daily: this.daily.length,
          alert: this.alertText
        });
      } catch (e) {
        clearTimeout(timeoutId);
        const msg = e.name === 'AbortError' ? 'Request timeout' : e.message;
        console.error('[weather-forecast] Fetch error:', msg);
        this.error = msg;
        // Keep last successful data (don't clear hourly/daily)
      } finally {
        this.loading = false;
      }
    },

    // ========================================
    // PARSERS
    // ========================================

    _parseCurrent(current) {
      if (!current) return null;
      const code = current.weather_code;
      const isDay = current.is_day === 1;
      const info = this._weatherInfo(code, isDay);
      return {
        temp: Math.round(current.temperature_2m),
        emoji: info.emoji,
        description: info.desc,
        isDay,
        wind: Math.round(current.wind_speed_10m || 0),
        windDir: current.wind_direction_10m ?? null,
        humidity: Math.round(current.relative_humidity_2m || 0),
        feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m)
      };
    },

    _parseHourly(hourly) {
      if (!hourly?.time) return [];
      const now = Date.now();
      const result = [];

      for (let i = 0; i < hourly.time.length; i++) {
        const time = new Date(hourly.time[i]);
        if (time.getTime() < now) continue;
        if (result.length >= 24) break;

        const code = hourly.weather_code[i];
        const isDay = hourly.is_day[i] === 1;
        const info = this._weatherInfo(code, isDay);

        result.push({
          time,
          hour: time.getHours(),
          temp: Math.round(hourly.temperature_2m[i]),
          precipProb: Math.round(hourly.precipitation_probability[i] || 0),
          weatherCode: code,
          emoji: info.emoji,
          isDay
        });
      }
      return result;
    },

    _parseDaily(daily) {
      if (!daily?.time) return [];
      return daily.time.map((t, i) => {
        const date = new Date(t);
        const code = daily.weather_code[i];
        const info = this._weatherInfo(code, true);
        const dayOfWeek = date.getDay();

        return {
          date,
          dayName: this._dayName(date, i),
          dateStr: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
          emoji: info.emoji,
          description: info.desc,
          tempMax: Math.round(daily.temperature_2m_max[i]),
          tempMin: Math.round(daily.temperature_2m_min[i]),
          precipProb: Math.round(daily.precipitation_probability_max[i] || 0),
          precipSum: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
          sunrise: daily.sunrise[i],
          sunset: daily.sunset[i],
          uvIndex: Math.round(daily.uv_index_max?.[i] ?? 0),
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6
        };
      });
    },

    // ========================================
    // ALERT GENERATION
    // Scans hourly data for actionable weather events
    // ========================================

    _generateAlert(hourly, daily) {
      if (!hourly.length) return null;

      // Check for rain in next 12 hours
      const next12h = hourly.slice(0, 12);
      const rainyHours = next12h.filter(h => h.precipProb >= 50);

      if (rainyHours.length > 0) {
        const peakHour = rainyHours.reduce((a, b) => a.precipProb > b.precipProb ? a : b);
        const startHour = rainyHours[0];
        const endHour = rainyHours[rainyHours.length - 1];
        const fmt = h => h.time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

        if (rainyHours.length === 1) {
          return `🌧️ Rain likely around ${fmt(startHour)} (${peakHour.precipProb}%)`;
        }
        return `🌧️ Rain expected ${fmt(startHour)}–${fmt(endHour)} · Peak: ${fmt(peakHour)} (${peakHour.precipProb}%)`;
      }

      // Check for extreme cold (below 0°C)
      const coldHours = next12h.filter(h => h.temp <= 0);
      if (coldHours.length > 0) {
        const coldest = coldHours.reduce((a, b) => a.temp < b.temp ? a : b);
        return `❄️ Freezing temperatures · Low: ${coldest.temp}°C`;
      }

      // Check for extreme heat (above 32°C)
      const hotHours = next12h.filter(h => h.temp >= 32);
      if (hotHours.length > 0) {
        const hottest = hotHours.reduce((a, b) => a.temp > b.temp ? a : b);
        return `🔥 Heat alert · High: ${hottest.temp}°C`;
      }

      // Check for snow in next 12 hours (scan all, not just first hour)
      const snowCodes = [71, 73, 75, 77, 85, 86];
      const snowHours = next12h.filter(h => snowCodes.includes(h.weatherCode));
      if (snowHours.length > 0) {
        const today = daily.length > 0 ? daily[0] : null;
        return `🌨️ Snow expected · ${today?.description || 'Snow forecast'}`;
      }

      // Clear day message
      if (daily.length > 0) {
        const today = daily[0];
        return `${today.emoji} ${today.description} · High ${today.tempMax}° / Low ${today.tempMin}°`;
      }

      return null;
    },

    // ========================================
    // WEEKLY HIGHLIGHTS
    // Eager compute, called once per fetch (see fetchForecast).
    // NOT a getter - getters run on every Alpine reactive read.
    // ========================================

    _computeHighlights(daily) {
      if (!daily || daily.length === 0) return null;

      const warmest = daily.reduce((a, b) => (b.tempMax > a.tempMax ? b : a));
      const coldest = daily.reduce((a, b) => (b.tempMin < a.tempMin ? b : a));
      const wettest = daily.reduce((a, b) => (b.precipProb > a.precipProb ? b : a));

      const weekends = daily.filter(d => d.isWeekend);
      let bestWeekend = null;
      if (weekends.length > 0) {
        // Highest tempMax, tiebreak lowest precipProb
        bestWeekend = weekends.reduce((a, b) => {
          if (b.tempMax !== a.tempMax) return b.tempMax > a.tempMax ? b : a;
          return b.precipProb < a.precipProb ? b : a;
        });
      }

      return { warmest, coldest, wettest, bestWeekend };
    },

    // ========================================
    // HELPERS
    // ========================================

    _weatherInfo(code, isDay) {
      const entry = WMO_CODES[code];
      if (!entry) {
        console.warn('[weather-forecast] Unknown WMO code:', code);
        return { emoji: '❓', desc: `Unknown (${code})` };
      }
      return {
        emoji: isDay ? entry.day : entry.night,
        desc: entry.desc
      };
    },

    _dayName(date, _index) {
      // Always 3-char weekday so column labels stay aligned across the 10 columns.
      // "Today" / "Tomorrow" identity is conveyed via the Today badge on the
      // day-column button, not by changing label length (which breaks layout).
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
  });
}
