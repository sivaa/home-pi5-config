/**
 * HotWaterPage - Hot Water Usage Monitor
 *
 * Simple page showing:
 * - Live running/idle status
 * - Large visual indicator
 * - Last update time
 *
 * Note: Stats and charts require InfluxDB integration (Phase 4+)
 */

import { useHotWaterStore } from '@/stores/hotWaterStore';
import { useHotWaterMQTT } from '@/hooks/useHotWaterMQTT';
import styles from './HotWaterPage.module.css';

export function HotWaterPage() {
  // Connect to MQTT
  useHotWaterMQTT();

  // Store values
  const isRunning = useHotWaterStore((state) => state.isRunning);
  const lastUpdate = useHotWaterStore((state) => state.lastUpdate);

  // Format last update time
  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Waiting for data...';
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className={styles.page}>
      {/* Status Section */}
      <div className={styles.statusSection}>
        <div className={styles.statusHeader}>Hot Water</div>

        <div className={`${styles.indicator} ${isRunning ? styles.running : styles.idle}`}>
          <div className={styles.indicatorIcon}>
            {isRunning ? '💧' : '🚿'}
          </div>
          <div className={styles.indicatorRing} />
        </div>

        <div className={`${styles.statusText} ${isRunning ? styles.running : ''}`}>
          {isRunning ? 'Water Running' : 'Idle'}
        </div>

        <div className={styles.lastUpdate}>
          Last update: {formatLastUpdate()}
        </div>
      </div>

      {/* Info Cards */}
      <div className={styles.infoCards}>
        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>📊</div>
          <div className={styles.infoTitle}>Usage Statistics</div>
          <div className={styles.infoDescription}>
            Daily and weekly usage stats coming in Phase 4
          </div>
        </div>

        <div className={styles.infoCard}>
          <div className={styles.infoIcon}>📈</div>
          <div className={styles.infoTitle}>History Chart</div>
          <div className={styles.infoDescription}>
            Historical usage charts coming in Phase 4
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerItem}>Vibration Sensor</span>
        <span className={styles.footerItem}>Hot Water Pipe</span>
      </div>
    </div>
  );
}
