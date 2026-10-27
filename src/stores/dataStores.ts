import { create } from 'zustand';
import type { Category, Reminder } from '../domain/types';
import { getRepositories } from '../repositories';

interface ReminderState {
  reminders: Reminder[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
}

/** Mirrors the repository list; screens read from here to stay reactive. */
export const useReminderStore = create<ReminderState>()((set) => ({
  reminders: [],
  loading: false,
  loaded: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const repos = await getRepositories();
      const reminders = await repos.reminders.list();
      set({ reminders, loading: false, loaded: true });
    } catch {
      set({ loading: false });
    }
  },
}));

interface CategoryState {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useCategoryStore = create<CategoryState>()((set) => ({
  categories: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const repos = await getRepositories();
      const categories = await repos.categories.list();
      set({ categories, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
