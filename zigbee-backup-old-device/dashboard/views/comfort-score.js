/**
 * Vision 1: Comfort Score Dashboard
 * "One number to rule them all" - Single comfort score with room breakdown
 */

export function comfortScoreView() {
  return {
    homeScore: 0,
    roomScores: [],
    suggestions: [],
    showBreakdown: false,

    init() {
      this.updateScores();
      this.$watch('$store.rooms.list', () => this.updateScores());
    },

    updateScores() {
      const rooms = this.$store.rooms.list;

      this.roomScores = rooms
        .filter(r => r.temperature !== null && r.humidity !== null)
        .map(room => ({
          ...room,
          score: this.calculateComfort(room.temperature, room.humidity)
        }))
        .sort((a, b) => b.score - a.score);

      this.homeScore = this.calculateHomeScore(rooms);
      this.suggestions = this.generateSuggestions(rooms).slice(0, 2);
    },

    calculateComfort(temp, humidity) {
      if (temp === null || humidity === null) return 0;
      let tempScore = 70;
      if (temp < 20) tempScore = Math.max(0, 70 - (20 - temp) * 10);
      else if (temp > 26) tempScore = Math.max(0, 70 - (temp - 26) * 10);
      else tempScore = 70 - Math.abs(temp - 23) * 2;

      let humidScore = 30;
      if (humidity < 40) humidScore = Math.max(0, 30 - (40 - humidity));
      else if (humidity > 60) humidScore = Math.max(0, 30 - (humidity - 60) * 1.5);
      else humidScore = 30 - Math.abs(humidity - 50) * 0.3;

      return Math.round(Math.max(0, Math.min(100, tempScore + humidScore)));
    },

    calculateHomeScore(rooms) {
      const weights = { 'Living Room': 1.5, 'Bedroom': 1.3, 'Study': 1.0, 'Kitchen': 0.8, 'Bathroom': 0.5 };
      const valid = rooms.filter(r => r.temperature !== null);
      if (valid.length === 0) return 0;

      let sum = 0, total = 0;
      valid.forEach(r => {
        const w = weights[r.name] || 1;
        sum += this.calculateComfort(r.temperature, r.humidity) * w;
        total += w;
      });
      return Math.round(sum / total);
    },

    generateSuggestions(rooms) {
      const valid = rooms.filter(r => r.temperature !== null && r.humidity !== null);
      if (valid.length === 0) return [];

      const suggestions = [];
      const hottest = valid.reduce((a, b) => a.temperature > b.temperature ? a : b);
      const mostHumid = valid.reduce((a, b) => a.humidity > b.humidity ? a : b);

      if (mostHumid.humidity > 65) {
        suggestions.push({ type: 'action', icon: '💨', title: 'Improve ventilation',
          message: `${mostHumid.name} humidity is high (${mostHumid.humidity}%)` });
      }
      if (hottest.temperature > 28) {
        const coldest = valid.reduce((a, b) => a.temperature < b.temperature ? a : b);
        suggestions.push({ type: 'tip', icon: '🏃', title: 'Go to cooler room',
          message: `${coldest.name} is ${(hottest.temperature - coldest.temperature).toFixed(1)}° cooler` });
      }
      return suggestions;
    },

    getLabel() {
      if (this.homeScore >= 90) return 'Perfect';
      if (this.homeScore >= 75) return 'Comfortable';
      if (this.homeScore >= 60) return 'Okay';
      if (this.homeScore >= 40) return 'Uncomfortable';
      return 'Poor';
    },

    getColor() {
      if (this.homeScore >= 90) return '#34C759';
      if (this.homeScore >= 75) return '#30D158';
      if (this.homeScore >= 60) return '#FFD60A';
      if (this.homeScore >= 40) return '#FF9500';
      return '#FF3B30';
    },

    getRoomColor(score) {
      if (score >= 75) return 'var(--color-success)';
      if (score >= 50) return 'var(--color-warning)';
      return 'var(--color-danger)';
    },

    getScoreArc() {
      const percent = this.homeScore / 100;
      const circumference = 2 * Math.PI * 90;
      return `${percent * circumference} ${circumference}`;
    },

    openRoom(room) { this.$store.roomDetail.open(room); }
  };
}
