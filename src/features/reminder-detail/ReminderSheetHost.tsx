import { useEffect, useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { useReminders } from '../../hooks/useReminders';
import type { Reminder } from '../../domain/types';
import { ReminderSheet } from './ReminderSheet';

/**
 * Owns the detail sheet for a list screen. The sheet stays mounted and is
 * driven by `open`, so closing (or deleting the reminder) plays the exit
 * animation instead of vanishing — conditionally rendering `<Sheet open>`
 * unmounted it before the exit could run. The last shown reminder is kept so
 * the content stays on screen while it animates away.
 */
export function ReminderSheetHost({
  reminderId,
  mode,
  onClose,
  onEdit,
}: {
  reminderId: string | null;
  mode: 'dashboard' | 'manage';
  onClose: () => void;
  onEdit?: (reminder: Reminder) => void;
}) {
  const { reminders } = useReminders();
  const live = reminderId ? reminders.find((r) => r.id === reminderId) : undefined;

  const [last, setLast] = useState<Reminder | null>(null);
  useEffect(() => {
    if (live) setLast(live);
  }, [live]);

  const shown = live ?? last;
  return (
    <Sheet open={live !== undefined} onClose={onClose} label={shown?.title ?? ''}>
      {shown && (
        <ReminderSheet
          reminder={shown}
          mode={mode}
          onClose={onClose}
          onEdit={onEdit ? () => onEdit(shown) : undefined}
        />
      )}
    </Sheet>
  );
}
