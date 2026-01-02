/**
 * Rooms Store - Zustand store for room temperature/humidity data
 *
 * Manages state for all rooms with multi-sensor support:
 * - Individual sensor readings
 * - Room averages (when multiple sensors)
 * - Comfort level calculation
 * - Stale sensor detection
 */

import { create } from 'zustand';
import {
  ROOMS_CONFIG,
  ROOM_SENSORS,
  CONFIG,
  COMFORT_THRESHOLDS,
  type ComfortLevel,
} from '@/config';
import type { RoomState, SensorReading, ClimateMQTTMessage } from '@/types';

interface RoomsStore {
  // State
  rooms: RoomState[];
  initializing: boolean;

  // Computed
  indoorRooms: () => RoomState[];
  homeAverage: () => { temperature: number | null; humidity: number | null };

  // Actions
  updateSensor: (sensorName: string, data: ClimateMQTTMessage) => void;
  checkStaleSensors: () => void;
}

// Calculate comfort level from temperature
function getComfortLevel(temp: number | null): ComfortLevel | null {
  if (temp === null) return null;
  if (temp < COMFORT_THRESHOLDS.cold) return 'cold';
  if (temp < COMFORT_THRESHOLDS.cool) return 'cool';
  if (temp < COMFORT_THRESHOLDS.comfortable) return 'comfortable';
  if (temp < COMFORT_THRESHOLDS.warm) return 'warm';
  return 'hot';
}

// Calculate room averages from sensor readings
function calculateRoomAverages(sensors: SensorReading[]): {
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  activeSensorCount: number;
} {
  const validTemps = sensors.filter((s) => s.temperature !== null && !s.isStale);
  const validHumidity = sensors.filter((s) => s.humidity !== null && !s.isStale);
  const validCO2 = sensors.filter((s) => s.co2 !== null && !s.isStale);

  const temperature =
    validTemps.length > 0
      ? validTemps.reduce((sum, s) => sum + (s.temperature ?? 0), 0) / validTemps.length
      : null;

  const humidity =
    validHumidity.length > 0
      ? validHumidity.reduce((sum, s) => sum + (s.humidity ?? 0), 0) / validHumidity.length
      : null;

  const co2 =
    validCO2.length > 0
      ? validCO2.reduce((sum, s) => sum + (s.co2 ?? 0), 0) / validCO2.length
      : null;

  return {
    temperature,
    humidity,
    co2,
    activeSensorCount: validTemps.length,
  };
}

// Build sensor name to room mapping
const sensorToRoomMap: Map<string, { roomId: string; sensorIndex: number }> = new Map();
ROOMS_CONFIG.forEach((room) => {
  const roomSensors = ROOM_SENSORS[room.id];
  if (roomSensors) {
    roomSensors.climate.forEach((sensor, index) => {
      sensorToRoomMap.set(sensor.name, { roomId: room.id, sensorIndex: index });
    });
    roomSensors.co2?.forEach((sensor, index) => {
      // CO2 sensors are added after climate sensors
      sensorToRoomMap.set(sensor.name, {
        roomId: room.id,
        sensorIndex: roomSensors.climate.length + index,
      });
    });
  }
});

// Initialize rooms from config
function initializeRooms(): RoomState[] {
  return ROOMS_CONFIG.map((room) => {
    const roomSensors = ROOM_SENSORS[room.id];
    const sensors: SensorReading[] = [];

    if (roomSensors) {
      // Add climate sensors
      roomSensors.climate.forEach((sensor) => {
        sensors.push({
          sensorName: sensor.name,
          label: sensor.label,
          isPrimary: sensor.isPrimary ?? false,
          temperature: null,
          humidity: null,
          battery: null,
          co2: null,
          lastSeen: null,
          isStale: false,
        });
      });

      // Add CO2 sensors
      roomSensors.co2?.forEach((sensor) => {
        sensors.push({
          sensorName: sensor.name,
          label: sensor.label,
          isPrimary: false,
          temperature: null,
          humidity: null,
          battery: null,
          co2: null,
          lastSeen: null,
          isStale: false,
        });
      });
    }

    return {
      id: room.id,
      name: room.name,
      icon: room.icon,
      isOutdoor: room.isOutdoor,
      sensors,
      temperature: null,
      humidity: null,
      co2: null,
      comfortLevel: null,
      hasData: false,
      sensorCount: sensors.length,
      activeSensorCount: 0,
    };
  });
}

export const useRoomsStore = create<RoomsStore>((set, get) => ({
  rooms: initializeRooms(),
  initializing: true,

  indoorRooms: () => get().rooms.filter((r) => !r.isOutdoor),

  homeAverage: () => {
    const indoor = get().indoorRooms();
    const validTemps = indoor.filter((r) => r.temperature !== null);
    const validHumidity = indoor.filter((r) => r.humidity !== null);

    const temperature =
      validTemps.length > 0
        ? validTemps.reduce((sum, r) => sum + (r.temperature ?? 0), 0) / validTemps.length
        : null;

    const humidity =
      validHumidity.length > 0
        ? validHumidity.reduce((sum, r) => sum + (r.humidity ?? 0), 0) / validHumidity.length
        : null;

    return { temperature, humidity };
  },

  updateSensor: (sensorName: string, data: ClimateMQTTMessage) => {
    const mapping = sensorToRoomMap.get(sensorName);
    if (!mapping) return;

    set((state) => ({
      rooms: state.rooms.map((room) => {
        if (room.id !== mapping.roomId) return room;

        // Update the specific sensor
        const updatedSensors = room.sensors.map((sensor, idx) => {
          if (idx !== mapping.sensorIndex) return sensor;

          return {
            ...sensor,
            temperature: data.temperature ?? sensor.temperature,
            humidity: data.humidity ?? sensor.humidity,
            battery: data.battery ?? sensor.battery,
            co2: data.co2 ?? sensor.co2,
            lastSeen: Date.now(),
            isStale: false,
          };
        });

        // Recalculate room averages
        const averages = calculateRoomAverages(updatedSensors);

        return {
          ...room,
          sensors: updatedSensors,
          temperature: averages.temperature,
          humidity: averages.humidity,
          co2: averages.co2,
          comfortLevel: getComfortLevel(averages.temperature),
          hasData: averages.temperature !== null,
          activeSensorCount: averages.activeSensorCount,
        };
      }),
      initializing: false,
    }));
  },

  checkStaleSensors: () => {
    const now = Date.now();
    const staleThreshold = CONFIG.staleThreshold;

    set((state) => ({
      rooms: state.rooms.map((room) => {
        const updatedSensors = room.sensors.map((sensor) => {
          if (sensor.lastSeen === null) return sensor;
          const isStale = now - sensor.lastSeen > staleThreshold;
          if (isStale === sensor.isStale) return sensor;
          return { ...sensor, isStale };
        });

        // Recalculate if any sensor staleness changed
        const stalenessChanged = room.sensors.some(
          (s, i) => s.isStale !== updatedSensors[i].isStale
        );

        if (!stalenessChanged) return room;

        const averages = calculateRoomAverages(updatedSensors);

        return {
          ...room,
          sensors: updatedSensors,
          temperature: averages.temperature,
          humidity: averages.humidity,
          co2: averages.co2,
          comfortLevel: getComfortLevel(averages.temperature),
          hasData: averages.temperature !== null,
          activeSensorCount: averages.activeSensorCount,
        };
      }),
    }));
  },
}));
