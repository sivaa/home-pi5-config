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
└── rc.xml                    # labwc touch configuration

configs/touch-udev/
└── 99-touch-usb.rules        # USB autosuspend disable rule
```

### Pi Destination

```
~/.config/labwc/
└── rc.xml                           # Active labwc config

/etc/udev/rules.d/
└── 99-touch-usb.rules               # USB autosuspend disable rule
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

## USB Power Management (Autosuspend Fix)

> **Added:** December 2025
> **Issue:** Touch intermittently unresponsive - need to press harder or twice

### Problem

The Linux kernel's USB autosuspend was putting the touch controller to sleep after 2 seconds of inactivity:

```
┌─────────────────────────────────────────────────────────────────┐
│                    USB AUTOSUSPEND ISSUE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Symptom                        Root Cause                      │
│  ─────────────────────────────  ─────────────────────────────   │
│  Press harder sometimes         First touch wakes device        │
│  Need to press twice            First touch lost during wake    │
│  Intermittent response          Device suspended after 2s idle  │
│  Slow response after idle       USB resume latency              │
│                                                                 │
│  Default: autosuspend = 2 (suspend after 2 seconds)             │
│  Fixed:   autosuspend = -1 (never suspend)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Solution

Created udev rule to disable USB autosuspend for the ILITEK touch controller.

**File:** `configs/touch-udev/99-touch-usb.rules`

```bash
# Matches by Vendor:Product ID - works on ANY USB port
ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="222a", ATTR{idProduct}=="0001", ATTR{power/autosuspend}="-1"
```

### Installation

```bash
# Copy to Pi
scp configs/touch-udev/99-touch-usb.rules pi@pi:/tmp/

# Install
ssh pi@pi "sudo cp /tmp/99-touch-usb.rules /etc/udev/rules.d/"
ssh pi@pi "sudo chmod 644 /etc/udev/rules.d/99-touch-usb.rules"

# Reload and apply immediately
ssh pi@pi "sudo udevadm control --reload-rules"
ssh pi@pi "echo -1 | sudo tee /sys/bus/usb/devices/*/power/autosuspend"  # Apply now
```

### Verification

```bash
# Check autosuspend is disabled (should show -1)
ssh pi@pi "cat /sys/bus/usb/devices/3-2.4/power/autosuspend"

# Note: USB path (3-2.4) may change if device is moved to different port
# Use lsusb to find current path:
ssh pi@pi "lsusb -t | grep -A1 222a"
```

### Port Flexibility

The udev rule matches by **Vendor:Product ID** (222a:0001), not by USB port:
- Device can be moved to any USB port
- Works through USB hubs
- Same approach as Zigbee dongle udev rule

---

## Dashboard Touch Responsiveness

> **Added:** December 2025
> **Issue:** Menu bar (navigation tabs, theme toggle, refresh button) felt slow/unresponsive when tapping

### Problem

The dashboard header bar had multiple layered issues causing perceived touch lag:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOUCH ISSUES IDENTIFIED                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Global 250ms transitions on EVERY DOM element               │
│     → Every tap triggered animations everywhere                 │
│                                                                 │
│  2. transition: all on buttons                                  │
│     → Animated layout properties causing reflows                │
│                                                                 │
│  3. Touch targets too small (28-32px)                           │
│     → Required precise tapping, caused missed taps              │
│                                                                 │
│  4. Hover states stuck on touch devices                         │
│     → Visual confusion after tapping                            │
│                                                                 │
│  5. Global click handler ran on every tap                       │
│     → Unnecessary DOM queries (.closest()) on each touch        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Solution

| File | Changes |
|------|---------|
| `base.css` | Scoped theme transitions to `.theme-transitioning` class only |
| `base.css` | Added `touch-action: manipulation` (prevents 300ms tap delay) |
| `base.css` | Added `-webkit-tap-highlight-color: transparent` |
| `layout.css` | Replaced `transition: all` with specific properties (100ms) |
| `layout.css` | Increased touch targets to 44px minimum (Apple HIG) |
| `layout.css` | Added `@media (hover: hover)` guards for hover effects |
| `layout.css` | Added `:active` states for instant touch feedback |
| `navigation.js` | Added early exit when no menus are open |
| `theme-store.js` | Adds/removes `theme-transitioning` class during theme switch |

### Key CSS Patterns

```css
/* Touch optimization */
button, .nav-tab, .refresh-btn {
  touch-action: manipulation;          /* No 300ms delay */
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;                    /* Apple HIG minimum */
}

/* Hover only for mouse/trackpad */
@media (hover: hover) and (pointer: fine) {
  .nav-tab:hover { /* hover effects */ }
}

/* Instant touch feedback */
.nav-tab:active {
  transform: scale(0.97);              /* Immediate visual response */
}

/* Specific transitions, not "all" */
.nav-tab {
  transition: background-color 100ms ease, color 100ms ease;
}
```

### Result

Menu bar taps now feel **instant** instead of sluggish.

---

## Related

- [Display Scheduling](10-display-scheduling.md) - Uses touch wake detection
- [Browser Setup](13-browser-setup.md) - Firefox/Chromium configuration
- [Kiosk Browser](18-kiosk-browser.md) - Dashboard kiosk mode setup
