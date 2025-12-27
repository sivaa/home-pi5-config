import mqtt from 'mqtt';
import Influx from 'influx';
import { CONFIG } from './config.js';
import { EventProcessor } from './event-processor.js';

// ASCII art banner
console.log(`
┌─────────────────────────────────────────────────────────────┐
│           MQTT → InfluxDB Event Bridge                      │
│                                                             │
│  Capturing Zigbee events for timeline dashboard             │
└─────────────────────────────────────────────────────────────┘
`);

// Initialize InfluxDB client
const influx = new Influx.InfluxDB({
  host: new URL(CONFIG.influx.url).hostname,
  port: new URL(CONFIG.influx.url).port || 8086,
  database: CONFIG.influx.database,
  schema: [
    {
      measurement: 'zigbee_events',
      fields: {
        value: Influx.FieldType.FLOAT,
        state: Influx.FieldType.STRING,
        brightness: Influx.FieldType.INTEGER
      },
      tags: [
        'device_name',
        'device_type',
        'room',
        'event_type',
        'source'  // Track where the change came from (Dashboard, External)
      ]
    }
  ]
});

// Initialize event processor
const processor = new EventProcessor();

// Stats tracking
const stats = {
  messagesReceived: 0,
  eventsWritten: 0,
  errors: 0,
  startTime: Date.now()
};

// Connect to MQTT
console.log(`Connecting to MQTT at ${CONFIG.mqtt.url}...`);
const client = mqtt.connect(CONFIG.mqtt.url, {
  clientId: `mqtt-influx-bridge-${Date.now()}`,
  clean: true,
  reconnectPeriod: 5000
});

client.on('connect', () => {
  console.log('Connected to MQTT broker');

  // Subscribe to Zigbee events
  console.log(`Subscribing to ${CONFIG.mqtt.topic}...`);
  client.subscribe(CONFIG.mqtt.topic, { qos: 0 }, (err) => {
    if (err) {
      console.error('Subscribe error (zigbee):', err);
    } else {
      console.log('Subscribed to Zigbee events');
    }
  });

  // Subscribe to Dashboard audit events (for source tracking)
  const auditTopic = 'dashboard/audit/#';
  console.log(`Subscribing to ${auditTopic}...`);
  client.subscribe(auditTopic, { qos: 0 }, (err) => {
    if (err) {
      console.error('Subscribe error (audit):', err);
    } else {
      console.log('Subscribed to Dashboard audit events');
      console.log('');
      console.log('Listening for Zigbee and audit events...');
      console.log('─'.repeat(60));
    }
  });
});

client.on('message', async (topic, message) => {
  stats.messagesReceived++;

  try {
    // Parse message
    let payload;
    const messageStr = message.toString();

    // Handle simple string payloads (like availability: "online")
    try {
      payload = JSON.parse(messageStr);
    } catch {
      payload = messageStr;
    }

    // Route audit messages to audit processor (for source tracking)
    if (topic.startsWith('dashboard/audit/')) {
      processor.processAuditMessage(topic, payload);
      return;  // Audit messages don't generate events
    }

    // Process Zigbee message into events
    const events = processor.processMessage(topic, payload);

    if (events.length > 0) {
      // Write to InfluxDB
      await writeEvents(events);

      // Log events
      for (const event of events) {
        const icon = getEventIcon(event.tags.event_type);
        console.log(
          `${icon} [${event.tags.room}] ${event.tags.device_name}: ` +
          `${event.tags.event_type} (${event.fields.state})`
        );
      }
    }
  } catch (err) {
    stats.errors++;
    if (CONFIG.logLevel === 'debug') {
      console.error(`Error processing ${topic}:`, err.message);
    }
  }
});

client.on('error', (err) => {
  console.error('MQTT error:', err);
  stats.errors++;
});

client.on('close', () => {
  console.log('MQTT connection closed');
});

client.on('reconnect', () => {
  console.log('Reconnecting to MQTT...');
});

/**
 * Write events to InfluxDB
 */
async function writeEvents(events) {
  try {
    await influx.writePoints(events.map(event => ({
      measurement: event.measurement,
      tags: event.tags,
      fields: event.fields,
      timestamp: event.timestamp
    })));
    stats.eventsWritten += events.length;
  } catch (err) {
    console.error('InfluxDB write error:', err.message);
    stats.errors++;
  }
}

/**
 * Get icon for event type
 */
function getEventIcon(eventType) {
  const icons = {
    motion_detected: '👁️ ',
    motion_cleared: '👁️ ',
    door_opened: '🚪',
    door_closed: '🚪',
    light_on: '💡',
    light_off: '💡',
    plug_on: '🔌',
    plug_off: '🔌',
    co2_reading: '💨',
    air_quality_excellent: '🌿',
    air_quality_moderate: '💨',
    air_quality_poor: '⚠️ ',
    device_online: '📡',
    device_offline: '📡',
    remote_toggle: '🎮',
    remote_brightness_up_click: '🎮',
    remote_brightness_down_click: '🎮',
    // Thermostat events
    heating_started: '🔥',
    heating_stopped: '❄️',
    setpoint_changed: '🎯',
    mode_changed_heat: '🔥',
    mode_changed_off: '⛔'
  };
  return icons[eventType] || '📍';
}

/**
 * Print stats periodically
 */
setInterval(() => {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  const mins = Math.floor(uptime / 60);
  const secs = uptime % 60;

  console.log('─'.repeat(60));
  console.log(
    `Stats: ${stats.eventsWritten} events written | ` +
    `${stats.messagesReceived} messages | ` +
    `${stats.errors} errors | ` +
    `Uptime: ${mins}m ${secs}s`
  );
  console.log('─'.repeat(60));
}, 300000);  // Every 5 minutes

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  client.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  client.end();
  process.exit(0);
});

console.log(`InfluxDB: ${CONFIG.influx.url}/${CONFIG.influx.database}`);
console.log('');
