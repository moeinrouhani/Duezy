import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { pushOverlay } from '../utils/overlayStack';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog behaviour: Escape (top-most overlay only), reference-counted
 * page scroll lock, focus hand-in / hand-back, and a Tab focus trap so
 * keyboard users on desktop can't wander into the page behind the dialog.
 */
export function useOverlay(open: boolean, panelRef: RefObject<HTMLElement | null>, onClose: () => void): void {
  // Latest-callback ref: the effect must run only on open/close, not on every
  // parent render (that used to yank focus out of inputs mid-typing).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const handle = pushOverlay();
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (!handle.isTop()) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      handle.release();
      previouslyFocused?.focus?.();
    };
  }, [open, panelRef]);
}
