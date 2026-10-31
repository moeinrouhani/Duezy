import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/uiStore';
import { Button } from './Button';
import { Modal } from './Modal';

/** Renders the pending confirm request as a modal. Mounted once in AppShell. */
export function ConfirmDialog() {
  const { t } = useTranslation();
  const request = useUiStore((s) => s.confirmRequest);
  const resolve = useUiStore((s) => s.resolveConfirm);

  // Keep the last request around so its text stays on screen while the
  // dialog animates out (the store clears the request immediately).
  const [last, setLast] = useState(request);
  useEffect(() => {
    if (request) setLast(request);
  }, [request]);

  const shown = request ?? last;
  if (!shown) return null;

  return (
    <Modal open={request !== null} onClose={() => resolve(false)} title={t(shown.titleKey)}>
      {shown.messageKey && <p className="text-sm leading-6 text-fg-2">{t(shown.messageKey)}</p>}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => resolve(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          variant={shown.danger ? 'danger' : 'primary'}
          className="flex-1"
          onClick={() => resolve(true)}
        >
          {shown.confirmKey ?? t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
