import { useEffect, useState } from 'react';
import type { CompletionRecord } from '../domain/types';
import { getRepositories } from '../repositories';
import { useReminderStore } from '../stores/dataStores';

/**
 * All live completions, refreshed whenever the reminder mirror changes.
 * Occurrence-level checked state and per-reminder progress derive from this.
 */
export function useCompletions(): CompletionRecord[] {
  const [completions, setCompletions] = useState<CompletionRecord[]>([]);
  const remindersVersion = useReminderStore((s) => s.reminders);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const repos = await getRepositories();
        const rows = await repos.completions.listAll();
        if (!cancelled) setCompletions(rows);
      } catch {
        if (!cancelled) setCompletions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remindersVersion]);

  return completions;
}
