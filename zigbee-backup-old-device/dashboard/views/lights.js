/**
 * Vision 7: Lights Control Panel
 * Control IKEA FLOALT panel lights with brightness, color temp, and presets
 */

export function lightsView() {
  return {
    // Helper function for color temperature label
    getColorTempLabel(colorTemp) {
      if (colorTemp <= 280) return 'Cool White';
      if (colorTemp <= 350) return 'Neutral';
      if (colorTemp <= 400) return 'Warm White';
      return 'Warm';
    },

    // Helper function for last update formatting
    formatLastUpdate(timestamp) {
      if (!timestamp) return 'No data';
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      return `${Math.floor(seconds / 3600)}h ago`;
    }
  };
}
