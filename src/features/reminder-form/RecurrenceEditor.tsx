import { useTranslation } from 'react-i18next';
import type { CalendarSystem, RecurrenceEnd, RecurrenceFreq, RecurrenceRule, Weekday } from '../../domain/types';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Input } from '../../components/ui/Input';
import { Chip } from '../../components/ui/EmptyState';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { useLocalDate, weekdayOrder } from '../../hooks/useLocalDate';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatNumber } from '../../utils/digits';
import { weekdayNames } from './weekdayNames';

export interface RecurrenceDraft {
  freq: RecurrenceFreq | 'none';
  interval: number;
  byWeekday: Weekday[];
  endType: RecurrenceEnd['type'];
  endDate: string;
  /** TOTAL occurrences the user wants (the rule stores total − paid). */
  endCount: number;
  /** Installments already paid before tracking began (endType 'after' only). */
  paidCount: number;
  calendar: CalendarSystem;
}

export const EMPTY_DRAFT: RecurrenceDraft = {
  freq: 'none',
  interval: 1,
  byWeekday: [],
  endType: 'never',
  endDate: '',
  endCount: 4,
  paidCount: 0,
  calendar: 'jalali',
};

export function draftToRule(
  draft: RecurrenceDraft,
  dueDate: string,
): { rule: RecurrenceRule | null; paidCount?: number } {
  if (draft.freq === 'none') return { rule: null };
  let end: RecurrenceEnd;
  let paidCount: number | undefined;
  if (draft.endType === 'after') {
    // The rule counts only the REMAINING occurrences; paid ones live on the
    // reminder as paidCount so progress starts partway through the series.
    const total = Math.max(1, draft.endCount);
    const paid = Math.min(Math.max(0, draft.paidCount), total - 1);
    paidCount = paid > 0 ? paid : undefined;
    end = { type: 'after', count: total - paid };
  } else if (draft.endType === 'on' && draft.endDate) {
    end = { type: 'on', date: draft.endDate };
  } else {
    end = { type: 'never' };
  }
  return {
    rule: {
      freq: draft.freq,
      interval: Math.max(1, draft.interval),
      byWeekday: draft.freq === 'weekly' && draft.byWeekday.length > 0 ? draft.byWeekday : undefined,
      calendar: draft.calendar,
      start: dueDate,
      end,
    },
    paidCount,
  };
}

export function ruleToDraft(rule: RecurrenceRule | null, paidCount = 0): RecurrenceDraft {
  if (!rule) return { ...EMPTY_DRAFT };
  return {
    freq: rule.freq,
    interval: rule.interval,
    byWeekday: rule.byWeekday ?? [],
    endType: rule.end.type,
    endDate: rule.end.type === 'on' ? rule.end.date : '',
    endCount: rule.end.type === 'after' ? rule.end.count + paidCount : 4,
    paidCount,
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
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  const weekStart = useSettingsStore((s) => s.settings.weekStart);
  const localDate = useLocalDate();
  const patch = (partial: Partial<RecurrenceDraft>) => onChange({ ...draft, ...partial });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <SegmentedControl
        label={t('recurrence.label')}
        value={draft.freq}
        onChange={(freq) => patch({ freq: freq as RecurrenceDraft['freq'] })}
        options={FREQ_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
      />

      {draft.freq !== 'none' && (
        <div className="anim-fade-in flex flex-col gap-4">
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
                <>
                  <Input
                    label={t('recurrence.countLabel')}
                    type="number"
                    min={1}
                    max={9999}
                    value={draft.endCount}
                    onChange={(event) => {
                      const total = Math.max(1, Number(event.target.value) || 1);
                      patch({ endCount: total, paidCount: Math.min(draft.paidCount, total - 1) });
                    }}
                  />
                  {/* Installments settled before tracking — progress starts partway. */}
                  <Input
                    label={t('recurrence.paidLabel')}
                    type="number"
                    min={0}
                    max={draft.endCount - 1}
                    value={draft.paidCount}
                    onChange={(event) =>
                      patch({ paidCount: Math.min(Math.max(0, Number(event.target.value) || 0), draft.endCount - 1) })
                    }
                  />
                  {draft.paidCount > 0 && (
                    <p className="text-xs text-fg-2">
                      {t('recurrence.paidHint', {
                        paid: formatNumber(draft.paidCount, lang),
                        total: formatNumber(draft.endCount, lang),
                        remaining: formatNumber(draft.endCount - draft.paidCount, lang),
                      })}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {draft.endType === 'on' && draft.endDate && (
            <p className="text-xs text-fg-2">
              {t('detail.dueLabel')}: {localDate.formatDate(dueDate)} → {localDate.formatDate(draft.endDate)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
