# Dashboard React - AI Context

```
╔══════════════════════════════════════════════════════════════════╗
║  🛑 ON HOLD — NOT USED, NOT MAINTAINED  (as of 2026-04-15)       ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  This React rewrite is PAUSED. All active development and       ║
║  feature work happens in the classic Alpine.js dashboard at:    ║
║                                                                  ║
║      services/dashboard/www/                                     ║
║                                                                  ║
║  Do NOT update this React codebase for new features unless the  ║
║  user explicitly revives it. When adding Zigbee devices, config ║
║  changes, or bug fixes, ONLY modify the classic dashboard.      ║
║                                                                  ║
║  The `/v2/` URL on the Pi may still serve stale builds; that's  ║
║  fine — it is not the production surface.                       ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

This file provides historical context for the paused React rewrite.

## Project Overview

React + TypeScript rewrite of the Alpine.js dashboard. Serves as `/v2/` alongside the original dashboard.

```
┌─────────────────────────────────────────────────────────────────┐
│  ARCHITECTURE                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser                                                        │
│    ├── React 18 + TypeScript                                    │
│    ├── Zustand (state management)                               │
│    ├── MQTT.js (real-time data)                                 │
│    └── CSS Modules (scoped styles)                              │
│                                                                 │
│  Build: Vite 5 → static export                                  │
│  Deploy: scp to Pi → nginx serves /v2/                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Patterns

### MQTT Central Dispatcher

Single connection, multiple handlers. Components subscribe via hook:

```typescript
// In a component or custom hook
const { subscribe, publish, connected } = useMQTT();

useEffect(() => {
  return subscribe('zigbee2mqtt/[Study] Light', (topic, data) => {
    // Handle message
  });
}, [subscribe]);
```

### Zustand Stores

Each domain has its own store. Stores receive `publish` function for commands:

```typescript
// Store actions take publish as parameter
toggleLight: (lightId, publish) => {
  // Optimistic update
  set(state => ({ ... }));
  // Publish MQTT command
  publish(topic, payload);
}
```

### CSS Performance Rules

From Pi testing - these cause high CPU:
- NO `backdrop-filter: blur()`
- NO `animation: ... infinite`
- Single `box-shadow` only, max 10px blur
- Use `transform` and `opacity` for animations

## File Structure

```
src/
├── main.tsx              # Entry point
├── App.tsx               # Main app component
├── providers/
│   └── MQTTProvider.tsx  # MQTT connection + dispatch
├── stores/
│   └── lightsStore.ts    # Light state + actions
├── hooks/
│   └── useLightsMQTT.ts  # Connects store to MQTT
├── components/
│   └── lights/
│       ├── LightCard.tsx
│       └── LightCard.module.css
├── config/
│   └── index.ts          # Centralized config
├── types/
│   └── index.ts          # TypeScript types
└── styles/
    └── globals.css       # Global styles + CSS vars
```

## Development

```bash
# Install dependencies
cd services/dashboard-react
npm install

# Start dev server (connects to Pi MQTT)
npm run dev
# Open http://localhost:5173

# Build for production
npm run build

# Deploy to Pi
scp -r dist/* pi@pi:/opt/dashboard/www/v2/
```

## MQTT Topics

| Topic | Component | Action |
|-------|-----------|--------|
| `zigbee2mqtt/[Study] IKEA Light` | LightCard | Update state |
| `zigbee2mqtt/[Living] IKEA Light` | LightCard | Update state |
| `zigbee2mqtt/*/availability` | LightCard | Online/offline |

## Session Continuity

See `PROGRESS.md` for current status and next steps.

## Original Dashboard Reference

The Alpine.js dashboard is at `../dashboard/www/`. Key reference files:
- `js/stores/lights-store.js` - Original lights implementation
- `js/config.js` - All device configurations
- `js/stores/mqtt-store.js` - MQTT dispatcher pattern
