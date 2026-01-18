/**
 * Layout - Main app layout with header and sidebar
 */

import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSensorsMQTT } from '@/hooks/useSensorsMQTT';
import { useWeatherPolling } from '@/hooks/useWeatherPolling';
import styles from './Layout.module.css';

export function Layout() {
  // Enable keyboard shortcuts for navigation
  useKeyboardShortcuts();

  // Initialize sensors and weather data for sidebar
  useSensorsMQTT();
  useWeatherPolling();

  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.contentWrapper}>
        <main className={styles.main}>
          <Outlet />
        </main>
        <Sidebar />
      </div>
    </div>
  );
}
