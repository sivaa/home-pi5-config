/**
 * useMailboxMQTT - Hook to connect mailbox store with MQTT
 *
 * Subscribes to [Mailbox] Motion Sensor for motion events.
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useMailboxStore } from '@/stores/mailboxStore';
import { CONFIG } from '@/config';

// Mailbox sensor device name
const MAILBOX_SENSOR = '[Mailbox] Motion Sensor';

export function useMailboxMQTT() {
  const { subscribe, connected } = useMQTT();
  const processMessage = useMailboxStore((state) => state.processMessage);
  const updateAvailability = useMailboxStore((state) => state.updateAvailability);

  useEffect(() => {
    if (!connected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to sensor data
    const dataTopic = `${CONFIG.baseTopic}/${MAILBOX_SENSOR}`;
    const dataUnsub = subscribe(dataTopic, (_topic, data) => {
      processMessage(data as Record<string, unknown>);
    });
    unsubscribers.push(dataUnsub);

    // Subscribe to availability
    const availTopic = `${CONFIG.baseTopic}/${MAILBOX_SENSOR}/availability`;
    const availUnsub = subscribe(availTopic, (_topic, data) => {
      const payload = data as { state?: string } | string;
      const isOnline =
        typeof payload === 'string'
          ? payload === 'online'
          : payload.state === 'online';
      updateAvailability(isOnline);
    });
    unsubscribers.push(availUnsub);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [connected, subscribe, processMessage, updateAvailability]);
}
