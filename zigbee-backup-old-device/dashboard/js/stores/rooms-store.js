/**
 * Rooms Data Store
 * Manages room sensor data and history
 */

export function initRoomsStore(Alpine, CONFIG) {
  Alpine.store('rooms', {
    list: CONFIG.rooms.map(r => ({
      ...r,
      temperature: null,
      humidity: null,
      lastSeen: null,
      stale: false,
      tempHistory: [],
      humidHistory: []
    })),
    lastUpdate: null,
    loading: false,

    get historyCount() {
      return this.list.reduce((sum, r) => sum + r.tempHistory.length + r.humidHistory.length, 0);
    },

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
    },

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
        } catch (e) {
          console.error(`Failed to load history for ${room.name}:`, e);
        }
      }
      this.lastUpdate = Date.now();
      this.loading = false;
    },

    checkStale() {
      const now = Date.now();
      this.list.forEach(room => {
        if (room.lastSeen && (now - room.lastSeen) > CONFIG.staleThreshold) {
          room.stale = true;
        }
      });
    }
  });
}
