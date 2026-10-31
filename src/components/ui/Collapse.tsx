import type { ReactNode } from 'react';

/**
 * Height-animated disclosure. Content stays mounted (form state is untouched);
 * while closed it is made inert so it can't be tabbed into.
 *
 * Named `dz-collapse`, NOT `collapse`: Tailwind ships a `collapse` visibility
 * utility (for table rows) whose `visibility: collapse` rendered the region
 * permanently hidden — the "More options" section showed up empty.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="dz-collapse" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="dz-collapse-inner">{children}</div>
    </div>
  );
}
