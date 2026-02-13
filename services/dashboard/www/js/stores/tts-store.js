// ============================================================================
//  TTS STORE - Voice Announcements via Google Cast Speakers
// ============================================================================
//
//  Sends text-to-speech announcements to Cast-enabled speakers through
//  Home Assistant's REST API. Two-step flow: set volume, then speak.
//
//  DATA FLOW
//  ---------
//
//  Dashboard UI
//       |
//       |  User types message, picks speaker, adjusts volume
//       v
//  tts-store.js  announce()
//       |
//       |  Step 1: Set volume
//       |  POST /api/services/media_player/volume_set
//       |  { entity_id, volume_level: 0.0-1.0 }
//       |
//       |  Step 2: Speak
//       |  POST /api/services/tts/google_translate_say
//       |  { entity_id, message, language: 'en' }
//       |
//       v
//  Home Assistant (pi:8123)
//       |
//       |  HA calls Google TTS -> streams audio
//       v
//  Cast Speaker (Kitchen Display / Bedroom Clock / Broken Display)
//       |
//       v
//  Audio plays in the room
//
// ============================================================================

export function initTtsStore(Alpine) {
  Alpine.store('tts', {

    // ── Connection ──────────────────────────────────────────────────────
    HA_URL: 'http://pi:8123',
    haToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkZjJhY2UwMTBmNGY0Y2NiYTI0ZGZhMGUyZjg5NWYzNiIsImlhdCI6MTc2Njg1NjU1NywiZXhwIjoyMDgyMjE2NTU3fQ.2t04JrsGafT9hDhg0BniYG90i1O7a7DHqpdst9x3-no',

    // ── Available Cast Speakers ─────────────────────────────────────────
    //
    //  Kitchen Display   - Google Nest Hub in the kitchen (main speaker)
    //  Bedroom Clock     - Lenovo Smart Clock in bedroom
    //  Broken Display    - Google Nest Hub (cracked screen, still works as speaker)
    //
    speakers: [
      { id: 'media_player.kitchen_display',       label: 'Kitchen Display' },
      { id: 'media_player.master_bedroom_clock',  label: 'Bedroom Clock' },
      { id: 'media_player.broken_display',        label: 'Broken Display' },
    ],

    // ── Form State ──────────────────────────────────────────────────────
    selectedSpeaker: 'media_player.kitchen_display',
    volume: 60,       // 0-100 percentage (sent as 0.0-1.0 to HA)
    message: '',

    // ── Request State ───────────────────────────────────────────────────
    sending: false,
    status: null,     // null | { type: 'success'|'error', text: '...' }
    _statusTimer: null,

    // ── Methods ─────────────────────────────────────────────────────────

    /**
     * Send a TTS announcement to the selected Cast speaker.
     *
     * Flow:
     *   1. Validate message (non-empty, not already sending)
     *   2. POST volume_set  -> adjusts speaker volume
     *   3. POST tts/google_translate_say -> speaks the message
     *   4. Show success/error status for 8 seconds
     */
    async announce() {
      const trimmed = this.message.trim();
      if (!trimmed || this.sending) return;

      this.sending = true;
      this.setStatus(null);

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.haToken}`,
      };

      try {
        // Step 1: Set the speaker volume
        //
        //  HA expects volume_level as a float 0.0-1.0
        //  Dashboard stores it as 0-100 for slider UX
        //
        //  volume: 60  ->  volume_level: 0.6
        //
        const volumeResponse = await fetch(`${this.HA_URL}/api/services/media_player/volume_set`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entity_id: this.selectedSpeaker,
            volume_level: this.volume / 100,
          }),
        });

        if (!volumeResponse.ok) {
          throw new Error(`Volume set failed: HTTP ${volumeResponse.status}`);
        }

        // Step 2: Send the TTS announcement
        const ttsResponse = await fetch(`${this.HA_URL}/api/services/tts/google_translate_say`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            entity_id: this.selectedSpeaker,
            message: trimmed,
            language: 'en',
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`TTS failed: HTTP ${ttsResponse.status}`);
        }

        // Success - find the speaker label for the status message
        const speaker = this.speakers.find(s => s.id === this.selectedSpeaker);
        const label = speaker ? speaker.label : this.selectedSpeaker;
        this.setStatus('success', `Sent to ${label}`);
        this.message = '';

        console.log('[tts] Announcement sent:', { speaker: label, message: trimmed, volume: this.volume });

      } catch (e) {
        console.error('[tts] Announcement failed:', e);
        this.setStatus('error', e.message || 'Failed to send announcement');
      } finally {
        this.sending = false;
      }
    },

    /**
     * Set a status message that auto-clears after 8 seconds.
     *
     * @param {string|null} type  - 'success', 'error', or null to clear
     * @param {string}      text  - Human-readable status message
     */
    setStatus(type, text) {
      // Clear any existing auto-clear timer
      if (this._statusTimer) {
        clearTimeout(this._statusTimer);
        this._statusTimer = null;
      }

      if (!type) {
        this.status = null;
        return;
      }

      this.status = { type, text };

      // Auto-clear after 8 seconds
      this._statusTimer = setTimeout(() => {
        this.status = null;
        this._statusTimer = null;
      }, 8000);
    },
  });
}
