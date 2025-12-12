/**
 * Insight Generation Engine
 * Auto-generates human-readable insights from room data
 */

import { calculateRoomComfort } from './comfort-algo.js';

/**
 * Generate smart suggestions based on current conditions
 * @param {Array} rooms - Room data with temp/humidity
 * @param {Object} outdoor - Outdoor conditions (if available)
 * @returns {Array} Array of suggestion objects
 */
export function generateSuggestions(rooms, outdoor = null) {
  const validRooms = rooms.filter(r => r.temperature !== null && r.humidity !== null);
  if (validRooms.length === 0) return [];

  const suggestions = [];

  // Find extremes
  const hottest = validRooms.reduce((a, b) => a.temperature > b.temperature ? a : b);
  const coldest = validRooms.reduce((a, b) => a.temperature < b.temperature ? a : b);
  const mostHumid = validRooms.reduce((a, b) => a.humidity > b.humidity ? a : b);
  const leastHumid = validRooms.reduce((a, b) => a.humidity < b.humidity ? a : b);

  // Suggestion: Open window in hot room (if outdoor is cooler)
  if (outdoor && hottest.temperature > outdoor.temperature + 2 && hottest.temperature > 25) {
    suggestions.push({
      type: 'action',
      icon: '🪟',
      title: 'Open window',
      message: `${hottest.name} is ${(hottest.temperature - outdoor.temperature).toFixed(1)}° warmer than outside`,
      room: hottest.name,
      priority: 'high'
    });
  }

  // Suggestion: Turn on fan in humid room
  if (mostHumid.humidity > 65) {
    suggestions.push({
      type: 'action',
      icon: '💨',
      title: 'Improve ventilation',
      message: `${mostHumid.name} humidity is high (${mostHumid.humidity}%)`,
      room: mostHumid.name,
      priority: mostHumid.humidity > 75 ? 'high' : 'medium'
    });
  }

  // Suggestion: Move to coolest room
  if (hottest.temperature > 28 && hottest.temperature - coldest.temperature > 2) {
    suggestions.push({
      type: 'tip',
      icon: '🏃',
      title: 'Go to cooler room',
      message: `${coldest.name} is ${(hottest.temperature - coldest.temperature).toFixed(1)}° cooler`,
      room: coldest.name,
      priority: 'medium'
    });
  }

  // Suggestion: Temperature spread warning
  const tempSpread = hottest.temperature - coldest.temperature;
  if (tempSpread > 5) {
    suggestions.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Large temperature difference',
      message: `${tempSpread.toFixed(1)}° spread between ${hottest.name} and ${coldest.name}`,
      priority: 'low'
    });
  }

  // Sort by priority
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  return suggestions.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
}

/**
 * Insight Engine - Analyzes data and generates insights
 */
export class InsightEngine {
  constructor(rooms, history = []) {
    this.rooms = rooms;
    this.history = history;
  }

  /**
   * Generate all insights
   * @returns {Array} Array of insight objects (max 4)
   */
  generateAll() {
    const validRooms = this.rooms.filter(r => r.temperature !== null && r.humidity !== null);
    if (validRooms.length === 0) return [];

    return [
      ...this.temperatureGapInsights(validRooms),
      ...this.humidityAlertInsights(validRooms),
      ...this.comfortZoneInsights(validRooms),
      ...this.trendInsights(validRooms)
    ].slice(0, 4); // Max 4 insights
  }

  temperatureGapInsights(rooms) {
    const temps = rooms.map(r => r.temperature);
    const spread = Math.max(...temps) - Math.min(...temps);

    if (spread < 2) return [];

    const hottest = rooms.find(r => r.temperature === Math.max(...temps));
    const coldest = rooms.find(r => r.temperature === Math.min(...temps));

    return [{
      type: spread > 4 ? 'warning' : 'info',
      icon: '🔺',
      title: 'TEMPERATURE GAP',
      message: `${hottest.name} is ${spread.toFixed(1)}° warmer than ${coldest.name}`,
      priority: spread > 4 ? 3 : 2,
      relatedRooms: [hottest.name, coldest.name]
    }];
  }

  humidityAlertInsights(rooms) {
    const alerts = [];

    rooms.forEach(room => {
      if (room.humidity > 70) {
        alerts.push({
          type: 'alert',
          icon: '💧',
          title: 'HIGH HUMIDITY',
          message: `${room.name} at ${room.humidity}% — risk of mold`,
          priority: 4,
          relatedRooms: [room.name]
        });
      } else if (room.humidity < 30) {
        alerts.push({
          type: 'alert',
          icon: '🏜️',
          title: 'LOW HUMIDITY',
          message: `${room.name} at ${room.humidity}% — very dry`,
          priority: 3,
          relatedRooms: [room.name]
        });
      }
    });

    return alerts;
  }

  comfortZoneInsights(rooms) {
    const comfortableRooms = rooms.filter(room =>
      room.temperature >= 22 && room.temperature <= 26 &&
      room.humidity >= 40 && room.humidity <= 60
    );

    if (comfortableRooms.length === rooms.length) {
      return [{
        type: 'success',
        icon: '✓',
        title: 'ALL COMFORTABLE',
        message: 'Every room is in the ideal comfort zone',
        priority: 1
      }];
    }

    if (comfortableRooms.length > 0) {
      const names = comfortableRooms.map(r => r.name);
      return [{
        type: 'success',
        icon: '✓',
        title: 'COMFORT ZONES',
        message: `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} comfortable`,
        priority: 1,
        relatedRooms: names
      }];
    }

    return [];
  }

  trendInsights(rooms) {
    const insights = [];

    rooms.forEach(room => {
      const roomHistory = room.tempHistory || [];
      if (roomHistory.length < 10) return;

      // Check last hour trend
      const hourAgo = Date.now() - 3600000;
      const recentHistory = roomHistory.filter(h => h.time >= hourAgo);

      if (recentHistory.length >= 2) {
        const oldest = recentHistory[0];
        const newest = recentHistory[recentHistory.length - 1];
        const tempDelta = newest.value - oldest.value;

        if (Math.abs(tempDelta) >= 2) {
          insights.push({
            type: 'info',
            icon: tempDelta > 0 ? '📈' : '📉',
            title: 'RAPID CHANGE',
            message: `${room.name} ${tempDelta > 0 ? 'rose' : 'dropped'} ${Math.abs(tempDelta).toFixed(1)}° in the last hour`,
            priority: 2,
            relatedRooms: [room.name]
          });
        }
      }
    });

    return insights;
  }
}

/**
 * Get insight type styles
 * @param {string} type - Insight type: success, warning, alert, info
 * @returns {Object} Style object with color and background
 */
export function getInsightStyles(type) {
  const styles = {
    success: { color: '#34C759', background: 'rgba(52, 199, 89, 0.1)' },
    warning: { color: '#FF9500', background: 'rgba(255, 149, 0, 0.1)' },
    alert: { color: '#FF3B30', background: 'rgba(255, 59, 48, 0.1)' },
    info: { color: '#007AFF', background: 'rgba(0, 122, 255, 0.1)' }
  };
  return styles[type] || styles.info;
}
