/**
 * Vision 6: Classic Cards View
 * The original Apple-inspired grid design with room cards
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

      // Update sparklines every 5 seconds
      this.sparklineUpdateInterval = setInterval(() => this.updateSparklines(), 5000);

      // Watch for room changes
      this.$watch('$store.rooms.list', () => {
        this.$nextTick(() => this.updateSparklines());
      });
    },

    destroy() {
      if (this.sparklineUpdateInterval) {
        clearInterval(this.sparklineUpdateInterval);
      }
    },

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
