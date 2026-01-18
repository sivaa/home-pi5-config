/**
 * FloorPlanMini - Compact floor plan SVG for sidebar
 *
 * Matches the Classic dashboard apartment layout exactly:
 * ┌──────────────┬──────────┬─────────────────┐
 * │   BATHROOM   │          │                 │
 * │              │  HALLWAY │     STUDY       │
 * ├──────────────┤          │                 │
 * │   KITCHEN    │          │                 │
 * │              ├──────────┴─────────────────┤
 * ├──────────────┤                            │
 * │              │        LIVING              │
 * │   BEDROOM    │                            │
 * │              │                            │
 * └──────────────┴────────────────────────────┘
 */

import type { RoomState } from '@/types';
import styles from './FloorPlanMini.module.css';

interface FloorPlanMiniProps {
  rooms: RoomState[];
}

// Room layout matching Classic dashboard (viewBox 0 0 92.39 76.65)
const APARTMENT_LAYOUT = [
  // Left column
  { id: 'bathroom', name: 'BATH', x: 0, y: 0, width: 35, height: 20, labelY: 3, tempY: 14, small: true },
  { id: 'kitchen', name: 'KITCH', x: 0, y: 20, width: 35, height: 20, labelY: 23, tempY: 34, small: true },
  { id: 'bedroom', name: 'BED', x: 0, y: 40, width: 45, height: 36.65, labelY: 68, tempY: 58, small: false },
  // Center corridor
  { id: 'hallway', name: 'FLUR', x: 35, y: 0, width: 20, height: 40, labelY: 4, tempY: 22, small: true },
  // Right side
  { id: 'study', name: 'STUDY', x: 55, y: 0, width: 37.39, height: 40, labelY: 32, tempY: 20, small: false },
  { id: 'living', name: 'LIVING', x: 45, y: 40, width: 47.39, height: 36.65, labelY: 68, tempY: 58, small: false },
];

// Get fill color based on temperature (comfort level)
function getTempColor(temp: number | null): string {
  if (temp === null) return '#374151'; // gray-700
  if (temp < 15) return '#3b82f6'; // blue-500 (freezing)
  if (temp < 16) return '#60a5fa'; // blue-400 (cold)
  if (temp < 18) return '#22c55e'; // green-500 (comfortable)
  if (temp < 19) return '#eab308'; // yellow-500 (warm)
  if (temp < 21) return '#f97316'; // orange-500 (hot)
  return '#ef4444'; // red-500 (very hot)
}

// Format temperature with styled decimal
function formatTemp(temp: number | null): { int: string; dec: string } {
  if (temp === null) return { int: '--', dec: '' };
  const fixed = temp.toFixed(1);
  const [intPart, decPart] = fixed.split('.');
  return { int: intPart, dec: `.${decPart}` };
}

export function FloorPlanMini({ rooms }: FloorPlanMiniProps) {
  // Map room data by id for easy lookup
  const roomData = new Map(rooms.map((r) => [r.id, r]));

  return (
    <svg className={styles.floorPlan} viewBox="0 0 92.39 76.65" preserveAspectRatio="xMidYMid meet">
      {/* Room fills */}
      <g className={styles.rooms}>
        {APARTMENT_LAYOUT.map((room) => {
          const data = roomData.get(room.id);
          const temp = data?.temperature ?? null;
          const fillColor = getTempColor(temp);

          return (
            <rect
              key={room.id}
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              fill={fillColor}
              opacity="0.85"
            />
          );
        })}
      </g>

      {/* Room names (helicopter pad style) */}
      <g className={styles.names}>
        {APARTMENT_LAYOUT.map((room) => {
          const cx = room.x + room.width / 2;
          return (
            <text
              key={`name-${room.id}`}
              x={cx}
              y={room.labelY}
              textAnchor="middle"
              className={styles.roomName}
            >
              {room.name}
            </text>
          );
        })}
      </g>

      {/* Temperature labels with styled decimals */}
      <g className={styles.labels}>
        {APARTMENT_LAYOUT.map((room) => {
          const data = roomData.get(room.id);
          const temp = data?.temperature ?? null;
          const { int, dec } = formatTemp(temp);
          const cx = room.x + room.width / 2;
          const fontSize = room.small ? 9 : 12;

          return (
            <text
              key={`temp-${room.id}`}
              x={cx}
              y={room.tempY}
              textAnchor="middle"
              className={styles.tempLabel}
              style={{ fontSize }}
            >
              <tspan>{int}</tspan>
              <tspan className={styles.decimal}>{dec}</tspan>
            </text>
          );
        })}
      </g>

      {/* Wall structure */}
      <g className={styles.walls} fill="none">
        {/* Outer perimeter */}
        <rect
          x="0.5"
          y="0.5"
          width="91.39"
          height="75.65"
          stroke="var(--color-text-secondary)"
          strokeWidth="1"
        />
        {/* Internal walls */}
        <path
          d="
            M 55 0 L 55 40
            M 45 40 L 45 76.65
            M 35 0 L 35 40
            M 0 20 L 35 20
            M 0 40 L 92.39 40
          "
          stroke="var(--color-text-secondary)"
          strokeWidth="0.5"
        />
      </g>
    </svg>
  );
}
