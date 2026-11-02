import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useUiStore, type Snackbar as SnackbarData } from '../../stores/uiStore';

const EXIT_MS = 200;

/** Single snackbar host, mounted once in AppShell. */
export function Snackbar() {
  const { t } = useTranslation();
  const snackbar = useUiStore((s) => s.snackbar);
  const dismiss = useUiStore((s) => s.dismissSnackbar);

  // Keep the last message mounted while it animates out.
  const [shown, setShown] = useState<SnackbarData | null>(snackbar);
  useEffect(() => {
    if (snackbar) {
      setShown(snackbar);
      return;
    }
    const id = setTimeout(() => setShown(null), EXIT_MS);
    return () => clearTimeout(id);
  }, [snackbar]);

  if (!shown) return null;
  const state = snackbar ? 'open' : 'closed';

  return (
    // Hangs from the top edge, below any notch/home-indicator inset.
    <div
      className="pointer-events-none fixed inset-x-0 z-60 flex justify-center px-4"
      style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      {/* Keyed by id: a replacement message re-plays the entrance. */}
      <div
        key={shown.id}
        data-state={state}
        className="snack pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-2xl bg-fg-1 px-4 py-3 text-bg shadow-pop"
      >
        <p className="flex-1 text-sm">{shown.message}</p>
        {shown.actionLabel && (
          <button
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-accent-300 transition-colors hover:bg-white/10 hover:text-accent-200 dark:text-accent-600 dark:hover:bg-black/10 dark:hover:text-accent-700"
            onClick={() => {
              shown.onAction?.();
              dismiss();
            }}
          >
            {shown.actionLabel}
          </button>
        )}
        <button
          type="button"
          aria-label={t('common.close')}
          title={t('common.close')}
          className="-me-1 shrink-0 rounded-lg p-1 transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-90 dark:hover:bg-black/10"
          onClick={dismiss}
        >
          <X size={15} aria-hidden />
        </button>
        {snackbar && (
          <span
            aria-hidden
            className="snack-timer absolute inset-x-0 bottom-0 h-0.5 bg-accent-400/70 dark:bg-accent-600/60"
          />
        )}
      </div>
    </div>
  );
}

export function useConfirm() {
  const confirm = useUiStore((s) => s.confirm);
  const { t } = useTranslation();
  return (titleKey: string, messageKey?: string, opts?: { danger?: boolean; confirmLabel?: string }) =>
    confirm({
      titleKey,
      messageKey,
      confirmKey: opts?.confirmLabel ?? t('common.confirm'),
      danger: opts?.danger,
    });
}
