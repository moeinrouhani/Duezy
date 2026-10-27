import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { DualCalendarPanel, type DayMark } from '../../components/date-picker/DualCalendarPanel';
import { Modal } from '../../components/ui/Modal';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLocalDate } from '../../hooks/useLocalDate';
import { daysUntil } from '../../domain/date';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';

export function CalendarScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reminders } = useReminders();
  const { categories } = useCategories();
  const calendar = useSettingsStore((s) => s.settings.calendar);
  const weekStart = useSettingsStore((s) => s.settings.weekStart);
  const localDate = useLocalDate();
  const [selected, setSelected] = useState<string | null>(null);

  const marks = useMemo(() => {
    const result: Record<string, DayMark> = {};
    for (const reminder of reminders) {
      if (reminder.done || reminder.deletedAt) continue;
      const mark = (result[reminder.dueDate] ??= { count: 0, danger: false });
      mark.count++;
      if (daysUntil(reminder.dueDate) < 0) mark.danger = true;
    }
    return result;
  }, [reminders]);

  const dayReminders = selected
    ? reminders.filter((reminder) => !reminder.deletedAt && reminder.dueDate === selected)
    : [];

  return (
    <div>
      <PageHeader title={t('calendar.title')} />
      <div className="rounded-2xl border border-line bg-surface p-4">
        <DualCalendarPanel
          calendar={calendar}
          weekStart={weekStart}
          value={null}
          onChange={(iso) => setSelected(iso)}
          marks={marks}
        />
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? localDate.formatDateLong(selected) : ''}
      >
        {dayReminders.length === 0 ? (
          <p className="py-4 text-center text-sm text-fg-2">{t('calendar.noneOnDay')}</p>
        ) : (
          <>
            <p className="mb-3 text-xs font-medium text-fg-2">{t('calendar.remindersOnDay')}</p>
            <ul className="flex flex-col gap-2">
              {dayReminders.map((reminder) => {
                const category = categories.find((c) => c.id === reminder.categoryId);
                const color = CATEGORY_COLOR_HEX[category?.color ?? 'teal'];
                return (
                  <li key={reminder.id}>
                    <button
                      className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-start transition hover:bg-surface-2"
                      onClick={() => {
                        setSelected(null);
                        navigate(`/reminder/${reminder.id}`);
                      }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                      <span className="flex-1 truncate text-sm">{reminder.title}</span>
                      <span className="text-xs text-fg-2">
                        {localDate.relative(reminder.dueDate)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Modal>
    </div>
  );
}
