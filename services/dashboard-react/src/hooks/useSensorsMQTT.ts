/**
 * useSensorsMQTT - Hook to connect sensors store with MQTT
 *
 * Subscribes to contact sensor topics and updates the store.
 * Should be called once at the app level.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useSensorsStore, type ContactMQTTMessage } from '@/stores/sensorsStore';
import { CONFIG, CONTACT_SENSORS } from '@/config';

export function useSensorsMQTT() {
  const { subscribe, connected } = useMQTT();
  const updateSensor = useSensorsStore((state) => state.updateSensor);
  const initializeSensors = useSensorsStore((state) => state.initializeSensors);

  // Initialize sensors on mount
  useEffect(() => {
    initializeSensors(CONTACT_SENSORS);
  }, [initializeSensors]);

  // Subscribe to MQTT topics when connected
  useEffect(() => {
    if (!connected) return;

    const unsubscribes: (() => void)[] = [];

    // Subscribe to each sensor's state topic
    CONTACT_SENSORS.forEach((config) => {
      const stateTopic = `${CONFIG.baseTopic}/${config.name}`;

      const unsubState = subscribe(stateTopic, (_topic, data) => {
        updateSensor(config.name, data as ContactMQTTMessage);
      });
      unsubscribes.push(unsubState);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, updateSensor]);
}
