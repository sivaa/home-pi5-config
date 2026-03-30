/**
 * Sailing View - Where Is Siva?
 * Shows voyage progress from Ft. Lauderdale to Horta, Azores
 *
 * Features:
 *   - SVG route map with current position
 *   - Progress bar with distance stats
 *   - Speed, ETA, daily distance stats
 *   - Recent check-in messages
 *
 * Lifecycle:
 *   init() -> activate store (starts fetching)
 *   destroy() -> deactivate store (stops polling)
 */

export function sailingView() {
  return {
    _initialized: false,

    // ========================================
    // LIFECYCLE
    // ========================================

    init() {
      if (this._initialized) return;
      this._initialized = true;
      console.log('[sailing-view] Initializing...');
      if (!this.$store.sailing) {
        console.error('[sailing-view] Store not found!');
        return;
      }
      this.$store.sailing.activate();
    },

    destroy() {
      console.log('[sailing-view] Destroying...');
      this.$store.sailing?.deactivate();
      this._initialized = false;
    },

    // ========================================
    // STORE ACCESS
    // ========================================

    get store() { return this.$store.sailing; },
    get stats() { return this.store?.stats; },
    get track() { return this.store?.track || []; },
    get messages() { return this.store?.messages || []; },
    get waypoints() { return this.store?.waypoints || []; },
    get isLoading() { return this.store?.loading && !this.stats; },
    get hasError() { return this.store?.error && !this.stats; },
    get hasData() { return !!this.stats; },
    get route() { return this.store?.route; },

    // ========================================
    // POSITION & VOYAGE
    // ========================================

    get position() { return this.stats?.current_position; },

    get progressPct() {
      return this.stats?.voyage?.progress_pct || 0;
    },

    get distanceCompleted() {
      const km = this.stats?.voyage?.distance_completed_km || 0;
      return km >= 100 ? Math.round(km).toLocaleString() : km.toFixed(1);
    },

    get distanceRemaining() {
      const km = this.stats?.voyage?.distance_remaining_km || 0;
      return km >= 100 ? Math.round(km).toLocaleString() : km.toFixed(1);
    },

    get totalRouteKm() {
      const km = this.stats?.voyage?.total_route_km || 5000;
      return km.toLocaleString();
    },

    get currentSpeed() {
      return (this.stats?.speed?.current_kmh || 0).toFixed(1);
    },

    get avgSpeed() {
      return (this.stats?.speed?.average_kmh || 0).toFixed(1);
    },

    get etaText() {
      const eta = this.stats?.eta;
      if (!eta?.estimated_arrival) return '--';
      const d = new Date(eta.estimated_arrival);
      return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    },

    get daysRemaining() {
      const days = this.stats?.eta?.days_remaining;
      if (!days) return '--';
      return days < 1 ? '< 1' : Math.round(days).toString();
    },

    get lastUpdate() {
      const ts = this.position?.last_update;
      if (!ts) return 'No data';
      const d = new Date(ts);
      const now = new Date();
      const diffMin = Math.floor((now - d) / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${Math.floor(diffHrs / 24)}d ago`;
    },

    get heading() {
      return this.position?.heading_compass || '--';
    },

    // ========================================
    // DAILY DISTANCES
    // ========================================

    get dailyDistances() {
      const daily = this.stats?.daily_distances || [];
      return daily.slice(-7).reverse();
    },

    get maxDailyKm() {
      if (!this.dailyDistances.length) return 1;
      return Math.max(...this.dailyDistances.map(d => d.distance_km));
    },

    dailyBarWidth(km) {
      return Math.max(4, (km / this.maxDailyKm) * 100) + '%';
    },

    formatDayLabel(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    },

    // ========================================
    // MESSAGES
    // ========================================

    get recentMessages() {
      return [...this.messages]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5);
    },

    formatMessageTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    // ========================================
    // SVG MAP
    // ========================================

    // Project lat/lon to SVG coordinates matching the atlantic-map.svg background
    // Map bounds: lat 20-45, lon -85 to -20, SVG viewBox: 0 0 1000 500
    projectX(lon) {
      return ((lon - (-85)) / 65) * 1000;
    },

    projectY(lat) {
      return ((45 - lat) / 25) * 500;
    },

    get waypointPositions() {
      return this.waypoints.map(wp => ({
        name: wp.name,
        x: this.projectX(wp.lon),
        y: this.projectY(wp.lat),
      }));
    },

    get boatPosition() {
      if (!this.position) return null;
      return {
        x: this.projectX(this.position.lon),
        y: this.projectY(this.position.lat),
      };
    },

    get trackPath() {
      if (this.track.length < 2) return '';
      return this.track.map((p, i) => {
        const x = this.projectX(p.lon);
        const y = this.projectY(p.lat);
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
    },

    get routePath() {
      if (this.waypoints.length < 2) return '';
      return this.waypoints.map((wp, i) => {
        const x = this.projectX(wp.lon);
        const y = this.projectY(wp.lat);
        return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
    },

    // ========================================
    // ACTIONS
    // ========================================

    refresh() {
      this.store?.fetchData();
    }
  };
}
