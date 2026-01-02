/**
 * CO2Page - CO2 Air Quality Monitor
 *
 * Displays:
 * - Large circular gauge with CO2 level
 * - Air quality status (excellent/good/moderate/poor/bad)
 * - Temperature and humidity cards
 * - Legend with threshold levels
 */

import { useCO2Store } from '@/stores/co2Store';
import { useCO2MQTT } from '@/hooks/useCO2MQTT';
import styles from './CO2Page.module.css';

// SVG gauge configuration
const GAUGE_RADIUS = 90;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

export function CO2Page() {
  // Connect to MQTT
  useCO2MQTT();

  // Store values
  const co2 = useCO2Store((state) => state.co2);
  const temperature = useCO2Store((state) => state.temperature);
  const humidity = useCO2Store((state) => state.humidity);
  const isStale = useCO2Store((state) => state.isStale);
  const initializing = useCO2Store((state) => state.initializing);
  const airQualityLevel = useCO2Store((state) => state.airQualityLevel);
  const co2Color = useCO2Store((state) => state.co2Color);
  const co2Percent = useCO2Store((state) => state.co2Percent);

  // Calculate gauge arc
  const gaugeArc = `${(co2Percent() / 100) * GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}`;

  // Format values
  const co2Display = co2 !== null ? co2 : '--';
  const tempDisplay = temperature !== null ? `${temperature.toFixed(1)}°C` : '--';
  const humidityDisplay = humidity !== null ? `${Math.round(humidity)}%` : '--';
  const statusDisplay = airQualityLevel().charAt(0).toUpperCase() + airQualityLevel().slice(1);

  // Temperature comfort level
  const getTempLevel = () => {
    if (temperature === null) return 'unknown';
    if (temperature < 18) return 'cold';
    if (temperature < 20) return 'cool';
    if (temperature <= 26) return 'comfortable';
    if (temperature <= 28) return 'warm';
    return 'hot';
  };

  // Humidity comfort level
  const getHumidityLevel = () => {
    if (humidity === null) return 'unknown';
    if (humidity < 30) return 'dry';
    if (humidity < 40) return 'low';
    if (humidity <= 60) return 'optimal';
    if (humidity <= 70) return 'high';
    return 'humid';
  };

  return (
    <div className={styles.page}>
      {/* Gauge Section */}
      <div className={styles.gaugeSection}>
        <div className={styles.gaugeHeader}>Air Quality</div>

        <div className={styles.gauge}>
          <svg className={styles.gaugeRing} viewBox="0 0 200 200">
            {/* Background ring */}
            <circle
              cx="100"
              cy="100"
              r={GAUGE_RADIUS}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="12"
            />
            {/* Value arc */}
            <circle
              cx="100"
              cy="100"
              r={GAUGE_RADIUS}
              fill="none"
              stroke={co2Color()}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={gaugeArc}
              transform="rotate(-90 100 100)"
              className={styles.gaugeArc}
            />
          </svg>

          <div className={styles.gaugeContent}>
            <div className={styles.value} style={{ color: co2Color() }}>
              {co2Display}
            </div>
            <div className={styles.unit}>ppm</div>
            <div className={styles.status} style={{ color: co2Color() }}>
              {initializing ? 'Connecting...' : statusDisplay}
            </div>
          </div>
        </div>
      </div>

      {/* Air Quality Cards */}
      <div className={styles.cards}>
        {/* CO2 Card */}
        <div className={`${styles.card} ${styles.highlight}`}>
          <div className={styles.cardIcon}>💨</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>CO2</div>
            <div className={styles.cardValue}>{co2Display} ppm</div>
            <div className={styles.cardBar}>
              <div
                className={styles.cardFill}
                style={{
                  width: `${co2Percent()}%`,
                  background: co2Color(),
                }}
              />
            </div>
            <div className={styles.cardStatus}>{statusDisplay}</div>
          </div>
        </div>

        {/* Temperature Card */}
        <div className={styles.card}>
          <div className={styles.cardIcon}>🌡️</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>Temperature</div>
            <div className={styles.cardValue}>{tempDisplay}</div>
            <div className={styles.cardBar}>
              <div
                className={styles.cardFill}
                style={{
                  width: temperature !== null ? `${Math.min(100, ((temperature - 15) / 20) * 100)}%` : '0%',
                  background: getTempLevel() === 'comfortable' ? '#81C784' : '#FFE082',
                }}
              />
            </div>
            <div className={styles.cardStatus}>{getTempLevel()}</div>
          </div>
        </div>

        {/* Humidity Card */}
        <div className={styles.card}>
          <div className={styles.cardIcon}>💧</div>
          <div className={styles.cardContent}>
            <div className={styles.cardLabel}>Humidity</div>
            <div className={styles.cardValue}>{humidityDisplay}</div>
            <div className={styles.cardBar}>
              <div
                className={styles.cardFill}
                style={{
                  width: humidity !== null ? `${humidity}%` : '0%',
                  background: getHumidityLevel() === 'optimal' ? '#81C784' : '#90CAF9',
                }}
              />
            </div>
            <div className={styles.cardStatus}>{getHumidityLevel()}</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#34C759' }} />
          <span>&lt;600 Excellent</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#30D158' }} />
          <span>&lt;1000 Good</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#FFD60A' }} />
          <span>&lt;1500 Moderate</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#FF9500' }} />
          <span>&lt;2000 Poor</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: '#FF3B30' }} />
          <span>&gt;2000 Bad</span>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerItem}>
          {isStale ? '⚠️ Data stale' : '✓ Live'}
        </span>
        <span className={styles.footerItem}>Hallway Sensor</span>
      </div>
    </div>
  );
}
