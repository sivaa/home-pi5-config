/**
 * useRoomsMQTT - Hook to connect rooms store with MQTT
 *
 * This hook subscribes to all climate sensor topics and updates the store.
 * It also sets up a timer to check for stale sensors.
 * Should be called once at the app level.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useRoomsStore } from '@/stores/roomsStore';
import { CONFIG, ROOM_SENSORS } from '@/config';
import type { ClimateMQTTMessage } from '@/types';

// Collect all unique sensor names
const allSensorNames: string[] = [];
Object.values(ROOM_SENSORS).forEach((roomSensors) => {
  roomSensors.climate.forEach((sensor) => {
    if (!allSensorNames.includes(sensor.name)) {
      allSensorNames.push(sensor.name);
    }
  });
  roomSensors.co2?.forEach((sensor) => {
    if (!allSensorNames.includes(sensor.name)) {
      allSensorNames.push(sensor.name);
    }
  });
});

export function useRoomsMQTT() {
  const { subscribe, connected } = useMQTT();
  const updateSensor = useRoomsStore((state) => state.updateSensor);
  const checkStaleSensors = useRoomsStore((state) => state.checkStaleSensors);

  useEffect(() => {
    if (!connected) return;

    const unsubscribes: (() => void)[] = [];

    // Subscribe to each sensor's topic
    allSensorNames.forEach((sensorName) => {
      const topic = `${CONFIG.baseTopic}/${sensorName}`;

      const unsub = subscribe(topic, (_topic, data) => {
        updateSensor(sensorName, data as ClimateMQTTMessage);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, updateSensor]);

  // Check for stale sensors every minute
  useEffect(() => {
    const interval = setInterval(checkStaleSensors, 60000);
    return () => clearInterval(interval);
  }, [checkStaleSensors]);
}
