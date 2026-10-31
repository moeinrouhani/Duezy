import type { ReactNode } from 'react';

/**
 * Height-animated disclosure. Content stays mounted (form state is untouched);
 * while closed it is made inert so it can't be tabbed into.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="collapse" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="collapse-inner">{children}</div>
    </div>
  );
}
