// External converter: TEST writing to colorPointRGBIntensity attributes
// on the EGLO Rovito-Z (EBF_RGB_Zm) to see if we can dim the backlight
// independently of the main CCT ring.
//
// Discovered 2026-04-15 via probe2 that cluster 0x0300 exposes:
//   0x0034 colorPointRIntensity = 255
//   0x0038 colorPointGIntensity = 255
//   0x003c colorPointBIntensity = 255
//
// These are ZCL ZLL spec calibration attributes. We want to know if the
// lamp lets us write them dynamically and whether that dims the backlight
// in proportion.
//
// Usage (MQTT):
//   {"awox_set_rgb_intensity": 128}   # set all three to 128
//   {"awox_set_rgb_intensity": 0}     # off
//   {"awox_set_rgb_intensity": 255}   # restore factory
//
// To read current values after a write:
//   {"awox_read_rgb_intensity": ""}

const m = require('zigbee-herdsman-converters/lib/modernExtend');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const e = exposes.presets;
const ea = exposes.access;

const CLUSTER_COLOR_CTRL = 0x0300;
const ATTR_R_INT = 0x0034;
const ATTR_G_INT = 0x0038;
const ATTR_B_INT = 0x003c;
const MFG_AWOX = 0x1135;

const tzSetRgbIntensity = {
    key: ['awox_set_rgb_intensity'],
    convertSet: async (entity, key, value, meta) => {
        const device = meta.device;
        const logger = meta.logger || console;
        const ep1 = device.getEndpoint(1);
        if (!ep1) { logger.warn('[AWOX_RGB] no ep1'); return; }
        const v = parseInt(value);
        if (isNaN(v) || v < 0 || v > 255) {
            logger.warn(`[AWOX_RGB] invalid value ${value}, must be 0..255`);
            return;
        }
        logger.info(`[AWOX_RGB] writing R/G/B intensity = ${v}`);
        try {
            await ep1.write(CLUSTER_COLOR_CTRL, {0x0034: {value: v, type: 0x20}}, {manufacturerCode: MFG_AWOX});
            logger.info('[AWOX_RGB] colorPointRIntensity write OK');
        } catch (err) { logger.info(`[AWOX_RGB] colorPointRIntensity write: ${err.message}`); }
        try {
            await ep1.write(CLUSTER_COLOR_CTRL, {0x0038: {value: v, type: 0x20}}, {manufacturerCode: MFG_AWOX});
            logger.info('[AWOX_RGB] colorPointGIntensity write OK');
        } catch (err) { logger.info(`[AWOX_RGB] colorPointGIntensity write: ${err.message}`); }
        try {
            await ep1.write(CLUSTER_COLOR_CTRL, {0x003c: {value: v, type: 0x20}}, {manufacturerCode: MFG_AWOX});
            logger.info('[AWOX_RGB] colorPointBIntensity write OK');
        } catch (err) { logger.info(`[AWOX_RGB] colorPointBIntensity write: ${err.message}`); }
        return {state: {awox_set_rgb_intensity: v}};
    },
};

const tzReadRgbIntensity = {
    key: ['awox_read_rgb_intensity'],
    convertSet: async (entity, key, value, meta) => {
        const device = meta.device;
        const logger = meta.logger || console;
        const ep1 = device.getEndpoint(1);
        if (!ep1) { logger.warn('[AWOX_RGB] no ep1'); return; }
        try {
            const r = await ep1.read(CLUSTER_COLOR_CTRL, [0x0034, 0x0038, 0x003c], {manufacturerCode: MFG_AWOX});
            logger.info(`[AWOX_RGB] read: ${JSON.stringify(r)}`);
            return {state: {awox_read_rgb_intensity: JSON.stringify(r)}};
        } catch (err) { logger.info(`[AWOX_RGB] read error: ${err.message}`); }
    },
};

const definition = {
    zigbeeModel: ['EBF_RGB_Zm'],
    model: '900087',
    vendor: 'EGLO',
    description: 'Rovito-Z ceiling light (probe3 — test writes to colorPoint*Intensity)',
    extend: [
        m.light({colorTemp: {range: [153, 370]}, color: {modes: ['xy', 'hs']}}),
        m.commandsOnOff(),
    ],
    toZigbee: [tzSetRgbIntensity, tzReadRgbIntensity],
    exposes: [
        e.numeric('awox_set_rgb_intensity', ea.SET).withValueMin(0).withValueMax(255).withDescription('Write colorPointR/G/BIntensity'),
        e.text('awox_read_rgb_intensity', ea.SET).withDescription('Read colorPointR/G/BIntensity'),
    ],
};

module.exports = definition;
