/**
 * Room Detail Modal Component
 * Shared modal for viewing detailed room data across all views
 */

/**
 * Room detail Alpine.js component
 */
export function roomDetailComponent() {
  return {
    selectedRoom: null,
    timeRange: '6h',
    loading: false,
    tempHistory: [],
    humidHistory: [],

    // Time range options
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

        // Load temperature for selected time range
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

        // Load humidity for selected time range
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

        console.log(`Loaded ${this.tempHistory.length} temp, ${this.humidHistory.length} humid points for ${this.timeRange}`);
      } catch (e) {
        console.error('Failed to load room data:', e);
      }

      this.loading = false;
      await this.$nextTick();
      this.drawCharts();
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

      // Grid lines (horizontal)
      const ySteps = 5;
      for (let i = 0; i <= ySteps; i++) {
        const y = padding.top + (i / ySteps) * chartHeight;
        const val = maxVal - (i / ySteps) * valueRange;
        svgContent += `<line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-dasharray="3,3"/>`;
        svgContent += `<text class="chart-axis" x="${padding.left - 8}" y="${y + 4}" text-anchor="end" fill="var(--color-text-tertiary)" font-size="10">${val.toFixed(1)}${unit}</text>`;
      }

      // Grid lines (vertical) - time labels
      const xSteps = Math.min(6, data.length);
      for (let i = 0; i <= xSteps; i++) {
        const x = padding.left + (i / xSteps) * chartWidth;
        const time = new Date(minTime + (i / xSteps) * timeRange);
        const label = time.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
        svgContent += `<line class="chart-grid" x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#e0e0e0" stroke-dasharray="3,3"/>`;
        svgContent += `<text class="chart-axis" x="${x}" y="${height - 8}" text-anchor="middle" fill="var(--color-text-tertiary)" font-size="10">${label}</text>`;
      }

      // Axis lines
      svgContent += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="var(--color-text-tertiary)"/>`;
      svgContent += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="var(--color-text-tertiary)"/>`;

      // Data line
      if (data.length >= 2) {
        const points = data.map(d => {
          const x = padding.left + ((d.time - minTime) / timeRange) * chartWidth;
          const y = padding.top + ((maxVal - d.value) / valueRange) * chartHeight;
          return `${x},${y}`;
        }).join(' ');

        const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`;
        svgContent += `<polygon fill="${color}" opacity="0.15" points="${areaPoints}"/>`;
        svgContent += `<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${points}"/>`;

        // Current value dot
        const lastPoint = data[data.length - 1];
        const lastX = padding.left + ((lastPoint.time - minTime) / timeRange) * chartWidth;
        const lastY = padding.top + ((maxVal - lastPoint.value) / valueRange) * chartHeight;
        svgContent += `<circle cx="${lastX}" cy="${lastY}" r="5" fill="${color}"/>`;
      } else if (data.length === 1) {
        // Single point
        const x = width / 2;
        const y = height / 2;
        svgContent += `<circle cx="${x}" cy="${y}" r="6" fill="${color}"/>`;
        svgContent += `<text x="${x}" y="${y - 12}" text-anchor="middle" font-size="14" fill="${color}">${values[0].toFixed(1)}${unit}</text>`;
      }

      svg.innerHTML = svgContent;
    },

    getMinMax() {
      if (!this.tempHistory.length) return '--';
      const temps = this.tempHistory.map(d => d.value);
      const min = Math.min(...temps).toFixed(1);
      const max = Math.max(...temps).toFixed(1);
      return `${min}° / ${max}°`;
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
    }
  };
}

/**
 * Room detail modal HTML template
 */
