/**
 * TimelinePage - Event Timeline View
 *
 * Features:
 * - Chronological event display
 * - Category filtering (motion, contact, lights, plugs)
 * - Date range selection
 * - Search by device name
 */

import { useEventsStore, EVENT_TYPES, Category, TimelineEvent } from '@/stores/eventsStore';
import { useEventsMQTT } from '@/hooks/useEventsMQTT';
import styles from './TimelinePage.module.css';

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

// Format device name for display
function formatDeviceName(name: string): string {
  // Remove room prefix like "[Study]"
  let formatted = name.replace(/^\[[^\]]+\]\s*/, '');
  // Shorten common suffixes
  formatted = formatted.replace(/\s*(Temperature & Humidity|Contact Sensor|Motion Sensor)\s*/gi, '');
  formatted = formatted.replace(/\s*Sensor\s*/gi, '');
  return formatted.trim() || name;
}

// Category config for filter chips
const CATEGORIES: { id: Category; icon: string; label: string }[] = [
  { id: 'motion', icon: '👁️', label: 'Motion' },
  { id: 'contact', icon: '🚪', label: 'Doors' },
  { id: 'light', icon: '💡', label: 'Lights' },
  { id: 'plug', icon: '🔌', label: 'Plugs' },
  { id: 'vibration', icon: '📬', label: 'Mailbox' },
  { id: 'availability', icon: '📡', label: 'Devices' },
];

// Date range options
const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'all', label: 'All' },
] as const;

// Event row component
function EventRow({ event }: { event: TimelineEvent }) {
  const eventInfo = EVENT_TYPES[event.eventType];
  const priority = eventInfo?.priority || 'activity';

  return (
    <div className={`${styles.eventRow} ${styles[priority]}`}>
      <div className={styles.eventTime}>
        <span className={styles.time}>{formatTime(event.time)}</span>
        <span className={styles.relative}>{formatRelativeTime(event.time)}</span>
      </div>
      <div className={styles.eventIcon}>{eventInfo?.icon || '📋'}</div>
      <div className={styles.eventContent}>
        <div className={styles.eventLabel}>{eventInfo?.label || event.eventType}</div>
        <div className={styles.eventDevice}>{formatDeviceName(event.deviceName)}</div>
      </div>
      <div className={styles.eventRoom}>{event.room}</div>
    </div>
  );
}

export function TimelinePage() {
  // Connect to MQTT
  useEventsMQTT();

  // Store state and actions
  const filters = useEventsStore((state) => state.filters);
  const toggleCategory = useEventsStore((state) => state.toggleCategory);
  const setDateRange = useEventsStore((state) => state.setDateRange);
  const setSearchText = useEventsStore((state) => state.setSearchText);
  const clearFilters = useEventsStore((state) => state.clearFilters);
  const getFilteredEvents = useEventsStore((state) => state.getFilteredEvents);
  const getCategoryStats = useEventsStore((state) => state.getCategoryStats);
  const getStats = useEventsStore((state) => state.getStats);

  // Get computed values
  const events = getFilteredEvents();
  const categoryStats = getCategoryStats();
  const stats = getStats();

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>📖 Event Timeline</h1>
          <div className={styles.stats}>
            <span className={styles.stat}>👁️ {stats.motionCount}</span>
            <span className={styles.stat}>🚪 {stats.doorCount}</span>
            {stats.mailboxCount > 0 && (
              <span className={styles.stat}>📬 {stats.mailboxCount}</span>
            )}
          </div>
        </div>

        {/* Date Range Tabs */}
        <div className={styles.dateRanges}>
          {DATE_RANGES.map((range) => (
            <button
              key={range.id}
              className={`${styles.rangeTab} ${filters.dateRange === range.id ? styles.active : ''}`}
              onClick={() => setDateRange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filters */}
      <div className={styles.filters}>
        <div className={styles.categoryChips}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`${styles.chip} ${filters.categories.includes(cat.id) ? styles.active : ''}`}
              onClick={() => toggleCategory(cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span className={styles.chipCount}>{categoryStats[cat.id]}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className={styles.searchRow}>
          <input
            type="text"
            placeholder="Search devices..."
            value={filters.searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles.searchInput}
          />
          {(filters.categories.length > 0 || filters.searchText) && (
            <button className={styles.clearBtn} onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Event List */}
      <div className={styles.eventList}>
        {events.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <span>No events found</span>
            <span className={styles.emptyHint}>
              {filters.categories.length > 0 || filters.searchText
                ? 'Try adjusting your filters'
                : 'Events will appear as they happen'}
            </span>
          </div>
        ) : (
          events.slice(0, 100).map((event) => (
            <EventRow key={event.id} event={event} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>Showing {Math.min(events.length, 100)} of {events.length} events</span>
      </div>
    </div>
  );
}
