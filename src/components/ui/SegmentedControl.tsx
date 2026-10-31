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

/**
 * Radio-group styled as a segmented control (keyboard accessible).
 * The selected pill slides between segments; it is positioned with
 * inset-inline-start so it tracks correctly in both LTR and RTL.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
}: Props<T>) {
  const count = options.length;
  const index = options.findIndex((option) => option.value === value);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('relative grid grid-flow-col auto-cols-fr rounded-xl bg-surface-2 p-1', className)}
    >
      {index >= 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-surface shadow-card ring-1 ring-black/[0.03] transition-[inset-inline-start] duration-300 ease-[var(--ease-out)] dark:ring-white/[0.06]"
          style={{
            width: `calc((100% - 0.5rem) / ${count})`,
            insetInlineStart: `calc(0.25rem + (100% - 0.5rem) / ${count} * ${index})`,
          }}
        />
      )}
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
              'relative z-10 min-w-0 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors duration-200',
              active ? 'text-fg-1' : 'text-fg-2 hover:text-fg-1',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
