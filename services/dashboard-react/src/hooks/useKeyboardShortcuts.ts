/**
 * useKeyboardShortcuts - Handle keyboard navigation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_VIEWS, KEYBOARD_SHORTCUTS } from '@/config';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except for shortcuts that need them)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();
      const viewId = KEYBOARD_SHORTCUTS[key];

      if (viewId) {
        const view = ALL_VIEWS.find((v) => v.id === viewId);
        if (view) {
          e.preventDefault();
          navigate(view.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
