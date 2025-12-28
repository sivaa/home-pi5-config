/**
 * Navigation Component
 * Grouped tab navigation with "More" dropdown and mobile support
 */

import {
  ALL_VIEWS,
  PRIMARY_VIEWS,
  OVERFLOW_CATEGORIES,
  KEYBOARD_SHORTCUTS
} from '../js/config.js';

/**
 * Navigation Alpine.js component
 */
export function navigationComponent() {
  return {
    // State
    moreMenuOpen: false,
    mobileMenuOpen: false,
    currentView: 'classic',

    // Data from config
    primaryViews: PRIMARY_VIEWS,
    overflowCategories: OVERFLOW_CATEGORIES,
    allViews: ALL_VIEWS,

    init() {
      // Restore last view from localStorage
      const saved = localStorage.getItem('dashboard-view');
      if (saved && ALL_VIEWS.find(v => v.id === saved)) {
        this.currentView = saved;
      }

      // Sync with app component if it exists
      if (this.$root && this.$root._x_dataStack) {
        const appData = this.$root._x_dataStack[0];
        if (appData && appData.currentView) {
          this.currentView = appData.currentView;
        }
      }

      // SINGLE keyboard handler for all view shortcuts
      document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.ctrlKey || e.metaKey) return;

        const key = e.key.toUpperCase();

        // Check for letter shortcuts (I, N, H, M)
        if (KEYBOARD_SHORTCUTS[key]) {
          e.preventDefault();
          this.setView(KEYBOARD_SHORTCUTS[key]);
          return;
        }

        // Check for number shortcuts (1-9, 0)
        if (KEYBOARD_SHORTCUTS[e.key]) {
          e.preventDefault();
          this.setView(KEYBOARD_SHORTCUTS[e.key]);
          return;
        }
      });

      // Close menus on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.moreMenuOpen = false;
          this.mobileMenuOpen = false;
        }
      });

      // Close menus on outside click
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-more') && !e.target.closest('.nav-mobile-trigger')) {
          this.moreMenuOpen = false;
        }
        if (!e.target.closest('.nav-mobile-drawer') && !e.target.closest('.nav-mobile-trigger')) {
          this.mobileMenuOpen = false;
        }
      });
    },

    setView(viewId) {
      if (this.currentView !== viewId) {
        this.currentView = viewId;
        localStorage.setItem('dashboard-view', viewId);

        // Sync with app component
        this.$dispatch('view-changed', { view: viewId });

        // Also try to update app directly
        if (window.Alpine) {
          const appEl = document.querySelector('[x-data="app()"]');
          if (appEl && appEl._x_dataStack) {
            appEl._x_dataStack[0].currentView = viewId;
          }
        }
      }

      // Close menus after selection
      this.moreMenuOpen = false;
      this.mobileMenuOpen = false;
    },

    getViewTitle() {
      const view = ALL_VIEWS.find(v => v.id === this.currentView);
      return view ? view.title : 'Dashboard';
    },

    isActive(viewId) {
      return this.currentView === viewId;
    },

    isOverflowActive() {
      // Check if current view is in overflow (not primary)
      return !PRIMARY_VIEWS.find(v => v.id === this.currentView) &&
             ALL_VIEWS.find(v => v.id === this.currentView);
    },

    toggleMoreMenu() {
      this.moreMenuOpen = !this.moreMenuOpen;
      this.mobileMenuOpen = false;
    },

    toggleMobileMenu() {
      this.mobileMenuOpen = !this.mobileMenuOpen;
      this.moreMenuOpen = false;
    },

    getShortcutLabel(key) {
      // Format shortcut for display
      if (key.length === 1 && key >= '0' && key <= '9') {
        return key;
      }
      return key;
    }
  };
}

// Export views for other modules that might need them
export { ALL_VIEWS, PRIMARY_VIEWS, OVERFLOW_CATEGORIES };
