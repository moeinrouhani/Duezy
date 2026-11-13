import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useReminderStore } from '../stores/dataStores';
import { useSettingsStore } from '../stores/settingsStore';
import { computeAlertSlots } from '../domain/alerts';
import type { AlertSlot } from '../domain/alerts';
import { daysUntil } from '../domain/date';

const FIRED_KEY = 'duezy-fired-alerts';
const PRUNE_MS = 30 * 86_400_000;
const CHECK_EVERY_MS = 30_000;
const ICON = '/icons/icon-192.png';

interface FiredLog {
  [slotId: string]: number;
}

function readFired(): FiredLog {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    return raw ? (JSON.parse(raw) as FiredLog) : {};
  } catch {
    return {};
  }
}

function writeFired(log: FiredLog): void {
  const cutoff = Date.now() - PRUNE_MS;
  const pruned = Object.fromEntries(Object.entries(log).filter(([, at]) => at > cutoff));
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(pruned));
  } catch {
    /* storage full — alerts will just re-fire once */
  }
}

/**
 * Show a notification and report whether the browser accepted it.
 *
 * Order matters: the service worker route is the only one that works on
 * Android Chrome and installed iOS PWAs (`new Notification()` throws there),
 * and it keeps working while the tab is in the background. The page-level
 * constructor is the fallback for desktop browsers / dev mode with no worker.
 * Failures used to be swallowed silently AND the alert was still marked as
 * delivered, so a single hiccup lost it forever — callers now get a boolean.
 */
async function showNotification(title: string, body: string, tag: string, url: string): Promise<boolean> {
  const options: NotificationOptions = { body, tag, icon: ICON, badge: ICON, data: { url } };

  try {
    if ('serviceWorker' in navigator && (await navigator.serviceWorker.getRegistration())) {
      // `.ready` waits for an active worker (a fresh install may still be activating).
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000)),
      ]);
      if (registration) {
        await registration.showNotification(title, options);
        return true;
      }
    }
  } catch (error) {
    console.warn('[duezy] service-worker notification failed, trying page notification', error);
  }

  try {
    new Notification(title, options);
    return true;
  } catch (error) {
    console.warn('[duezy] notification failed', error);
    return false;
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

async function checkAlerts(t: Translate): Promise<void> {
  const { settings } = useSettingsStore.getState();
  if (!settings.notificationsEnabled) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const { reminders, loaded } = useReminderStore.getState();
  // An unloaded store is "empty", not "nothing due" — wait for real data.
  if (!loaded) return;

  const now = Date.now();
  const fired = readFired();
  const due = computeAlertSlots(reminders, settings.notifyTime).filter(
    (slot) => slot.at.getTime() <= now && !fired[slot.id],
  );
  if (due.length === 0) return;

  // The app may have been closed for days, leaving several stages of one
  // reminder due at once. Notify once per reminder (its most recent stage).
  const latest = new Map<string, AlertSlot>();
  for (const slot of due) {
    const best = latest.get(slot.reminderId);
    if (!best || slot.at.getTime() > best.at.getTime()) latest.set(slot.reminderId, slot);
  }

  let dirty = false;
  for (const slot of due) {
    if (latest.get(slot.reminderId) !== slot) {
      fired[slot.id] = now; // superseded stage — nothing more to say about it
      dirty = true;
    }
  }

  for (const slot of latest.values()) {
    const reminder = reminders.find((r) => r.id === slot.reminderId);
    // Word it by the REAL distance to the due date, not the stage's offset.
    const remaining = daysUntil(slot.dueDate);
    if (!reminder || remaining < 0) {
      fired[slot.id] = now; // already overdue — the in-app Overdue list covers it
      dirty = true;
      continue;
    }
    const body = remaining === 0 ? t('notif.dueToday') : t('notif.dueIn', { count: remaining });
    // Only a notification the browser actually accepted counts as delivered;
    // otherwise the next tick retries.
    if (await showNotification(reminder.title, body, slot.id, `#/reminder/${reminder.id}`)) {
      fired[slot.id] = now;
      dirty = true;
    }
  }
  if (dirty) writeFired(fired);
}

/** Serialise checks across tabs/ticks so two of them can't both fire the same alert. */
async function runExclusive(task: () => Promise<void>): Promise<void> {
  if (navigator.locks) {
    // Awaited (not returned) so the result type is `void` whichever way the
    // installed TypeScript lib infers `request`'s generic (`Promise<void>` vs `void`).
    await navigator.locks.request('duezy-notify', { ifAvailable: true }, async (lock) => {
      if (lock) await task();
    });
    return;
  }
  await task();
}

/**
 * Best-effort browser notifications. Without a push server these fire while
 * the app is running — an open tab (visible OR in the background) or the
 * installed app — and anything missed while it was closed is delivered the
 * next time it opens. Checks run: on mount, whenever reminders/settings
 * change, on focus / visibility / reconnect, and every 30 s.
 *
 * (The old version skipped checks while the tab was hidden — exactly when a
 * notification is useful — and only polled once a minute.)
 */
export function useNotificationScheduler(): void {
  const { t, i18n } = useTranslation();
  const tRef = useRef<Translate>(t as unknown as Translate);
  useEffect(() => {
    tRef.current = t as unknown as Translate;
  });

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      void runExclusive(() => checkAlerts(tRef.current)).catch((error) =>
        console.warn('[duezy] alert check failed', error),
      );
    };
    const soon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(check, 400);
    };

    check();
    const interval = setInterval(check, CHECK_EVERY_MS);
    const unsubReminders = useReminderStore.subscribe(soon);
    const unsubSettings = useSettingsStore.subscribe(soon);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);

    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      unsubReminders();
      unsubSettings();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
    };
  }, [i18n.language]);
}

export type NotificationSupport = NotificationPermission | 'unsupported';

/** Current permission, or 'unsupported' when the browser has no Notification API. */
export function getNotificationPermission(): NotificationSupport {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

/** Fire a one-off notification so the user can verify the whole delivery path. */
export function sendTestNotification(title: string, body: string): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return Promise.resolve(false);
  return showNotification(title, body, `duezy-test-${Date.now()}`, '#/settings');
}
