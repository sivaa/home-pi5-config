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
    HA_URL: 'http://pi:8123',  // Home Assistant for container restart
    // Long-lived access token for HA API (same as other stores)
    haToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkZjJhY2UwMTBmNGY0Y2NiYTI0ZGZhMGUyZjg5NWYzNiIsImlhdCI6MTc2Njg1NjU1NywiZXhwIjoyMDgyMjE2NTU3fQ.2t04JrsGafT9hDhg0BniYG90i1O7a7DHqpdst9x3-no',

    // Container auto-restart state
    containerStopped: false,
    retrying: false,

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
        this.containerStopped = false;  // Container is working

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

        // If network error and not already retrying, try to restart container via HA
        if (isNetworkError && !this.retrying) {
          console.log('[transport] Network error - attempting container restart via HA');
          this.containerStopped = true;
          await this.triggerContainerRestart();
          return;  // triggerContainerRestart will retry the fetch
        }

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
      this.retrying = false;
    },

    // Trigger container restart via Home Assistant shell_command
    async triggerContainerRestart() {
      this.error = 'Starting transport service...';
      this.retrying = true;

      try {
        // Call HA shell_command to start container
        const response = await fetch(`${this.HA_URL}/api/services/shell_command/start_data_scraper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.haToken}`,
          },
        });

        if (response.ok) {
          console.log('[transport] Container start triggered, waiting 20s for browser launch...');
          this.error = 'Service starting, please wait (~20s)...';

          // Wait for container to start and browser to launch
          await new Promise(resolve => setTimeout(resolve, 20000));

          // Retry fetch
          console.log('[transport] Retrying fetch after container start');
          await this.fetchDepartures();
        } else {
          throw new Error(`HA returned ${response.status}`);
        }
      } catch (e) {
        console.error('[transport] Failed to restart container:', e);
        this.error = 'Cannot start service. Check Home Assistant.';
        this.errorDetails = {
          url: `${this.HA_URL}/api/services/shell_command/start_data_scraper`,
          message: e.message,
          type: 'HA_ERROR',
          timestamp: new Date().toLocaleTimeString('de-DE'),
          hint: 'Home Assistant shell_command failed. Is HA running?'
        };
        this.loading = false;
        this.retrying = false;
      }
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
