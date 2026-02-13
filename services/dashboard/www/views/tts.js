/**
 * TTS Announce View
 * Hidden view (no nav entry) - accessible only via URL hash #tts
 * Lets user type a message and announce it on Cast speakers via HA TTS
 */

export function ttsView() {
  return {
    _initialized: false,

    init() {
      if (this._initialized) return;
      this._initialized = true;
      console.log('[tts-view] Initialized');
    },

    destroy() {
      if (this.store._statusTimer) {
        clearTimeout(this.store._statusTimer);
        this.store._statusTimer = null;
      }
      this.store.status = null;
      this._initialized = false;
      console.log('[tts-view] Destroyed');
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
