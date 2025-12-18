# On-Screen Keyboard

> **Created:** December 2025
> **Purpose:** Tablet-like touch input for the Pi dashboard

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ON-SCREEN KEYBOARD                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Tap text field → Keyboard appears automatically                       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────┐           │
│   │  q  w  e  r  t  y  u  i  o  p                          │           │
│   │   a  s  d  f  g  h  j  k  l                            │           │
│   │  ⇧  z  x  c  v  b  n  m  ⌫                             │           │
│   │  123  🌐  ␣ space ␣  .  ⏎                              │           │
│   └─────────────────────────────────────────────────────────┘           │
│                                                                         │
│   Tap outside or press ⏎ → Keyboard hides                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Solution

**Squeekboard** - A Wayland-native on-screen keyboard designed for touch devices.

| Component | Description |
|-----------|-------------|
| `squeekboard` | The keyboard application |
| `wfplug-squeek` | Panel plugin (keyboard icon in taskbar) |
| `sbtest` | Startup script that checks for touch device |

---

## Installation

Already installed on Raspberry Pi OS. The packages come pre-installed:

```bash
# Verify installation
dpkg -l | grep squeekboard
# ii  squeekboard    1.43.1-1+rpt1    arm64    On-screen keyboard for Wayland

dpkg -l | grep wfplug-squeek
# ii  wfplug-squeek  1.1              arm64    Squeekboard plugin for wf-panel-pi
```

---

## Configuration

### Enable Autostart

```bash
# Copy autostart entry to user config
mkdir -p ~/.config/autostart
cp /etc/xdg/autostart/squeekboard.desktop ~/.config/autostart/
```

### Manual Start

```bash
# Start squeekboard manually
squeekboard &

# Or use the startup script (checks for touch device first)
/usr/bin/sbtest
```

### Panel Integration

The default panel config (`/etc/xdg/wf-panel-pi/wf-panel-pi.ini`) already includes the keyboard widget:

```ini
widgets_right=tray power ... squeek
```

This adds a keyboard icon to the panel for manual toggle.

---

## Usage

### Automatic Popup

1. Tap on any text input field (browser, terminal, file manager, etc.)
2. Keyboard appears automatically from the bottom
3. Type using touch
4. Tap outside or press Enter - keyboard hides

### Manual Toggle

- Tap the **keyboard icon** in the panel (top-right area)
- Keyboard shows/hides on each tap

### Keyboard Features

- **Letters**: Standard QWERTY layout
- **Numbers**: Tap `123` to switch to numbers/symbols
- **Emoji**: Tap 🌐 for language/emoji options
- **Shift**: Tap ⇧ for uppercase
- **Backspace**: Tap ⌫ to delete
- **Enter**: Tap ⏎ to submit/newline

---

## How It Works

```
Touch device detected?
        │
        ├── Yes → sbtest starts squeekboard
        │              │
        │              ▼
        │         squeekboard registers with Wayland
        │              │
        │              ▼
        │         Listens for text-input events
        │              │
        │         ┌────┴────┐
        │         │         │
        │    [text field    [panel icon
        │     focused]       tapped]
        │         │         │
        │         ▼         ▼
        │     Keyboard appears
        │
        └── No → squeekboard not started (no touch = no need)
```

---

## Troubleshooting

### Keyboard doesn't appear

```bash
# Check if squeekboard is running
pgrep -a squeekboard

# If not running, start it manually
squeekboard &

# Check if touch device is detected
libinput list-devices | grep -A2 Capabilities | grep touch
```

### Keyboard icon missing from panel

```bash
# Check panel config includes squeek widget
grep squeek /etc/xdg/wf-panel-pi/wf-panel-pi.ini
# Should show: widgets_right=... squeek

# Restart panel if needed
killall wf-panel-pi
```

### Keyboard doesn't auto-popup in browser

Some web applications may not trigger the Wayland text-input protocol. Use the panel icon to manually show the keyboard.

---

## Files

| File | Purpose |
|------|---------|
| `/usr/bin/squeekboard` | Main keyboard application |
| `/usr/bin/sbtest` | Startup script (checks for touch) |
| `/etc/xdg/autostart/squeekboard.desktop` | System autostart entry |
| `~/.config/autostart/squeekboard.desktop` | User autostart entry |
| `/etc/xdg/wf-panel-pi/wf-panel-pi.ini` | Panel config with squeek widget |
| `/usr/lib/aarch64-linux-gnu/wf-panel-pi/libsqueek.so` | Panel plugin |

---

## Related

- [Display Scheduling](10-display-scheduling.md) - Display auto-off with touch wake
- Squeekboard project: https://gitlab.gnome.org/World/Phosh/squeekboard
