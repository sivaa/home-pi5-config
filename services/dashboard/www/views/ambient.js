/**
 * Vision 4: Minimal Ambient Display
 * Giant glanceable temperature from across the room
 */

export function ambientView() {
  return {
    currentRoomIndex: 0,
    isDarkMode: false,
    autoRotate: false,
    showDetails: false,
    detailsTimeout: null,
    touchStartX: 0,

    init() {
      const hour = new Date().getHours();
      this.isDarkMode = hour >= 22 || hour < 6;

      this.$el.addEventListener('touchstart', (e) => { this.touchStartX = e.touches[0].clientX; }, { passive: true });
      this.$el.addEventListener('touchend', (e) => {
        const deltaX = e.changedTouches[0].clientX - this.touchStartX;
        if (Math.abs(deltaX) > 50) deltaX > 0 ? this.previousRoom() : this.nextRoom();
      }, { passive: true });

      let lastTap = 0;
      this.$el.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTap < 300) this.isDarkMode = !this.isDarkMode;
        lastTap = now;
      }, { passive: true });
    },

    get rooms() { return this.$store.rooms.list.filter(r => r.temperature !== null); },

    get currentRoom() {
      return this.rooms.length > 0 ? this.rooms[this.currentRoomIndex % this.rooms.length]
        : { name: 'Loading...', temperature: 0, humidity: 0, icon: '🏠' };
    },

    nextRoom() { this.currentRoomIndex = (this.currentRoomIndex + 1) % this.rooms.length; },
    previousRoom() { this.currentRoomIndex = (this.currentRoomIndex - 1 + this.rooms.length) % this.rooms.length; },
    selectRoom(index) { this.currentRoomIndex = index; },

    showDetailsOverlay() {
      this.showDetails = true;
      if (this.detailsTimeout) clearTimeout(this.detailsTimeout);
      this.detailsTimeout = setTimeout(() => { this.showDetails = false; }, 5000);
    },

    getBackgroundColor() {
      if (this.isDarkMode) return '#000000';
      const temp = this.currentRoom.temperature;
      if (temp < 20) return '#E3F2FD';
      if (temp < 23) return '#E8F5E9';
      if (temp < 26) return '#FFFFFF';
      if (temp < 28) return '#FFF8E1';
      return '#FFEBEE';
    },

    getMinMaxToday() {
      const room = this.currentRoom;
      if (!room.tempHistory || room.tempHistory.length === 0) return '--';
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayHistory = room.tempHistory.filter(h => h.time >= today.getTime());
      if (todayHistory.length === 0) return '--';
      const temps = todayHistory.map(h => h.value);
      return `${Math.min(...temps).toFixed(1)}° / ${Math.max(...temps).toFixed(1)}°`;
    },

    getTrend() {
      const room = this.currentRoom;
      if (!room.tempHistory || room.tempHistory.length < 2) return '→';
      const recent = room.tempHistory.slice(-10);
      const diff = recent[recent.length - 1].value - recent[0].value;
      if (diff > 0.5) return '↑';
      if (diff < -0.5) return '↓';
      return '→';
    },

    formatLastUpdate() {
      if (!this.currentRoom.lastSeen) return 'No data';
      const seconds = Math.floor((Date.now() - this.currentRoom.lastSeen) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      return `${Math.floor(seconds / 3600)}h ago`;
    }
  };
}
