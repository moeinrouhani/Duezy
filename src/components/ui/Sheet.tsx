import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of what the sheet presents (usually the record's title). */
  label: string;
  children: ReactNode;
  className?: string;
}

/** Keep the panel mounted this long after `open` flips false so it can animate out. */
const EXIT_MS = 240;

/**
 * iOS-style bottom sheet: slides up from the bottom edge with rounded top
 * corners and may expand almost to the top of the screen. Unlike Modal it
 * keeps that presentation at every viewport — the page behind stays in place.
 */
export function Sheet({ open, onClose, label, children, className }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest-callback ref: effects below must run only on open/close, not on
  // every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // `mounted` outlives `open` by the exit animation.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const id = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    // Lock page scroll behind the sheet.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open && !mounted) return null;
  const state = open ? 'open' : 'closed';

  return createPortal(
    <div
      data-state={state}
      className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          // Phones: full-width docked sheet. Wide screens: same sheet, but a
          // centered column — full-bleed across a monitor looks like a wall.
          'overlay-panel overlay-sheet flex max-h-[92dvh] w-full sm:max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-surface text-fg-1 shadow-pop outline-none',
          className,
        )}
      >
        {/* Grab handle — a visual cue that the sheet came up from the edge. */}
        <div className="flex shrink-0 justify-center pt-2.5" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-fg-2/25" />
        </div>
        {children}
        {/* Bottom sheets reach the physical screen edge — keep content above
            the gesture bar / home indicator on notched phones. */}
        <div className="shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
