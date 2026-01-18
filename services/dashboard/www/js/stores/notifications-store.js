/**
 * Notification/Toast Store
 *
 * Provides user-visible feedback for errors, warnings, and status updates.
 * Toasts appear bottom-right and auto-dismiss.
 *
 * Usage:
 *   Alpine.store('notifications').error('Title', 'Message');
 *   Alpine.store('notifications').warning('Title', 'Message');
 *   Alpine.store('notifications').success('Title', 'Message');
 *   Alpine.store('notifications').info('Title', 'Message');
 */

export function initNotificationsStore(Alpine, CONFIG) {
  Alpine.store('notifications', {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STATE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    toasts: [],  // Array of {id, type, title, message, duration, timestamp}

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CORE METHODS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    /**
     * Add a toast notification
     * @param {'error'|'warning'|'success'|'info'} type - Toast type
     * @param {string} title - Short title
     * @param {string} message - Descriptive message
     * @param {object} options - Optional: {duration: ms, dismissible: bool}
     */
    add(type, title, message, options = {}) {
      // Default durations: errors stay longer
      const defaultDuration = type === 'error' ? 8000 : 4000;

      const toast = {
        id: Date.now() + Math.random(),
        type,
        title,
        message,
        duration: options.duration ?? defaultDuration,
        dismissible: options.dismissible ?? true,
        timestamp: Date.now()
      };

      this.toasts.push(toast);
      console.log(`[notifications] ${type.toUpperCase()}: ${title} - ${message}`);

      // Auto-dismiss after duration (0 = persistent)
      if (toast.duration > 0) {
        setTimeout(() => this.remove(toast.id), toast.duration);
      }

      return toast.id;
    },

    /**
     * Remove a toast by ID
     */
    remove(id) {
      const index = this.toasts.findIndex(t => t.id === id);
      if (index !== -1) {
        this.toasts.splice(index, 1);
      }
    },

    /**
     * Clear all toasts
     */
    clear() {
      this.toasts = [];
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CONVENIENCE METHODS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    error(title, message, options) {
      return this.add('error', title, message, options);
    },

    warning(title, message, options) {
      return this.add('warning', title, message, options);
    },

    success(title, message, options) {
      return this.add('success', title, message, options);
    },

    info(title, message, options) {
      return this.add('info', title, message, options);
    }
  });
}
