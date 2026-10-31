import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}

/**
 * Round check control. The tick draws itself and a ring bursts outward only
 * when the state flips to checked — rows that mount already-checked stay quiet.
 */
export function CheckButton({ checked, onToggle, label, className }: Props) {
  const previous = useRef(checked);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (checked && !previous.current) {
      setBurst(true);
      const id = setTimeout(() => setBurst(false), 600);
      previous.current = checked;
      return () => clearTimeout(id);
    }
    previous.current = checked;
  }, [checked]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={label}
      title={label}
      aria-pressed={checked}
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
        'transition-[background-color,border-color,transform] duration-300 ease-[var(--ease-spring)] active:scale-85',
        checked
          ? 'border-accent-500 bg-accent-500 text-white'
          : 'border-fg-2/30 text-transparent hover:border-accent-500 hover:text-accent-500/60',
        className,
      )}
    >
      {burst && (
        <span
          aria-hidden
          className="anim-burst pointer-events-none absolute inset-[-2px] rounded-full border-2 border-accent-500"
        />
      )}
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          style={{
            strokeDasharray: 24,
            strokeDashoffset: checked ? 0 : 24,
            transition: 'stroke-dashoffset 0.32s var(--ease-out) 0.05s',
          }}
        />
      </svg>
    </button>
  );
}
