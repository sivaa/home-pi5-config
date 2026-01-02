/**
 * LightsPage - Light control view
 */

import { useCallback } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useLightsStore } from '@/stores/lightsStore';
import { useLightsMQTT } from '@/hooks/useLightsMQTT';
import { LightCard } from '@/components/lights/LightCard';
import styles from './LightsPage.module.css';

export function LightsPage() {
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

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Light Control</h1>

      {/* All lights toggle */}
      <button
        className={styles.toggleAllButton}
        onClick={handleToggleAll}
        disabled={anyLightSyncing()}
      >
        {lightsOnCount() > 0 ? `Turn Off All (${lightsOnCount()} on)` : 'Turn On All'}
      </button>

      {/* Lights grid */}
      <div className={styles.grid}>
        {lights.map((light) => (
          <LightCard key={light.id} light={light} />
        ))}
      </div>
    </div>
  );
}
