/**
 * Vision 5: Timeline Story View
 * Data is a story - tell it that way
 */

export function timelineView() {
  return {
    events: [],
    selectedDate: 'today',
    loading: false,

    init() {
      this.loadEvents();
      this.$watch('$store.rooms.list', () => this.loadEvents());
    },

    loadEvents() {
      this.loading = true;
      const rooms = this.$store.rooms.list;
      const allEvents = [];

      const now = Date.now();
      let startTime;
      if (this.selectedDate === 'yesterday') {
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
        startTime = yesterday.getTime();
      } else if (this.selectedDate === 'week') {
        startTime = now - 7 * 24 * 60 * 60 * 1000;
      } else {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        startTime = today.getTime();
      }

      rooms.forEach(room => {
        if (room.tempHistory && room.tempHistory.length > 0) {
          const filtered = room.tempHistory.filter(h => h.time >= startTime);
          allEvents.push(...this.detectEvents(filtered, room.name, room.icon));
        }
      });

      this.events = allEvents.sort((a, b) => b.time - a.time).slice(0, 20);
      this.loading = false;
    },

    detectEvents(history, roomName, roomIcon) {
      if (history.length < 10) return [];
      const events = [];
      const sorted = [...history].sort((a, b) => a.time - b.time);

      // Detect rapid changes
      for (let i = 0; i < sorted.length - 1; i++) {
        const windowMs = 30 * 60 * 1000;
        const start = sorted[i];
        const endIdx = sorted.findIndex(p => p.time >= start.time + windowMs && p.time <= start.time + windowMs * 1.2);
        if (endIdx === -1) continue;

        const end = sorted[endIdx];
        const delta = end.value - start.value;

        if (Math.abs(delta) >= 3) {
          events.push({
            type: delta > 0 ? 'RAPID_RISE' : 'RAPID_DROP',
            time: start.time, room: roomName, icon: roomIcon,
            value: start.value, endValue: end.value, delta: Math.abs(delta),
            duration: Math.round((end.time - start.time) / 60000),
            eventIcon: delta > 0 ? '🔥' : '❄️',
            title: `${roomName} ${delta > 0 ? 'rose' : 'dropped'} ${Math.abs(delta).toFixed(1)}° in ${Math.round((end.time - start.time) / 60000)} mins`,
            cause: this.inferCause(delta > 0 ? 'RAPID_RISE' : 'RAPID_DROP', roomName, start.time)
          });
        }
      }

      // Detect peaks
      const windowSize = 6;
      for (let i = windowSize; i < sorted.length - windowSize; i++) {
        const point = sorted[i];
        const before = sorted.slice(i - windowSize, i);
        const after = sorted.slice(i + 1, i + windowSize + 1);
        const maxBefore = Math.max(...before.map(p => p.value));
        const maxAfter = Math.max(...after.map(p => p.value));

        if (point.value > maxBefore && point.value > maxAfter && point.value - Math.min(maxBefore, maxAfter) >= 2) {
          events.push({
            type: 'PEAK', time: point.time, room: roomName, icon: roomIcon,
            value: point.value, eventIcon: '📈',
            title: `${roomName} peaked at ${point.value.toFixed(1)}°`,
            cause: this.inferCause('PEAK', roomName, point.time)
          });
        }
      }

      return events;
    },

    inferCause(type, roomName, time) {
      const hour = new Date(time).getHours();
      const room = roomName.toLowerCase();

      if (room.includes('bathroom') && type === 'PEAK' && hour >= 6 && hour <= 9)
        return { text: 'Morning shower' };
      if (room.includes('kitchen') && type === 'RAPID_RISE' && hour >= 18 && hour <= 21)
        return { text: 'Cooking dinner' };
      if (type === 'RAPID_RISE' && hour >= 10 && hour <= 15)
        return { text: 'Sun exposure' };
      return null;
    },

    setDate(date) { this.selectedDate = date; this.loadEvents(); },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    },

    getEventClass(type) {
      return { 'PEAK': 'event-peak', 'VALLEY': 'event-valley', 'RAPID_RISE': 'event-rise', 'RAPID_DROP': 'event-drop' }[type] || '';
    },

    getTodaySummary() {
      const rooms = this.$store.rooms.list.filter(r => r.tempHistory && r.tempHistory.length > 0);
      if (rooms.length === 0) return null;

      const today = new Date(); today.setHours(0, 0, 0, 0);
      let allTemps = [], mostStable = null, minVar = Infinity, mostVolatile = null, maxVar = 0;

      rooms.forEach(room => {
        const todayHistory = room.tempHistory.filter(h => h.time >= today.getTime());
        if (todayHistory.length < 2) return;
        const temps = todayHistory.map(h => h.value);
        allTemps.push(...temps);
        const variation = Math.max(...temps) - Math.min(...temps);
        if (variation < minVar) { minVar = variation; mostStable = room.name; }
        if (variation > maxVar) { maxVar = variation; mostVolatile = room.name; }
      });

      if (allTemps.length === 0) return null;
      return {
        minTemp: Math.min(...allTemps).toFixed(1),
        maxTemp: Math.max(...allTemps).toFixed(1),
        mostStable, mostVolatile,
        eventCount: this.events.length
      };
    },

    openRoom(roomName) {
      const room = this.$store.rooms.list.find(r => r.name === roomName);
      if (room) this.$store.roomDetail.open(room);
    }
  };
}
