import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { CalendarSystem, RecurrenceEnd, RecurrenceFreq, RecurrenceRule, Weekday } from '../../domain/types';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Input } from '../../components/ui/Input';
import { Chip } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/Button';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { useLocalDate, weekdayOrder } from '../../hooks/useLocalDate';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatNumber, formatAmountInput, parseAmount } from '../../utils/digits';
import { cn } from '../../utils/cn';
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
  /**
   * Price overrides keyed by 1-based installment number ('1'…endCount, the
   * user-facing numbering — pre-tracking installments included).
   */
  installmentAmounts: Record<string, number>;
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
  installmentAmounts: {},
  calendar: 'jalali',
};

/** Drop empty/non-positive entries and anything outside 1…total. */
export function cleanInstallmentAmounts(
  amounts: Record<string, number>,
  total?: number,
): Record<string, number> | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(amounts).filter(
      ([key, value]) =>
        /^\d+$/.test(key) &&
        Number.isFinite(value) &&
        value > 0 &&
        (total === undefined || (Number(key) >= 1 && Number(key) <= total)),
    ),
  );
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

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

export function ruleToDraft(
  rule: RecurrenceRule | null,
  paidCount = 0,
  installmentAmounts?: Record<string, number>,
): RecurrenceDraft {
  if (!rule) return { ...EMPTY_DRAFT };
  return {
    freq: rule.freq,
    interval: rule.interval,
    byWeekday: rule.byWeekday ?? [],
    endType: rule.end.type,
    endDate: rule.end.type === 'on' ? rule.end.date : '',
    endCount: rule.end.type === 'after' ? rule.end.count + paidCount : 4,
    paidCount,
    installmentAmounts: installmentAmounts ?? {},
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
  currency,
}: {
  draft: RecurrenceDraft;
  onChange: (draft: RecurrenceDraft) => void;
  dueDate: string;
  currency?: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fa';
  const weekStart = useSettingsStore((s) => s.settings.weekStart);
  const localDate = useLocalDate();
  const patch = (partial: Partial<RecurrenceDraft>) => onChange({ ...draft, ...partial });
  const [overrideNum, setOverrideNum] = useState('');
  const [overrideAmount, setOverrideAmount] = useState('');

  const overrideEntries = Object.entries(draft.installmentAmounts)
    .map(([key, value]) => ({ num: Number(key), value }))
    .filter((entry) => Number.isInteger(entry.num) && entry.num >= 1)
    .sort((a, b) => a.num - b.num);
  const overrideNumValue = Math.max(1, Number(overrideNum) || 1);
  const overrideAmountValue = parseAmount(overrideAmount);
  const overrideAddable =
    overrideNumValue <= draft.endCount && overrideAmountValue !== undefined && overrideAmountValue > 0;

  const addOverride = () => {
    if (!overrideAddable || overrideAmountValue === undefined) return;
    patch({
      installmentAmounts: {
        ...draft.installmentAmounts,
        [String(overrideNumValue)]: overrideAmountValue,
      },
    });
    setOverrideNum('');
    setOverrideAmount('');
  };

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
                      patch({
                        endCount: total,
                        paidCount: Math.min(draft.paidCount, total - 1),
                        // A shorter series can't keep prices for past-the-end installments.
                        installmentAmounts: cleanInstallmentAmounts(draft.installmentAmounts, total) ?? {},
                      });
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

                  {/* Per-installment prices: override specific slots of the series. */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-fg-2">{t('recurrence.customAmountsLabel')}</p>
                    {overrideEntries.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {overrideEntries.map((entry) => (
                          <li
                            key={entry.num}
                            className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-1.5 text-xs"
                          >
                            <span className="font-medium">{t('recurrence.installmentShort', { n: entry.num })}</span>
                            <span className="ms-auto tabular-nums text-fg-1">
                              {formatNumber(entry.value, lang)}
                              {currency ? ` ${currency}` : ''}
                            </span>
                            <IconButton
                              label={t('common.delete')}
                              className="h-7 w-7 rounded-lg hover:bg-danger/10 hover:text-danger"
                              onClick={() => {
                                const next = { ...draft.installmentAmounts };
                                delete next[String(entry.num)];
                                patch({ installmentAmounts: next });
                              }}
                            >
                              <X size={13} />
                            </IconButton>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-end gap-2">
                      <div className="w-20">
                        <Input
                          label={t('recurrence.installmentNo')}
                          type="number"
                          min={1}
                          max={draft.endCount}
                          inputMode="numeric"
                          value={overrideNum}
                          placeholder="1"
                          onChange={(event) => setOverrideNum(event.target.value)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Input
                          label={t('form.amountLabel')}
                          inputMode="decimal"
                          value={overrideAmount}
                          onChange={(event) => setOverrideAmount(formatAmountInput(event.target.value, lang))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addOverride();
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={t('common.add')}
                        disabled={!overrideAddable}
                        onClick={addOverride}
                        className={cn(
                          'mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-[background-color,color,transform] duration-200 active:scale-95',
                          overrideAddable
                            ? 'border-accent-500/40 text-accent-600 hover:bg-accent-500/10 dark:text-accent-400'
                            : 'border-line text-fg-2/50',
                        )}
                      >
                        <Plus size={16} aria-hidden />
                      </button>
                    </div>
                    <p className="text-xs text-fg-2">{t('recurrence.customAmountHint')}</p>
                  </div>
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
