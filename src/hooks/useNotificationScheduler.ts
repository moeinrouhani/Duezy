import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReminderStore } from '../stores/dataStores';
import { useSettingsStore } from '../stores/settingsStore';
import { computeAlertSlots } from '../domain/alerts';

const FIRED_KEY = 'duezy-fired-alerts';
const PRUNE_MS = 30 * 86_400_000;

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

/** Resolves false when the OS refused the notification, so it can be retried. */
async function showNotification(title: string, body: string, tag: string, url: string): Promise<boolean> {
  const options: NotificationOptions = { body, tag, data: { url } };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return true;
  } catch {
    return false; // notifications can throw on some platforms — in-app badges remain
  }
}

/**
 * Best-effort browser notifications. Without a push server these only fire
 * while the app is running (closed apps have no scheduler), but any live
 * context counts — background tabs and occluded windows included. Checks run
 * on mount, once reminders have loaded, when notifications are (re)enabled,
 * and every 60 s; browsers throttle hidden-tab timers to about once a minute,
 * which matches the minute-level notify time. The in-app Overdue/Today
 * sections remain the source of truth.
 */
export function useNotificationScheduler(): void {
  const { t } = useTranslation();
  const notificationsEnabled = useSettingsStore((s) => s.settings.notificationsEnabled);
  const remindersLoaded = useReminderStore((s) => s.loaded);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { settings } = useSettingsStore.getState();
      if (!settings.notificationsEnabled) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      // Empty ≠ settled: skip until the store has loaded, so a slow Dexie
      // read can't pass as "nothing to notify".
      if (!useReminderStore.getState().loaded) return;

      const reminders = useReminderStore.getState().reminders;
      const slots = computeAlertSlots(reminders, settings.notifyTime);
      const now = Date.now();
      const fired = readFired();
      let dirty = false;

      for (const slot of slots) {
        if (slot.at.getTime() > now) continue;
        if (fired[slot.id]) continue;

        const reminder = reminders.find((r) => r.id === slot.reminderId);
        if (!reminder) continue;

        // A slot fires exactly `offset` days before its due date, so the
        // distance to the due date at fire time is the offset itself.
        const body =
          slot.offset === 0 ? t('notif.dueToday') : t('notif.dueIn_other', { count: slot.offset });

        if (cancelled) break;
        const ok = await showNotification(reminder.title, body, slot.id, `#/reminder/${reminder.id}`);
        // Record only successful shows so a blocked one retries next pass.
        if (ok) {
          fired[slot.id] = Date.now();
          dirty = true;
        }
      }
      if (dirty) writeFired(fired);
    };

    void check();
    const interval = setInterval(() => void check(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [t, notificationsEnabled, remindersLoaded]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}
