/**
 * Comfort Score Algorithm
 * Calculates comfort scores based on temperature and humidity
 */

// Ideal ranges (configurable)
const IDEAL_TEMP = { min: 20, max: 26, perfect: 23 };
const IDEAL_HUMIDITY = { min: 40, max: 60, perfect: 50 };

// Room weights for home average
const ROOM_WEIGHTS = {
  'Living Room': 1.5,    // Most used
  'Bedroom': 1.3,        // Sleep quality matters
  'Study': 1.0,          // Normal
  'Kitchen': 0.8,        // Expect variation
  'Bathroom': 0.5        // Expect humidity spikes
};

/**
 * Calculate comfort score for a single room
 * @param {number} temp - Temperature in Celsius
 * @param {number} humidity - Humidity percentage
 * @returns {number} Score from 0-100
 */
export function calculateRoomComfort(temp, humidity) {
  if (temp === null || humidity === null) return 0;

  // Temperature contributes 70% of score
  let tempScore = 70;
  if (temp < IDEAL_TEMP.min) {
    tempScore = Math.max(0, 70 - (IDEAL_TEMP.min - temp) * 10);
  } else if (temp > IDEAL_TEMP.max) {
    tempScore = Math.max(0, 70 - (temp - IDEAL_TEMP.max) * 10);
  } else {
    // Within range - full score with bonus for being near perfect
    const distFromPerfect = Math.abs(temp - IDEAL_TEMP.perfect);
    tempScore = 70 - distFromPerfect * 2;
  }

  // Humidity contributes 30% of score
  let humidityScore = 30;
  if (humidity < IDEAL_HUMIDITY.min) {
    humidityScore = Math.max(0, 30 - (IDEAL_HUMIDITY.min - humidity) * 1);
  } else if (humidity > IDEAL_HUMIDITY.max) {
    humidityScore = Math.max(0, 30 - (humidity - IDEAL_HUMIDITY.max) * 1.5);
  } else {
    // Within range
    const distFromPerfect = Math.abs(humidity - IDEAL_HUMIDITY.perfect);
    humidityScore = 30 - distFromPerfect * 0.3;
  }

  return Math.round(Math.max(0, Math.min(100, tempScore + humidityScore)));
}

/**
 * Calculate overall home comfort score
 * @param {Array} rooms - Array of room objects with temp/humidity
 * @returns {number} Weighted average score
 */
export function calculateHomeComfort(rooms) {
  if (!rooms || rooms.length === 0) return 0;

  const validRooms = rooms.filter(r => r.temperature !== null && r.humidity !== null);
  if (validRooms.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  validRooms.forEach(room => {
    const weight = ROOM_WEIGHTS[room.name] || 1.0;
    const score = calculateRoomComfort(room.temperature, room.humidity);
    weightedSum += score * weight;
    totalWeight += weight;
  });

  return Math.round(weightedSum / totalWeight);
}

/**
 * Get human-readable label for comfort score
 * @param {number} score - Comfort score 0-100
 * @returns {string} Human-readable label
 */
export function getComfortLabel(score) {
  if (score >= 90) return 'Perfect';
  if (score >= 75) return 'Comfortable';
  if (score >= 60) return 'Okay';
  if (score >= 40) return 'Uncomfortable';
  return 'Poor';
}

/**
 * Get color for comfort score
 * @param {number} score - Comfort score 0-100
 * @returns {string} CSS color value
 */
export function getComfortColor(score) {
  if (score >= 90) return '#34C759';  // Green
  if (score >= 75) return '#30D158';  // Light green
  if (score >= 60) return '#FFD60A';  // Yellow
  if (score >= 40) return '#FF9500';  // Orange
  return '#FF3B30';                    // Red
}

/**
 * Get temperature zone classification
 * @param {number} temp - Temperature in Celsius
 * @returns {string} Zone name: cold, cool, comfortable, warm, hot
 */
export function getTempZone(temp) {
  if (temp === null) return 'unknown';
  if (temp < 18) return 'cold';
  if (temp < 22) return 'cool';
  if (temp < 26) return 'comfortable';
  if (temp < 28) return 'warm';
  return 'hot';
}

/**
 * Get comfort class for temperature (for legacy compatibility)
 * @param {number} temp - Temperature in Celsius
 * @returns {string} CSS class name
 */
export function getComfortClass(temp) {
  if (temp === null) return '';
  if (temp < 18) return 'cold';
  if (temp <= 24) return 'good';
  if (temp <= 28) return 'warm';
  return 'hot';
}

/**
 * Get temperature color for heat maps
 * @param {number} temp - Temperature in Celsius
 * @returns {string} CSS color value
 */
export function getTempColor(temp) {
  if (temp < 20) return '#90CAF9';    // Cold - Light blue
  if (temp < 22) return '#A5D6A7';    // Cool - Light green
  if (temp < 24) return '#81C784';    // Comfortable - Green
  if (temp < 26) return '#FFE082';    // Warm - Yellow
  if (temp < 28) return '#FFAB91';    // Hot - Orange
  return '#EF5350';                    // Very hot - Red
}

/**
 * Get humidity color for heat maps
 * @param {number} humidity - Humidity percentage
 * @returns {string} CSS color value
 */
export function getHumidityColor(humidity) {
  if (humidity < 30) return '#FFCC80';    // Dry - Orange
  if (humidity < 40) return '#A5D6A7';    // Ideal low
  if (humidity < 60) return '#81C784';    // Perfect
  if (humidity < 70) return '#90CAF9';    // Humid - Blue
  return '#5C6BC0';                        // Very humid - Dark blue
}
