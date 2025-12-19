/**
 * Rooms Data Store
 * Manages room sensor data and history with multi-sensor support
 */

import { ROOM_SENSORS } from '../config.js';

export function initRoomsStore(Alpine, CONFIG) {
  Alpine.store('rooms', {
    // Initialize rooms with multi-sensor support
    list: CONFIG.rooms.map(r => {
      // Get all sensors for this room from ROOM_SENSORS config
      const roomSensorConfig = ROOM_SENSORS[r.id] || { climate: [] };
      const allSensors = [
        ...(roomSensorConfig.climate || []).map(s => ({ ...s, type: 'climate' })),
        ...(roomSensorConfig.co2 || []).map(s => ({ ...s, type: 'co2' })),
        ...(roomSensorConfig.motion || []).map(s => ({ ...s, type: 'motion' })),
        ...(roomSensorConfig.contact || []).map(s => ({ ...s, type: 'contact' }))
      ];

      return {
        ...r,
        // Primary sensor values (backward compatibility)
        temperature: null,
        humidity: null,
        lastSeen: null,
        stale: false,
        tempHistory: [],
        humidHistory: [],
        // Multi-sensor support
        sensors: allSensors.map(s => ({
          ...s,
          temperature: null,
          humidity: null,
          co2: null,
          battery: null,
          lastSeen: null,
          stale: false
        })),
        // Computed room averages
        avgTemperature: null,
        avgHumidity: null,
        tempSpread: null
      };
    }),
    lastUpdate: null,
    loading: false,

    // Computed: Total history points across all rooms
    get historyCount() {
      return this.list.reduce((sum, r) => sum + r.tempHistory.length + r.humidHistory.length, 0);
    },

    // Computed: Home-wide average temperature
    get avgTemperature() {
      const temps = this.list.filter(r => r.avgTemperature != null).map(r => r.avgTemperature);
      if (temps.length === 0) return null;
      return temps.reduce((a, b) => a + b, 0) / temps.length;
    },

    // Computed: Home-wide average humidity
    get avgHumidity() {
      const humids = this.list.filter(r => r.avgHumidity != null).map(r => r.avgHumidity);
      if (humids.length === 0) return null;
      return humids.reduce((a, b) => a + b, 0) / humids.length;
    },

    // Computed: Combined temperature history for home average sparkline
    get avgHistory() {
      // Combine all room histories and compute average at each time point
      const allPoints = [];
      this.list.forEach(room => {
        room.tempHistory.forEach(p => allPoints.push(p));
      });
      if (allPoints.length === 0) return [];

      // Group by time (within 1 minute buckets) and average
      const buckets = {};
      allPoints.forEach(p => {
        const bucket = Math.floor(p.time / 60000) * 60000;
        if (!buckets[bucket]) buckets[bucket] = [];
        buckets[bucket].push(p.value);
      });

      return Object.entries(buckets)
        .map(([time, values]) => ({
          time: parseInt(time),
          value: values.reduce((a, b) => a + b, 0) / values.length
        }))
        .sort((a, b) => a.time - b.time)
        .slice(-50);
    },

    // Update primary sensor (backward compatibility)
    updateRoom(sensorName, data) {
      const roomIndex = this.list.findIndex(r => r.sensor === sensorName);
      if (roomIndex === -1) return;

      const room = this.list[roomIndex];
      const now = Date.now();

      let sensorTime = now;
      if (data.last_seen) {
        sensorTime = typeof data.last_seen === 'number' ? data.last_seen : new Date(data.last_seen).getTime();
      }

      if (data.temperature !== undefined) {
        room.temperature = data.temperature;
        room.tempHistory.push({ time: sensorTime, value: data.temperature });
        if (room.tempHistory.length > CONFIG.maxHistoryPoints) room.tempHistory.shift();
      }

      if (data.humidity !== undefined) {
        room.humidity = data.humidity;
        room.humidHistory.push({ time: sensorTime, value: data.humidity });
        if (room.humidHistory.length > CONFIG.maxHistoryPoints) room.humidHistory.shift();
      }

      room.lastSeen = sensorTime;
      room.stale = false;
      this.lastUpdate = now;

      // Also update in the sensors array
      this.updateRoomSensor(room.id, sensorName, data);
    },

    // Update any sensor in a room (multi-sensor support)
    updateRoomSensor(roomId, sensorName, data) {
      const room = this.list.find(r => r.id === roomId);
      if (!room) {
        // Try to find room by matching sensor name
        const roomWithSensor = this.list.find(r =>
          r.sensors.some(s => s.name === sensorName)
        );
        if (roomWithSensor) {
          this._updateSensorInRoom(roomWithSensor, sensorName, data);
        }
        return;
      }
      this._updateSensorInRoom(room, sensorName, data);
    },

    // Internal: Update sensor data within a room
    _updateSensorInRoom(room, sensorName, data) {
      const sensor = room.sensors.find(s => s.name === sensorName);
      if (!sensor) return;

      const now = Date.now();
      let sensorTime = now;
      if (data.last_seen) {
        sensorTime = typeof data.last_seen === 'number' ? data.last_seen : new Date(data.last_seen).getTime();
      }

      // Update sensor values
      if (data.temperature !== undefined) sensor.temperature = data.temperature;
      if (data.humidity !== undefined) sensor.humidity = data.humidity;
      if (data.co2 !== undefined) sensor.co2 = data.co2;
      if (data.battery !== undefined) sensor.battery = data.battery;

      sensor.lastSeen = sensorTime;
      sensor.stale = false;

      // Recalculate room averages
      this._recalculateRoomAverages(room);
      this.lastUpdate = now;
    },

    // Internal: Recalculate room-wide averages from all sensors
    _recalculateRoomAverages(room) {
      const climateSensors = room.sensors.filter(s =>
        s.type === 'climate' && s.temperature != null
      );

      if (climateSensors.length === 0) {
        room.avgTemperature = room.temperature;
        room.avgHumidity = room.humidity;
        room.tempSpread = null;
        return;
      }

      const temps = climateSensors.map(s => s.temperature);
      room.avgTemperature = temps.reduce((a, b) => a + b, 0) / temps.length;
      room.tempSpread = Math.max(...temps) - Math.min(...temps);

      const humids = climateSensors.filter(s => s.humidity != null).map(s => s.humidity);
      if (humids.length > 0) {
        room.avgHumidity = humids.reduce((a, b) => a + b, 0) / humids.length;
      }
    },

    // Find sensor by MQTT friendly name and update it
    handleSensorMessage(sensorName, data) {
      // Check if this is a primary room sensor
      const roomByPrimary = this.list.find(r => r.sensor === sensorName);
      if (roomByPrimary) {
        this.updateRoom(sensorName, data);
        return;
      }

      // Check if this is an additional sensor in any room
      const roomWithSensor = this.list.find(r =>
        r.sensors.some(s => s.name === sensorName)
      );
      if (roomWithSensor) {
        this._updateSensorInRoom(roomWithSensor, sensorName, data);
      }
    },

    // Get all sensor MQTT topics to subscribe to
    getAllSensorTopics() {
      const topics = new Set();
      this.list.forEach(room => {
        // Primary sensor
        topics.add(room.sensor);
        // Additional sensors
        room.sensors.forEach(s => topics.add(s.name));
      });
      return Array.from(topics);
    },

    // Load historical data for primary sensors
    async loadHistorical() {
      this.loading = true;
      for (const room of this.list) {
        try {
          const tempQuery = `SELECT value FROM temperature WHERE entity_id = '${room.entityId}_temperature' AND time > now() - ${CONFIG.historyHours}h ORDER BY time ASC`;
          const tempUrl = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(tempQuery)}`;
          const tempRes = await fetch(tempUrl);
          const tempData = await tempRes.json();

          if (tempData.results?.[0]?.series?.[0]?.values) {
            const values = tempData.results[0].series[0].values;
            room.tempHistory = values.map(v => ({ time: new Date(v[0]).getTime(), value: v[1] }));
            room.temperature = values[values.length - 1][1];
            room.lastSeen = new Date(values[values.length - 1][0]).getTime();
          }

          const humidQuery = `SELECT value FROM humidity WHERE entity_id = '${room.entityId}_humidity' AND time > now() - ${CONFIG.historyHours}h ORDER BY time ASC`;
          const humidUrl = `${CONFIG.influxUrl}/query?db=${CONFIG.influxDb}&q=${encodeURIComponent(humidQuery)}`;
          const humidRes = await fetch(humidUrl);
          const humidData = await humidRes.json();

          if (humidData.results?.[0]?.series?.[0]?.values) {
            const values = humidData.results[0].series[0].values;
            room.humidHistory = values.map(v => ({ time: new Date(v[0]).getTime(), value: v[1] }));
            room.humidity = values[values.length - 1][1];
          }

          // Initialize primary sensor in sensors array too
          const primarySensor = room.sensors.find(s => s.isPrimary);
          if (primarySensor) {
            primarySensor.temperature = room.temperature;
            primarySensor.humidity = room.humidity;
            primarySensor.lastSeen = room.lastSeen;
          }

          // Recalculate averages after loading
          this._recalculateRoomAverages(room);
        } catch (e) {
          console.error(`Failed to load history for ${room.name}:`, e);
        }
      }
      this.lastUpdate = Date.now();
      this.loading = false;
    },

    // Check for stale sensors
    checkStale() {
      const now = Date.now();
      this.list.forEach(room => {
        // Check primary sensor
        if (room.lastSeen && (now - room.lastSeen) > CONFIG.staleThreshold) {
          room.stale = true;
        }
        // Check all sensors in the room
        room.sensors.forEach(sensor => {
          if (sensor.lastSeen && (now - sensor.lastSeen) > CONFIG.staleThreshold) {
            sensor.stale = true;
          }
        });
      });
    }
  });
}
