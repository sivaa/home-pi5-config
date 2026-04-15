/**
 * Lights Store
 * Manages IKEA FLOALT light control
 */

export function initLightsStore(Alpine, CONFIG) {
  Alpine.store('lights', {
    list: [
      {
        id: 'study_light',
        name: 'Study Room',
        icon: '📚',
        topic: '[Study] IKEA Light',
        state: 'OFF',
        brightness: 254,
        colorTemp: 370,
        colorTempMin: 250,   // IKEA FLOALT: 250-454 mired (2200K-4000K)
        colorTempMax: 454,
        supportsColor: false,
        hue: 0,
        saturation: 100,
        linkquality: null,
        lastSeen: null,
        syncing: false,
        available: true
      },
      {
        id: 'living_light',
        name: 'Living Room',
        icon: '🛋️',
        topic: '[Living] IKEA Light',
        state: 'OFF',
        brightness: 254,
        colorTemp: 370,
        colorTempMin: 250,   // IKEA FLOALT: 250-454 mired (2200K-4000K)
        colorTempMax: 454,
        supportsColor: false,
        hue: 0,
        saturation: 100,
        linkquality: null,
        lastSeen: null,
        syncing: false,
        available: true
      },
      {
        id: 'bath_light',
        name: 'Bathroom',
        icon: '🛁',
        topic: '[Bath] Light',
        state: 'OFF',
        brightness: 254,
        colorTemp: 370,
        colorTempMin: 153,   // AwoX 33955: 153-370 mired (2703K-6536K)
        colorTempMax: 370,
        supportsColor: false,
        hue: 0,
        saturation: 100,
        linkquality: null,
        lastSeen: null,
        syncing: false,
        available: true
      },
      {
        id: 'bed_light',
        name: 'Bedroom',
        icon: '🛏️',
        topic: '[Bed] Light',
        state: 'OFF',
        brightness: 254,
        colorTemp: 370,
        colorTempMin: 153,   // EGLO Rovito-Z (AwoX EBF_RGB_Zm): 153-370 mired
        colorTempMax: 370,
        supportsColor: true, // EGLO Rovito-Z has full RGB alongside CCT
        hue: 0,
        saturation: 100,
        linkquality: null,
        lastSeen: null,
        syncing: false,
        available: true
      },
      {
        id: 'hallway_light',
        name: 'Hallway',
        icon: '🚪',
        topic: '[Hallway] Light',
        // Aqara T1M (lumi.light.acn032) is a multi-endpoint device: 'white' is
        // the main CCT ceiling ring, 'rgb' is a secondary ambient strip. We
        // expose the white ring as the primary control surface. Z2M publishes
        // state as state_white / brightness_white / color_temp_white on the
        // parent topic — propSuffix tells the store to translate to/from those
        // suffixed property names.
        propSuffix: 'white',
        state: 'OFF',
        brightness: 254,
        colorTemp: 370,
        colorTempMin: 153,   // Aqara T1M white ring: 153-370 mired
        colorTempMax: 370,
        supportsColor: false,
        hue: 0,
        saturation: 100,
        linkquality: null,
        lastSeen: null,
        syncing: false,
        available: true
      }
    ],
    syncing: false,
    initializing: true,

    get anyLightSyncing() {
      return this.list.some(l => l.syncing);
    },

    get lightsOnCount() {
      return this.list.filter(l => l.state === 'ON' && l.available).length;
    },

    presets: {
      reading: { brightness: 254, colorTemp: 300 },
      relax: { brightness: 150, colorTemp: 400 },
      bright: { brightness: 254, colorTemp: 250 },
      night: { brightness: 30, colorTemp: 454 }
    },

    scenes: {
      movie: { state: 'ON', brightness: 50, colorTemp: 400 },
      work: { state: 'ON', brightness: 254, colorTemp: 280 },
      evening: { state: 'ON', brightness: 150, colorTemp: 380 },
      goodnight: { state: 'OFF' }
    },

    updateLight(topic, data) {
      const light = this.list.find(l => l.topic === topic);
      if (light) {
        const s = light.propSuffix;
        const stateKey = s ? `state_${s}` : 'state';
        const brightKey = s ? `brightness_${s}` : 'brightness';
        const ctKey = s ? `color_temp_${s}` : 'color_temp';
        const colorKey = s ? `color_${s}` : 'color';
        if (data[stateKey] !== undefined) light.state = data[stateKey];
        if (data[brightKey] !== undefined) light.brightness = data[brightKey];
        if (data[ctKey] !== undefined) light.colorTemp = data[ctKey];
        if (data.linkquality !== undefined) light.linkquality = data.linkquality;
        // Color (HS) — only applies to lights with supportsColor
        if (light.supportsColor && data[colorKey]) {
          if (data[colorKey].hue !== undefined) light.hue = data[colorKey].hue;
          if (data[colorKey].saturation !== undefined) light.saturation = data[colorKey].saturation;
        }
        light.lastSeen = Date.now();
        light.syncing = false;
        this.initializing = false;
        this.syncing = this.anyLightSyncing;
      }
    },

    updateAvailability(topic, data) {
      const light = this.list.find(l => l.topic === topic);
      if (light) {
        light.available = data.state === 'online';
      }
    },

    publishCommand(light, payload) {
      const client = Alpine.store('mqtt').client;
      if (!client || !Alpine.store('mqtt').connected) {
        console.error('MQTT not connected');
        return;
      }

      // Set syncing state
      light.syncing = true;
      this.syncing = true;

      // For multi-endpoint devices (e.g. Aqara T1M), Z2M expects suffixed
      // property names on the parent set topic: state → state_white, etc.
      const s = light.propSuffix;
      const outPayload = s
        ? Object.fromEntries(Object.entries(payload).map(([k, v]) => [`${k}_${s}`, v]))
        : payload;

      const topic = `zigbee2mqtt/${light.topic}/set`;
      client.publish(topic, JSON.stringify(outPayload), { qos: 0 }, (err) => {
        if (err) {
          console.error('Failed to publish:', err);
          light.syncing = false;
          this.syncing = this.anyLightSyncing;
        } else {
          // Syncing will be cleared when we receive the state update
          // Set a timeout to clear syncing if no response
          setTimeout(() => {
            if (light.syncing) {
              light.syncing = false;
              this.syncing = this.anyLightSyncing;
            }
          }, 3000);
        }
      });
    },

    toggleLight(light) {
      if (!light.available) return; // Don't toggle unavailable lights
      const newState = light.state === 'ON' ? 'OFF' : 'ON';
      this.publishCommand(light, { state: newState });
      light.state = newState; // Optimistic update
    },

    toggleAllLights() {
      const availableLights = this.list.filter(l => l.available);
      if (availableLights.length === 0) return;
      const allOn = availableLights.every(l => l.state === 'ON');
      const newState = allOn ? 'OFF' : 'ON';
      availableLights.forEach(light => {
        this.publishCommand(light, { state: newState });
        light.state = newState;
      });
    },

    setBrightness(light, value) {
      const brightness = parseInt(value);
      this.publishCommand(light, { brightness });
    },

    setColorTemp(light, value) {
      const colorTemp = parseInt(value);
      this.publishCommand(light, { color_temp: colorTemp });
    },

    setHue(light, value) {
      if (!light.supportsColor) return;
      const hue = parseInt(value);
      light.hue = hue;
      this.publishCommand(light, { color: { hue, saturation: light.saturation } });
    },

    setColorPreset(light, hue, saturation) {
      if (!light.supportsColor) return;
      light.hue = hue;
      light.saturation = saturation;
      this.publishCommand(light, { color: { hue, saturation } });
    },

    applyPreset(light, presetName) {
      const preset = this.presets[presetName];
      if (preset) {
        this.publishCommand(light, {
          brightness: preset.brightness,
          color_temp: preset.colorTemp
        });
        light.brightness = preset.brightness;
        light.colorTemp = preset.colorTemp;
      }
    },

    applyScene(sceneName) {
      const scene = this.scenes[sceneName];
      if (scene) {
        this.list.forEach(light => {
          this.publishCommand(light, scene);
          if (scene.state !== undefined) light.state = scene.state;
          if (scene.brightness !== undefined) light.brightness = scene.brightness;
          if (scene.colorTemp !== undefined) light.colorTemp = scene.colorTemp;
        });
      }
    }
  });
}
