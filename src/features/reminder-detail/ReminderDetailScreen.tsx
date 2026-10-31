import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Sheet } from '../../components/ui/Sheet';
import { useReminders } from '../../hooks/useReminders';
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
        <p className="px-5 py-10 text-center text-sm text-fg-2">{t('common.loading')}</p>
      )}
    </Sheet>
  );
}
