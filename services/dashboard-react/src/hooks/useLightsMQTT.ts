/**
 * useLightsMQTT - Hook to connect lights store with MQTT
 *
 * This hook subscribes to light topics and updates the store.
 * It should be called once at the app level.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useLightsStore } from '@/stores/lightsStore';
import { CONFIG, LIGHTS_CONFIG } from '@/config';
import type { LightMQTTMessage, AvailabilityMessage } from '@/types';

export function useLightsMQTT() {
  const { subscribe, connected } = useMQTT();
  const updateLight = useLightsStore((state) => state.updateLight);
  const updateAvailability = useLightsStore((state) => state.updateAvailability);

  useEffect(() => {
    if (!connected) return;

    const unsubscribes: (() => void)[] = [];

    // Subscribe to each light's state topic
    LIGHTS_CONFIG.forEach((config) => {
      const stateTopic = `${CONFIG.baseTopic}/${config.topic}`;
      const availabilityTopic = `${stateTopic}/availability`;

      // State updates
      const unsubState = subscribe(stateTopic, (_topic, data) => {
        updateLight(config.topic, data as LightMQTTMessage);
      });
      unsubscribes.push(unsubState);

      // Availability updates
      const unsubAvail = subscribe(availabilityTopic, (_topic, data) => {
        updateAvailability(config.topic, data as AvailabilityMessage);
      });
      unsubscribes.push(unsubAvail);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, updateLight, updateAvailability]);
}
