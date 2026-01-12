// ========================================
// TRANSPORT STORE
// Fetches from Pi backend scraper service (on-demand)
// ========================================

export function initTransportStore(Alpine, CONFIG) {
  Alpine.store('transport', {
    departures: { sbahn: [], bus: [] },
    loading: false,
    lastUpdated: null,
    error: null,
    errorDetails: null,  // Technical details for debugging
    fallback: null,
    fetchStartTime: null,

    // Configuration
    WALK_TIME: 5,  // Minutes to reach stops
    // Always use 'pi' - scraper only runs on Pi (in Docker), never locally
    API_URL: 'http://pi:8890/api/transport',

    // No auto-refresh - fetched on-demand when view opens

    async fetchDepartures() {
      console.log('[transport] Fetching from backend...');
      this.loading = true;
      this.error = null;
      this.errorDetails = null;
      this.fetchStartTime = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch(this.API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.departures.sbahn = data.sbahn || [];
        this.departures.bus = data.bus || [];
        this.lastUpdated = data.updated;
        this.error = data.error;
        this.fallback = data.fallback;

        // If API returned an error in the response body, show technical details
        if (data.error) {
          this.errorDetails = {
            url: this.API_URL,
            message: data.error,
            type: 'API',
            timestamp: new Date().toLocaleTimeString('de-DE'),
            hint: 'Scraper returned an error. Check container logs: docker logs data-scraper'
          };
        }

        console.log('[transport] Updated:', {
          sbahn: this.departures.sbahn.length,
          bus: this.departures.bus.length,
          error: this.error,
          duration: Date.now() - this.fetchStartTime + 'ms'
        });

      } catch (e) {
        console.error('[transport] Fetch failed:', e);
        const isTimeout = e.name === 'AbortError';
        const isNetworkError = e.message === 'Failed to fetch' || e.name === 'TypeError';

        this.error = isTimeout ? 'Request timeout' :
                     isNetworkError ? 'Cannot connect to scraper' :
                     e.message || 'Service unavailable';

        this.errorDetails = {
          url: this.API_URL,
          message: e.message,
          type: isTimeout ? 'TIMEOUT' : isNetworkError ? 'NETWORK' : 'HTTP',
          timestamp: new Date().toLocaleTimeString('de-DE'),
          hint: isNetworkError
            ? 'Scraper container may be starting up (~15s) or not running'
            : isTimeout
            ? 'Browser may be launching. Try again in 20 seconds.'
            : 'Check container logs: docker logs data-scraper'
        };

        this.fallback = {
          sbahn: 'https://www.bahnhof.de/berlin-zehlendorf/abfahrt?verkehrsmittel=s-bahn',
          bus: 'https://www.bvg.de/de/verbindungen/echtzeit-abfahrten'
        };
      }

      this.loading = false;
      this.fetchStartTime = null;
    },

    // Get elapsed time since fetch started (for loading UI)
    getElapsedSeconds() {
      if (!this.fetchStartTime) return 0;
      return Math.floor((Date.now() - this.fetchStartTime) / 1000);
    },

    getNextDeparture() {
      // Combine S-Bahn and bus departures, excluding cancelled trips
      const all = [...this.departures.sbahn, ...this.departures.bus]
        .filter(dep => !dep.cancelled);
      if (all.length === 0) return null;
      return all.sort((a, b) => a.minutes - b.minutes)[0];
    },

    getNextDepartureText() {
      const next = this.getNextDeparture();
      if (!next) return this.loading ? '...' : 'No data';
      return `${next.line} in ${next.minutes} min`;
    },

    getStatusClass(minutes) {
      if (minutes === undefined || minutes === null) return '';
      if (minutes < this.WALK_TIME) return 'status-missed';
      if (minutes <= this.WALK_TIME + 2) return 'status-urgent';
      if (minutes <= this.WALK_TIME + 5) return 'status-soon';
      return 'status-ok';
    },

    getBadgeClass() {
      const next = this.getNextDeparture();
      if (!next) return '';
      return this.getStatusClass(next.minutes);
    }
  });
}
