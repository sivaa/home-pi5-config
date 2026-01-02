/**
 * MailboxPage - Mailbox Motion Sensor Monitor
 *
 * Features:
 * - Real-time motion alerts
 * - Delivery statistics (today, week)
 * - Event timeline
 * - Signal health status
 */

import { useMailboxStore } from '@/stores/mailboxStore';
import { useMailboxMQTT } from '@/hooks/useMailboxMQTT';
import styles from './MailboxPage.module.css';

// Format time for display
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Format hour for display
function formatHour(hour: number | null): string {
  if (hour === null) return '--';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
}

// Get event icon
function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'motion_detected':
      return '📬';
    case 'motion_cleared':
      return '📭';
    case 'device_online':
      return '📡';
    case 'device_offline':
      return '⚠️';
    default:
      return '📋';
  }
}

// Get event label
function getEventLabel(eventType: string): string {
  switch (eventType) {
    case 'motion_detected':
      return 'Mail Arrived';
    case 'motion_cleared':
      return 'Motion Cleared';
    case 'device_online':
      return 'Sensor Online';
    case 'device_offline':
      return 'Sensor Offline';
    default:
      return eventType;
  }
}

export function MailboxPage() {
  // Connect to MQTT
  useMailboxMQTT();

  // Store state
  const events = useMailboxStore((state) => state.events);
  const available = useMailboxStore((state) => state.available);
  const lastBattery = useMailboxStore((state) => state.lastBattery);
  const lastLinkquality = useMailboxStore((state) => state.lastLinkquality);
  const lastSeen = useMailboxStore((state) => state.lastSeen);
  const hasMailToday = useMailboxStore((state) => state.hasMailToday);
  const lastDelivery = useMailboxStore((state) => state.lastDelivery);
  const stats = useMailboxStore((state) => state.stats);
  const signalHealth = useMailboxStore((state) => state.signalHealth);

  // Get computed values
  const mailToday = hasMailToday();
  const lastMail = lastDelivery();
  const statsData = stats();
  const health = signalHealth();

  // Filter to show only delivery events in main list
  const deliveryEvents = events.filter((e) => e.eventType === 'motion_detected');

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>📬 Mailbox Monitor</h1>
        <div className={styles.status}>
          <span className={`${styles.statusDot} ${available ? styles.online : styles.offline}`} />
          <span>{available ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Hero Card - Mail Today Status */}
      <div className={`${styles.heroCard} ${mailToday ? styles.hasMail : styles.noMail}`}>
        <div className={styles.heroIcon}>{mailToday ? '📬' : '📭'}</div>
        <div className={styles.heroContent}>
          <div className={styles.heroTitle}>
            {mailToday ? 'You have mail!' : 'No mail yet today'}
          </div>
          <div className={styles.heroSubtitle}>
            {lastMail
              ? `Last delivery: ${formatRelativeTime(lastMail.time)}`
              : 'Waiting for activity...'}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{statsData.todayCount}</div>
          <div className={styles.statLabel}>Today</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{statsData.weekCount}</div>
          <div className={styles.statLabel}>This Week</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{formatHour(statsData.avgDeliveryHour)}</div>
          <div className={styles.statLabel}>Avg Time</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{statsData.totalCount}</div>
          <div className={styles.statLabel}>All Time</div>
        </div>
      </div>

      {/* Signal Health */}
      <div className={styles.healthCard}>
        <div className={styles.healthHeader}>
          <span className={styles.healthTitle}>Signal Health</span>
          <span className={`${styles.healthBadge} ${styles[health.status]}`}>
            {health.label}
          </span>
        </div>
        <div className={styles.healthDetails}>
          {lastBattery !== null && (
            <span className={styles.healthItem}>
              🔋 {lastBattery}%
            </span>
          )}
          {lastLinkquality !== null && (
            <span className={styles.healthItem}>
              📶 {lastLinkquality}
            </span>
          )}
          {lastSeen && (
            <span className={styles.healthItem}>
              Last seen: {formatRelativeTime(lastSeen)}
            </span>
          )}
        </div>
      </div>

      {/* Event Timeline */}
      <div className={styles.timelineCard}>
        <div className={styles.timelineHeader}>
          <span className={styles.timelineTitle}>Recent Deliveries</span>
          <span className={styles.timelineCount}>{deliveryEvents.length} events</span>
        </div>
        <div className={styles.timeline}>
          {deliveryEvents.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📭</span>
              <span>No deliveries recorded yet</span>
            </div>
          ) : (
            deliveryEvents.slice(0, 20).map((event) => (
              <div key={event.id} className={styles.timelineItem}>
                <div className={styles.eventIcon}>{getEventIcon(event.eventType)}</div>
                <div className={styles.eventContent}>
                  <div className={styles.eventLabel}>{getEventLabel(event.eventType)}</div>
                  <div className={styles.eventTime}>{formatTime(event.time)}</div>
                </div>
                <div className={styles.eventMeta}>
                  {formatRelativeTime(event.time)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>[Mailbox] Motion Sensor</span>
        <span>SNZB-03P</span>
      </div>
    </div>
  );
}
