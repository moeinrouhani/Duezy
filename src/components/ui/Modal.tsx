import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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

export function Modal({ open, onClose, title, children, variant = 'center', className }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the dialog for keyboard/screen-reader users.
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'bg-surface text-fg-1 shadow-2xl max-h-[90dvh] w-full sm:max-w-md overflow-y-auto outline-none',
          'rounded-t-3xl sm:rounded-3xl',
          variant === 'center' && 'sm:max-w-sm',
          className,
        )}
      >
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-surface px-5 py-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <IconButton label="close" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
