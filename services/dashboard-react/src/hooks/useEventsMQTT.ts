/**
 * useEventsMQTT - Hook to capture events for Timeline
 *
 * Listens to all Zigbee devices and captures:
 * - Motion events (occupancy)
 * - Contact events (doors/windows)
 * - Light state changes
 * - Plug state changes
 * - Vibration events (mailbox)
 */

import { useEffect } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useEventsStore, EventType } from '@/stores/eventsStore';
import { CONFIG } from '@/config';

// Extract room from device name like "[Study] Light"
const extractRoom = (deviceName: string): string => {
  const match = deviceName.match(/^\[([^\]]+)\]/);
  return match ? match[1].toLowerCase() : 'unknown';
};

// Process MQTT message into event
interface MQTTPayload {
  occupancy?: boolean;
  contact?: boolean;
  state?: string;
  brightness?: number;
  vibration?: boolean;
  battery?: number;
  linkquality?: number;
}

export function useEventsMQTT() {
  const { subscribe, connected } = useMQTT();
  const addEvent = useEventsStore((state) => state.addEvent);

  useEffect(() => {
    if (!connected) return;

    // Subscribe to all Zigbee messages
    const topic = `${CONFIG.baseTopic}/#`;

    const unsub = subscribe(topic, (msgTopic, data) => {
      // Skip bridge messages
      if (msgTopic.includes('/bridge/')) return;
      // Skip availability messages
      if (msgTopic.endsWith('/availability')) return;

      const payload = data as MQTTPayload;
      const deviceName = msgTopic.replace(`${CONFIG.baseTopic}/`, '');
      const room = extractRoom(deviceName);
      const now = Date.now();

      // Motion events
      if (payload.occupancy !== undefined) {
        const eventType: EventType = payload.occupancy ? 'motion_detected' : 'motion_cleared';
        addEvent({
          time: now,
          eventType,
          deviceName,
          room,
          value: payload.occupancy ? 1 : 0,
          battery: payload.battery,
          linkquality: payload.linkquality,
        });
        return;
      }

      // Contact events (doors/windows)
      if (payload.contact !== undefined) {
        const eventType: EventType = payload.contact ? 'door_closed' : 'door_opened';
        addEvent({
          time: now,
          eventType,
          deviceName,
          room,
          value: payload.contact ? 0 : 1,
          battery: payload.battery,
          linkquality: payload.linkquality,
        });
        return;
      }

      // Vibration events (mailbox)
      if (payload.vibration === true) {
        addEvent({
          time: now,
          eventType: 'vibration_detected',
          deviceName,
          room,
          value: 1,
          battery: payload.battery,
          linkquality: payload.linkquality,
        });
        return;
      }

      // Light/Plug state changes
      if (payload.state !== undefined) {
        const isLight =
          payload.brightness !== undefined ||
          deviceName.toLowerCase().includes('light');

        const eventType: EventType = payload.state === 'ON'
          ? (isLight ? 'light_on' : 'plug_on')
          : (isLight ? 'light_off' : 'plug_off');

        addEvent({
          time: now,
          eventType,
          deviceName,
          room,
          value: payload.state === 'ON' ? 1 : 0,
        });
      }
    });

    return unsub;
  }, [connected, subscribe, addEvent]);
}
