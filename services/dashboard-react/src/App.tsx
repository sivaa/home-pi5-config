/**
 * App - Main dashboard component for Phase 0
 *
 * This is the minimal viable app for validating:
 * - MQTT connection
 * - Zustand store pattern
 * - Light control with brightness
 */

import { useCallback } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useLightsStore } from '@/stores/lightsStore';
import { useLightsMQTT } from '@/hooks/useLightsMQTT';
import { LightCard } from '@/components/lights/LightCard';
import styles from './App.module.css';

export function App() {
  const { connected, connecting, error } = useMQTT();
  const { publish } = useMQTT();
  const lights = useLightsStore((state) => state.lights);
  const lightsOnCount = useLightsStore((state) => state.lightsOnCount);
  const anyLightSyncing = useLightsStore((state) => state.anyLightSyncing);
  const toggleAllLights = useLightsStore((state) => state.toggleAllLights);

  // Connect lights store to MQTT
  useLightsMQTT();

  const handleToggleAll = useCallback(() => {
    toggleAllLights(publish);
  }, [publish, toggleAllLights]);

  // Connection status
  const getStatusClass = () => {
    if (error) return styles.statusDotError;
    if (connecting) return styles.statusDotConnecting;
    if (connected) return styles.statusDotConnected;
    return '';
  };

  const getStatusText = () => {
    if (error) return 'Error';
    if (connecting) return 'Connecting...';
    if (connected) return 'Connected';
    return 'Disconnected';
  };

  return (
    <div className={styles.app}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard v2</h1>
        <div className={styles.connectionStatus}>
          <span className={`${styles.statusDot} ${getStatusClass()}`} />
          <span>{getStatusText()}</span>
        </div>
      </header>

      {/* Error message */}
      {error && <div className={styles.error}>MQTT Error: {error}</div>}

      {/* All lights toggle */}
      <button
        className={styles.allLightsToggle}
        onClick={handleToggleAll}
        disabled={!connected || anyLightSyncing()}
      >
        {lightsOnCount() > 0 ? `Turn Off All (${lightsOnCount()} on)` : 'Turn On All'}
      </button>

      {/* Lights grid */}
      <div className={styles.lightsGrid}>
        {lights.map((light) => (
          <LightCard key={light.id} light={light} />
        ))}
      </div>
    </div>
  );
}
