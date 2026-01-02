/**
 * useHotWaterMQTT - Hook to connect hot water store with MQTT
 *
 * Subscribes to the vibration sensor on the hot water pipe.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useHotWaterStore } from '@/stores/hotWaterStore';
import { CONFIG } from '@/config';

// Vibration sensor topic
const VIBRATION_SENSOR_TOPIC = 'Vibration Sensor';

interface VibrationMQTTMessage {
  vibration?: boolean;
}

export function useHotWaterMQTT() {
  const { subscribe, connected } = useMQTT();
  const setRunning = useHotWaterStore((state) => state.setRunning);

  useEffect(() => {
    if (!connected) return;

    const topic = `${CONFIG.baseTopic}/${VIBRATION_SENSOR_TOPIC}`;

    const unsub = subscribe(topic, (_topic, data) => {
      const msg = data as VibrationMQTTMessage;
      if (msg.vibration !== undefined) {
        setRunning(msg.vibration);
      }
    });

    return unsub;
  }, [connected, subscribe, setRunning]);
}
