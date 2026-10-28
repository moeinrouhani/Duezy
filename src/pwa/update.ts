/** Tracks a waiting service worker so Settings can apply it on demand. */

type ApplyUpdate = (reloadPage?: boolean) => Promise<void>;

let applyUpdate: ApplyUpdate | null = null;

/** Called from main.tsx when the browser reports a waiting service worker. */
export function noteServiceWorkerUpdate(apply: ApplyUpdate): void {
  applyUpdate = apply;
}

/**
 * Activate a waiting service worker and reload. Returns false when nothing
 * is pending — the running bundle is the latest deployed one.
 */
export function applyPendingUpdate(): boolean {
  if (!applyUpdate) return false;
  void applyUpdate(true);
  return true;
}
