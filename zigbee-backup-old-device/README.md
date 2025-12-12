# Zigbee Smart Home Control

Control IKEA TRADFRI lights with a 5-button remote via Zigbee.

```
┌───────────────────────────────────────────────────────┐
│                   ARCHITECTURE                        │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │  Mosquitto  │◄──►│ Zigbee2MQTT │◄──►│ ZBDongle  │ │
│  │    MQTT     │    │   Gateway   │    │   (USB)   │ │
│  └──────┬──────┘    └─────────────┘    └─────┬─────┘ │
│         │                                    │       │
│  ┌──────▼──────┐                      Zigbee │       │
│  │   Remote    │              ┌──────────────┼─────┐ │
│  │   Bridge    │              │              │     │ │
│  └─────────────┘         ┌────▼────┐   ┌────▼────┐ │ │
│                          │  IKEA   │   │  IKEA   │ │ │
│                          │  Light  │   │ Remote  │ │ │
│                          └─────────┘   └─────────┘ │ │
└───────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
brew install mosquitto node@22
brew services start mosquitto

# 2. Setup Python environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 3. Install zigbee2mqtt dependencies
cd zigbee2mqtt && npm install && npm run build && cd ..

# 4. Start everything
./restart.sh

# 5. Open web UI
open http://localhost:8080
```

## Hardware

| Device | Model | Purpose |
|--------|-------|---------|
| Coordinator | Sonoff ZBDongle-E | USB Zigbee adapter |
| Light | IKEA FLOALT (L1527) | LED panel with color temp |
| Remote | IKEA TRADFRI (E1524/E1810) | 5-button remote |

## Remote Controls

```
          ┌─────────────────┐
          │       DIM       │  Brightness +
          │       UP        │  (Hold = MAX)
          ├─────────────────┤
    ◄─────│     TOGGLE      │─────►
   COOL   │   (ON/OFF)      │   WARM
          ├─────────────────┤
          │       DIM       │  Brightness -
          │      DOWN       │  (Hold = MIN)
          └─────────────────┘

Left/Right: Cycle color temps
Hold Left:  Jump to COOL
Hold Right: Jump to WARM
Hold Toggle: Reading mode preset
```

## Project Structure

```
zigbee/
├── restart.sh              # Start all services
├── remote_bridge.py        # Remote → Light bridge
├── requirements.txt        # Python dependencies
└── zigbee2mqtt/
    └── data/
        └── configuration.yaml  # Zigbee config
```

## Commands

```bash
# Start services
./restart.sh

# Stop services
pkill -f zigbee2mqtt && pkill -f remote_bridge

# View logs
tail -f logs/zigbee2mqtt.log
tail -f logs/remote_bridge.log
```

## Troubleshooting

**USB device not found:**
```bash
ls /dev/cu.usbserial-*
# Update port in zigbee2mqtt/data/configuration.yaml
```

**Services won't start:**
```bash
# Check if mosquitto is running
brew services list | grep mosquitto

# Check Node.js version (needs v18+)
node --version
```
