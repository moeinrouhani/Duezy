import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 dark:bg-accent-500 dark:hover:bg-accent-600 dark:text-white',
  secondary:
    'bg-surface-2 text-fg-1 hover:bg-line dark:bg-surface-2 dark:hover:bg-line border border-line',
  ghost: 'text-fg-2 hover:text-fg-1 hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors select-none disabled:opacity-50 disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg-1',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
