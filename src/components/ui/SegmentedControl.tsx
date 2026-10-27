import { cn } from '../../utils/cn';

interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}

/** Radio-group styled as a segmented control (keyboard accessible). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex rounded-xl bg-surface-2 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'bg-surface text-fg-1 shadow-sm'
                : 'text-fg-2 hover:text-fg-1',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
