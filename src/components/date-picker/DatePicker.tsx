import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import type { ISODate, Weekday } from '../../domain/types';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLocalDate } from '../../hooks/useLocalDate';
import { cn } from '../../utils/cn';
import { DualCalendarPanel } from './DualCalendarPanel';
import { Modal } from '../ui/Modal';

interface Props {
  value: ISODate;
  onChange: (iso: ISODate) => void;
  label: string;
}

/**
 * Field + sheet picker. The sheet hosts the dual-calendar panel, so the same
 * component serves Jalali and Gregorian entry (and either direction shows the
 * other system on toggle in Settings).
 */
export function DatePicker({ value, onChange, label }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const calendar = useSettingsStore((s) => s.settings.calendar);
  const weekStart = useSettingsStore((s) => s.settings.weekStart);
  const localDate = useLocalDate();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={cn(
          'group flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-card',
          'transition-[border-color,box-shadow,transform] duration-150 hover:border-accent-400 active:scale-[0.99]',
        )}
      >
        <span>{localDate.formatDate(value)}</span>
        <CalendarDays size={16} className="text-fg-2 transition-colors group-hover:text-accent-600 dark:group-hover:text-accent-400" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={label} variant="sheet">
        <DualCalendarPanel
          calendar={calendar}
          weekStart={weekStart}
          value={value}
          onChange={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
        <p className="mt-3 text-center text-xs text-fg-2">
          {t(`settings.${calendar === 'jalali' ? 'jalali' : 'gregorian'}`)}
        </p>
      </Modal>
    </>
  );
}

export type { Weekday };
