import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/uiStore';
/** Single snackbar host, mounted once in AppShell. */
export function Snackbar() {
  const snackbar = useUiStore((s) => s.snackbar);
  const dismiss = useUiStore((s) => s.dismissSnackbar);
  if (!snackbar) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-6 inset-x-0 z-60 flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-fg-1 px-4 py-3 text-bg shadow-xl">
        <p className="flex-1 text-sm">{snackbar.message}</p>
        {snackbar.actionLabel && (
          <button
            className="text-sm font-semibold text-accent-300 hover:text-accent-200 shrink-0"
            onClick={() => {
              snackbar.onAction?.();
              dismiss();
            }}
          >
            {snackbar.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function useConfirm() {
  const confirm = useUiStore((s) => s.confirm);
  const { t } = useTranslation();
  return (titleKey: string, messageKey?: string) =>
    confirm({
      titleKey,
      messageKey,
      confirmKey: t('common.confirm'),
    });
}
