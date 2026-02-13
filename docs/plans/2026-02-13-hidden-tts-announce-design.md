# Hidden TTS Announce View - Design Doc

**Date:** 2026-02-13
**Status:** Approved

---

## Problem

The dashboard has a mature TTS pipeline (Google Translate TTS, 3 Cast speakers, smart fallback scripts) but no way to manually type and send an announcement from the browser.

## Solution

A hidden dashboard view at `#tts` that lets you type a message, pick a speaker, and announce it via Home Assistant's TTS service.

```
  Navigate to #tts
        |
        v
  +-------------------------------------+
  | Speaker: [Kitchen Display    v]      |
  | Volume:  ----*------ 60%            |
  | Message: [Type here...        ]      |
  |          [ Announce ]                |
  | Status:  Ready                       |
  +-------------------------------------+
        |
        v (POST)
  HA REST API /api/services/tts/google_translate_say
        |
        v
  Cast Speaker plays message
```

## Architecture

```
Dashboard #tts view
  |
  | POST /api/services/tts/google_translate_say
  | Headers: Authorization: Bearer <haToken>
  | Body: { entity_id, message }
  |
  v
Home Assistant --> Google Translate TTS --> Cast Speaker
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| View HTML | `index.html` (new section) | Text input, speaker dropdown, volume, send button |
| Store | `js/stores/tts-store.js` | API call logic, state management |
| CSS | `css/views/tts-view.css` | Styling for the TTS view |

## Speaker Options

| Label | entity_id |
|-------|-----------|
| Kitchen Display | `media_player.kitchen_display` |
| Bedroom Clock | `media_player.master_bedroom_clock` |
| Broken Display | `media_player.broken_display` |

## Behavior

1. Navigate to `#tts` - view appears (NOT in nav menu)
2. Pick speaker (default: Kitchen Display)
3. Optional: adjust volume (0-100%)
4. Type message, hit Announce or Enter
5. POST to HA REST API with entity_id + message
6. Show success/error status
7. Clear message on success

## What It Does NOT Do

- No nav menu entry (hidden URL only)
- No message history
- No scheduling or queuing
- No preset messages
