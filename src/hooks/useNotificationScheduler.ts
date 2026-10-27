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

async function showNotification(title: string, body: string, tag: string, url: string): Promise<void> {
  const options: NotificationOptions = { body, tag, data: { url } };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    /* notifications can throw on some platforms — in-app badges remain */
  }
}

/**
 * Best-effort browser notifications. Without a push server these only fire
 * while the app is open (or its service worker is alive), so the in-app
 * Overdue/Today sections remain the source of truth. Checks run on mount,
 * when the tab becomes visible, and every 60 s while visible.
 */
export function useNotificationScheduler(): void {
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { settings } = useSettingsStore.getState();
      if (!settings.notificationsEnabled) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      if (document.visibilityState !== 'visible') return;

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

        fired[slot.id] = Date.now();
        dirty = true;
        if (!cancelled) {
          void showNotification(reminder.title, body, slot.id, `#/reminder/${reminder.id}`);
        }
      }
      if (dirty) writeFired(fired);
    };

    void check();
    const interval = setInterval(() => void check(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [t]);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}
