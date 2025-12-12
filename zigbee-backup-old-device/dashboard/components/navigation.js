/**
 * Navigation Component
 * Tab-based navigation between dashboard views
 */

export const VIEWS = [
  { id: 'comfort', name: 'Score', icon: '🎯', title: 'Comfort Score' },
  { id: 'compare', name: 'Compare', icon: '📊', title: 'Room Comparison' },
  { id: 'floor', name: 'Floor Plan', icon: '🏠', title: 'Floor Plan' },
  { id: '3d', name: '3D View', icon: '🏗️', title: '3D Floor Plan' },
  { id: 'ambient', name: 'Ambient', icon: '🌡️', title: 'Ambient Display' },
  { id: 'timeline', name: 'Timeline', icon: '📖', title: 'Timeline Story' },
  { id: 'classic', name: 'Classic', icon: '🃏', title: 'Classic Cards' },
  { id: 'lights', name: 'Lights', icon: '💡', title: 'Light Control' }
];

/**
 * Navigation Alpine.js component
 */
export function navigationComponent() {
  return {
    views: VIEWS,
    currentView: 'comfort',

    init() {
      // Restore last view from localStorage
      const saved = localStorage.getItem('dashboard-view');
      if (saved && VIEWS.find(v => v.id === saved)) {
        this.currentView = saved;
      }

      // Listen for keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Number keys 1-8 switch views
        if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.metaKey) {
          const index = parseInt(e.key) - 1;
          if (index < VIEWS.length) {
            this.setView(VIEWS[index].id);
          }
        }
      });
    },

    setView(viewId) {
      if (this.currentView !== viewId) {
        this.currentView = viewId;
        localStorage.setItem('dashboard-view', viewId);
        this.$dispatch('view-changed', { view: viewId });
      }
    },

    getViewTitle() {
      const view = VIEWS.find(v => v.id === this.currentView);
      return view ? view.title : 'Dashboard';
    },

    isActive(viewId) {
      return this.currentView === viewId;
    }
  };
}

/**
 * Generate navigation HTML
 */
export function getNavigationHTML() {
  return `
    <nav class="view-nav" x-data="navigation()">
      <div class="nav-tabs">
        <template x-for="view in views" :key="view.id">
          <button
            class="nav-tab"
            :class="{ active: isActive(view.id) }"
            @click="setView(view.id)"
            :title="view.title + ' (Press ' + (views.indexOf(view) + 1) + ')'"
          >
            <span class="nav-icon" x-text="view.icon"></span>
            <span class="nav-label" x-text="view.name"></span>
          </button>
        </template>
      </div>
    </nav>
  `;
}

/**
 * Navigation CSS styles
 */
export const navigationStyles = `
  .view-nav {
    margin-bottom: var(--space-lg);
  }

  .nav-tabs {
    display: flex;
    gap: var(--space-sm);
    justify-content: center;
    flex-wrap: wrap;
  }

  .nav-tab {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: none;
    background: var(--color-surface);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .nav-tab:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .nav-tab.active {
    background: var(--color-primary);
    color: white;
    box-shadow: var(--shadow-md);
  }

  .nav-icon {
    font-size: var(--font-size-md);
  }

  .nav-label {
    display: inline;
  }

  @media (max-width: 480px) {
    .nav-tabs {
      gap: var(--space-xs);
    }

    .nav-tab {
      padding: var(--space-sm);
    }

    .nav-label {
      display: none;
    }

    .nav-icon {
      font-size: var(--font-size-lg);
    }
  }
`;
