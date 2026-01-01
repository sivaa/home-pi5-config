/**
 * Idle Refresh Manager
 *
 * Automatically refreshes the page after a period of user inactivity.
 * This helps with:
 *   - Memory management (clears accumulated leaks)
 *   - State synchronization (fresh MQTT/data on reload)
 *   - Kiosk reliability (self-healing dashboard)
 *
 * Usage:
 *   IdleRefresh.init(5);  // Refresh after 5 minutes idle
 *
 * URL Override:
 *   ?idle=10  - Set to 10 minutes
 *   ?idle=0   - Disable idle refresh
 */

const IdleRefresh = {
  IDLE_TIMEOUT_MS: 5 * 60 * 1000,  // Default: 5 minutes
  CHECK_INTERVAL_MS: 30 * 1000,    // Check every 30 seconds
  lastActivity: Date.now(),
  checkInterval: null,
  enabled: true,

  /**
   * Initialize idle refresh with optional timeout override
   * @param {number} timeoutMinutes - Minutes of idle time before refresh
   */
  init(timeoutMinutes = 5) {
    // Check for URL parameter override
    const urlParams = new URLSearchParams(window.location.search);
    const idleParam = urlParams.get('idle');

    if (idleParam !== null) {
      const paramValue = parseInt(idleParam, 10);
      if (paramValue === 0) {
        this.enabled = false;
        console.log('[IdleRefresh] Disabled via URL param');
        return;
      }
      if (!isNaN(paramValue) && paramValue > 0) {
        timeoutMinutes = paramValue;
      }
    }

    this.IDLE_TIMEOUT_MS = timeoutMinutes * 60 * 1000;
    this.resetTimer();
    this.startActivityListeners();
    this.startIdleCheck();

    console.log(`[IdleRefresh] Initialized - will refresh after ${timeoutMinutes}min idle`);
  },

  /**
   * Reset the idle timer (called on user activity)
   */
  resetTimer() {
    this.lastActivity = Date.now();
  },

  /**
   * Attach event listeners for user activity
   */
  startActivityListeners() {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimer(), { passive: true });
    });
  },

  /**
   * Start the periodic idle check
   */
  startIdleCheck() {
    this.checkInterval = setInterval(() => {
      if (!this.enabled) return;

      const idleTime = Date.now() - this.lastActivity;

      if (idleTime >= this.IDLE_TIMEOUT_MS) {
        const idleMinutes = Math.round(idleTime / 60000);
        console.log(`[IdleRefresh] Idle for ${idleMinutes}min - refreshing page`);
        location.reload();
      }
    }, this.CHECK_INTERVAL_MS);
  },

  /**
   * Get current idle time in seconds
   * @returns {number} Seconds since last activity
   */
  getIdleSeconds() {
    return Math.round((Date.now() - this.lastActivity) / 1000);
  },

  /**
   * Disable idle refresh (useful for debugging)
   */
  disable() {
    this.enabled = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[IdleRefresh] Disabled');
  }
};

// Auto-initialize on DOMContentLoaded with 5-minute default
// Can be overridden via URL param: ?idle=10 (10 min) or ?idle=0 (disabled)
document.addEventListener('DOMContentLoaded', () => {
  IdleRefresh.init(5);
});
