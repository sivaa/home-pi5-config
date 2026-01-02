/**
 * NetworkPage - Zigbee Network Visualization
 *
 * 2D floor plan with device markers showing:
 * - Coordinator, routers, and end devices
 * - Device type indicators
 * - Room layout
 *
 * Note: Simplified 2D version for Pi performance
 * (Original was 3D with Three.js)
 */

import { useState } from 'react';
import { ZIGBEE_DEVICES, FLOOR_PLAN_ROOMS, ZigbeeDevice } from '@/config';
import styles from './NetworkPage.module.css';

// Device type colors
const DEVICE_COLORS = {
  coordinator: '#FF6B6B',
  router: '#4DABF7',
  'end-device': '#51CF66',
};

// Calculate device position in SVG coordinates
function getDevicePosition(device: ZigbeeDevice): { x: number; y: number } | null {
  const room = FLOOR_PLAN_ROOMS.find((r) => r.id === device.room);
  if (!room) return null;

  return {
    x: room.x + device.x * room.width,
    y: room.y + device.z * room.height,
  };
}

// Device marker component
function DeviceMarker({
  device,
  isSelected,
  onClick,
}: {
  device: ZigbeeDevice;
  isSelected: boolean;
  onClick: () => void;
}) {
  const pos = getDevicePosition(device);
  if (!pos) return null;

  const color = DEVICE_COLORS[device.type];
  const size = device.type === 'coordinator' ? 14 : device.type === 'router' ? 12 : 10;

  return (
    <g
      className={styles.deviceMarker}
      transform={`translate(${pos.x}, ${pos.y})`}
      onClick={onClick}
    >
      {/* Selection ring */}
      {isSelected && (
        <circle r={size + 4} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
      )}
      {/* Device circle */}
      <circle r={size} fill={color} />
      {/* Icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.9}
        className={styles.deviceIcon}
      >
        {device.icon}
      </text>
    </g>
  );
}

export function NetworkPage() {
  const [selectedDevice, setSelectedDevice] = useState<ZigbeeDevice | null>(null);
  const [showLabels, setShowLabels] = useState(false);

  // Count device types
  const deviceCounts = {
    coordinator: ZIGBEE_DEVICES.filter((d) => d.type === 'coordinator').length,
    router: ZIGBEE_DEVICES.filter((d) => d.type === 'router').length,
    endDevice: ZIGBEE_DEVICES.filter((d) => d.type === 'end-device').length,
    total: ZIGBEE_DEVICES.length,
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>📡 Zigbee Network</h1>
        <div className={styles.controls}>
          <button
            className={`${styles.toggleBtn} ${showLabels ? styles.active : ''}`}
            onClick={() => setShowLabels(!showLabels)}
          >
            Labels
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statDot} style={{ background: DEVICE_COLORS.coordinator }} />
          <span>Coordinator: {deviceCounts.coordinator}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statDot} style={{ background: DEVICE_COLORS.router }} />
          <span>Routers: {deviceCounts.router}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statDot} style={{ background: DEVICE_COLORS['end-device'] }} />
          <span>End Devices: {deviceCounts.endDevice}</span>
        </div>
        <div className={styles.statItem}>
          <span>Total: {deviceCounts.total}</span>
        </div>
      </div>

      {/* Floor Plan */}
      <div className={styles.floorPlanContainer}>
        <svg
          viewBox="0 0 240 240"
          className={styles.floorPlan}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Rooms */}
          {FLOOR_PLAN_ROOMS.map((room) => (
            <g key={room.id}>
              {/* Room rectangle */}
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                className={styles.room}
              />
              {/* Room label */}
              <text
                x={room.x + room.width / 2}
                y={room.y + room.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className={styles.roomLabel}
              >
                {room.name}
              </text>
            </g>
          ))}

          {/* Device markers */}
          {ZIGBEE_DEVICES.map((device) => (
            <DeviceMarker
              key={device.id}
              device={device}
              isSelected={selectedDevice?.id === device.id}
              onClick={() =>
                setSelectedDevice(selectedDevice?.id === device.id ? null : device)
              }
            />
          ))}

          {/* Device labels (when enabled) */}
          {showLabels &&
            ZIGBEE_DEVICES.map((device) => {
              const pos = getDevicePosition(device);
              if (!pos) return null;
              return (
                <text
                  key={`label-${device.id}`}
                  x={pos.x}
                  y={pos.y + 18}
                  textAnchor="middle"
                  className={styles.deviceLabel}
                >
                  {device.icon} {device.name.replace(/^\[[^\]]+\]\s*/, '')}
                </text>
              );
            })}
        </svg>
      </div>

      {/* Selected Device Info */}
      {selectedDevice && (
        <div className={styles.deviceInfo}>
          <div className={styles.deviceInfoHeader}>
            <span className={styles.deviceInfoIcon}>{selectedDevice.icon}</span>
            <span className={styles.deviceInfoName}>{selectedDevice.name}</span>
          </div>
          <div className={styles.deviceInfoDetails}>
            <span>Type: {selectedDevice.type}</span>
            <span>Room: {selectedDevice.room}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: DEVICE_COLORS.coordinator }} />
          <span>Coordinator (Dongle)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: DEVICE_COLORS.router }} />
          <span>Router (Mains-powered)</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: DEVICE_COLORS['end-device'] }} />
          <span>End Device (Battery)</span>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>Sonoff Zigbee 3.0 USB Dongle Plus V2</span>
        <span>Tap device for details</span>
      </div>
    </div>
  );
}
