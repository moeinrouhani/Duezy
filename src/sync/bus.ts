type SyncTrigger = () => void;

let trigger: SyncTrigger | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Bridge between the repository layer and the sync engine — the repos call
 * requestSync() after every mutation, and the engine registers the actual
 * trigger at boot. Keeping this in its own module avoids a circular import
 * (repositories → bus ← engine).
 */
export function setSyncTrigger(next: SyncTrigger | null): void {
  trigger = next;
}

/** Debounced: bursts of mutations (bulk import, multi-edit) coalesce into one sync. */
export function requestSync(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    trigger?.();
  }, 2500);
}
