# Browser Setup: Chromium → Epiphany

> **Date:** December 19, 2025
> **Issue:** Chromium infinite loading, high memory usage
> **Solution:** Replaced with Epiphany (GNOME Web)

---

## The Problem

```
┌─────────────────────────────────────────────────────────────┐
│  CHROMIUM ISSUES                                            │
├─────────────────────────────────────────────────────────────┤
│  • Infinite loading - pages never finish loading            │
│  • Firefox worked fine on same Pi (network OK)              │
│  • Heavy memory footprint (~440 MB installed)               │
│  • Overkill for home automation dashboard use               │
└─────────────────────────────────────────────────────────────┘
```

---

## The Solution: Epiphany (GNOME Web)

| Browser   | Size    | Engine  | Modern Web | Notes                      |
|-----------|---------|---------|------------|----------------------------|
| Chromium  | 440 MB  | Blink   | Yes        | Removed - broken/heavy     |
| Epiphany  | 2.5 MB  | WebKit  | Yes        | Installed - lightweight    |
| Firefox   | ~200 MB | Gecko   | Yes        | Already installed, backup  |

**Why Epiphany?**
- WebKit engine (same as Safari) - excellent compatibility
- 175x smaller than Chromium
- Handles YouTube, Home Assistant, modern JS sites
- Clean, simple GNOME interface

---

## Installation Steps

### 1. Remove Chromium

```bash
# Remove all Chromium packages
sudo apt remove --purge chromium chromium-common chromium-l10n \
  chromium-sandbox chromium-headless-shell rpi-chromium-mods

# Clean up unused dependencies
sudo apt autoremove

# Remove user config (optional)
rm -rf ~/.config/chromium ~/.cache/chromium
```

### 2. Install Epiphany

```bash
sudo apt install epiphany-browser

# Verify installation
epiphany --version
# Output: Web 48.5
```

### 3. Verify Default Browser

Epiphany automatically becomes the default `x-www-browser`:

```bash
update-alternatives --display x-www-browser
# Should show: link currently points to /usr/bin/epiphany-browser
```

---

## Top Panel Integration

The Pi uses `wf-panel-pi` (Wayfire panel). The browser launcher is already configured:

**Config location:** `/etc/xdg/wf-panel-pi/wf-panel-pi.ini`

```ini
[panel]
widgets_left=smenu spacing0 spacing4 launchers spacing8 window-list
launchers=x-www-browser pcmanfm x-terminal-emulator
```

The `x-www-browser` launcher automatically uses whatever browser is set as default.

### Panel Layout

```
┌────────────────────────────────────────────────────────────┐
│ [Menu] [🌐] [📁] [>_]                    [tray] [clock]    │
│         │    │    │                                        │
│         │    │    └── Terminal (x-terminal-emulator)       │
│         │    └────── File Manager (pcmanfm)                │
│         └────────── Browser (x-www-browser → Epiphany)     │
└────────────────────────────────────────────────────────────┘
```

### Restart Panel (if needed)

```bash
# Kill all instances and restart single
killall wf-panel-pi
sleep 1
WAYLAND_DISPLAY=wayland-1 wf-panel-pi &

# Verify only one instance
pgrep -c wf-panel-pi  # Should output: 1
```

---

## Troubleshooting

### Multiple panels appearing

```bash
# Kill all and restart single instance
killall wf-panel-pi
WAYLAND_DISPLAY=wayland-1 wf-panel-pi &
```

### Want Firefox as default instead

```bash
sudo update-alternatives --config x-www-browser
# Select Firefox from the list
```

### Reinstall Epiphany

```bash
sudo apt install --reinstall epiphany-browser
```

---

## Disk Space Saved

```
Before:  Chromium ~440 MB
After:   Epiphany ~60 MB (with WebKit libs)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Saved:   ~380 MB
```

---

## Use Cases

Epiphany works well for:
- Home Assistant dashboards (`http://pi:8123`)
- Zigbee2MQTT interface (`http://pi:8080`)
- YouTube, Spotify streaming
- General web browsing

For heavy web apps or complex sites, Firefox is still available as backup.
