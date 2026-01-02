/**
 * ClassicPage - Classic room cards view
 *
 * Shows all rooms with temperature/humidity in a grid layout.
 * Includes a summary card with home averages.
 */

import { useRoomsStore } from '@/stores/roomsStore';
import { useRoomsMQTT } from '@/hooks/useRoomsMQTT';
import { RoomCard } from '@/components/rooms/RoomCard';
import styles from './ClassicPage.module.css';

export function ClassicPage() {
  const rooms = useRoomsStore((state) => state.rooms);
  const homeAverage = useRoomsStore((state) => state.homeAverage);
  const initializing = useRoomsStore((state) => state.initializing);

  // Connect rooms store to MQTT
  useRoomsMQTT();

  const { temperature, humidity } = homeAverage();

  // Format averages
  const avgTempDisplay = temperature !== null ? temperature.toFixed(1) : '--';
  const avgHumidityDisplay = humidity !== null ? `${Math.round(humidity)}%` : '--%';

  return (
    <div className={styles.page}>
      {/* Summary card */}
      <div className={styles.summary}>
        <div className={styles.summarySection}>
          <div className={styles.summaryLabel}>Temperature</div>
          <div className={styles.summaryValue}>
            {avgTempDisplay}
            <span className={styles.summaryUnit}>°C</span>
          </div>
        </div>

        <div className={styles.summaryDivider} />

        <div className={styles.summarySection}>
          <div className={styles.summaryLabel}>Humidity</div>
          <div className={styles.summaryValue}>
            {avgHumidityDisplay}
          </div>
        </div>

        <div className={styles.summaryDivider} />

        <div className={styles.summarySection}>
          <div className={styles.summaryLabel}>Home Average</div>
          <div className={styles.summaryStatus}>
            {initializing ? 'Connecting...' : 'Live'}
          </div>
        </div>
      </div>

      {/* Room cards grid */}
      <div className={styles.grid}>
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}
