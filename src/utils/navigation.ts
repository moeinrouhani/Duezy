import type { NavigateFunction } from 'react-router';

/**
 * Go back one entry — but only when there is an in-app entry to go back to.
 * `navigate(-1)` on a deep link (notification tap, bookmark, fresh tab) used
 * to leave the app entirely; fall back to the dashboard instead.
 */
export function goBack(navigate: NavigateFunction): void {
  const state = window.history.state as { idx?: number } | null;
  if (typeof state?.idx === 'number' && state.idx > 0) void navigate(-1);
  else void navigate('/', { replace: true });
}
