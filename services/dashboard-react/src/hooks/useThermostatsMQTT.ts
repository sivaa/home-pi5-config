/**
 * useThermostatsMQTT - Hook to connect thermostats store with MQTT
 *
 * Subscribes to all thermostat topics and availability.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useThermostatsStore } from '@/stores/thermostatsStore';
import { CONFIG, THERMOSTATS_CONFIG } from '@/config';

export function useThermostatsMQTT() {
  const { subscribe, connected } = useMQTT();
  const updateThermostat = useThermostatsStore((state) => state.updateThermostat);
  const updateAvailability = useThermostatsStore((state) => state.updateAvailability);

  useEffect(() => {
    if (!connected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to each thermostat's data and availability
    THERMOSTATS_CONFIG.forEach((config) => {
      // Data topic
      const dataTopic = `${CONFIG.baseTopic}/${config.sensor}`;
      const dataUnsub = subscribe(dataTopic, (_topic, data) => {
        updateThermostat(config.sensor, data as Record<string, unknown>);
      });
      unsubscribers.push(dataUnsub);

      // Availability topic
      const availTopic = `${CONFIG.baseTopic}/${config.sensor}/availability`;
      const availUnsub = subscribe(availTopic, (_topic, data) => {
        const payload = data as { state?: string } | string;
        const isOnline = typeof payload === 'string'
          ? payload === 'online'
          : payload.state === 'online';
        updateAvailability(config.sensor, isOnline);
      });
      unsubscribers.push(availUnsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, updateThermostat, updateAvailability]);
}
