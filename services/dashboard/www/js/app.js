/**
 * Main Application Entry Point
 * Smart Home Climate Dashboard
 */

// Import Alpine as ES module (ensures proper load order)
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/module.esm.js';
window.Alpine = Alpine;

import { CONFIG, FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS, SENSOR_VISUALS } from './config.js';
import { initMqttStore } from './stores/mqtt-store.js';
import { initRoomsStore } from './stores/rooms-store.js';
import { initLightsStore } from './stores/lights-store.js';
import { initRoomDetailStore } from './stores/room-detail-store.js';
import { initSensorsStore } from './stores/sensors-store.js';
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
import { sensorConfigView } from '../views/sensor-config.js';
import { co2View } from '../views/co2-monitor.js';
import { isometricView } from '../views/isometric.js';

// Make OrbitControls available to Three.js
if (typeof THREE !== 'undefined') {
  THREE.OrbitControls = OrbitControls;
}

// ========================================
// ALPINE STORE REGISTRATION
// ========================================
// Register stores directly (before Alpine.start())
Alpine.store('config', CONFIG);
initMqttStore(Alpine, CONFIG);
initRoomsStore(Alpine, CONFIG);
initLightsStore(Alpine, CONFIG);
initRoomDetailStore(Alpine, CONFIG);
initSensorsStore(Alpine, CONFIG);

// Make config available for 3D views
window.FLOOR_PLAN_CONFIG = FLOOR_PLAN_CONFIG;
window.TEMP_COLORS = TEMP_COLORS;
window.HUMIDITY_COLORS = HUMIDITY_COLORS;
window.SENSOR_VISUALS = SENSOR_VISUALS;

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

      // Keyboard shortcuts for view switching (1-9, 0 for CO2, I for Isometric)
      document.addEventListener('keydown', (e) => {
        // 'I' key for isometric view
        if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) {
          this.setView('isometric');
          return;
        }
        if ((e.key >= '1' && e.key <= '9' || e.key === '0') && !e.ctrlKey && !e.metaKey) {
          const views = ['comfort', 'compare', 'floor', '3d', 'ambient', 'timeline', 'classic', 'lights', 'config', 'co2'];
          const index = e.key === '0' ? 9 : parseInt(e.key) - 1;
          if (index < views.length) {
            this.setView(views[index]);
          }
        }
      });

      // Initialize sensors store after MQTT connects
      setTimeout(() => {
        Alpine.store('sensors')?.init();
      }, 1000);
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

// Sensor config view is also a factory function
window.sensorConfigView = function() {
  return sensorConfigView(FLOOR_PLAN_CONFIG, SENSOR_VISUALS, OrbitControls);
};

// CO2 monitor view
window.co2View = co2View;

// Isometric view is a factory function
window.isometricView = function() {
  return isometricView(FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS);
};

console.log('🏠 Smart Home Dashboard loaded (modular)');

// ========================================
// START ALPINE (after all registrations)
// ========================================
Alpine.start();
