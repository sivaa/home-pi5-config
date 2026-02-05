/**
 * Sensor Palette Component
 * Displays list of sensors for drag-drop configuration
 */

import { SENSOR_VISUALS } from '../js/config.js';

/**
 * Sensor palette Alpine component
 */
export function sensorPaletteComponent() {
  return {
    expandedType: null,
    searchQuery: '',

    init() {
      // Initialize sensors store if needed
      const sensorsStore = Alpine.store('sensors');
      if (sensorsStore && !sensorsStore.devices.length) {
        sensorsStore.init();
      }
    },

    /**
     * Get sensors grouped by type
     */
    get sensorsByType() {
      const store = Alpine.store('sensors');
      if (!store) return {};

      const grouped = {
        climate: [],
        co2: [],
        motion: [],
        contact: [],
        illuminance: []
      };

      store.devices.forEach(sensor => {
        if (grouped[sensor.sensorType]) {
          grouped[sensor.sensorType].push(sensor);
        }
      });

      return grouped;
    },

    /**
     * Get filtered sensors based on search
     */
    get filteredSensors() {
      const store = Alpine.store('sensors');
      if (!store) return [];

      if (!this.searchQuery) {
        return store.devices;
      }

      const query = this.searchQuery.toLowerCase();
      return store.devices.filter(s =>
        s.friendly_name.toLowerCase().includes(query) ||
        s.model.toLowerCase().includes(query) ||
        s.sensorType.toLowerCase().includes(query)
      );
    },

    /**
     * Get visual config for sensor type
     */
    getVisuals(sensorType) {
      return SENSOR_VISUALS[sensorType] || SENSOR_VISUALS.climate;
    },

    /**
     * Check if sensor is placed
     */
    isPlaced(ieeeAddress) {
      return Alpine.store('sensors')?.isPlaced(ieeeAddress) || false;
    },

    /**
     * Get position info for placed sensor
     */
    getPositionInfo(ieeeAddress) {
      const pos = Alpine.store('sensors')?.getPosition(ieeeAddress);
      if (!pos) return null;
      return pos.roomId || 'Placed';
    },

    /**
     * Get live data for sensor
     */
    getLiveData(ieeeAddress) {
      return Alpine.store('sensors')?.getLiveData(ieeeAddress) || null;
    },

    /**
     * Check if sensor data is stale
     */
    isStale(ieeeAddress) {
      return Alpine.store('sensors')?.isStale(ieeeAddress) || false;
    },

    /**
     * Format live value for display
     */
    formatLiveValue(sensor) {
      const data = this.getLiveData(sensor.ieee_address);
      if (!data) return '--';

      switch (sensor.sensorType) {
        case 'climate':
          const temp = data.temperature !== undefined ? `${data.temperature.toFixed(1)}°` : '--';
          const hum = data.humidity !== undefined ? `${data.humidity.toFixed(0)}%` : '';
          return `${temp} ${hum}`.trim();

        case 'co2':
          return data.co2 !== undefined ? `${data.co2} ppm` : '--';

        case 'motion':
          if (data.occupancy === undefined) return '--';
          return data.occupancy ? 'Motion' : 'Clear';

        case 'contact':
          if (data.contact === undefined) return '--';
          return data.contact ? 'Closed' : 'Open';

        case 'illuminance':
          return data.illuminance !== undefined ? `${data.illuminance} lx` : '--';

        default:
          return '--';
      }
    },

    /**
     * Start drag operation
     */
    startDrag(event, sensor) {
      event.dataTransfer.setData('sensor-ieee', sensor.ieee_address);
      event.dataTransfer.effectAllowed = 'move';

      // Notify config view
      this.$dispatch('sensor-drag-start', { sensor });
    },

    /**
     * Handle click to select/deselect
     */
    selectSensor(sensor) {
      Alpine.store('sensors').selectSensor(sensor.ieee_address);
      this.$dispatch('sensor-selected', { sensor });
    },

    /**
     * Toggle type group expansion (for mobile)
     */
    toggleType(type) {
      this.expandedType = this.expandedType === type ? null : type;
    },

    /**
     * Get count of sensors by type
     */
    getTypeCount(type) {
      return this.sensorsByType[type]?.length || 0;
    },

    /**
     * Get count of placed sensors by type
     */
    getPlacedCount(type) {
      const sensors = this.sensorsByType[type] || [];
      return sensors.filter(s => this.isPlaced(s.ieee_address)).length;
    },

    /**
     * Get total placed count
     */
    get totalPlaced() {
      return Alpine.store('sensors')?.placedCount || 0;
    },

    /**
     * Get total sensor count
     */
    get totalCount() {
      return Alpine.store('sensors')?.totalCount || 0;
    },

    /**
     * Get loading state
     */
    get loading() {
      return Alpine.store('sensors')?.loading ?? true;
    }
  };
}

/**
 * Generate sensor card HTML for a single sensor
 */
export function sensorCardHTML(sensor, isPlaced, liveValue, isStale, visuals) {
  return `
    <div class="sensor-card ${isPlaced ? 'placed' : ''} ${isStale ? 'stale' : ''}"
         draggable="true"
         @dragstart="startDrag($event, sensor)"
         @click="selectSensor(sensor)">
      <div class="sensor-icon" style="background-color: #${visuals.color.toString(16).padStart(6, '0')}">
        ${visuals.icon}
      </div>
      <div class="sensor-info">
        <div class="sensor-name">${sensor.friendly_name}</div>
        <div class="sensor-value">${liveValue}</div>
        <div class="sensor-status">
          ${isPlaced ? '<span class="placed-badge">Placed</span>' : '<span class="unplaced-badge">Not placed</span>'}
          ${isStale ? '<span class="stale-badge">Stale</span>' : ''}
        </div>
      </div>
    </div>
  `;
}
