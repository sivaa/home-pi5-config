# Smart Home Documentation

> Complete guide to recreate this Zigbee smart home system from scratch.

```
                         SYSTEM OVERVIEW
    ┌──────────────────────────────────────────────────────────┐
    │                                                          │
    │    ┌─────────┐     ┌──────────┐     ┌─────────────┐     │
    │    │ Zigbee  │────►│  MQTT    │────►│    Home     │     │
    │    │ Devices │     │ Broker   │     │  Assistant  │     │
    │    └─────────┘     └──────────┘     └──────┬──────┘     │
    │         │                                   │            │
    │         │         Raspberry Pi 3B+         │            │
    │         │           (DietPi)               │            │
    │    ┌────┴────┐                      ┌──────┴──────┐     │
    │    │Zigbee2  │                      │ Cloudflare  │     │
    │    │  MQTT   │                      │   Tunnel    │     │
    │    └─────────┘                      └──────┬──────┘     │
    │                                            │            │
    └────────────────────────────────────────────│────────────┘
                                                 │
                           ┌─────────────────────┼─────────────────────┐
                           │                     │                     │
                           ▼                     ▼                     ▼
                    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
                    │   Google    │      │    Web      │      │   Mobile    │
                    │  Assistant  │      │   Access    │      │    App      │
                    │   (Voice)   │      │(ha.sivaa.in)│      │             │
                    └─────────────┘      └─────────────┘      └─────────────┘
```

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Hardware Setup](./01-hardware-setup.md) | Required hardware and initial Pi setup |
| [Docker Services](./02-docker-services.md) | All Docker containers and configurations |
| [Zigbee2MQTT Config](./03-zigbee2mqtt-config.md) | Zigbee gateway configuration |
| [Home Assistant Config](./04-home-assistant-config.md) | Home automation platform setup |
| [Cloudflare Tunnel](./05-cloudflare-tunnel.md) | External HTTPS access setup |
| [Google Assistant](./06-google-assistant.md) | Voice control integration |
| [Device Reference](./07-device-reference.md) | All paired devices and how to pair new ones |
| [Troubleshooting](./08-troubleshooting.md) | Common issues and solutions |
| [Grafana Visualization](./09-grafana-visualization.md) | Historical data charts in Grafana |
| [Custom Dashboard](./10-custom-dashboard.md) | Real-time kiosk display |

---

## Quick Start (TL;DR)

```bash
# 1. Clone to Pi
ssh root@dietpi.local
git clone <repo> ~/zigbee
cd ~/zigbee

# 2. Start services
docker compose up -d

# 3. Configure MQTT in HA UI
# http://dietpi.local:8123 → Settings → Add Integration → MQTT

# 4. Start Cloudflare tunnel
systemctl start cloudflared

# Done! Access at https://ha.sivaa.in
```

---

## Current System Status

### Services
| Service | Local URL | External URL |
|---------|-----------|--------------|
| Home Assistant | http://dietpi.local:8123 | https://ha.sivaa.in |
| Zigbee2MQTT | http://dietpi.local:8080 | - |
| MQTT Broker | localhost:1883 (TCP), 9001 (WebSocket) | - |
| Grafana | http://localhost:3333 | - |
| Climate Dashboard | http://localhost:8888 | - |

### Devices
| Device | Type | Location |
|--------|------|----------|
| Desk Lamp | IKEA FLOALT Light | Study |
| TRADFRI Remote | IKEA 5-button | Study |
| Bath Room | Sonoff SNZB-02P Sensor | Bathroom |

### Voice Commands
```
"Hey Google, turn on Desk Lamp"
"Hey Google, what's the temperature in the bathroom?"
```

---

## Project Structure

```
~/zigbee/
├── docs/                           # Documentation (you are here)
│   ├── README.md                   # This file
│   ├── 01-hardware-setup.md
│   ├── 02-docker-services.md
│   ├── 03-zigbee2mqtt-config.md
│   ├── 04-home-assistant-config.md
│   ├── 05-cloudflare-tunnel.md
│   ├── 06-google-assistant.md
│   ├── 07-device-reference.md
│   ├── 08-troubleshooting.md
│   ├── 09-grafana-visualization.md
│   └── 10-custom-dashboard.md
├── dashboard/                      # Real-time climate display
│   ├── index.html                  # Single-file app (Alpine.js)
│   └── CLAUDE.md
├── grafana/dashboards/             # Grafana dashboard JSONs
├── docker-compose.yml              # Service orchestration
├── mosquitto/
│   └── mosquitto.conf              # MQTT broker config
├── zigbee2mqtt/
│   └── data/configuration.yaml     # Zigbee gateway config
├── homeassistant/
│   ├── configuration.yaml          # HA config
│   └── SERVICE_ACCOUNT.json        # GCP credentials (secret!)
└── requirements.txt                # Python dependencies
```

---

## Key Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| **OS** | DietPi | Lightweight, optimized for Pi |
| **Zigbee Adapter** | Sonoff ZBDongle-E | EFR32MG21 chip, well supported |
| **MQTT Broker** | Eclipse Mosquitto | Standard, lightweight |
| **Zigbee Software** | Zigbee2MQTT | Flexible, great device support |
| **Home Automation** | Home Assistant | Industry standard, Google integration |
| **External Access** | Cloudflare Tunnel | Free, secure, no port forwarding |
| **Voice Control** | Google Assistant | Works with existing Nest devices |

---

*Last updated: December 2025*
