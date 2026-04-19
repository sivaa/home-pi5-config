// External converter: add `network_indicator` toggle to SONOFF S60ZBTPF smart plug.
//
// The built-in converter for S60ZBTPF in zigbee-herdsman-converters does NOT expose
// the blue network-status LED control, even though the device firmware implements it
// (attribute 0x0001 `networkLed` on the custom eWeLink cluster 0xFC11). The sibling
// device ZBMINIR2 already exposes this same attribute as a user-facing binary - we
// replicate that pattern here.
//
// Approach: pull the built-in S60ZBTPF definition from zigbee-herdsman-converters and
// append a single modernExtend binary to its `extend` array. This preserves every
// other feature (on/off, metering, inching_control_set, overload_protection, etc).
//
// After deploying this file to /opt/zigbee2mqtt/data/external_converters/ and
// restarting Z2M via `sudo systemctl restart zigbee2mqtt`, each of the 3 S60ZBTPF
// plugs will expose a "Network indicator" toggle under Settings (specific).
//
// Disable LED on a specific plug via MQTT:
//   docker exec mosquitto mosquitto_pub -h localhost \
//     -t 'zigbee2mqtt/Smart Plug [1]/set' \
//     -m '{"network_indicator": "OFF"}'
//
// Verify the device actually honored the write:
//   docker exec mosquitto mosquitto_pub -h localhost \
//     -t 'zigbee2mqtt/Smart Plug [1]/get' \
//     -m '{"network_indicator": ""}'
//
// If the write succeeds but the LED stays on, the firmware doesn't honor the
// attribute and we fall back to electrical tape.

const {definitions} = require('zigbee-herdsman-converters/devices/sonoff');
const m = require('zigbee-herdsman-converters/lib/modernExtend');

const original = definitions.find(
    (d) => d.zigbeeModel && d.zigbeeModel.includes('S60ZBTPF'),
);

if (!original) {
    throw new Error('[s60zbtpf-network-indicator] could not find built-in S60ZBTPF definition');
}

const definition = {
    ...original,
    extend: [
        ...original.extend,
        m.binary({
            name: 'network_indicator',
            cluster: 'customClusterEwelink',
            attribute: 'networkLed',
            description: 'Turn the blue network-status LED on or off. Set OFF to stop it from emitting light in bedrooms at night.',
            entityCategory: 'config',
            valueOff: [false, 0],
            valueOn: [true, 1],
        }),
    ],
};

module.exports = definition;
