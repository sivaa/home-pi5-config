# Hidden TTS Announce View - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a hidden dashboard view at `#tts` that lets users type a message, pick a Cast speaker, adjust volume, and announce via Home Assistant's TTS service.

**Architecture:** New Alpine.js view + store, no nav menu entry. Activated via URL hash `#tts`. POSTs directly to HA REST API for volume_set + tts.google_translate_say. Follows existing dashboard patterns exactly.

**Tech Stack:** Alpine.js, HA REST API, CSS custom properties

---

### Task 1: Create TTS Store (`tts-store.js`)

**Files:**
- Create: `services/dashboard/www/js/stores/tts-store.js`

**Step 1: Create the store file**

```javascript
/**
 * TTS Announce Store
 *
 * Handles sending text-to-speech announcements to Cast speakers
 * via Home Assistant's TTS service.
 *
 * ┌──────────────┐     POST /api/services/       ┌──────────────┐
 * │  Dashboard   │     tts/google_translate_say   │  Home        │
 * │  #tts view   │ ─────────────────────────────► │  Assistant   │
 * │              │     {entity_id, message}       │              │
 * │  tts-store   │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  TTS Engine  │
 * │              │     200 OK / error             │  (Google     │
 * └──────────────┘                                │   Translate) │
 *                                                 └──────┬───────┘
 *                                                        │
 *                                                        ▼
 *                                                 ┌──────────────┐
 *                                                 │ Cast Speaker │
 *                                                 └──────────────┘
 */

export function initTtsStore(Alpine) {
  Alpine.store('tts', {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STATE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    HA_URL: 'http://pi:8123',
    haToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkZjJhY2UwMTBmNGY0Y2NiYTI0ZGZhMGUyZjg5NWYzNiIsImlhdCI6MTc2Njg1NjU1NywiZXhwIjoyMDgyMjE2NTU3fQ.2t04JrsGafT9hDhg0BniYG90i1O7a7DHqpdst9x3-no',

    speakers: [
      { id: 'media_player.kitchen_display', label: 'Kitchen Display' },
      { id: 'media_player.master_bedroom_clock', label: 'Bedroom Clock' },
      { id: 'media_player.broken_display', label: 'Broken Display' },
    ],

    selectedSpeaker: 'media_player.kitchen_display',
    volume: 60,       // 0-100 percentage
    message: '',
    sending: false,
    status: null,      // { type: 'success'|'error', text: '...' }
    _statusTimer: null,

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ACTIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async announce() {
      const text = this.message.trim();
      if (!text || this.sending) return;

      this.sending = true;
      this.status = null;

      try {
        // Step 1: Set volume
        await fetch(`${this.HA_URL}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.haToken}`,
          },
          body: JSON.stringify({
            entity_id: this.selectedSpeaker,
            volume_level: this.volume / 100,
          }),
        });

        // Step 2: Send TTS
        const response = await fetch(`${this.HA_URL}/api/services/tts/google_translate_say`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.haToken}`,
          },
          body: JSON.stringify({
            entity_id: this.selectedSpeaker,
            message: text,
            language: 'en',
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const speakerLabel = this.speakers.find(s => s.id === this.selectedSpeaker)?.label || 'speaker';
        this.setStatus('success', `Sent "${text}" to ${speakerLabel}`);
        this.message = '';

      } catch (e) {
        console.error('[tts] Announce failed:', e.message);
        this.setStatus('error', `Failed: ${e.message}`);
      } finally {
        this.sending = false;
      }
    },

    setStatus(type, text) {
      this.status = { type, text };
      if (this._statusTimer) clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => { this.status = null; }, 8000);
    },
  });
}
```

**Step 2: Verify file created**

Run: `cat services/dashboard/www/js/stores/tts-store.js | head -5`
Expected: Shows the comment header

**Step 3: Commit**

```bash
git add services/dashboard/www/js/stores/tts-store.js
git commit -m "feat(dashboard): add TTS announce store for hidden speaker control"
```

---

### Task 2: Create TTS View (`tts.js`)

**Files:**
- Create: `services/dashboard/www/views/tts.js`

**Step 1: Create the view file**

```javascript
/**
 * TTS Announce View
 * Hidden view (no nav entry) - accessible only via URL hash #tts
 * Lets user type a message and announce it on Cast speakers via HA TTS
 */

