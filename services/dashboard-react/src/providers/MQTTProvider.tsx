/**
 * MQTTProvider - Central MQTT connection and message dispatcher
 *
 * Architecture:
 * - Single MQTT connection shared across all components
 * - Central dispatcher pattern: components register topic handlers
 * - Single JSON parse per message, then dispatch to handlers
 *
 * Usage:
 *   // In a store or component
 *   const { subscribe, publish, connected } = useMQTT();
 *
 *   useEffect(() => {
 *     return subscribe('zigbee2mqtt/[Study] Light', (topic, data) => {
 *       // Handle message
 *     });
 *   }, [subscribe]);
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import mqtt, { type MqttClient } from 'mqtt';
import { CONFIG } from '@/config';
import type { TopicHandler } from '@/types';

interface MQTTContextValue {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  subscribe: (topicPattern: string, handler: TopicHandler) => () => void;
  publish: (topic: string, payload: unknown) => void;
}

const MQTTContext = createContext<MQTTContextValue | null>(null);

interface MQTTProviderProps {
  children: ReactNode;
}

export function MQTTProvider({ children }: MQTTProviderProps) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<MqttClient | null>(null);

  // Topic handlers: Map<topicPattern, Set<handler>>
  // Supports exact topics and wildcard patterns (zigbee2mqtt/#)
  const handlersRef = useRef<Map<string, Set<TopicHandler>>>(new Map());

  // Active MQTT subscriptions (to avoid duplicate subscribes)
  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Convert topic pattern to MQTT subscription pattern
  const toMqttPattern = useCallback((pattern: string): string => {
    // If pattern doesn't contain wildcards, it's an exact topic
    // For the base topic, subscribe to all messages under it
    if (!pattern.includes('#') && !pattern.includes('+')) {
      return pattern;
    }
    return pattern;
  }, []);

  // Check if a topic matches a pattern
  const topicMatches = useCallback((topic: string, pattern: string): boolean => {
    if (pattern === topic) return true;

    // Handle # wildcard (matches any number of levels)
    if (pattern.endsWith('#')) {
      const prefix = pattern.slice(0, -1);
      return topic.startsWith(prefix);
    }

    // Handle + wildcard (matches exactly one level)
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length) return false;

    return patternParts.every((part, i) => part === '+' || part === topicParts[i]);
  }, []);

  // Dispatch message to matching handlers
  const dispatchMessage = useCallback((topic: string, payload: Buffer) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload.toString());
    } catch {
      // Not JSON, pass as string
      parsed = payload.toString();
    }

    // Find and call matching handlers
    handlersRef.current.forEach((handlers, pattern) => {
      if (topicMatches(topic, pattern)) {
        handlers.forEach((handler) => {
          try {
            handler(topic, parsed);
          } catch (err) {
            console.error(`Handler error for ${topic}:`, err);
          }
        });
      }
    });
  }, [topicMatches]);

  // Subscribe to a topic pattern
  const subscribe = useCallback(
    (topicPattern: string, handler: TopicHandler): (() => void) => {
      // Add handler to registry
      if (!handlersRef.current.has(topicPattern)) {
        handlersRef.current.set(topicPattern, new Set());
      }
      handlersRef.current.get(topicPattern)!.add(handler);

      // Subscribe to MQTT if not already subscribed
      const mqttPattern = toMqttPattern(topicPattern);
      if (!subscriptionsRef.current.has(mqttPattern) && clientRef.current?.connected) {
        clientRef.current.subscribe(mqttPattern, { qos: 0 }, (err) => {
          if (err) {
            console.error(`Failed to subscribe to ${mqttPattern}:`, err);
          } else {
            subscriptionsRef.current.add(mqttPattern);
          }
        });
      }

      // Return unsubscribe function
      return () => {
        const handlers = handlersRef.current.get(topicPattern);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            handlersRef.current.delete(topicPattern);
            // Note: We don't unsubscribe from MQTT to avoid subscribe/unsubscribe churn
            // The broker handles this efficiently
          }
        }
      };
    },
    [toMqttPattern]
  );

  // Publish to a topic
  const publish = useCallback((topic: string, payload: unknown) => {
    if (!clientRef.current?.connected) {
      console.error('MQTT not connected');
      return;
    }

    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    clientRef.current.publish(topic, message, { qos: 0 }, (err) => {
      if (err) {
        console.error(`Failed to publish to ${topic}:`, err);
      }
    });
  }, []);

  // Connect to MQTT broker on mount
  useEffect(() => {
    console.log('Connecting to MQTT:', CONFIG.mqttUrl);
    setConnecting(true);
    setError(null);

    const client = mqtt.connect(CONFIG.mqttUrl, {
      clientId: `dashboard-react-${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      console.log('MQTT connected');
      setConnected(true);
      setConnecting(false);
      setError(null);

      // Re-subscribe to all registered patterns
      handlersRef.current.forEach((_, pattern) => {
        const mqttPattern = toMqttPattern(pattern);
        if (!subscriptionsRef.current.has(mqttPattern)) {
          client.subscribe(mqttPattern, { qos: 0 }, (err) => {
            if (!err) {
              subscriptionsRef.current.add(mqttPattern);
            }
          });
        }
      });
    });

    client.on('message', (topic, payload) => {
      dispatchMessage(topic, payload);
    });

    client.on('error', (err) => {
      console.error('MQTT error:', err);
      setError(err.message);
    });

    client.on('close', () => {
      console.log('MQTT disconnected');
      setConnected(false);
      subscriptionsRef.current.clear();
    });

    client.on('reconnect', () => {
      console.log('MQTT reconnecting...');
      setConnecting(true);
    });

    // Cleanup on unmount
    return () => {
      client.end(true);
      clientRef.current = null;
      subscriptionsRef.current.clear();
    };
  }, [dispatchMessage, toMqttPattern]);

  const value: MQTTContextValue = {
    connected,
    connecting,
    error,
    subscribe,
    publish,
  };

  return <MQTTContext.Provider value={value}>{children}</MQTTContext.Provider>;
}

// Hook to use MQTT context
export function useMQTT(): MQTTContextValue {
  const context = useContext(MQTTContext);
  if (!context) {
    throw new Error('useMQTT must be used within an MQTTProvider');
  }
  return context;
}
