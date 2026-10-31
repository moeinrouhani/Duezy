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
    'bg-accent-600 text-white shadow-sm shadow-accent-600/25 hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/30 active:bg-accent-800 dark:bg-accent-500 dark:shadow-accent-500/20 dark:hover:bg-accent-600 dark:text-white',
  secondary:
    'bg-surface text-fg-1 border border-line shadow-card hover:bg-surface-2 hover:border-fg-2/30 dark:bg-surface-2 dark:hover:bg-line',
  ghost: 'text-fg-2 hover:text-fg-1 hover:bg-surface-2',
  danger: 'bg-danger text-white shadow-sm shadow-danger/25 hover:brightness-110',
};

const SIZE_CLASSES: Record<Size, string> = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium select-none',
        'transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-out',
        'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
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
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-fg-2',
        'transition-[background-color,color,transform] duration-150 ease-out',
        'hover:bg-surface-2 hover:text-fg-1 active:scale-90',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
