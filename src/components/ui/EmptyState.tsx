import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('anim-page flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      <div className="anim-float flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-50 text-accent-600 ring-8 ring-accent-50/60 dark:bg-accent-950 dark:text-accent-300 dark:ring-accent-950/60">
        {icon}
      </div>
      <h3 className="mt-2 text-base font-semibold text-fg-1">{title}</h3>
      {body && <p className="max-w-xs text-sm leading-6 text-fg-2">{body}</p>}
      {action}
    </div>
  );
}

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ children, active, onClick, className }: ChipProps) {
  const interactive = onClick !== undefined;
  const Tag = interactive ? 'button' : 'span';
  return (
    <Tag
      // Buttons default to type="submit" — inside a form (e.g. the reminder
      // form's alert chips) that would submit on every tap.
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
        'transition-[background-color,color,transform,box-shadow] duration-200 ease-out',
        interactive && 'active:scale-95',
        active
          ? 'bg-accent-600 text-white shadow-sm shadow-accent-600/25 dark:bg-accent-500'
          : 'bg-surface-2 text-fg-2 hover:text-fg-1',
        interactive && !active && 'hover:bg-line',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
