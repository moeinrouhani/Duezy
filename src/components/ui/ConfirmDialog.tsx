import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/uiStore';
import { Button } from './Button';
import { Modal } from './Modal';

/** Renders the pending confirm request as a modal. Mounted once in AppShell. */
export function ConfirmDialog() {
  const { t } = useTranslation();
  const request = useUiStore((s) => s.confirmRequest);
  const resolve = useUiStore((s) => s.resolveConfirm);

  if (!request) return null;

  return (
    <Modal open onClose={() => resolve(false)} title={t(request.titleKey)}>
      {request.messageKey && <p className="text-sm text-fg-2">{t(request.messageKey)}</p>}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => resolve(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          variant={request.danger ? 'danger' : 'primary'}
          className="flex-1"
          onClick={() => resolve(true)}
        >
          {request.confirmKey ?? t('common.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
