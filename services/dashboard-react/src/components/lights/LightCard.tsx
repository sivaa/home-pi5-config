/**
 * LightCard - Individual light control card
 *
 * Features:
 * - Toggle on/off with visual feedback
 * - Brightness slider (0-254)
 * - Color temperature slider (250-454)
 * - Quick presets
 * - Syncing indicator
 * - Availability status
 */

import { useCallback } from 'react';
import { useMQTT } from '@/providers/MQTTProvider';
import { useLightsStore } from '@/stores/lightsStore';
import { LIGHT_PRESETS, type LightPreset } from '@/config';
import type { LightState } from '@/types';
import styles from './LightCard.module.css';

interface LightCardProps {
  light: LightState;
}

export function LightCard({ light }: LightCardProps) {
  const { publish } = useMQTT();
  const { toggleLight, setBrightness, setColorTemp, applyPreset } = useLightsStore();

  const handleToggle = useCallback(() => {
    toggleLight(light.id, publish);
  }, [light.id, publish, toggleLight]);

  const handleBrightnessChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBrightness(light.id, parseInt(e.target.value, 10), publish);
    },
    [light.id, publish, setBrightness]
  );

  const handleColorTempChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setColorTemp(light.id, parseInt(e.target.value, 10), publish);
    },
    [light.id, publish, setColorTemp]
  );

  const handlePreset = useCallback(
    (preset: LightPreset) => {
      applyPreset(light.id, preset, publish);
    },
    [light.id, publish, applyPreset]
  );

  // Format last update time
  const formatLastUpdate = (timestamp: number | null): string => {
    if (!timestamp) return 'No data';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  // Color temperature label
  const getColorTempLabel = (colorTemp: number): string => {
    if (colorTemp <= 280) return 'Cool White';
    if (colorTemp <= 350) return 'Neutral';
    if (colorTemp <= 400) return 'Warm White';
    return 'Warm';
  };

  // Brightness percentage
  const brightnessPercent = Math.round((light.brightness / 254) * 100);

  // Card classes
  const cardClasses = [
    styles.card,
    light.syncing && styles.cardSyncing,
    !light.available && styles.cardUnavailable,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.icon}>{light.icon}</span>
        <span className={styles.name}>{light.name}</span>
        <span className={light.available ? styles.statusOnline : styles.statusOffline}>
          {light.available ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Toggle Button */}
      <button
        className={`${styles.toggleButton} ${light.state === 'ON' ? styles.toggleButtonOn : ''}`}
        onClick={handleToggle}
        disabled={!light.available || light.syncing}
      >
        {light.state === 'ON' ? 'ON' : 'OFF'}
        {light.syncing && ' ...'}
      </button>

      {/* Controls - only show when light is ON */}
      {light.state === 'ON' && (
        <div className={styles.controls}>
          {/* Brightness */}
          <div className={styles.sliderGroup}>
            <label className={styles.sliderLabel}>
              <span>Brightness</span>
              <span className={styles.sliderValue}>{brightnessPercent}%</span>
            </label>
            <input
              type="range"
              min="1"
              max="254"
              value={light.brightness}
              onChange={handleBrightnessChange}
              disabled={light.syncing}
            />
          </div>

          {/* Color Temperature */}
          <div className={styles.sliderGroup}>
            <label className={styles.sliderLabel}>
              <span>Color Temp</span>
              <span className={styles.sliderValue}>{getColorTempLabel(light.colorTemp)}</span>
            </label>
            <input
              type="range"
              min="250"
              max="454"
              value={light.colorTemp}
              onChange={handleColorTempChange}
              disabled={light.syncing}
            />
          </div>

          {/* Presets */}
          <div className={styles.presets}>
            {(Object.keys(LIGHT_PRESETS) as LightPreset[]).map((presetName) => (
              <button
                key={presetName}
                className={styles.presetButton}
                onClick={() => handlePreset(presetName)}
                disabled={light.syncing}
              >
                {LIGHT_PRESETS[presetName].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meta info */}
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          {light.linkquality !== null && `Signal: ${light.linkquality}`}
        </span>
        <span className={styles.metaItem}>Updated: {formatLastUpdate(light.lastSeen)}</span>
      </div>
    </div>
  );
}
