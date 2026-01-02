/**
 * RoomCard - Displays room temperature and humidity
 *
 * Shows:
 * - Room name and icon
 * - Average temperature (large display)
 * - Average humidity
 * - Comfort level indicator
 * - Sensor count when multiple sensors
 */

import type { RoomState } from '@/types';
import styles from './RoomCard.module.css';

interface RoomCardProps {
  room: RoomState;
}

export function RoomCard({ room }: RoomCardProps) {
  const { name, icon, temperature, humidity, comfortLevel, hasData, sensorCount, activeSensorCount, isOutdoor } =
    room;

  // Format temperature with one decimal
  const tempDisplay = temperature !== null ? temperature.toFixed(1) : '--';

  // Format humidity as integer
  const humidityDisplay = humidity !== null ? `${Math.round(humidity)}%` : '--%';

  // Card class with comfort level
  const cardClass = [
    styles.card,
    !hasData && styles.noData,
    isOutdoor && styles.outdoor,
  ]
    .filter(Boolean)
    .join(' ');

  // Comfort strip class
  const comfortClass = comfortLevel ? styles[comfortLevel] : '';

  return (
    <div className={cardClass}>
      {/* Comfort indicator strip */}
      {comfortLevel && <div className={`${styles.comfortStrip} ${comfortClass}`} />}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.roomTitle}>
          <span className={styles.icon}>{icon}</span>
          <span className={styles.name}>{name}</span>
        </div>
        {sensorCount > 1 && (
          <span className={styles.sensorCount}>
            {activeSensorCount}/{sensorCount}
          </span>
        )}
      </div>

      {/* Main values */}
      <div className={styles.values}>
        <div className={styles.temperature}>
          {hasData ? (
            <>
              {tempDisplay}
              <span className={styles.unit}>°C</span>
            </>
          ) : (
            <span className={styles.noDataText}>--</span>
          )}
        </div>

        <div className={styles.humidity}>
          <span className={styles.humidityIcon}>💧</span>
          {humidityDisplay}
        </div>
      </div>

      {/* Outdoor badge */}
      {isOutdoor && (
        <div className={styles.outdoorBadge}>Outdoor</div>
      )}
    </div>
  );
}
