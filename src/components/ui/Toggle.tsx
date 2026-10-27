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
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent-600 dark:bg-accent-500' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start]',
            checked ? 'start-[1.25rem]' : 'start-0.5',
          )}
        />
      </button>
      {label && <span className="text-sm text-fg-1">{label}</span>}
    </label>
  );
}
