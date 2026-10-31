import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { IconButton } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 'center' dialog or 'sheet' (bottom on mobile, center on desktop). */
  variant?: 'center' | 'sheet';
  className?: string;
}

/** Keep the panel mounted this long after `open` flips false so it can animate out. */
const EXIT_MS = 200;

export function Modal({ open, onClose, title, children, variant = 'center', className }: ModalProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  // Latest-callback ref: the focus effect must run only on open/close. Keying
  // it on `onClose` re-ran it on every parent render — and parents re-render
  // on every keystroke — repeatedly yanking focus out of inputs mid-typing.
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
    // Lock page scroll behind the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog for keyboard/screen-reader users.
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
      className="overlay-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={(event) => {
        // Dismiss on click, not mousedown: closing mid-gesture unmounts the
        // backdrop before the browser dispatches click, and the tap then
        // re-hit-tests onto whatever button sits behind it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'overlay-panel bg-surface text-fg-1 shadow-pop max-h-[90dvh] w-full sm:max-w-md overflow-y-auto outline-none',
          'rounded-t-3xl sm:rounded-3xl',
          variant === 'center' && 'sm:max-w-sm',
          className,
        )}
      >
        {/* Grab handle — a visual cue that the sheet came up from the edge. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-fg-2/25" />
        </div>
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
            <h2 className="text-base font-semibold">{title}</h2>
            <IconButton label={t('common.close')} onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        {/* Bottom sheets reach the physical screen edge — keep content above
            the gesture bar / home indicator on notched phones. */}
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
