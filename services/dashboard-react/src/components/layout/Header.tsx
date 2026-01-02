/**
 * Header - Main navigation header
 */

import { NavLink } from 'react-router-dom';
import { useMQTT } from '@/providers/MQTTProvider';
import { ALL_VIEWS } from '@/config';
import styles from './Header.module.css';

export function Header() {
  const { connected, connecting, error } = useMQTT();

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
    <header className={styles.header}>
      <NavLink to="/" className={styles.logo}>
        <span className={styles.logoIcon}>🏠</span>
        <span>Dashboard</span>
      </NavLink>

      <nav className={styles.nav}>
        {ALL_VIEWS.map((view) => (
          <NavLink
            key={view.id}
            to={view.path}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
            title={`${view.title} (${view.key.toUpperCase()})`}
          >
            <span className={styles.navIcon}>{view.icon}</span>
            <span className={styles.navLabel}>{view.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.status}>
        <span className={`${styles.statusDot} ${getStatusClass()}`} />
        <span>{getStatusText()}</span>
      </div>
    </header>
  );
}
