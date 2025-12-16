# Project: Raspberry Pi 5 Setup & Configuration

## Purpose

This repository documents the complete setup of a Raspberry Pi 5, designed for **disaster recovery**.
If the Pi dies, we should be able to rebuild it exactly as it was using this documentation.

---

## Core Principles

1. **Document Everything**
   - WHY we made each change
   - HOW we made it (exact commands)
   - WHAT the result looks like (verification)

2. **Backup All Configs**
   - Store copies of critical config files in `backups/configs/`
   - Update backups after every change

3. **Honest Documentation**
   - No assumptions - only document what was actually done
   - Include error messages and troubleshooting steps
   - Evidence-based: show actual outputs, not expected outputs

4. **Organized Structure**
   - Each topic gets its own numbered doc in `docs/`
   - Main README.md serves as the index
   - Update CLAUDE.md after significant changes

---

## Project Structure

```
pi-setup/
├── README.md           # Main index and quick reference
├── CLAUDE.md           # This file - AI instructions
├── docs/               # Detailed documentation
│   ├── 01-*.md         # Numbered for reading order
│   └── ...
└── backups/
    └── configs/        # Backed up Pi config files
```

---

## Current Pi Configuration

- **Device:** Raspberry Pi 5 Model B Rev 1.1
- **OS:** Debian GNU/Linux 13 (trixie)
- **Access:** `ssh pi@pi`
- **Boot:** NVMe primary (BOOT_ORDER=0xf416)
- **Storage:**
  - NVMe: `/` and `/boot/firmware`
  - SD Card: `/mnt/storage` (extra storage)
- **Hardware:**
  - Zigbee: Sonoff Zigbee 3.0 USB Dongle Plus V2
  - Path: `/dev/serial/by-id/usb-Itead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_V2_...-if00-port0`
- **Zigbee Devices:** 22 total (including coordinator)
  - 12x Temperature sensors (SNZB-02P, SNZB-02WD)
  - 2x IKEA FLOALT lights + 2x remotes
  - CO2 sensor, motion sensor, contact sensor
  - Smart plug, mailbox vibration sensor
- **Docker Services:** 5 containers
  - mosquitto (MQTT), zigbee2mqtt, homeassistant
  - influxdb, dashboard (nginx)

---

## When Making Changes

1. **Before:** Read relevant existing docs
2. **During:** Note exact commands and outputs
3. **After:**
   - Backup changed config files to `backups/configs/`
   - Document in appropriate `docs/*.md` file
   - Update README.md index if new doc created
   - Update this CLAUDE.md if project structure changes

---

## Recovery Philosophy

> *"We are preparing for the worst day and we need to recover and get it up exactly the same as before."*

All documentation should enable complete system restoration from scratch.
- make sure that all teh coding agents refers to the proper documents. create agents.md based on the standard and add high level instructions on where to refer. because we are gonna use this pi for many services
- don't use anything from zigbee-backup-old-device folder without user's explict approval. its a backup from old device and lot of things to changed. be honest with this
- every soruce and config file should be first in this repo and later moved to      pi. eerything single time. golden rule
- no services should run locaally (mac) never ever unless user explicts asks

---

## Lessons Learned (AI Memory)

### Dashboard Network View - Wall Index Tracing (2024-12-14)

**Mistake Made:** When tracing wall indices in `services/dashboard/www/index.html`, incorrectly assumed interior divider walls (wall1, wall2) were created BEFORE room walls. This led to wrong wall identification (claimed wall 17 was bathroom's exterior wall when it's actually the Kitchen↔Bedroom interior divider).

**Root Cause:** Did not carefully read the execution order in `buildFloorPlan()`:
```javascript
buildFloorPlan() {
  // FIRST: Room walls created (walls 0-15)
  FLOOR_PLAN_CONFIG.rooms.forEach(config => this.createRoom(config));

  // THEN: Interior walls created (walls 16-17)
  // wall1 → index 16
  // wall2 → index 17
}
```

**Correct Wall Index Map:**
```
0-2:   Study (back, left, right)
3-5:   Living (front, left, right)
6-8:   Bedroom (front, left, right)
9-11:  Kitchen (back, left, right)
12-15: Bathroom (back, front, left, right)
16:    Interior - Study↔Living horizontal divider
17:    Interior - Kitchen↔Bedroom horizontal divider
```

**Prevention:** Always verify execution order by reading the actual code flow. Don't assume based on code comments or naming. When debugging visual elements, cross-reference with the actual rendered output (screenshots) rather than relying solely on code tracing.