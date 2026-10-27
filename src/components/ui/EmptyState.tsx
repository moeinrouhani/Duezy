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
    <div className={cn('flex flex-col items-center gap-3 px-6 py-14 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-fg-2">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-fg-1">{title}</h3>
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
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-accent-600 text-white dark:bg-accent-500'
          : 'bg-surface-2 text-fg-2 hover:text-fg-1',
        interactive && !active && 'hover:bg-line',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
