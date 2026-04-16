# Smart Home Dashboard - Product Requirements Document

> **Version:** 1.0
> **Last Verified:** January 13, 2026
> **Philosophy:** Disaster recovery ready - rebuild Pi exactly as before
> **Verify Accuracy:** `./scripts/verify-prd-counts.sh`

---

## 1. Executive Summary

### Purpose

A comprehensive smart home automation system for a Berlin apartment, designed to:
- Monitor temperature, humidity, and air quality across all rooms
- Control heating with safety automations (window-aware shutoff)
- Provide real-time dashboards for monitoring and control
- Support voice control via Google Assistant
- Enable complete disaster recovery from bare hardware

### Design Philosophy

> *"We are preparing for the worst day and we need to recover and get it up exactly the same as before."*

Every configuration is documented and backed up. The system can be fully rebuilt from this repository.

---

## 2. System Metrics

> **Single Source of Truth:** This table references config files. Run `./scripts/verify-prd-counts.sh` to verify counts.

| Metric | Count | Source File | Verify Command |
|--------|-------|-------------|----------------|
| Zigbee Devices | 49 | `configs/zigbee2mqtt/configuration.yaml` | `grep -c "friendly_name:"` |
| Automations | 77 | `configs/homeassistant/automations.yaml` | `grep -c "alias:"` |
| Docker Services | 9 | `configs/zigbee2mqtt/docker-compose.yml` + `services/data-scraper/` | `grep -c "container_name:"` |
| Systemd Services | 18 | `configs/**/*.service` | `find configs -name "*.service" \| wc -l` |
| Systemd Timers | 6 | `configs/**/*.timer` | `find configs -name "*.timer" \| wc -l` |
| Dashboard Views | 15 | `services/dashboard/www/views/*.js` | `ls \| wc -l` |

### Device Categories (Summary)

| Category | Count | Notes |
|----------|-------|-------|
| Temperature Sensors | 12 | SNZB-02P (11x), SNZB-02WD (1x) |
| Contact Sensors | 8 | Windows and doors |
| Thermostats | 4 | SONOFF TRVZB radiator valves |
| Lights | 5 | 2x IKEA FLOALT, 2x AwoX LED, 1x Aqara T1M ceiling |
| Smart Plugs | 3 | SONOFF S60ZBTPF |
| Other Sensors | 6 | CO2, motion, vibration, remotes, switch |

For complete device list with IEEE addresses: `configs/zigbee2mqtt/configuration.yaml` lines 55-187

---

## 3. User Personas & Use Cases

### Primary User: Siva (Engineer)
- **Role:** System builder and maintainer
- **Goals:** Automation, data visualization, system reliability
- **Use Cases:**
  - Configure automations for energy efficiency
  - Monitor system health and device status
  - Debug issues via logs and timeline views
  - Maintain documentation for disaster recovery

### Secondary User: Nithya (Family Member)
- **Role:** Daily user
- **Goals:** Comfort, convenience, safety
- **Use Cases:**
  - Check room temperatures at a glance
  - Control heating via dashboard or voice
  - View transport departure times
  - Receive alerts (mailbox, air quality, sensor offline)

