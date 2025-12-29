/**
 * Theme Store - Dark Mode Management
 *
 * Manages theme preference (light/dark/system) with:
 * - localStorage persistence
 * - System preference detection
 * - Real-time OS theme change handling
 */
export function initThemeStore(Alpine) {
  Alpine.store('theme', {
    preference: 'system',  // 'light' | 'dark' | 'system'
    resolved: 'light',     // actual applied theme: 'light' | 'dark'

    init() {
      // Read from DOM attributes (set by FOIT prevention script)
      this.preference = document.documentElement.getAttribute('data-theme-preference') || 'system';
      this.resolved = document.documentElement.getAttribute('data-theme') || 'light';

      // Listen for system preference changes (when OS theme changes)
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (this.preference === 'system') {
          this.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
    },

    /**
     * Set user's theme preference
     * @param {'light' | 'dark' | 'system'} pref
     */
    setPreference(pref) {
      this.preference = pref;
      localStorage.setItem('dashboard-theme', pref);
      document.documentElement.setAttribute('data-theme-preference', pref);

      if (pref === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme(prefersDark ? 'dark' : 'light');
      } else {
        this.applyTheme(pref);
      }
    },

    /**
     * Apply theme to document
     * @param {'light' | 'dark'} theme
     */
    applyTheme(theme) {
      this.resolved = theme;
      // Enable smooth transitions during theme change
      document.documentElement.classList.add('theme-transitioning');
      document.documentElement.setAttribute('data-theme', theme);
      // Remove transition class after animation completes
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
      }, 300);
    },

    /**
     * Cycle through themes: light -> dark -> system -> light
     */
    cycle() {
      const order = ['light', 'dark', 'system'];
      const currentIndex = order.indexOf(this.preference);
      const nextIndex = (currentIndex + 1) % order.length;
      this.setPreference(order[nextIndex]);
    }
  });
}
