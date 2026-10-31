import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { getRepositories } from '../../repositories';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { Collapse } from '../../components/ui/Collapse';
import { ChevronDown } from 'lucide-react';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { useReminders, useCategories } from '../../hooks/useReminders';
import { useSettingsStore } from '../../stores/settingsStore';
import { todayISO } from '../../domain/date';
import { CATEGORY_COLOR_HEX } from '../../themes/accents';
import { cn } from '../../utils/cn';
import { parseAmount } from '../../utils/digits';
import type { AlertOffset, ReminderDraft } from '../../domain/types';
import { AlertPicker } from './AlertPicker';
import {
  RecurrenceEditor,
  EMPTY_DRAFT,
  draftToRule,
  ruleToDraft,
  type RecurrenceDraft,
} from './RecurrenceEditor';

export function ReminderForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = id !== undefined;

  const { create, update } = useReminders();
  const { categories } = useCategories();
  const settings = useSettingsStore((s) => s.settings);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState('');
  const [notes, setNotes] = useState('');
  const [alerts, setAlerts] = useState<AlertOffset[]>(settings.defaultAlertOffsets);
  const [recurrence, setRecurrence] = useState<RecurrenceDraft>({ ...EMPTY_DRAFT, calendar: settings.calendar });
  const [pinned, setPinned] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [ready, setReady] = useState(!editing);

  // Load existing reminder when editing.
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void (async () => {
      const repos = await getRepositories();
      const reminder = await repos.reminders.get(id!);
      // StrictMode double-invokes effects: the discarded first run resolves
      // after its own cleanup — bail silently, never navigate on cancel.
      if (cancelled) return;
      if (!reminder) {
        navigate('/');
        return;
      }
      setTitle(reminder.title);
      setDueDate(reminder.dueDate);
      setCategoryId(reminder.categoryId);
      setAmountText(reminder.amount !== undefined ? String(reminder.amount) : '');
      setCurrency(reminder.currency ?? '');
      setNotes(reminder.notes ?? '');
      setAlerts(reminder.alerts.offsets);
      setRecurrence(ruleToDraft(reminder.recurrence, reminder.paidCount ?? 0));
      setPinned(reminder.pinned);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, id, navigate]);

  // Default category: first available.
  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const amount = useMemo(() => parseAmount(amountText), [amountText]);

  const save = async () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    const { rule, paidCount } = draftToRule(recurrence, dueDate);
    const draft: ReminderDraft = {
      title: title.trim(),
      dueDate,
      categoryId: categoryId || categories[0]?.id || 'cat-other',
      notes: notes.trim() || undefined,
      amount: amountText.trim() ? amount : undefined,
      currency: currency.trim() || undefined,
      recurrence: rule,
      paidCount,
      alerts: { offsets: alerts },
      pinned,
    };
    if (editing) {
      await update(id!, draft);
    } else {
      await create(draft);
    }
    navigate('/');
  };

  if (!ready) {
    return (
      <div>
        <PageHeader title={t('form.editTitle')} showBack />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={editing ? t('form.editTitle') : t('form.newTitle')} showBack />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Input
          label={t('form.titleLabel')}
          placeholder={t('form.titlePlaceholder')}
          value={title}
          error={titleError ? t('form.titleRequired') : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
            if (event.target.value.trim()) setTitleError(false);
          }}
          autoFocus={!editing}
          required
        />

        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-2">{t('form.dueDateLabel')}</p>
          <DatePicker label={t('form.dueDateLabel')} value={dueDate} onChange={setDueDate} />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-2">{t('form.categoryLabel')}</p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => {
              const active = category.id === categoryId;
              const color = CATEGORY_COLOR_HEX[category.color];
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-[background-color,color,transform] duration-200 active:scale-95',
                    active ? 'border-transparent text-white' : 'border-line bg-surface text-fg-2 hover:text-fg-1',
                  )}
                  style={active ? { backgroundColor: color } : undefined}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: active ? 'rgba(255,255,255,.8)' : color }}
                    aria-hidden
                  />
                  {category.nameKey ? t(category.nameKey) : category.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-fg-2">{t('form.alertsLabel')}</p>
          <AlertPicker offsets={alerts} onChange={setAlerts} />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <button
            type="button"
            aria-expanded={advanced}
            className="flex w-full items-center justify-between text-start text-sm font-medium text-accent-600 dark:text-accent-400"
            onClick={() => setAdvanced((value) => !value)}
          >
            {advanced ? t('form.lessOptions') : t('form.moreOptions')}
            <ChevronDown size={16} aria-hidden className={cn('transition-transform duration-300 ease-[var(--ease-out)]', advanced && 'rotate-180')} />
          </button>

          <Collapse open={advanced}>
            <div className="flex flex-col gap-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('form.amountLabel')}
                  placeholder={t('form.amountPlaceholder')}
                  value={amountText}
                  inputMode="decimal"
                  onChange={(event) => setAmountText(event.target.value)}
                />
                <Input
                  label={t('form.currencyLabel')}
                  placeholder={t('form.currencyPlaceholder')}
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                />
              </div>
              <Textarea
                label={t('form.notesLabel')}
                placeholder={t('form.notesPlaceholder')}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <Toggle label={t('form.pinnedLabel')} checked={pinned} onChange={setPinned} />
              <RecurrenceEditor draft={recurrence} onChange={setRecurrence} dueDate={dueDate} />
            </div>
          </Collapse>
        </div>

        {/* Clears the bottom nav plus the phone's gesture-bar inset. */}
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex gap-3 rounded-2xl bg-bg/80 py-2 backdrop-blur-md md:bottom-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="flex-1">
            {t('common.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
