/**
 * TypeScript types for the dashboard
 */

// Light state from MQTT
export interface LightState {
  id: string;
  name: string;
  icon: string;
  topic: string;
  state: 'ON' | 'OFF';
  brightness: number;      // 0-254
  colorTemp: number;       // 250-454 (cool to warm)
  linkquality: number | null;
  lastSeen: number | null;
  syncing: boolean;
  available: boolean;
}

// MQTT message from zigbee2mqtt light
export interface LightMQTTMessage {
  state?: 'ON' | 'OFF';
  brightness?: number;
  color_temp?: number;
  linkquality?: number;
}

// MQTT availability message
export interface AvailabilityMessage {
  state: 'online' | 'offline';
}

// Light command payload
export interface LightCommand {
  state?: 'ON' | 'OFF';
  brightness?: number;
  color_temp?: number;
}

// Topic handler for MQTT dispatcher
export type TopicHandler = (topic: string, message: unknown) => void;

// MQTT message from climate sensor
export interface ClimateMQTTMessage {
  temperature?: number;
  humidity?: number;
  battery?: number;
  linkquality?: number;
  co2?: number;
}

// Individual sensor reading
export interface SensorReading {
  sensorName: string;
  label: string;
  isPrimary: boolean;
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  co2: number | null;
  lastSeen: number | null;
  isStale: boolean;
}

// Room state with multiple sensors
export interface RoomState {
  id: string;
  name: string;
  icon: string;
  isOutdoor: boolean;
  // Sensor readings
  sensors: SensorReading[];
  // Computed averages
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  // Status
  comfortLevel: 'cold' | 'cool' | 'comfortable' | 'warm' | 'hot' | null;
  hasData: boolean;
  sensorCount: number;
  activeSensorCount: number;
}
