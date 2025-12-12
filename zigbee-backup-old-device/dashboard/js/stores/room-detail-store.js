/**
 * Room Detail Modal Store
 * Manages room detail modal with historical charts
 */

export function initRoomDetailStore(Alpine, CONFIG) {
  Alpine.store('roomDetail', {
    selectedRoom: null,
    timeRange: '6h',
    loading: false,
    tempHistory: [],
    humidHistory: [],
    timeRanges: ['15m', '30m', '1h', '3h', '6h', '12h', '24h', '3d', '7d'],

    open(room) {
      this.selectedRoom = room;
      this.timeRange = '6h';
      this.loadData();
    },

    close() {
      this.selectedRoom = null;
    },

    async setTimeRange(range) {
      this.timeRange = range;
      await this.loadData();
    },

    async loadData() {
      if (!this.selectedRoom) return;
      this.loading = true;

      try {
        const room = this.selectedRoom;
        const config = Alpine.store('config');

        const tempQuery = `SELECT value FROM temperature WHERE entity_id = '${room.entityId}_temperature' AND time > now() - ${this.timeRange} ORDER BY time ASC`;
        const tempUrl = `${config.influxUrl}/query?db=${config.influxDb}&q=${encodeURIComponent(tempQuery)}`;
        const tempRes = await fetch(tempUrl);
        const tempData = await tempRes.json();

        if (tempData.results?.[0]?.series?.[0]?.values) {
          this.tempHistory = tempData.results[0].series[0].values.map(v => ({
            time: new Date(v[0]).getTime(),
            value: v[1]
          }));
        } else {
          this.tempHistory = [];
        }

        const humidQuery = `SELECT value FROM humidity WHERE entity_id = '${room.entityId}_humidity' AND time > now() - ${this.timeRange} ORDER BY time ASC`;
        const humidUrl = `${config.influxUrl}/query?db=${config.influxDb}&q=${encodeURIComponent(humidQuery)}`;
        const humidRes = await fetch(humidUrl);
        const humidData = await humidRes.json();

        if (humidData.results?.[0]?.series?.[0]?.values) {
          this.humidHistory = humidData.results[0].series[0].values.map(v => ({
            time: new Date(v[0]).getTime(),
            value: v[1]
          }));
        } else {
          this.humidHistory = [];
        }
      } catch (e) {
        console.error('Failed to load modal data:', e);
      }

      this.loading = false;
      setTimeout(() => this.drawCharts(), 50);
    },

    drawCharts() {
      this.drawChart('modal-chart-temp', this.tempHistory, '°C', 'var(--color-primary)');
      this.drawChart('modal-chart-humid', this.humidHistory, '%', 'var(--color-success)');
    },

    drawChart(id, data, unit, color) {
      const svg = document.getElementById(id);
      if (!svg || data.length === 0) return;

      const width = svg.clientWidth || 700;
      const height = svg.clientHeight || 180;
      const padding = { top: 20, right: 50, bottom: 30, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const values = data.map(d => d.value);
      const times = data.map(d => d.time);
      const minVal = Math.floor(Math.min(...values) - 1);
      const maxVal = Math.ceil(Math.max(...values) + 1);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const valueRange = maxVal - minVal || 1;
      const timeRange = maxTime - minTime || 1;

      let svgContent = '';

      const ySteps = 5;
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (i / ySteps) * chartHeight;
        const val = maxVal - (i / ySteps) * valueRange;
        svgContent += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-dasharray="3,3"/>`;
        svgContent += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-tertiary)" font-size="10">${val.toFixed(1)}${unit}</text>`;
      }

      const xSteps = Math.min(6, data.length);
      for (let i = 0; i <= xSteps; i++) {
        const x = padding.left + (i / xSteps) * chartWidth;
        const time = new Date(minTime + (i / xSteps) * timeRange);
        const label = time.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
        svgContent += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#e0e0e0" stroke-dasharray="3,3"/>`;
        svgContent += `<text x="${x}" y="${height - 8}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="10">${label}</text>`;
      }

      svgContent += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--color-text-tertiary)"/>`;
      svgContent += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--color-text-tertiary)"/>`;

      if (data.length >= 2) {
        const points = data.map(d => {
          const x = padding.left + ((d.time - minTime) / timeRange) * chartWidth;
          const y = padding.top + ((maxVal - d.value) / valueRange) * chartHeight;
          return `${x},${y}`;
        }).join(' ');

        const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`;
        svgContent += `<polygon fill="${color}" opacity="0.15" points="${areaPoints}"/>`;
        svgContent += `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${points}"/>`;

        const lastPoint = data[data.length - 1];
        const lastX = padding.left + ((lastPoint.time - minTime) / timeRange) * chartWidth;
        const lastY = padding.top + ((maxVal - lastPoint.value) / valueRange) * chartHeight;
        svgContent += `<circle cx="${lastX}" cy="${lastY}" r="5" fill="${color}"/>`;
      }

      svg.innerHTML = svgContent;
    },

    getMinMax() {
      if (!this.tempHistory.length) return '--';
      const temps = this.tempHistory.map(d => d.value);
      return `${Math.min(...temps).toFixed(1)}° / ${Math.max(...temps).toFixed(1)}°`;
    },

    formatUpdate(lastSeen) {
      if (!lastSeen) return 'No data';
      const seconds = Math.floor((Date.now() - lastSeen) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      return `${Math.floor(seconds / 3600)}h ago`;
    }
  });
}
