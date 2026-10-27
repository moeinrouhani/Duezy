import { useTranslation } from 'react-i18next';
import type { CalendarSystem, RecurrenceEnd, RecurrenceFreq, RecurrenceRule, Weekday } from '../../domain/types';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Input } from '../../components/ui/Input';
import { Chip } from '../../components/ui/EmptyState';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { useLocalDate, weekdayOrder } from '../../hooks/useLocalDate';
import { useSettingsStore } from '../../stores/settingsStore';
import { weekdayNames } from './weekdayNames';

export interface RecurrenceDraft {
  freq: RecurrenceFreq | 'none';
  interval: number;
  byWeekday: Weekday[];
  endType: RecurrenceEnd['type'];
  endDate: string;
  endCount: number;
  calendar: CalendarSystem;
}

export const EMPTY_DRAFT: RecurrenceDraft = {
  freq: 'none',
  interval: 1,
  byWeekday: [],
  endType: 'never',
  endDate: '',
  endCount: 4,
  calendar: 'jalali',
};

export function draftToRule(draft: RecurrenceDraft, dueDate: string): RecurrenceRule | null {
  if (draft.freq === 'none') return null;
  const end: RecurrenceEnd =
    draft.endType === 'on' && draft.endDate
      ? { type: 'on', date: draft.endDate }
      : draft.endType === 'after'
        ? { type: 'after', count: Math.max(1, draft.endCount) }
        : { type: 'never' };
  return {
    freq: draft.freq,
    interval: Math.max(1, draft.interval),
    byWeekday: draft.freq === 'weekly' && draft.byWeekday.length > 0 ? draft.byWeekday : undefined,
    calendar: draft.calendar,
    start: dueDate,
    end,
  };
}

export function ruleToDraft(rule: RecurrenceRule | null): RecurrenceDraft {
  if (!rule) return { ...EMPTY_DRAFT };
  return {
    freq: rule.freq,
    interval: rule.interval,
    byWeekday: rule.byWeekday ?? [],
    endType: rule.end.type,
    endDate: rule.end.type === 'on' ? rule.end.date : '',
    endCount: rule.end.type === 'after' ? rule.end.count : 4,
    calendar: rule.calendar,
  };
}

const FREQ_OPTIONS = [
  { value: 'none', labelKey: 'recurrence.none' },
  { value: 'daily', labelKey: 'recurrence.daily' },
  { value: 'weekly', labelKey: 'recurrence.weekly' },
  { value: 'monthly', labelKey: 'recurrence.monthly' },
  { value: 'yearly', labelKey: 'recurrence.yearly' },
] as const;

export function RecurrenceEditor({
  draft,
  onChange,
  dueDate,
}: {
  draft: RecurrenceDraft;
  onChange: (draft: RecurrenceDraft) => void;
  dueDate: string;
}) {
  const { t } = useTranslation();
  const weekStart = useSettingsStore((s) => s.settings.weekStart);
  const localDate = useLocalDate();
  const patch = (partial: Partial<RecurrenceDraft>) => onChange({ ...draft, ...partial });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <SegmentedControl
        label={t('recurrence.label')}
        value={draft.freq}
        onChange={(freq) => patch({ freq: freq as RecurrenceDraft['freq'] })}
        options={FREQ_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
      />

      {draft.freq !== 'none' && (
        <>
          <div className="flex items-end gap-3">
            <div className="w-24">
              <Input
                label={t('recurrence.intervalLabel')}
                type="number"
                min={1}
                max={999}
                value={draft.interval}
                onChange={(event) => patch({ interval: Math.max(1, Number(event.target.value) || 1) })}
              />
            </div>
            <p className="pb-3 text-sm text-fg-2">
              {t('recurrence.unit.' + draft.freq)}
            </p>
          </div>

          {draft.freq === 'weekly' && (
            <div>
              <p className="mb-2 text-xs font-medium text-fg-2">{t('recurrence.repeatOn')}</p>
              <div className="flex flex-wrap gap-1.5">
                {weekdayOrder(weekStart).map((weekday) => {
                  const active = draft.byWeekday.includes(weekday);
                  return (
                    <Chip
                      key={weekday}
                      active={active}
                      onClick={() =>
                        patch({
                          byWeekday: active
                            ? draft.byWeekday.filter((d) => d !== weekday)
                            : [...draft.byWeekday, weekday].sort((a, b) => a - b),
                        })
                      }
                    >
                      {weekdayNames(t)[weekday]}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}

          {(draft.freq === 'monthly' || draft.freq === 'yearly') && (
            <SegmentedControl
              label={t('recurrence.calendarBasis')}
              value={draft.calendar}
              onChange={(calendar) => patch({ calendar: calendar as CalendarSystem })}
              options={[
                { value: 'jalali', label: t('recurrence.calendarBasisJalali') },
                { value: 'gregorian', label: t('recurrence.calendarBasisGregorian') },
              ]}
            />
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-fg-2">{t('recurrence.end')}</p>
            <div className="flex flex-col gap-3">
              <SegmentedControl
                value={draft.endType}
                onChange={(endType) => patch({ endType: endType as RecurrenceEnd['type'] })}
                options={[
                  { value: 'never', label: t('recurrence.endNever') },
                  { value: 'on', label: t('recurrence.endOn') },
                  { value: 'after', label: t('recurrence.endAfter') },
                ]}
              />
              {draft.endType === 'on' && (
                <DatePicker
                  label={t('recurrence.end')}
                  value={draft.endDate || dueDate}
                  onChange={(endDate) => patch({ endDate })}
                />
              )}
              {draft.endType === 'after' && (
                <Input
                  label={t('recurrence.countLabel')}
                  type="number"
                  min={1}
                  max={9999}
                  value={draft.endCount}
                  onChange={(event) => patch({ endCount: Math.max(1, Number(event.target.value) || 1) })}
                />
              )}
            </div>
          </div>

          {draft.endType === 'on' && draft.endDate && (
            <p className="text-xs text-fg-2">
              {t('detail.dueLabel')}: {localDate.formatDate(dueDate)} → {localDate.formatDate(draft.endDate)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