### System User: Automation Engine
- **Role:** Home Assistant automations
- **Goals:** Safety, energy efficiency, comfort
- **Use Cases:**
  - Turn off heaters when windows open
  - Adjust lighting based on time of day
  - Send alerts for anomalies
  - Enforce night mode temperature limits

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HARDWARE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Raspberry Pi 5 (8GB)                                                       │
│  ├── NVMe: OS + Services (476GB)                                            │
│  ├── SD Card: Backups + Storage (119GB)                                     │
│  ├── Sonoff Zigbee 3.0 USB Dongle Plus V2                                   │
│  └── HDMI Touch Display (Kiosk Mode)                                        │
│                                                                             │
│  Zigbee Network: 49 Devices                                                 │
│  ├── Coordinator: USB Dongle                                                │
│  ├── Routers: Lights, Plugs, CO2 Sensor                                     │
│  └── End Devices: Sensors, Thermostats                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SOFTWARE STACK                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Docker Services (9):                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  mosquitto  │  │ zigbee2mqtt │  │homeassistant│  │  influxdb   │        │
│  │  MQTT:1883  │  │  HTTP:8080  │  │  HTTP:8123  │  │  HTTP:8086  │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                         │
│  ┌─────────────┐  ┌─────────────┐  │  ┌─────────────┐  ┌─────────────┐     │
│  │  dashboard  │  │mqtt-influx- │  │  │ cast-ip-    │  │  heater-    │     │
│  │ nginx:8888  │  │   bridge    │  │  │   monitor   │  │  watchdog   │     │
│  └─────────────┘  └─────────────┘  │  └─────────────┘  └─────────────┘     │
│                                    │                                        │
│                        ┌───────────┴───────────┐                            │
│                        │    data-scraper       │ (Separate docker-compose)  │
│                        │    HTTP:8890          │                            │
│                        └───────────────────────┘                            │
│                                                                             │
│  Systemd Services (18 units):                                               │
│  ├── Display Scheduler (on/off timers, brightness, wake)                   │
│  ├── Kiosk (browser, control, toggle)                                       │
│  ├── Watchdogs (WiFi, Zigbee, Z2M validation)                               │
│  └── Maintenance (daily reboot, squeekboard)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Zigbee Device                                                              │
│       │                                                                     │
│       ▼ (Zigbee protocol)                                                   │
│  Zigbee2MQTT ──────────────────────────────────────────────────────┐       │
│       │                                                            │       │
│       ▼ (MQTT publish)                                             │       │
│  Mosquitto Broker ────────────────────────────┐                    │       │
│       │                                       │                    │       │
│       ├──► Home Assistant (automations)       │                    │       │
│       │         │                             │                    │       │
│       │         ▼                             │                    │       │
│       │    Mobile Notifications               │                    │       │
│       │                                       │                    │       │
│       ├──► mqtt-influx-bridge                 │                    │       │
│       │         │                             │                    │       │
│       │         ▼                             │                    │       │
│       │    InfluxDB (time-series)             │                    │       │
│       │                                       │                    │       │
│       └──► Dashboard (WebSocket) ◄────────────┴────────────────────┘       │
│                 │                                                          │
│                 ▼                                                          │
│            Browser UI                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dashboard Architecture

### Dashboard

The classic Alpine.js dashboard is the production UI at `http://pi:8888/` with 15 views. See `services/dashboard/CLAUDE.md` for architecture details.

---

## 6. Safety & Reliability

### Multi-Layer Heater Safety

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEFENSE-IN-DEPTH SAFETY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: Home Assistant Automations (Event-Driven)                         │
│  ───────────────────────────────────────────────────                        │
│  Trigger: Contact sensor state change                                       │
│  Response: < 1 second                                                       │
│  Actions:                                                                   │
│    • Window open → Turn off room heater (30s delay)                         │
│    • Door open → Turn off heaters (2 min delay for entry/exit)              │
│    • All closed → Resume previous heater state                              │
│    • Prevent heating if ANY window open                                     │
│                                                                             │
│  LAYER 2: Heater Watchdog (Poll-Based)                                      │
│  ─────────────────────────────────────                                      │
│  Schedule: Every 5 minutes                                                  │
│  Response: 0-5 minutes (catches automation failures)                        │
│  Actions:                                                                   │
│    • Scan all windows/doors + heaters                                       │
│    • Detect violations (heater on + window open)                            │
│    • Force correct state                                                    │
│    • Send mobile notification                                               │
│                                                                             │
│  WHY TWO LAYERS:                                                            │
│  • Layer 1 may miss events (Z2M restart, MQTT glitch)                       │
│  • Layer 2 ensures eventual consistency                                     │
│  • Together: no violation lasts > 5 minutes                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Watchdog Systems

| Watchdog | Monitors | Action | Interval |
|----------|----------|--------|----------|
| Zigbee Watchdog | Z2M container health | Restart via systemctl | 60 seconds |
| WiFi Watchdog | Router stability | Reboot router | Daily 4:00 AM |
| Heater Watchdog | Window-heater violations | Force correct state | 5 minutes |
| Z2M Validation | Database integrity | Block corrupted startup | On start |

### Recovery Time Objectives

| Scenario | Target RTO | Documentation |
|----------|------------|---------------|
| Complete rebuild from bare Pi | 4 hours | docs/00-DISASTER-RECOVERY.md |
| Zigbee network re-pairing | 2-3 hours | docs/05-zigbee-devices.md |
| Docker service recovery | 15 minutes | docker-compose restart |
| Single device offline | 5 minutes | Z2M auto-reconnect |

---

## 7. Non-Functional Requirements

