/**
 * Main Application Entry Point
 * Smart Home Climate Dashboard
 */

import { CONFIG, FLOOR_PLAN_CONFIG, TEMP_COLORS, HUMIDITY_COLORS, SENSOR_VISUALS } from './config.js';
import { initMqttStore } from './stores/mqtt-store.js';
import { initRoomsStore } from './stores/rooms-store.js';
import { initLightsStore } from './stores/lights-store.js';
import { initRoomDetailStore } from './stores/room-detail-store.js';
import { initSensorsStore } from './stores/sensors-store.js';
import { initEventsStore } from './stores/events-store.js';
import { initThermostatStore } from './stores/thermostat-store.js';
import { initWeatherStore } from './stores/weather-store.js';
import { initThemeStore } from './stores/theme-store.js';
import { initLogsStore } from './stores/logs-store.js';
import { OrbitControls } from './three/orbit-controls.js';

// Import view components
import { floorPlanView } from '../views/floor-plan.js';
import { ambientView } from '../views/ambient.js';
import { timelineView } from '../views/timeline.js';
import { classicView } from '../views/classic.js';
import { lightsView } from '../views/lights.js';
import { co2View } from '../views/co2-monitor.js';
import { networkView } from '../views/network.js';
import { thermostatView } from '../views/thermostat.js';
import { mailboxView } from '../views/mailbox.js';
import { logsView } from '../views/logs.js';
import { hotWaterView } from '../views/hot-water.js';

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
  initThemeStore(Alpine);  // Theme store (no config needed)
  initMqttStore(Alpine, CONFIG);
  initRoomsStore(Alpine, CONFIG);
  initLightsStore(Alpine, CONFIG);
  initRoomDetailStore(Alpine, CONFIG);
  initSensorsStore(Alpine, CONFIG);
  initEventsStore(Alpine, CONFIG);
  initThermostatStore(Alpine, CONFIG);
  initWeatherStore(Alpine, CONFIG);
  initLogsStore(Alpine, CONFIG);

  // Initialize weather store after a short delay
  setTimeout(() => {
    Alpine.store('weather')?.init();
  }, 2000);

  // Load historical events on startup
  setTimeout(() => {
    Alpine.store('events')?.loadHistorical(24);
  }, 1000);

  // Make config available for 3D views
  window.FLOOR_PLAN_CONFIG = FLOOR_PLAN_CONFIG;
  window.TEMP_COLORS = TEMP_COLORS;
  window.HUMIDITY_COLORS = HUMIDITY_COLORS;
  window.SENSOR_VISUALS = SENSOR_VISUALS;
});

// ========================================
// MAIN APP COMPONENT
// ========================================
window.app = function() {
  return {
    currentView: 'classic',
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

      // Keyboard shortcuts are now handled by navigation component (single source)
      // Listen for view changes from navigation component
      document.addEventListener('view-changed', (e) => {
        if (e.detail && e.detail.view) {
          this.currentView = e.detail.view;
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
window.floorPlanView = floorPlanView;
window.ambientView = ambientView;
window.timelineView = timelineView;
window.classicView = classicView;
window.lightsView = lightsView;

// CO2 monitor view
window.co2View = co2View;

// Network view
window.networkView = networkView;

// Thermostat view
window.thermostatView = thermostatView;

// Mailbox view
window.mailboxView = mailboxView;

// Activity Logs view
window.logsView = logsView;

// Hot Water view
window.hotWaterView = hotWaterView;

console.log('🏠 Smart Home Dashboard loaded (modular)');
