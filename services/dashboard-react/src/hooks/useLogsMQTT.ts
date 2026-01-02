/**
 * useLogsMQTT - Hook to capture all MQTT messages for logs
 *
 * Subscribes to all zigbee2mqtt topics and captures messages.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useLogsStore } from '@/stores/logsStore';
import { CONFIG } from '@/config';

export function useLogsMQTT() {
  const { subscribe, connected } = useMQTT();
  const captureMessage = useLogsStore((state) => state.captureMessage);

  useEffect(() => {
    if (!connected) return;

    // Subscribe to all zigbee2mqtt messages
    const topic = `${CONFIG.baseTopic}/#`;

    const unsub = subscribe(topic, (topic, data) => {
      captureMessage(topic, data);
    });

    return unsub;
  }, [connected, subscribe, captureMessage]);
}
