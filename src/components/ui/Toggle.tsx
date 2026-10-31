import { cn } from '../../utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

/** Accessible switch built on a checkbox. */
export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-3', disabled && 'opacity-50 pointer-events-none')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'group relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent-600 dark:bg-accent-500' : 'bg-fg-2/30 dark:bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md',
            'transition-[inset-inline-start,width] duration-300 ease-[var(--ease-spring)]',
            'group-active:w-6',
            checked ? 'start-[1.25rem] group-active:start-[1rem]' : 'start-0.5',
          )}
        />
      </button>
      {label && <span className="text-sm text-fg-1">{label}</span>}
    </label>
  );
}
