# Touch Monitor Configuration

> **Created:** December 2025
> **Purpose:** Enable touch gestures (scroll, pinch-zoom) on Pi touch display

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOUCH MONITOR SETUP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Device:    ILITEK ILITEK-TP (USB touchscreen)                  │
│  Driver:    hid-multitouch                                      │
│  Points:    10-point multi-touch                                │
│  Display:   HDMI-A-1 (1920x1080 @ 120Hz)                        │
│                                                                 │
│  Gestures Enabled:                                              │
│    - 1-finger swipe → Scroll                                    │
│    - 2-finger pinch → Zoom in/out                               │
│    - Tap → Click                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Hardware Details

| Property | Value |
|----------|-------|
| Device Name | ILITEK ILITEK-TP |
| USB Path | `/dev/input/by-id/usb-ILITEK_ILITEK-TP-event-if00` |
| Event Device | `/dev/input/event5` |
| Driver | hid-multitouch |
| Touch Points | 10 (`ABS_MT_SLOT max=9`) |
| Resolution | 9600 x 9600 touch units |

---

## The Problem & Solution

### Problem

By default, labwc was configured with `mouseEmulation="yes"`, which converted all touch input to mouse clicks. This meant:
- No scrolling with finger swipe
- No pinch-to-zoom
- Touch only worked as mouse pointer + click

### Root Cause

```xml
<!-- OLD CONFIG - Broken gestures -->
<touch deviceName="ILITEK ILITEK-TP" mapToOutput="HDMI-A-1" mouseEmulation="yes"/>
```

### Solution

Disable mouse emulation to allow native touch events:

```xml
<!-- NEW CONFIG - Native touch gestures -->
<touch deviceName="ILITEK ILITEK-TP" mapToOutput="HDMI-A-1" mouseEmulation="no"/>
```

---

## Files

### Source (this repo)

```
configs/labwc/
└── rc.xml              # labwc touch configuration
```

### Pi Destination

```
~/.config/labwc/
└── rc.xml              # Active labwc config
```

---

## Installation

Already installed. If reinstalling:

```bash
# From this repo
scp configs/labwc/rc.xml pi@pi:~/.config/labwc/

# Reboot Pi to apply (labwc reads config at startup)
ssh pi@pi "sudo reboot"
```

---

## Verification

### Check touch device is detected

```bash
ssh pi@pi "sudo libinput list-devices" | grep -A 5 "ILITEK"
```

Expected output:
```
Device:           ILITEK ILITEK-TP
Capabilities:     touch
```

### Check multi-touch support

```bash
ssh pi@pi "sudo evtest /dev/input/event5"
```

Look for:
- `ABS_MT_SLOT` (max=9 means 10 touch points)
- `ABS_MT_POSITION_X/Y` (multi-touch coordinates)
- `ABS_MT_TRACKING_ID` (individual touch tracking)

### Test gestures in browser

1. Open Firefox or Chromium
2. Navigate to any scrollable page
3. Swipe up/down with 1 finger → should scroll
4. Pinch with 2 fingers → should zoom

---

## Troubleshooting

### Touch doesn't work at all

```bash
# Check if touch device is connected
ssh pi@pi "ls /dev/input/by-id/ | grep ILITEK"

# Check kernel sees it
ssh pi@pi "dmesg | grep -i ilitek"
```

### Gestures work in browser but not other apps

Some apps don't support native Wayland touch. Options:
1. Check app-specific settings for touch support
2. Consider installing `lisgd` (gesture daemon) as fallback

### Need to revert to mouse emulation

```bash
ssh pi@pi "sed -i 's/mouseEmulation=\"no\"/mouseEmulation=\"yes\"/' ~/.config/labwc/rc.xml"
ssh pi@pi "sudo reboot"
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| `mouseEmulation="no"` | Allows native touch gestures in Wayland apps |
| No gesture daemon | Browser handles gestures natively; simpler setup |
| labwc config | Compositor-level setting applies to all apps |

---

## Related

- [Display Scheduling](10-display-scheduling.md) - Uses touch wake detection
- [Browser Setup](13-browser-setup.md) - Firefox/Chromium configuration
