/**
 * Kiosk Store - Display Mode Control
 *
 * Manages kiosk mode (fullscreen toggle, refresh) via the kiosk-control service.
 * Only active when running on the Pi (not localhost development).
 */
export function initKioskStore(Alpine) {
  Alpine.store('kiosk', {
    isFullscreen: true,   // Assume fullscreen on load (default kiosk mode)
    isLoading: false,
    error: null,

    /**
     * Check if we're running on the Pi (kiosk mode available)
     */
    get isKioskAvailable() {
      // Always show on Pi - the kiosk-control service handles the actual toggle
      // On local dev without Pi, the API calls will just fail gracefully
      return true;
    },

    /**
     * Get the API base URL
     * On Pi: use localhost:8889 (kiosk-control runs on same machine)
     * Local dev on Mac: direct to Pi's kiosk-control service
     */
    get apiUrl() {
      // Local development on Mac - connect to Pi
      if (window.location.hostname === 'localhost' && window.location.port !== '8888') {
        return 'http://pi:8889/api/kiosk';
      }
      // On Pi - kiosk-control service is on the same machine
      return 'http://127.0.0.1:8889/api/kiosk';
    },

    /**
     * Toggle fullscreen mode (exit/enter kiosk)
     */
    async toggleFullscreen() {
      if (this.isLoading) return;

      this.isLoading = true;
      this.error = null;

      try {
        const response = await fetch(`${this.apiUrl}/toggle`, {
          method: 'GET',
          mode: 'cors'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          this.isFullscreen = !this.isFullscreen;
        } else {
          this.error = 'Toggle failed';
        }
      } catch (e) {
        this.error = 'Cannot reach kiosk service';
        console.error('[kiosk-store] Toggle error:', e);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Refresh the browser page
     */
    async refresh() {
      if (this.isLoading) return;

      this.isLoading = true;
      this.error = null;

      try {
        const response = await fetch(`${this.apiUrl}/refresh`, {
          method: 'GET',
          mode: 'cors'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Page will refresh, so we don't need to handle response
      } catch (e) {
        // Fallback: use JavaScript reload if API fails
        console.warn('[kiosk-store] API refresh failed, using JS fallback:', e);
        window.location.reload();
      } finally {
        this.isLoading = false;
      }
    }
  });
}
