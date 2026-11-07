import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Sheet } from '../../components/ui/Sheet';
import { useReminders } from '../../hooks/useReminders';
import { useReminderStore } from '../../stores/dataStores';
import { Button } from '../../components/ui/Button';
import { ReminderSheet } from './ReminderSheet';

/**
 * Route body for #/reminder/:id — notification deep-links land here. Presents
 * the same bottom sheet the dashboard and reminders screens open in place;
 * closing it returns to the dashboard.
 */
export function ReminderDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { reminders } = useReminders();
  const loaded = useReminderStore((s) => s.loaded);

  const reminder = reminders.find((r) => r.id === id);
  const close = () => navigate('/', { replace: true });

  return (
    <Sheet open onClose={close} label={reminder?.title ?? t('detail.title')}>
      {reminder ? (
        <ReminderSheet
          reminder={reminder}
          mode="manage"
          onClose={close}
          onEdit={() => navigate(`/reminder/${reminder.id}/edit`, { replace: true })}
        />
      ) : (
        // Before the first load: spinner text. After it: the reminder is gone
        // (deleted, or a stale notification link) — say so instead of "loading" forever.
        <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
          <p className="text-sm text-fg-2">{loaded ? t('detail.notFound') : t('common.loading')}</p>
          {loaded && (
            <Button variant="secondary" onClick={close}>
              {t('common.close')}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
