// External converter: probe AwoX proprietary cluster on EGLO Rovito-Z (EBF_RGB_Zm)
//
// Purpose: discover if cluster 0xFC57 (64599) on endpoint 1 exposes any
// readable attributes under manufacturer code 0x1135 (AwoX / 4417). If we
// find a "backlight level" or "backlight enable" attribute here, we can
// write independent backlight control without needing a Zigbee sniffer.
//
// Usage (MQTT):
//   zigbee2mqtt/[Bed] Light/set  {"awox_probe": "go"}
//
// The converter iterates attribute IDs 0x0000..0x001F on cluster 0xFC57
// (endpoint 1) and also 0x0000..0x0007 on clusters 0xFF50 / 0xFF51
// (endpoint 3, AwoX private profile 0x128F). Results are logged with
// the [AWOX_PROBE] prefix so they're easy to grep.
//
// Safe to delete after the probe is done: remove from configuration.yaml
// external_converters list and remove this file.

const m = require('zigbee-herdsman-converters/lib/modernExtend');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;

const MFG_AWOX = 0x1135; // 4417

async function probeRange(endpoint, cluster, startAttr, endAttr, logger) {
    for (let attr = startAttr; attr <= endAttr; attr++) {
        try {
            const result = await endpoint.read(cluster, [attr], {manufacturerCode: MFG_AWOX});
            logger.info(`[AWOX_PROBE] ep${endpoint.ID} cluster 0x${cluster.toString(16)} attr 0x${attr.toString(16).padStart(4, '0')}: OK ${JSON.stringify(result)}`);
        } catch (err) {
            // UNSUPPORTED_ATTRIBUTE is the expected "not here" response
            // Anything else is interesting (e.g. a missing cluster returns NOT_FOUND differently)
            const msg = (err && err.message) ? err.message.substring(0, 120) : String(err);
            logger.debug(`[AWOX_PROBE] ep${endpoint.ID} cluster 0x${cluster.toString(16)} attr 0x${attr.toString(16).padStart(4, '0')}: ${msg}`);
        }
    }
}

const tzAwoxProbe = {
    key: ['awox_probe'],
    convertSet: async (entity, key, value, meta) => {
        const device = meta.device;
        const logger = meta.logger || console;
        logger.info('[AWOX_PROBE] Starting probe on ' + (device.ieeeAddr || '?'));

        const ep1 = device.getEndpoint(1);
        const ep3 = device.getEndpoint(3);

        if (ep1) {
            logger.info('[AWOX_PROBE] --- endpoint 1, cluster 0xFC57 (64599) ---');
            await probeRange(ep1, 0xFC57, 0x0000, 0x001F, logger);
        } else {
            logger.warn('[AWOX_PROBE] endpoint 1 not found');
        }

        if (ep3) {
            logger.info('[AWOX_PROBE] --- endpoint 3, cluster 0xFF50 (65360) ---');
            await probeRange(ep3, 0xFF50, 0x0000, 0x000F, logger);
            logger.info('[AWOX_PROBE] --- endpoint 3, cluster 0xFF51 (65361) ---');
            await probeRange(ep3, 0xFF51, 0x0000, 0x000F, logger);
        } else {
            logger.warn('[AWOX_PROBE] endpoint 3 not found');
        }

        logger.info('[AWOX_PROBE] Probe complete. Grep "AWOX_PROBE" in Z2M logs for results.');
        return {state: {awox_probe: 'done'}};
    },
};

const definition = {
    zigbeeModel: ['EBF_RGB_Zm'],
    model: '900087',
    vendor: 'EGLO',
    description: 'Rovito-Z ceiling light (probe build — exposes AwoX cluster probe action)',
    extend: [
        m.light({colorTemp: {range: [153, 370]}, color: {modes: ['xy', 'hs']}}),
        m.commandsOnOff(),
    ],
    toZigbee: [tzAwoxProbe],
    exposes: [
        e.text('awox_probe', ea.SET).withDescription('Send any value to probe the AwoX proprietary cluster and log results'),
    ],
};

module.exports = definition;
