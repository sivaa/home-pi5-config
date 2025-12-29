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
    },
    {
      measurement: 'tts_events',
      fields: {
        message: Influx.FieldType.STRING,
        success: Influx.FieldType.BOOLEAN,
        all_available: Influx.FieldType.BOOLEAN,
        devices_available: Influx.FieldType.INTEGER,
        devices_total: Influx.FieldType.INTEGER,
        devices_json: Influx.FieldType.STRING
      },
      tags: [
        'automation',  // Parent automation ID (e.g., co2_high_alert)
        'status'       // success, partial, all_failed
      ]
    },
    {
      measurement: 'hot_water',
      fields: {
        running: Influx.FieldType.BOOLEAN
      },
      tags: [
        'device_name'
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
    }
  });

  // Subscribe to TTS events (for persistent logging)
  const ttsTopic = CONFIG.tts.topic;
  console.log(`Subscribing to ${ttsTopic}...`);
  client.subscribe(ttsTopic, { qos: 0 }, (err) => {
    if (err) {
      console.error('Subscribe error (tts):', err);
    } else {
      console.log('Subscribed to TTS events');
    }
  });

  // Subscribe to hot water vibration sensor (for usage tracking)
  const hotWaterTopic = 'zigbee2mqtt/Vibration Sensor';
  console.log(`Subscribing to ${hotWaterTopic}...`);
  client.subscribe(hotWaterTopic, { qos: 0 }, (err) => {
    if (err) {
      console.error('Subscribe error (hot_water):', err);
    } else {
      console.log('Subscribed to Hot Water sensor');
      console.log('');
      console.log('Listening for Zigbee, audit, TTS, and hot water events...');
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

    // Route TTS messages to TTS handler (persistent logging)
    if (topic === CONFIG.tts.topic) {
      await writeTTSEvent(payload);
      return;
    }

    // Route hot water vibration sensor messages
    if (topic === 'zigbee2mqtt/Vibration Sensor' && typeof payload === 'object' && payload.vibration !== undefined) {
      await writeHotWaterEvent(payload);
      return;
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
 * Write TTS event to InfluxDB
 */
async function writeTTSEvent(payload) {
  try {
    // Count available devices
    const devices = payload.devices || [];
    const devicesAvailable = devices.filter(d => d.available).length;
    const devicesTotal = devices.length;

    // Determine status tag
    let status = 'success';
    if (!payload.success) {
      status = 'all_failed';
    } else if (!payload.all_available) {
      status = 'partial';
    }

    // Write to InfluxDB
    await influx.writePoints([{
      measurement: CONFIG.tts.measurement,
      tags: {
        automation: payload.automation || 'unknown',
        status: status
      },
      fields: {
        message: payload.message || '',
        success: payload.success === true,
        all_available: payload.all_available === true,
        devices_available: devicesAvailable,
        devices_total: devicesTotal,
        devices_json: JSON.stringify(devices)
      },
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date()
    }]);

    stats.eventsWritten++;

    // Log TTS event
    const icon = status === 'all_failed' ? '🔇' : status === 'partial' ? '🔈' : '🔊';
    const shortMsg = (payload.message || '').substring(0, 40);
    console.log(
      `${icon} [TTS] ${payload.automation || 'unknown'}: "${shortMsg}..." ` +
      `(${devicesAvailable}/${devicesTotal} devices)`
    );
  } catch (err) {
    console.error('TTS write error:', err.message);
    stats.errors++;
  }
}

/**
 * Write hot water event to InfluxDB
 */
async function writeHotWaterEvent(payload) {
  try {
    const running = payload.vibration === true;

    await influx.writePoints([{
      measurement: 'hot_water',
      tags: {
        device_name: 'Vibration Sensor'
      },
      fields: {
        running: running
      },
      timestamp: new Date()
    }]);

    stats.eventsWritten++;

    // Log hot water event
    const icon = running ? '🚿' : '💧';
    console.log(`${icon} [Hot Water] running=${running}`);
  } catch (err) {
    console.error('Hot water write error:', err.message);
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
