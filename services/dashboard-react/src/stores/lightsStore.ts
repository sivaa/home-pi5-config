/**
 * Lights Store - Zustand store for light control
 *
 * Manages state for IKEA FLOALT lights:
 * - Light on/off state
 * - Brightness (0-254)
 * - Color temperature (250-454, cool to warm)
 * - Syncing state for optimistic updates
 * - Availability status
 */

import { create } from 'zustand';
import { LIGHTS_CONFIG, LIGHT_PRESETS, CONFIG, type LightPreset } from '@/config';
import type { LightState, LightMQTTMessage, AvailabilityMessage, LightCommand } from '@/types';

interface LightsStore {
  // State
  lights: LightState[];
  initializing: boolean;

  // Computed
  anyLightSyncing: () => boolean;
  lightsOnCount: () => number;

  // Actions
  updateLight: (topic: string, data: LightMQTTMessage) => void;
  updateAvailability: (topic: string, data: AvailabilityMessage) => void;

  // Commands (require publish function from MQTT context)
  toggleLight: (lightId: string, publish: (topic: string, payload: unknown) => void) => void;
  toggleAllLights: (publish: (topic: string, payload: unknown) => void) => void;
  setBrightness: (lightId: string, value: number, publish: (topic: string, payload: unknown) => void) => void;
  setColorTemp: (lightId: string, value: number, publish: (topic: string, payload: unknown) => void) => void;
  applyPreset: (lightId: string, preset: LightPreset, publish: (topic: string, payload: unknown) => void) => void;
}

// Initialize lights from config
const initialLights: LightState[] = LIGHTS_CONFIG.map((config) => ({
  id: config.id,
  name: config.name,
  icon: config.icon,
  topic: config.topic,
  state: 'OFF',
  brightness: 254,
  colorTemp: 370,
  linkquality: null,
  lastSeen: null,
  syncing: false,
  available: true,
}));

export const useLightsStore = create<LightsStore>((set, get) => ({
  lights: initialLights,
  initializing: true,

  anyLightSyncing: () => get().lights.some((l) => l.syncing),
  lightsOnCount: () => get().lights.filter((l) => l.state === 'ON' && l.available).length,

  updateLight: (topic: string, data: LightMQTTMessage) => {
    set((state) => ({
      lights: state.lights.map((light) => {
        if (light.topic !== topic) return light;

        return {
          ...light,
          state: data.state ?? light.state,
          brightness: data.brightness ?? light.brightness,
          colorTemp: data.color_temp ?? light.colorTemp,
          linkquality: data.linkquality ?? light.linkquality,
          lastSeen: Date.now(),
          syncing: false,
        };
      }),
      initializing: false,
    }));
  },

  updateAvailability: (topic: string, data: AvailabilityMessage) => {
    set((state) => ({
      lights: state.lights.map((light) => {
        if (light.topic !== topic) return light;
        return {
          ...light,
          available: data.state === 'online',
        };
      }),
    }));
  },

  toggleLight: (lightId: string, publish) => {
    const light = get().lights.find((l) => l.id === lightId);
    if (!light || !light.available) return;

    const newState = light.state === 'ON' ? 'OFF' : 'ON';
    const payload: LightCommand = { state: newState };

    // Optimistic update
    set((state) => ({
      lights: state.lights.map((l) =>
        l.id === lightId ? { ...l, state: newState, syncing: true } : l
      ),
    }));

    // Publish command
    const topic = `${CONFIG.baseTopic}/${light.topic}/set`;
    publish(topic, payload);

    // Clear syncing after timeout if no response
    setTimeout(() => {
      set((state) => ({
        lights: state.lights.map((l) =>
          l.id === lightId && l.syncing ? { ...l, syncing: false } : l
        ),
      }));
    }, 3000);
  },

  toggleAllLights: (publish) => {
    const { lights } = get();
    const availableLights = lights.filter((l) => l.available);
    if (availableLights.length === 0) return;

    const allOn = availableLights.every((l) => l.state === 'ON');
    const newState = allOn ? 'OFF' : 'ON';

    // Optimistic update for all lights
    set((state) => ({
      lights: state.lights.map((l) =>
        l.available ? { ...l, state: newState, syncing: true } : l
      ),
    }));

    // Publish commands
    availableLights.forEach((light) => {
      const topic = `${CONFIG.baseTopic}/${light.topic}/set`;
      publish(topic, { state: newState });
    });

    // Clear syncing after timeout
    setTimeout(() => {
      set((state) => ({
        lights: state.lights.map((l) =>
          l.syncing ? { ...l, syncing: false } : l
        ),
      }));
    }, 3000);
  },

  setBrightness: (lightId: string, value: number, publish) => {
    const light = get().lights.find((l) => l.id === lightId);
    if (!light || !light.available) return;

    const brightness = Math.max(1, Math.min(254, Math.round(value)));

    // Optimistic update
    set((state) => ({
      lights: state.lights.map((l) =>
        l.id === lightId ? { ...l, brightness, syncing: true } : l
      ),
    }));

    // Publish command
    const topic = `${CONFIG.baseTopic}/${light.topic}/set`;
    publish(topic, { brightness });

    // Clear syncing after timeout
    setTimeout(() => {
      set((state) => ({
        lights: state.lights.map((l) =>
          l.id === lightId && l.syncing ? { ...l, syncing: false } : l
        ),
      }));
    }, 3000);
  },

  setColorTemp: (lightId: string, value: number, publish) => {
    const light = get().lights.find((l) => l.id === lightId);
    if (!light || !light.available) return;

    const colorTemp = Math.max(250, Math.min(454, Math.round(value)));

    // Optimistic update
    set((state) => ({
      lights: state.lights.map((l) =>
        l.id === lightId ? { ...l, colorTemp, syncing: true } : l
      ),
    }));

    // Publish command
    const topic = `${CONFIG.baseTopic}/${light.topic}/set`;
    publish(topic, { color_temp: colorTemp });

    // Clear syncing after timeout
    setTimeout(() => {
      set((state) => ({
        lights: state.lights.map((l) =>
          l.id === lightId && l.syncing ? { ...l, syncing: false } : l
        ),
      }));
    }, 3000);
  },

  applyPreset: (lightId: string, presetName: LightPreset, publish) => {
    const light = get().lights.find((l) => l.id === lightId);
    if (!light || !light.available) return;

    const preset = LIGHT_PRESETS[presetName];

    // Optimistic update
    set((state) => ({
      lights: state.lights.map((l) =>
        l.id === lightId
          ? { ...l, brightness: preset.brightness, colorTemp: preset.colorTemp, syncing: true }
          : l
      ),
    }));

    // Publish command
    const topic = `${CONFIG.baseTopic}/${light.topic}/set`;
    publish(topic, {
      brightness: preset.brightness,
      color_temp: preset.colorTemp,
    });

    // Clear syncing after timeout
    setTimeout(() => {
      set((state) => ({
        lights: state.lights.map((l) =>
          l.id === lightId && l.syncing ? { ...l, syncing: false } : l
        ),
      }));
    }, 3000);
  },
}));
