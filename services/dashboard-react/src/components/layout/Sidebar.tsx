/**
 * Sidebar - Right sidebar with real-time data overview
 *
 * Displays 6 sections:
 * 1. HOME - Indoor temp/humidity/CO2 averages
 * 2. OUTSIDE - Balcony + weather
 * 3. ROOMS - Mini floor plan with temperatures
 * 4. HEATING - Active heating status
 * 5. DOORS - Door sensor status
 * 6. WINDOWS - Window sensor status
 */

import { useRoomsStore } from '@/stores/roomsStore';
import { useCO2Store } from '@/stores/co2Store';
import { useWeatherStore } from '@/stores/weatherStore';
import { useThermostatsStore } from '@/stores/thermostatsStore';
import { useSensorsStore } from '@/stores/sensorsStore';
import { FloorPlanMini } from '@/components/sidebar/FloorPlanMini';
import styles from './Sidebar.module.css';

// Format temperature with degree symbol
function formatTemp(temp: number | null): string {
  if (temp === null) return '--';
  return `${temp.toFixed(1)}°`;
}

// Format time duration since open
function formatDuration(openedAt: number | null): string {
  if (openedAt === null) return '';
  const seconds = Math.floor((Date.now() - openedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// Get humidity color based on value
function getHumidityClass(humidity: number | null): string {
  if (humidity === null) return '';
  if (humidity >= 40 && humidity <= 60) return styles.good;
  if (humidity >= 30 && humidity <= 70) return styles.warning;
  return styles.danger;
}

// Get CO2 color based on value
function getCO2Class(co2: number | null): string {
  if (co2 === null) return '';
  if (co2 < 800) return styles.good;
  if (co2 < 1000) return styles.warning;
  return styles.danger;
}

export function Sidebar() {
  // Room data for HOME section
  const homeAverage = useRoomsStore((s) => s.homeAverage());
  const rooms = useRoomsStore((s) => s.rooms);
  const balcony = rooms.find((r) => r.id === 'balcony');

  // CO2 data
  const co2 = useCO2Store((s) => s.co2);

  // Weather data
  const weather = useWeatherStore();

  // Thermostat data
  const thermostats = useThermostatsStore((s) => s.thermostats);
  const activeHeating = thermostats.filter((t) => t.runningState === 'heat');

  // Sensor data
  const openDoors = useSensorsStore((s) => s.openDoors());
  const openWindows = useSensorsStore((s) => s.openWindows());
  const allDoorsSecure = useSensorsStore((s) => s.allDoorsSecure());
  const allWindowsSecure = useSensorsStore((s) => s.allWindowsSecure());

  return (
    <aside className={styles.sidebar}>
      {/* HOME Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🏠</span>
          Home
        </h3>
        <div className={styles.homeStats}>
          <div className={styles.homeStat}>
            <span className={styles.homeStatValue}>{formatTemp(homeAverage.temperature)}</span>
            <span className={styles.homeStatLabel}>Indoor</span>
          </div>
          <div className={styles.homeStat}>
            <span className={`${styles.homeStatValue} ${getHumidityClass(homeAverage.humidity)}`}>
              {homeAverage.humidity !== null ? `${Math.round(homeAverage.humidity)}%` : '--'}
            </span>
            <span className={styles.homeStatLabel}>Humidity</span>
          </div>
          <div className={styles.homeStat}>
            <span className={`${styles.homeStatValue} ${getCO2Class(co2)}`}>
              {co2 !== null ? `${co2}` : '--'}
            </span>
            <span className={styles.homeStatLabel}>CO2 ppm</span>
          </div>
        </div>
      </section>

      {/* OUTSIDE Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>🌿</span>
          Outside
        </h3>
        <div className={styles.outsideStats}>
          <div className={styles.outsideStat}>
            <span className={styles.outsideIcon}>🌡️</span>
            <span className={styles.outsideValue}>{formatTemp(balcony?.temperature ?? null)}</span>
            <span className={styles.outsideLabel}>Balcony</span>
          </div>
          <div className={styles.outsideStat}>
            <span className={styles.outsideIcon}>{weather.icon}</span>
            <span className={styles.outsideValue}>
              {weather.temperature !== null ? formatTemp(weather.temperature) : '--'}
            </span>
            <span className={styles.outsideLabel}>Weather</span>
          </div>
        </div>
      </section>

      {/* ROOMS Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>📐</span>
          Rooms
        </h3>
        <FloorPlanMini rooms={rooms} />
      </section>

      {/* HEATING Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>{activeHeating.length > 0 ? '🔥' : '❄️'}</span>
          Heating
        </h3>
        {activeHeating.length > 0 ? (
          <div className={styles.statusList}>
            {activeHeating.map((t) => (
              <div key={t.id} className={styles.statusItem}>
                <span className={styles.statusName}>{t.name}</span>
                <span className={styles.statusValue}>{t.targetTemp}°C</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.statusOk}>All off</div>
        )}
      </section>

      {/* DOORS Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>{allDoorsSecure ? '🔒' : '🔓'}</span>
          Doors
        </h3>
        {openDoors.length > 0 ? (
          <div className={styles.statusList}>
            {openDoors.map((d) => (
              <div key={d.id} className={`${styles.statusItem} ${styles.statusOpen}`}>
                <span className={styles.statusName}>{d.shortName}</span>
                <span className={styles.statusDuration}>{formatDuration(d.openedAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.statusOk}>All secured</div>
        )}
      </section>

      {/* WINDOWS Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>{allWindowsSecure ? '🔒' : '🔓'}</span>
          Windows
        </h3>
        {openWindows.length > 0 ? (
          <div className={styles.statusList}>
            {openWindows.map((w) => (
              <div key={w.id} className={`${styles.statusItem} ${styles.statusOpen}`}>
                <span className={styles.statusName}>{w.shortName}</span>
                <span className={styles.statusDuration}>{formatDuration(w.openedAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.statusOk}>All closed</div>
        )}
      </section>
    </aside>
  );
}
