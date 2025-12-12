/**
 * Main Application Entry Point
 * Smart Home Climate Dashboard
 */

import { CONFIG, FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS } from './config.js';
import { initMqttStore } from './stores/mqtt-store.js';
import { initRoomsStore } from './stores/rooms-store.js';
import { initLightsStore } from './stores/lights-store.js';
import { initRoomDetailStore } from './stores/room-detail-store.js';
import { OrbitControls } from './three/orbit-controls.js';

// Import view components
import { comfortScoreView } from '../views/comfort-score.js';
import { barCompareView } from '../views/bar-compare.js';
import { floorPlanView } from '../views/floor-plan.js';
import { ambientView } from '../views/ambient.js';
import { timelineView } from '../views/timeline.js';
import { classicView } from '../views/classic.js';
import { lightsView } from '../views/lights.js';
import { threeDView } from '../views/floor-plan-3d.js';

// Make OrbitControls available to Three.js
if (typeof THREE !== 'undefined') {
  THREE.OrbitControls = OrbitControls;
}

// ========================================
// ALPINE INITIALIZATION
// ========================================
document.addEventListener('alpine:init', () => {
  // Register stores
  Alpine.store('config', CONFIG);
  initMqttStore(Alpine, CONFIG);
  initRoomsStore(Alpine, CONFIG);
  initLightsStore(Alpine, CONFIG);
  initRoomDetailStore(Alpine, CONFIG);

  // Make config available for 3D view
  window.FLOOR_PLAN_CONFIG = FLOOR_PLAN_CONFIG;
  window.TEMP_COLORS = TEMP_COLORS;
  window.HUMIDITY_COLORS = HUMIDITY_COLORS;
});

// ========================================
// MAIN APP COMPONENT
// ========================================
window.app = function() {
  return {
    currentView: 'comfort',
    currentDateTime: '',
    now: Date.now(),

    get lastUpdateText() {
      const lastUpdate = Alpine.store('rooms').lastUpdate;
      if (!lastUpdate) return 'Waiting...';
      const seconds = Math.floor((this.now - lastUpdate) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      return `${Math.floor(seconds / 60)}m ago`;
    },

    init() {
      // Restore last view
      const saved = localStorage.getItem('dashboard-view');
      if (saved) this.currentView = saved;

      // Update time
      this.updateDateTime();
      setInterval(() => {
        this.updateDateTime();
        this.now = Date.now();
      }, 1000);

      // Check stale
      setInterval(() => Alpine.store('rooms').checkStale(), 10000);

      // Load historical data and connect MQTT
      Alpine.store('rooms').loadHistorical();
      Alpine.store('mqtt').connect();

      // Keyboard shortcuts for view switching
      document.addEventListener('keydown', (e) => {
        if (e.key >= '1' && e.key <= '8' && !e.ctrlKey && !e.metaKey) {
          const views = ['comfort', 'compare', 'floor', 'ambient', 'timeline', 'classic', 'lights', '3d'];
          this.setView(views[parseInt(e.key) - 1]);
        }
      });
    },

    setView(view) {
      this.currentView = view;
      localStorage.setItem('dashboard-view', view);
    },

    updateDateTime() {
      const now = new Date();
      this.currentDateTime = now.toLocaleDateString('en-AU', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    }
  };
};

// ========================================
// REGISTER VIEW COMPONENTS
// ========================================
window.comfortScoreView = comfortScoreView;
window.barCompareView = barCompareView;
window.floorPlanView = floorPlanView;
window.ambientView = ambientView;
window.timelineView = timelineView;
window.classicView = classicView;
window.lightsView = lightsView;
// 3D view is a factory function that needs config passed to it
window.threeDView = function() {
  return threeDView(FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS, OrbitControls);
};

console.log('🏠 Smart Home Dashboard loaded (modular)');
