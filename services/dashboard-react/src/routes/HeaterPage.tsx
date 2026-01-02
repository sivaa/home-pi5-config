/**
 * HeaterPage - Thermostat Control Dashboard
 *
 * Features:
 * - Thermostat cards with current/target temp
 * - Temperature adjustment controls
 * - Heating status indicator
 * - Battery level display
 */

import { useMQTT } from '@/providers/MQTTProvider';
import { useThermostatsStore, ThermostatState } from '@/stores/thermostatsStore';
import { useThermostatsMQTT } from '@/hooks/useThermostatsMQTT';
import styles from './HeaterPage.module.css';

// Thermostat Card component
function ThermostatCard({ thermostat }: { thermostat: ThermostatState }) {
  const { publish } = useMQTT();
  const adjustTemp = useThermostatsStore((state) => state.adjustTemp);
  const togglePower = useThermostatsStore((state) => state.togglePower);

  const displayTemp = thermostat.pendingTarget ?? thermostat.targetTemp;
  const isHeating = thermostat.runningState === 'heat';
  const isOff = thermostat.systemMode === 'off';
  const isOffline = !thermostat.available;

  // Get status info
  const getStatusIcon = () => {
    if (isOffline) return '📡';
    if (isOff) return '⏹️';
    if (isHeating) return '🔥';
    return '❄️';
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline';
    if (isOff) return 'Off';
    if (isHeating) return 'Heating';
    return 'Idle';
  };

  const getStatusClass = () => {
    if (isOffline) return styles.offline;
    if (isOff) return styles.off;
    if (isHeating) return styles.heating;
    return styles.idle;
  };

  // Battery indicator
  const getBatteryIcon = () => {
    if (thermostat.battery === null) return '🔋';
    if (thermostat.battery < 20) return '🪫';
    return '🔋';
  };

  const getBatteryClass = () => {
    if (thermostat.battery === null) return '';
    if (thermostat.battery < 20) return styles.batteryLow;
    if (thermostat.battery < 50) return styles.batteryMedium;
    return styles.batteryGood;
  };

  // Temperature progress (how close to target)
  const getProgressPercent = () => {
    if (!thermostat.localTemp || !thermostat.targetTemp) return 0;
    const progress = (thermostat.localTemp / thermostat.targetTemp) * 100;
    return Math.min(100, Math.max(0, Math.round(progress)));
  };

  return (
    <div className={`${styles.card} ${getStatusClass()}`}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>{thermostat.icon}</span>
          <span>{thermostat.name}</span>
        </div>
        <div className={styles.cardStatus}>
          <span>{getStatusIcon()}</span>
          <span>{getStatusText()}</span>
        </div>
      </div>

      {/* Temperature display */}
      <div className={styles.tempDisplay}>
        <div className={styles.currentTemp}>
          <span className={styles.tempValue}>
            {thermostat.localTemp?.toFixed(1) ?? '--'}
          </span>
          <span className={styles.tempUnit}>°C</span>
          <span className={styles.tempLabel}>Current</span>
        </div>
        <div className={styles.tempArrow}>→</div>
        <div className={styles.targetTemp}>
          <span className={styles.tempValue}>
            {displayTemp?.toFixed(0) ?? '--'}
          </span>
          <span className={styles.tempUnit}>°C</span>
          <span className={styles.tempLabel}>Target</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${getProgressPercent()}%` }}
        />
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <button
          className={styles.tempButton}
          onClick={() => adjustTemp(thermostat.id, -1, publish)}
          disabled={isOffline || isOff}
        >
          −
        </button>

        <button
          className={`${styles.powerButton} ${isOff ? styles.powerOff : styles.powerOn}`}
          onClick={() => togglePower(thermostat.id, publish)}
          disabled={isOffline}
        >
          {isOff ? 'Turn On' : 'Turn Off'}
        </button>

        <button
          className={styles.tempButton}
          onClick={() => adjustTemp(thermostat.id, 1, publish)}
          disabled={isOffline || isOff}
        >
          +
        </button>
      </div>

      {/* Footer info */}
      <div className={styles.cardFooter}>
        <span className={`${styles.battery} ${getBatteryClass()}`}>
          {getBatteryIcon()} {thermostat.battery ?? '--'}%
        </span>
        {thermostat.linkquality !== null && (
          <span className={styles.signal}>
            📶 {thermostat.linkquality}
          </span>
        )}
        {thermostat.syncing && (
          <span className={styles.syncing}>Syncing...</span>
        )}
      </div>

      {/* Offline overlay */}
      {isOffline && (
        <div className={styles.offlineOverlay}>
          <span>📡 Offline</span>
        </div>
      )}
    </div>
  );
}

export function HeaterPage() {
  // Connect to MQTT
  useThermostatsMQTT();

  // Store values
  const thermostats = useThermostatsStore((state) => state.thermostats);
  const activeHeatingCount = useThermostatsStore((state) => state.activeHeatingCount);
  const offlineCount = useThermostatsStore((state) => state.offlineCount);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Heater Control</h1>
        <div className={styles.stats}>
          <span className={styles.stat}>
            🔥 {activeHeatingCount()} heating
          </span>
          {offlineCount() > 0 && (
            <span className={`${styles.stat} ${styles.offline}`}>
              📡 {offlineCount()} offline
            </span>
          )}
        </div>
      </div>

      {/* Thermostat grid */}
      <div className={styles.grid}>
        {thermostats.map((thermostat) => (
          <ThermostatCard key={thermostat.id} thermostat={thermostat} />
        ))}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>SONOFF TRVZB Thermostats</span>
        <span>Max 22°C • Step 1°C</span>
      </div>
    </div>
  );
}
