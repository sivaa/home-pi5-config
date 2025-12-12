/**
 * Vision 3: Floor Plan Heat Map
 * Spatial heat map visualization of your apartment
 */

export function floorPlanView() {
  return {
    viewType: 'temperature',
    // Layout based on actual floor plan measurements
    layout: {
      width: 620, height: 470,
      rooms: [
        // Top row: Living Room (left with balcony) + Bedroom (right with main door)
        { id: 'living', x: 70, y: 20, width: 260, height: 200 },      // 4.75m × 3.968m
        { id: 'bedroom', x: 340, y: 20, width: 250, height: 200 },    // 4.489m × 3.378m
        // Bottom row: Study (left) + Kitchen/Bathroom (right), Hallway in center
        { id: 'study', x: 20, y: 235, width: 216, height: 220 },      // 3.908m × 3.697m (20% reduced)
        { id: 'kitchen', x: 430, y: 235, width: 175, height: 115 },   // 3.203m × 2.138m
        { id: 'bathroom', x: 430, y: 355, width: 175, height: 95 }    // 3.15m × 1.424m
      ]
    },
    tempColors: [
      { value: 18, color: '#90CAF9' }, { value: 22, color: '#A5D6A7' },
      { value: 24, color: '#81C784' }, { value: 26, color: '#FFE082' },
      { value: 28, color: '#FFAB91' }, { value: 32, color: '#EF5350' }
    ],
    humidityColors: [
      { value: 30, color: '#FFCC80' }, { value: 40, color: '#A5D6A7' },
      { value: 50, color: '#81C784' }, { value: 60, color: '#A5D6A7' },
      { value: 70, color: '#90CAF9' }, { value: 85, color: '#5C6BC0' }
    ],

    get rooms() {
      const roomsList = this.$store.rooms.list;
      return this.layout.rooms.map(lr => {
        const dr = roomsList.find(r => r.id === lr.id);
        return { ...lr, ...dr, color: this.getRoomColor(dr) };
      });
    },

    setViewType(type) { this.viewType = type; },

    getRoomColor(room) {
      if (!room || room.temperature === null) return '#E0E0E0';
      const value = this.viewType === 'temperature' ? room.temperature : room.humidity;
      const scale = this.viewType === 'temperature' ? this.tempColors : this.humidityColors;
      return this.interpolateColor(value, scale);
    },

    interpolateColor(value, scale) {
      if (value < scale[0].value) return scale[0].color;
      if (value > scale[scale.length - 1].value) return scale[scale.length - 1].color;

      let lower = scale[0], upper = scale[scale.length - 1];
      for (let i = 0; i < scale.length - 1; i++) {
        if (value >= scale[i].value && value <= scale[i + 1].value) {
          lower = scale[i]; upper = scale[i + 1]; break;
        }
      }

      const factor = (value - lower.value) / (upper.value - lower.value);
      const lRGB = this.hexToRgb(lower.color), uRGB = this.hexToRgb(upper.color);
      const r = Math.round(lRGB.r + factor * (uRGB.r - lRGB.r));
      const g = Math.round(lRGB.g + factor * (uRGB.g - lRGB.g));
      const b = Math.round(lRGB.b + factor * (uRGB.b - lRGB.b));
      return `rgb(${r},${g},${b})`;
    },

    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 200, g: 200, b: 200 };
    },

    getLegendItems() {
      return this.viewType === 'temperature'
        ? [{ label: '< 20°', color: '#90CAF9' }, { label: '20-24°', color: '#81C784' }, { label: '24-28°', color: '#FFE082' }, { label: '> 28°', color: '#EF5350' }]
        : [{ label: '< 40%', color: '#FFCC80' }, { label: '40-60%', color: '#81C784' }, { label: '60-70%', color: '#90CAF9' }, { label: '> 70%', color: '#5C6BC0' }];
    },

    getValue(room) {
      if (!room) return '--';
      return this.viewType === 'temperature'
        ? (room.temperature !== null ? room.temperature.toFixed(1) + '°' : '--')
        : (room.humidity !== null ? room.humidity.toFixed(0) + '%' : '--');
    },

    openRoom(room) { this.$store.roomDetail.open(room); }
  };
}
