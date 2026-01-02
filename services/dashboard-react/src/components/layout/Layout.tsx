/**
 * Layout - Main app layout with header
 */

import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import styles from './Layout.module.css';

export function Layout() {
  // Enable keyboard shortcuts for navigation
  useKeyboardShortcuts();

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
