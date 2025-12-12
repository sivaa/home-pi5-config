/**
 * Vision 2: Bar Comparison Dashboard
 * Side-by-side room comparison with temperature and humidity bars
 */

export function barCompareView() {
  return {
    sortBy: 'temperature',
    sortDirection: 'desc',
    viewMode: 'both',
    insights: [],
    tempScale: { min: 18, max: 32 },
    humidityScale: { min: 0, max: 100 },
    comfortZone: { temp: { min: 22, max: 26 }, humidity: { min: 40, max: 60 } },

    init() {
      const saved = localStorage.getItem('bar-sort');
      if (saved) this.sortBy = saved;
      const savedView = localStorage.getItem('bar-view');
      if (savedView) this.viewMode = savedView;
      this.updateInsights();
      this.$watch('$store.rooms.list', () => this.updateInsights());
    },

    get rooms() { return this.$store.rooms.list.filter(r => r.temperature !== null); },

    get sortedRooms() {
      return [...this.rooms].sort((a, b) => {
        let cmp = 0;
        if (this.sortBy === 'temperature') cmp = a.temperature - b.temperature;
        else if (this.sortBy === 'humidity') cmp = a.humidity - b.humidity;
        else if (this.sortBy === 'name') cmp = a.name.localeCompare(b.name);
        return this.sortDirection === 'desc' ? -cmp : cmp;
      });
    },

    updateInsights() {
      const rooms = this.rooms;
      if (rooms.length === 0) { this.insights = []; return; }

      const insights = [];
      const temps = rooms.map(r => r.temperature);
      const spread = Math.max(...temps) - Math.min(...temps);

      if (spread >= 2) {
        const hottest = rooms.find(r => r.temperature === Math.max(...temps));
        const coldest = rooms.find(r => r.temperature === Math.min(...temps));
        insights.push({ type: spread > 4 ? 'warning' : 'info', icon: '🔺', title: 'TEMPERATURE GAP',
          message: `${hottest.name} is ${spread.toFixed(1)}° warmer than ${coldest.name}` });
      }

      rooms.forEach(r => {
        if (r.humidity > 70) {
          insights.push({ type: 'alert', icon: '💧', title: 'HIGH HUMIDITY',
            message: `${r.name} at ${r.humidity}% — risk of mold` });
        }
      });

      const comfortable = rooms.filter(r => r.temperature >= 22 && r.temperature <= 26 && r.humidity >= 40 && r.humidity <= 60);
      if (comfortable.length > 0) {
        insights.push({ type: 'success', icon: '✓', title: 'COMFORT ZONES',
          message: `${comfortable.map(r => r.name).join(', ')} ${comfortable.length === 1 ? 'is' : 'are'} comfortable` });
      }

      this.insights = insights.slice(0, 4);
    },

    setViewMode(mode) { this.viewMode = mode; localStorage.setItem('bar-view', mode); },

    getBarWidth(value, type) {
      const scale = type === 'temperature' ? this.tempScale : this.humidityScale;
      return Math.max(0, Math.min(100, ((value - scale.min) / (scale.max - scale.min)) * 100));
    },

    getBarColor(value, type) {
      const zone = type === 'temperature' ? this.comfortZone.temp : this.comfortZone.humidity;
      if (type === 'temperature') {
        if (value < zone.min) return 'var(--color-cold)';
        if (value > zone.max) return 'var(--color-hot)';
        return 'var(--color-comfortable)';
      } else {
        if (value < zone.min) return 'var(--color-warning)';
        if (value > zone.max) return 'var(--color-info)';
        return 'var(--color-comfortable)';
      }
    },

    getComfortZoneStyle(type) {
      const scale = type === 'temperature' ? this.tempScale : this.humidityScale;
      const zone = type === 'temperature' ? this.comfortZone.temp : this.comfortZone.humidity;
      const left = ((zone.min - scale.min) / (scale.max - scale.min)) * 100;
      const width = ((zone.max - zone.min) / (scale.max - scale.min)) * 100;
      return { left: left + '%', width: width + '%' };
    },

    getScaleLabels(type) {
      const scale = type === 'temperature' ? this.tempScale : this.humidityScale;
      const unit = type === 'temperature' ? '°' : '%';
      return [scale.min + unit, ((scale.min + scale.max) / 2) + unit, scale.max + unit];
    },

    getInsightClass(type) {
      return { success: 'insight-success', warning: 'insight-warning', alert: 'insight-alert', info: 'insight-info' }[type] || 'insight-info';
    },

    openRoom(room) { this.$store.roomDetail.open(room); }
  };
}
