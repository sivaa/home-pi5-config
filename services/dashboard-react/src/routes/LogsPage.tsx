/**
 * LogsPage - Real-time MQTT message viewer
 *
 * Features:
 * - Live message capture
 * - Category filtering
 * - Search functionality
 * - Pause/resume
 */

import { useState, useMemo } from 'react';
import { useLogsStore, LOG_CATEGORIES, LogCategory } from '@/stores/logsStore';
import { useLogsMQTT } from '@/hooks/useLogsMQTT';
import styles from './LogsPage.module.css';

export function LogsPage() {
  // Connect to MQTT
  useLogsMQTT();

  // Store values
  const logs = useLogsStore((state) => state.logs);
  const paused = useLogsStore((state) => state.paused);
  const categoryFilter = useLogsStore((state) => state.categoryFilter);
  const searchFilter = useLogsStore((state) => state.searchFilter);
  const togglePause = useLogsStore((state) => state.togglePause);
  const clearLogs = useLogsStore((state) => state.clearLogs);
  const setCategoryFilter = useLogsStore((state) => state.setCategoryFilter);
  const setSearchFilter = useLogsStore((state) => state.setSearchFilter);
  const getFilteredLogs = useLogsStore((state) => state.filteredLogs);
  const getStats = useLogsStore((state) => state.stats);

  // Local state for visible count
  const [visibleCount, setVisibleCount] = useState(50);

  // Get filtered logs and stats
  const filteredLogs = useMemo(() => getFilteredLogs(), [logs, categoryFilter, searchFilter, getFilteredLogs]);
  const stats = useMemo(() => getStats(), [logs, getStats]);

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format values for display
  const formatValues = (values: Record<string, unknown>) => {
    const parts: string[] = [];
    if (values.temperature !== undefined) parts.push(`${(values.temperature as number).toFixed(1)}°C`);
    if (values.humidity !== undefined) parts.push(`${values.humidity}%`);
    if (values.co2 !== undefined) parts.push(`${values.co2}ppm`);
    if (values.battery !== undefined) parts.push(`🔋${values.battery}%`);
    if (values.contact !== undefined) parts.push(values.contact ? 'closed' : 'open');
    if (values.occupancy !== undefined) parts.push(values.occupancy ? 'motion' : 'clear');
    if (values.state !== undefined) parts.push(String(values.state));
    if (values.brightness !== undefined) parts.push(`💡${Math.round(((values.brightness as number) / 254) * 100)}%`);
    if (values.runningState !== undefined) parts.push(values.runningState === 'heat' ? '🔥' : '❄️');
    if (values.linkquality !== undefined) parts.push(`📶${values.linkquality}`);
    return parts.join(' | ') || '—';
  };

  // Get severity color
  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'error': return styles.error;
      case 'warning': return styles.warning;
      case 'success': return styles.success;
      default: return styles.info;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Activity Logs</h1>
        <div className={styles.controls}>
          <button
            className={`${styles.button} ${paused ? styles.paused : ''}`}
            onClick={togglePause}
          >
            {paused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          <button className={styles.button} onClick={clearLogs}>
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        {Object.entries(LOG_CATEGORIES).map(([key, cat]) => {
          const count = stats.byCategory[key] || 0;
          if (count === 0) return null;
          return (
            <div
              key={key}
              className={`${styles.statItem} ${categoryFilter === key ? styles.active : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === key ? null : key as LogCategory)}
            >
              <span className={styles.statValue}>{cat.icon} {count}</span>
              <span className={styles.statLabel}>{cat.label}</span>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className={styles.search}>
        <input
          type="text"
          placeholder="Search device or value..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className={styles.searchInput}
        />
        {(categoryFilter || searchFilter) && (
          <button
            className={styles.clearFilter}
            onClick={() => {
              setCategoryFilter(null);
              setSearchFilter('');
            }}
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Logs list */}
      <div className={styles.logList}>
        {filteredLogs.length === 0 ? (
          <div className={styles.empty}>
            {paused ? (
              <>
                <div className={styles.emptyIcon}>⏸️</div>
                <div>Logging paused</div>
                <div className={styles.emptyHint}>Click Resume to capture messages</div>
              </>
            ) : (
              <>
                <div className={styles.emptyIcon}>📋</div>
                <div>No messages yet</div>
                <div className={styles.emptyHint}>Waiting for MQTT data...</div>
              </>
            )}
          </div>
        ) : (
          <>
            {filteredLogs.slice(0, visibleCount).map((log) => {
              const category = LOG_CATEGORIES[log.category];
              return (
                <div key={log.id} className={`${styles.logEntry} ${getSeverityClass(log.severity)}`}>
                  <div className={styles.logTime}>{formatTime(log.timestamp)}</div>
                  <div className={styles.logIcon}>{category.icon}</div>
                  <div className={styles.logDevice}>{log.device}</div>
                  <div className={styles.logValues}>{formatValues(log.values)}</div>
                </div>
              );
            })}
            {filteredLogs.length > visibleCount && (
              <button
                className={styles.loadMore}
                onClick={() => setVisibleCount((c) => c + 50)}
              >
                Load more ({filteredLogs.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>{paused ? '⏸️ Paused' : '● Live'}</span>
        <span>Showing {Math.min(visibleCount, filteredLogs.length)} of {filteredLogs.length}</span>
      </div>
    </div>
  );
}
