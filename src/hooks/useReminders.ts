import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRepositories } from '../repositories';
import { useReminderStore, useCategoryStore } from '../stores/dataStores';
import { useUiStore } from '../stores/uiStore';
import type { ISODate, Reminder, ReminderDraft } from '../domain/types';

/**
 * CRUD facade over the repositories. Every action refreshes the mirror store;
 * destructive/settling actions offer Undo through the snackbar.
 */
export function useReminders() {
  const { t } = useTranslation();
  const reminders = useReminderStore((s) => s.reminders);
  const loading = useReminderStore((s) => s.loading);
  const refresh = useReminderStore((s) => s.refresh);
  const showSnackbar = useUiStore((s) => s.showSnackbar);

  useEffect(() => {
    if (!useReminderStore.getState().loaded) void refresh();
  }, [refresh]);

  const create = useCallback(
    async (draft: ReminderDraft): Promise<Reminder> => {
      const repos = await getRepositories();
      const reminder = await repos.reminders.create(draft);
      await refresh();
      return reminder;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ReminderDraft>): Promise<Reminder> => {
      const repos = await getRepositories();
      const reminder = await repos.reminders.update(id, patch);
      await refresh();
      return reminder;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const repos = await getRepositories();
      await repos.reminders.softDelete(id);
      await refresh();
      showSnackbar(t('detail.deletedToast'), {
        label: t('common.undo'),
        onAction: () => {
          void (async () => {
            await repos.reminders.restore(id);
            await refresh();
          })();
        },
      });
    },
    [refresh, showSnackbar, t],
  );

  const complete = useCallback(
    async (id: string, opts?: { skipped?: boolean }) => {
      const repos = await getRepositories();
      const { completion } = await repos.reminders.complete(id, opts);
      await refresh();
      showSnackbar(t(opts?.skipped ? 'detail.skippedToast' : 'detail.completedToast'), {
        label: t('common.undo'),
        onAction: () => {
          void (async () => {
            await repos.reminders.undoComplete(id);
            await refresh();
            showSnackbar(t('detail.undoneToast'));
          })();
        },
      });
      return completion;
    },
    [refresh, showSnackbar, t],
  );

  const undoComplete = useCallback(
    async (id: string) => {
      const repos = await getRepositories();
      await repos.reminders.undoComplete(id);
      await refresh();
      showSnackbar(t('detail.undoneToast'));
    },
    [refresh, showSnackbar, t],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const repos = await getRepositories();
      await repos.reminders.togglePin(id);
      await refresh();
    },
    [refresh],
  );

  /** Settle one concrete occurrence (dashboard check marks). */
  const completeOccurrence = useCallback(
    async (id: string, dueDate: ISODate, opts?: { skipped?: boolean }) => {
      const repos = await getRepositories();
      const { completion } = await repos.reminders.completeOccurrence(id, dueDate, opts);
      await refresh();
      showSnackbar(t(opts?.skipped ? 'detail.skippedToast' : 'detail.completedToast'), {
        label: t('common.undo'),
        onAction: () => {
          void (async () => {
            await repos.reminders.undoOccurrence(id, dueDate);
            await refresh();
            showSnackbar(t('detail.undoneToast'));
          })();
        },
      });
      return completion;
    },
    [refresh, showSnackbar, t],
  );

  /** Un-settle one concrete occurrence (dashboard uncheck). */
  const undoOccurrence = useCallback(
    async (id: string, dueDate: ISODate) => {
      const repos = await getRepositories();
      await repos.reminders.undoOccurrence(id, dueDate);
      await refresh();
      showSnackbar(t('detail.undoneToast'));
    },
    [refresh, showSnackbar, t],
  );

  return {
    reminders,
    loading,
    refresh,
    create,
    update,
    remove,
    complete,
    undoComplete,
    togglePin,
    completeOccurrence,
    undoOccurrence,
  };
}

export function useCategories() {
  const categories = useCategoryStore((s) => s.categories);
  const refresh = useCategoryStore((s) => s.refresh);

  useEffect(() => {
    if (useCategoryStore.getState().categories.length === 0) void refresh();
  }, [refresh]);

  return { categories, refresh };
}
