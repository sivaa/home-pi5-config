/**
 * useCO2MQTT - Hook to connect CO2 store with MQTT
 *
 * Subscribes to the CO2 sensor topic (NOUS E10 in Hallway)
 * and updates the store with live readings.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useCO2Store } from '@/stores/co2Store';
import { CONFIG } from '@/config';

// CO2 sensor topic (Hallway CO2 sensor)
const CO2_SENSOR_TOPIC = '[Hallway] CO2';

interface CO2MQTTMessage {
  co2?: number;
  temperature?: number;
  humidity?: number;
  air_quality?: string;
  battery?: number;
}

export function useCO2MQTT() {
  const { subscribe, connected } = useMQTT();
  const updateCO2 = useCO2Store((state) => state.updateCO2);
  const checkStale = useCO2Store((state) => state.checkStale);

  useEffect(() => {
    if (!connected) return;

    const topic = `${CONFIG.baseTopic}/${CO2_SENSOR_TOPIC}`;

    const unsub = subscribe(topic, (_topic, data) => {
      const msg = data as CO2MQTTMessage;
      updateCO2({
        co2: msg.co2 ?? null,
        temperature: msg.temperature ?? null,
        humidity: msg.humidity ?? null,
        deviceAirQuality: msg.air_quality ?? null,
        battery: msg.battery ?? null,
      });
    });

    return unsub;
  }, [connected, subscribe, updateCO2]);

  // Check for stale data every minute
  useEffect(() => {
    const interval = setInterval(checkStale, 60000);
    return () => clearInterval(interval);
  }, [checkStale]);
}