export function ttsView() {
  return {
    init() {
      console.log('[tts-view] Initialized');
    },

    get store() {
      return Alpine.store('tts');
    },

    handleKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.store.announce();
      }
    },
  };
}
```

**Step 2: Commit**

```bash
git add services/dashboard/www/views/tts.js
git commit -m "feat(dashboard): add TTS announce view controller"
```

---

### Task 3: Create TTS CSS (`tts.css`)

**Files:**
- Create: `services/dashboard/www/styles/views/tts.css`

**Step 1: Create the CSS file**

Follow dashboard conventions: BEM-ish naming `.tts-{component}`, CSS custom properties, 44px touch targets, no banned properties (no blur, no infinite animations).

```css
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * TTS Announce View
 * Hidden view for sending text-to-speech to Cast speakers
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

:root {
  --color-tts-primary: #8b5cf6;
  --color-tts-light: #a78bfa;
  --color-tts-dark: #7c3aed;
  --color-tts-success: #10b981;
  --color-tts-error: #ef4444;
}

.tts-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  min-height: 60vh;
}

.tts-card {
  background: var(--color-card-bg, #1e1e2e);
  border: 1px solid var(--color-border, #333);
  border-radius: var(--radius-xl, 16px);
  padding: var(--space-xl, 32px);
  width: 100%;
  max-width: 480px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.tts-header {
  text-align: center;
  margin-bottom: var(--space-lg, 24px);
}

.tts-header-icon {
  font-size: 48px;
  margin-bottom: var(--space-xs, 8px);
}

.tts-header-title {
  font-size: var(--font-size-lg, 20px);
  font-weight: 600;
  color: var(--color-text, #e0e0e0);
}

/* Speaker Dropdown */
.tts-field {
  margin-bottom: var(--space-md, 16px);
}

.tts-label {
  display: block;
  font-size: var(--font-size-sm, 13px);
  color: var(--color-text-secondary, #999);
  margin-bottom: var(--space-xs, 8px);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tts-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #333);
  border-radius: var(--radius-md, 8px);
  background: var(--color-bg, #121212);
  color: var(--color-text, #e0e0e0);
  font-size: var(--font-size-base, 15px);
  min-height: 44px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

/* Volume Slider */
.tts-volume-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 12px);
}

.tts-volume-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.tts-volume-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-border, #333);
  border-radius: 3px;
  outline: none;
}

.tts-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-tts-primary);
  cursor: pointer;
}

.tts-volume-value {
  font-size: var(--font-size-sm, 13px);
  color: var(--color-text-secondary, #999);
  min-width: 36px;
  text-align: right;
}

/* Message Textarea */
.tts-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #333);
  border-radius: var(--radius-md, 8px);
  background: var(--color-bg, #121212);
  color: var(--color-text, #e0e0e0);
  font-size: var(--font-size-base, 15px);
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
  max-height: 200px;
  line-height: 1.5;
}

.tts-textarea::placeholder {
  color: var(--color-text-secondary, #666);
}

.tts-textarea:focus,
.tts-select:focus {
  outline: none;
  border-color: var(--color-tts-primary);
}

/* Announce Button */
.tts-button {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: var(--color-tts-primary);
  color: white;
  font-size: var(--font-size-base, 15px);
  font-weight: 600;
  cursor: pointer;
  min-height: 48px;
  touch-action: manipulation;
  transition: opacity 0.2s ease;
  margin-top: var(--space-sm, 12px);
}

.tts-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (hover: hover) {
  .tts-button:not(:disabled):hover {
    opacity: 0.9;
  }
}

/* Status Message */
.tts-status {
  margin-top: var(--space-md, 16px);
  padding: 10px 14px;
  border-radius: var(--radius-sm, 6px);
  font-size: var(--font-size-sm, 13px);
  text-align: center;
}

.tts-status.is-success {
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-tts-success);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.tts-status.is-error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-tts-error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .tts-view {
    padding: var(--space-md, 16px);
    min-height: 50vh;
  }

  .tts-card {
    padding: var(--space-lg, 24px);
  }
}
```

**Step 2: Commit**

```bash
git add services/dashboard/www/styles/views/tts.css
git commit -m "feat(dashboard): add TTS announce view styles"
```

---

### Task 4: Wire TTS into `index.html`

**Files:**
- Modify: `services/dashboard/www/index.html`

This task has 3 sub-steps: add CSS link, add view HTML, add module script.

**Step 1: Add CSS link**

Find the last `<link rel="stylesheet" href="styles/views/...">` in the `<head>` and add after it:

```html
<link rel="stylesheet" href="styles/views/tts.css">
```

**Step 2: Add view HTML block**

Find the last view `<div x-show="currentView === '...'">` block (should be the weather view around line 2795) and add AFTER it (before the closing `</main>` or footer):

```html
        <!-- TTS Announce (hidden - URL hash #tts only) -->
        <div x-show="currentView === 'tts'" x-cloak x-data="ttsView()" x-init="init()">
          <div class="tts-view">
            <div class="tts-card">

              <div class="tts-header">
                <div class="tts-header-icon">📢</div>
                <div class="tts-header-title">Announce</div>
              </div>

              <!-- Speaker -->
              <div class="tts-field">
                <label class="tts-label">Speaker</label>
                <select class="tts-select" x-model="$store.tts.selectedSpeaker">
                  <template x-for="speaker in $store.tts.speakers" :key="speaker.id">
                    <option :value="speaker.id" x-text="speaker.label"></option>
                  </template>
                </select>
              </div>

              <!-- Volume -->
              <div class="tts-field">
                <label class="tts-label">Volume</label>
                <div class="tts-volume-row">
                  <span class="tts-volume-icon">🔊</span>
                  <input type="range" class="tts-volume-slider"
                    min="0" max="100" step="5"
                    x-model.number="$store.tts.volume">
                  <span class="tts-volume-value" x-text="$store.tts.volume + '%'"></span>
                </div>
              </div>

              <!-- Message -->
              <div class="tts-field">
                <label class="tts-label">Message</label>
                <textarea class="tts-textarea"
                  placeholder="Type your announcement..."
                  x-model="$store.tts.message"
                  @keydown="handleKeydown($event)"
                  :disabled="$store.tts.sending"></textarea>
              </div>

              <!-- Send Button -->
              <button class="tts-button"
                @click="$store.tts.announce()"
                :disabled="!$store.tts.message.trim() || $store.tts.sending"
                x-text="$store.tts.sending ? 'Sending...' : '📢 Announce'">
              </button>

              <!-- Status -->
              <template x-if="$store.tts.status">
                <div class="tts-status"
                  :class="{ 'is-success': $store.tts.status.type === 'success', 'is-error': $store.tts.status.type === 'error' }"
                  x-text="$store.tts.status.text">
                </div>
              </template>

            </div>
          </div>
        </div>
```

**Step 3: Add module script block**

Find the last `<script type="module">` block that imports a store/view (around the notification-history or weather imports) and add a new block:

```html
    <script type="module">
      import { initTtsStore } from './js/stores/tts-store.js';
      import { ttsView } from './views/tts.js';
      window.ttsView = ttsView;
      initTtsStore(Alpine);
    </script>
```

**Step 4: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "feat(dashboard): wire TTS view, store, and CSS into index.html"
```

---

### Task 5: Add URL Hash Routing for `#tts`

**Files:**
- Modify: `services/dashboard/www/index.html` (app `init()` function around line 5973)

**Step 1: Add hash check to app init()**

In the `app()` function's `init()` method, AFTER the localStorage restore (line ~5976) and BEFORE the time update, add:

```javascript
          // URL hash routing for hidden views (e.g., #tts)
          if (window.location.hash) {
            const hashView = window.location.hash.slice(1);
            if (hashView) this.currentView = hashView;
          }
```

This lets `#tts` override the saved view. The hash is only checked on page load - it won't interfere with normal nav.

**Step 2: Verify locally**

Run: `cd services/dashboard/www && python -m http.server 8888` (background)
Open: `http://localhost:8888/#tts`
Expected: TTS announce view appears with speaker dropdown, volume slider, text input, announce button

**Step 3: Commit**

```bash
git add services/dashboard/www/index.html
git commit -m "feat(dashboard): add URL hash routing for hidden TTS view"
```

---

### Task 6: Local Testing + Final Commit

**Step 1: Start local server** (if not already running)

```bash
cd services/dashboard/www && python -m http.server 8888
```

**Step 2: Test the full flow**

1. Open `http://localhost:8888/#tts` - verify view loads
2. Verify speaker dropdown shows 3 options (Kitchen Display selected by default)
3. Drag volume slider - verify percentage updates
4. Type a test message
5. Click Announce - verify POST goes to `http://pi:8123/api/services/media_player/volume_set` then `http://pi:8123/api/services/tts/google_translate_say`
6. Verify success status shows and message clears
7. Test Enter key sends the message
8. Test empty message - button should be disabled
9. Open `http://localhost:8888` (no hash) - verify TTS view is NOT shown, normal nav works
10. Verify TTS is NOT in the navigation menu

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(dashboard): polish TTS announce view after testing"
```
