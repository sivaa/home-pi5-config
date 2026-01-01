/**
 * Vision 6: Classic Cards View
 * Multi-sensor room cards with individual sensor readings
 */

export function classicView() {
  return {
    sparklineUpdateInterval: null,

    get rooms() {
      return this.$store.rooms.list;
    },

    get avgTemperature() {
      return this.$store.rooms.avgTemperature;
    },

    get avgHumidity() {
      return this.$store.rooms.avgHumidity;
    },

    init() {
      // Initial sparkline render
      this.$nextTick(() => this.updateSparklines());

      // Update sparklines every 5 seconds (only when view is active)
      // CPU OPTIMIZATION: Skip updates when view is hidden
      this.sparklineUpdateInterval = setInterval(() => {
        if (Alpine.store('app')?.currentView === 'classic') {
          this.updateSparklines();
        }
      }, 5000);

      // Watch for room changes (only update if view is active)
      this.$watch('$store.rooms.list', () => {
        if (Alpine.store('app')?.currentView === 'classic') {
          this.$nextTick(() => this.updateSparklines());
        }
      });
    },

    destroy() {
      if (this.sparklineUpdateInterval) {
        clearInterval(this.sparklineUpdateInterval);
      }
    },

    // Get all sensors for a room (filters out sensors with no data)
    getRoomSensors(room) {
      if (!room.sensors) return [];
      // Return all configured sensors, even if they don't have data yet
      return room.sensors;
    },

    // Get sensors that have data
    getActiveSensors(room) {
      if (!room.sensors) return [];
      return room.sensors.filter(s =>
        s.temperature != null || s.humidity != null || s.co2 != null
      );
    },

    // Get CO2 sensor for a room (if any)
    getCO2Sensor(room) {
      if (!room.sensors) return null;
      return room.sensors.find(s => s.type === 'co2' && s.co2 != null);
    },

    // Get icon for sensor type
    getSensorIcon(sensor) {
      switch (sensor.type) {
        case 'co2': return '💨';
        case 'motion': return '👁️';
        case 'contact': return '🚪';
        default: return '🌡️';
      }
    },

    // Get CO2 status color based on ppm level
    getCO2StatusColor(co2) {
      if (co2 == null) return 'var(--color-text-tertiary)';
      if (co2 < 600) return 'var(--color-success)';
      if (co2 < 1000) return 'var(--color-cool)';
      if (co2 < 1500) return 'var(--color-warning)';
      return 'var(--color-danger)';
    },

    // Get CO2 status label
    getCO2StatusLabel(co2) {
      if (co2 == null) return 'No data';
      if (co2 < 600) return 'Excellent';
      if (co2 < 1000) return 'Good';
      if (co2 < 1500) return 'Moderate';
      return 'Poor';
    },

    // Get battery status for all sensors in a room
    getRoomBatteryStatus(room) {
      if (!room.sensors || room.sensors.length === 0) {
        return { status: 'unknown', icon: '🔋', message: '' };
      }

      const batteries = room.sensors
        .filter(s => s.battery != null)
        .map(s => s.battery);

      if (batteries.length === 0) {
        return { status: 'unknown', icon: '🔋', message: '' };
      }

      const minBattery = Math.min(...batteries);
      if (minBattery < 20) {
        return { status: 'low', icon: '🪫', message: 'Low battery' };
      }
      return { status: 'good', icon: '🔋', message: 'All good' };
    },

    // Check if a sensor is stale
    isSensorStale(sensor) {
      if (!sensor.lastSeen) return true;
      return Date.now() - sensor.lastSeen > 5 * 60 * 1000;
    },

    // Check if room is stale (backward compatibility)
    isStale(room) {
      if (!room.lastSeen) return true;
      return Date.now() - room.lastSeen > 5 * 60 * 1000;
    },

    getComfortClass(temp) {
      if (temp === null || temp === undefined) return '';
      if (temp < 20) return 'cold';
      if (temp < 23) return 'cool';
      if (temp <= 26) return 'good';
      if (temp <= 28) return 'warm';
      return 'hot';
    },

    formatUpdate(lastSeen) {
      if (!lastSeen) return 'No data';
      const seconds = Math.floor((Date.now() - lastSeen) / 1000);
      if (seconds < 5) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m ago`;
    },

    // Format temperature spread for display
    formatSpread(room) {
      if (!room.tempSpread || room.tempSpread < 0.1) return null;
      return `±${(room.tempSpread / 2).toFixed(1)}°`;
    },

    openRoom(room) {
      this.$store.roomDetail.open(room);
    },

    updateSparklines() {
      // Update room sparklines
      this.rooms.forEach(room => {
        const svg = document.getElementById(`classic-spark-${room.id}`);
        if (svg && room.tempHistory && room.tempHistory.length > 1) {
          this.drawSparkline(svg, room.tempHistory.slice(-50));
        }
      });

      // Update average sparkline
      const avgSvg = document.getElementById('classic-spark-avg');
      const avgHistory = this.$store.rooms.avgHistory;
      if (avgSvg && avgHistory && avgHistory.length > 1) {
        this.drawSparkline(avgSvg, avgHistory.slice(-50), true);
      }
    },

    drawSparkline(svg, data, isDark = false) {
      const width = svg.clientWidth || 200;
      const height = svg.clientHeight || 40;

      if (data.length < 2 || width === 0) return;

      const values = data.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;

      const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
      }).join(' ');

      const lineColor = isDark ? 'rgba(255,255,255,0.8)' : 'var(--color-primary)';
      const areaColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0, 122, 255, 0.1)';

      svg.innerHTML = `
        <polyline
          points="${points}"
          fill="none"
          stroke="${lineColor}"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <polygon
          points="0,${height} ${points} ${width},${height}"
          fill="${areaColor}"
        />
      `;
    }
  };
}