export function getRoomDetailHTML() {
  return `
    <template x-if="$store.roomDetail.selectedRoom">
      <div class="modal-overlay"
           @click.self="$store.roomDetail.close()"
           @keydown.escape.window="$store.roomDetail.close()">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-title">
              <span class="icon" x-text="$store.roomDetail.selectedRoom.icon"></span>
              <h2 x-text="$store.roomDetail.selectedRoom.name"></h2>
            </div>
            <button class="modal-close" @click="$store.roomDetail.close()">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Time Range Selector -->
            <div class="time-range-selector">
              <template x-for="range in $store.roomDetail.timeRanges" :key="range">
                <button
                  class="btn btn-secondary"
                  :class="{ active: $store.roomDetail.timeRange === range }"
                  @click="$store.roomDetail.setTimeRange(range)"
                  x-text="range"
                ></button>
              </template>
              <span x-show="$store.roomDetail.loading" class="loading-indicator"></span>
            </div>

            <!-- Stats -->
            <div class="modal-stats">
              <div class="modal-stat">
                <div class="modal-stat-label">Temperature</div>
                <div class="modal-stat-value temp">
                  <span x-text="$store.roomDetail.selectedRoom.temperature !== null
                    ? $store.roomDetail.selectedRoom.temperature.toFixed(1) + '°C'
                    : '--'"></span>
                </div>
              </div>
              <div class="modal-stat">
                <div class="modal-stat-label">Humidity</div>
                <div class="modal-stat-value humid">
                  <span x-text="$store.roomDetail.selectedRoom.humidity !== null
                    ? $store.roomDetail.selectedRoom.humidity.toFixed(0) + '%'
                    : '--'"></span>
                </div>
              </div>
              <div class="modal-stat">
                <div class="modal-stat-label">Min / Max</div>
                <div class="modal-stat-value minmax" x-text="$store.roomDetail.getMinMax()"></div>
              </div>
            </div>

            <!-- Temperature Chart -->
            <div class="modal-chart">
              <div class="modal-chart-title" x-text="'Temperature History (last ' + $store.roomDetail.timeRange + ')'"></div>
              <div class="chart-temp">
                <template x-if="$store.roomDetail.tempHistory.length === 0 && !$store.roomDetail.loading">
                  <div class="no-data-message">No data in this time range</div>
                </template>
                <svg id="modal-chart-temp" x-show="$store.roomDetail.tempHistory.length > 0"></svg>
              </div>
            </div>

            <!-- Humidity Chart -->
            <div class="modal-chart">
              <div class="modal-chart-title" x-text="'Humidity History (last ' + $store.roomDetail.timeRange + ')'"></div>
              <div class="chart-humid">
                <template x-if="$store.roomDetail.humidHistory.length === 0 && !$store.roomDetail.loading">
                  <div class="no-data-message">No data in this time range</div>
                </template>
                <svg id="modal-chart-humid" x-show="$store.roomDetail.humidHistory.length > 0"></svg>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <span x-text="'Last updated: ' + $store.roomDetail.formatUpdate($store.roomDetail.selectedRoom.lastSeen)"></span>
            <span> &bull; </span>
            <span x-text="$store.roomDetail.tempHistory.length + ' temperature readings, ' + $store.roomDetail.humidHistory.length + ' humidity readings'"></span>
          </div>
        </div>
      </div>
    </template>
  `;
}

/**
 * Room detail modal styles
 */
export const roomDetailStyles = `
  .time-range-selector {
    display: flex;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    align-items: center;
  }

  .modal-stats {
    display: flex;
    gap: var(--space-xl);
    margin-bottom: var(--space-lg);
  }

  .modal-stat {
    text-align: center;
  }

  .modal-stat-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--space-xs);
  }

  .modal-stat-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
  }

  .modal-stat-value.temp {
    color: var(--color-primary);
  }

  .modal-stat-value.humid {
    color: var(--color-success);
  }

  .modal-stat-value.minmax {
    font-size: var(--font-size-lg);
    color: var(--color-text-secondary);
  }

  .modal-chart {
    background: var(--color-bg);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .modal-chart-title {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--space-md);
  }

  .modal-chart svg {
    width: 100%;
    height: 180px;
  }

  .chart-temp {
    color: var(--color-primary);
  }

  .chart-humid {
    color: var(--color-success);
  }

  .no-data-message {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 180px;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    font-style: italic;
  }
`;
