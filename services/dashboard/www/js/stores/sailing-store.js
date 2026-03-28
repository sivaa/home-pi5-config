// ========================================
// SAILING STORE
// Fetches voyage data from where-is-siva API
// Lazy lifecycle: only fetches when view is active
//
// Data flow:
//   View opens -> activate() -> fetchData() -> poll every 5 min
//   View closes -> deactivate() -> clear timer, keep last data
// ========================================

export function initSailingStore(Alpine) {
  Alpine.store('sailing', {
    // Voyage statistics
    stats: null,
    // Track points array [{lat, lon, speed, heading, elevation, timestamp}]
    track: [],
    // Check-in messages [{text, lat, lon, timestamp}]
    messages: [],
    // Route waypoints
    waypoints: [],
    // Route metadata
    route: null,

    // Status
    loading: false,
    error: null,
    lastFetched: null,

    // Polling
    _pollTimer: null,
    _active: false,
    POLL_INTERVAL: 5 * 60 * 1000, // 5 minutes

    // On Pi: dashboard nginx proxies /api/sailing/ -> where-is-siva :8000/api/
    // Locally: hit the Pi directly
    get API_URL() {
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      return isLocal ? 'http://pi:8000/api/all' : '/api/sailing/all';
    },

    activate() {
      if (this._active) return;
      this._active = true;
      console.log('[sailing] Activating store');
      this.fetchData();
      this._pollTimer = setInterval(() => this.fetchData(), this.POLL_INTERVAL);
    },

    deactivate() {
      if (!this._active) return;
      this._active = false;
      console.log('[sailing] Deactivating store');
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    },

    async fetchData() {
      console.log('[sailing] Fetching voyage data...');
      this.loading = true;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(this.API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.stats = data.stats || null;
        this.track = data.track || [];
        this.messages = data.messages || [];
        this.waypoints = data.waypoints || [];
        this.route = data.route || null;
        this.error = null;
        this.lastFetched = Date.now();

        console.log('[sailing] Fetched: %d track points, %d messages', this.track.length, this.messages.length);
      } catch (err) {
        console.error('[sailing] Fetch failed:', err.message);
        this.error = err.name === 'AbortError' ? 'Request timed out' : err.message;
      } finally {
        this.loading = false;
      }
    }
  });
}
