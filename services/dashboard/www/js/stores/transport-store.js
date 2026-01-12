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
    fallback: null,

    // Configuration
    WALK_TIME: 5,  // Minutes to reach stops
    // Always use 'pi' - scraper only runs on Pi (in Docker), never locally
    API_URL: 'http://pi:8890/api/transport',

    // No auto-refresh - fetched on-demand when view opens

    async fetchDepartures() {
      console.log('[transport] Fetching from backend...');
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(this.API_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        this.departures.sbahn = data.sbahn || [];
        this.departures.bus = data.bus || [];
        this.lastUpdated = data.updated;
        this.error = data.error;
        this.fallback = data.fallback;

        console.log('[transport] Updated:', {
          sbahn: this.departures.sbahn.length,
          bus: this.departures.bus.length,
          error: this.error
        });

      } catch (e) {
        console.error('[transport] Fetch failed:', e);
        this.error = 'Service unavailable';
        this.fallback = {
          sbahn: 'https://www.bahnhof.de/berlin-zehlendorf/abfahrt?verkehrsmittel=s-bahn',
          bus: 'https://www.bvg.de/de/verbindungen/echtzeit-abfahrten'
        };
      }

      this.loading = false;
    },

    getNextDeparture() {
      // Combine S-Bahn and bus departures
      const all = [...this.departures.sbahn, ...this.departures.bus];
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