### Performance (Pi Thermal Constraints)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CSS PERFORMANCE RULES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INCIDENT (Dec 2025): Dashboard caused 147% CPU, 59.5°C, fan noise          │
│  ROOT CAUSE: 12 infinite animations, multi-layer box-shadows                │
│  RESOLUTION: Banned expensive CSS, CPU now 26%, temp 54.5°C                 │
│                                                                             │
│  BANNED:                                                                    │
│  • backdrop-filter: blur()                                                  │
│  • filter: blur() / grayscale()                                             │
│  • animation: * infinite                                                    │
│  • Multi-layer box-shadow (max 1, 10px blur)                                │
│                                                                             │
│  ALLOWED:                                                                   │
│  • transform, opacity (GPU-accelerated)                                     │
│  • Single-run animations                                                    │
│  • Simple transitions                                                       │
│                                                                             │
│  Full rules: services/dashboard/CLAUDE.md                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Reliability Targets

| Metric | Target | Current Status |
|--------|--------|----------------|
| System uptime | > 99.5% | Daily reboot at 4:30 AM (planned) |
| Heater safety catch rate | 100% | Two-layer system |
| Zigbee device availability | > 95% | 40-min timeout for battery devices |
| Dashboard response time | < 2 seconds | MQTT WebSocket + local nginx |

### Security

| Layer | Implementation |
|-------|----------------|
| External access | Cloudflare tunnel to ha.sivaa.in |
| Internal services | Local network only (no auth) |
| Zigbee network | Network key in secured config |
| SSH | Key-based authentication only |

---

## 8. Lessons Learned

### Critical Incidents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔴 INCIDENT: Zigbee Network Loss (January 4, 2026)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT HAPPENED:                                                             │
│  • AI agent issued 4 docker restart commands in 21 seconds                  │
│  • USB dongle entered race condition (300ms reconnect window)               │
│  • Z2M database corrupted, coordinator reset                                │
│  • ALL 35 DEVICES ORPHANED                                                  │
│                                                                             │
│  ROOT CAUSE:                                                                │
│  • No validation before Z2M restart                                         │
│  • Docker restart bypassed safety checks                                    │
│                                                                             │
│  RESOLUTION:                                                                │
│  • Z2M now managed by systemd (not docker directly)                         │
│  • Pre-start validation checks database integrity                           │
│  • Must use `systemctl restart zigbee2mqtt` (NEVER docker restart)          │
│  • 60-second wait between operations                                        │
│                                                                             │
│  DOCUMENTATION: docs/21-zigbee-network-incident-2026-01-04.md               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Other Learnings

| Date | Issue | Resolution |
|------|-------|------------|
| Dec 2025 | CSS causing 147% CPU | Banned expensive properties |
| Jan 2026 | Transport REST APIs unreliable | Switched to Playwright web scraping |
| Jan 2026 | Delayed trains showing wrong minutes | Fixed time calculation in scraper |
| Dec 2025 | WiFi degradation over days | Daily router reboot at 4 AM |

---

## 9. Source File Reference

> **No duplication:** For detailed lists, refer to these source files.

### Configuration Files

| Topic | Source File | Lines/Notes |
|-------|-------------|-------------|
| Device inventory | `configs/zigbee2mqtt/configuration.yaml` | Lines 55-156 |
| Automation list | `configs/homeassistant/automations.yaml` | 77 automations |
| Docker services | `configs/zigbee2mqtt/docker-compose.yml` | 8 services |
| HA configuration | `configs/homeassistant/configuration.yaml` | Integrations |
| HA scripts | `configs/homeassistant/scripts.yaml` | Callable scripts |

### Service Documentation

| Service | CLAUDE.md Location |
|---------|-------------------|
| Dashboard (Classic) | `services/dashboard/CLAUDE.md` |
| Heater Watchdog | `services/heater-watchdog/CLAUDE.md` |
| Zigbee Watchdog | `services/zigbee-watchdog/CLAUDE.md` |
| Data Scraper | `services/data-scraper/CLAUDE.md` |
| MQTT-InfluxDB Bridge | `services/mqtt-influx-bridge/CLAUDE.md` |
| Cast IP Monitor | `services/cast-ip-monitor/CLAUDE.md` |
| Kiosk Control | `services/kiosk-control/CLAUDE.md` |

### Key Documentation

| Topic | Document |
|-------|----------|
| Disaster Recovery | `docs/00-DISASTER-RECOVERY.md` |
| Secrets Recovery | `docs/secrets-recovery.md` |
| Zigbee Devices | `docs/05-zigbee-devices.md` |
| HA Automations | `docs/15-ha-automations.md` |
| Heater Watchdog | `docs/17-heater-watchdog.md` |
| Zigbee Watchdog | `docs/19-zigbee-watchdog.md` |

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-01-13 | Initial PRD created with verified counts |

---

*This PRD uses counts + references to source files. When devices/automations change, update source files only - this PRD remains valid via references.*
