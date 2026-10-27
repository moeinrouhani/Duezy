import { useTranslation } from 'react-i18next';
import type { AlertOffset } from '../../domain/types';
import { Chip } from '../../components/ui/EmptyState';

const CHOICES: AlertOffset[] = [7, 3, 1, 0];

/** Multi-stage alert selection: day-of + 1/3/7 days before, any combination. */
export function AlertPicker({
  offsets,
  onChange,
}: {
  offsets: AlertOffset[];
  onChange: (offsets: AlertOffset[]) => void;
}) {
  const { t } = useTranslation();

  const toggle = (offset: AlertOffset) =>
    onChange(
      offsets.includes(offset)
        ? offsets.filter((item) => item !== offset)
        : [...offsets, offset].sort((a, b) => b - a),
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      {CHOICES.map((offset) => (
        <Chip key={offset} active={offsets.includes(offset)} onClick={() => toggle(offset)}>
          {offset === 0 ? t('alerts.dayOf') : t('alerts.dayBefore_other', { count: offset })}
        </Chip>
      ))}
    </div>
  );
}
