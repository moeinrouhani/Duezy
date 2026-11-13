import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutState {
  /** Desktop sidebar shrunk to an icon rail. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

/**
 * Persisted layout preferences. localStorage hydrates synchronously, so a
 * collapsed sidebar renders collapsed on first paint — no animation on load.
 */
export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: 'duezy-layout', version: 1 },
  ),
);
