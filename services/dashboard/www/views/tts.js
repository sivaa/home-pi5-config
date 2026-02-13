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
