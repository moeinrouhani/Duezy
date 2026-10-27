import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Info } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Toggle } from '../../components/ui/Toggle';
import { useConfirm } from '../../components/ui/Snackbar';
import { AlertPicker } from '../reminder-form/AlertPicker';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { ACCENTS } from '../../themes/accents';
import { requestNotificationPermission } from '../../hooks/useNotificationScheduler';
import { createBackup, downloadBackup, importBackup } from '../../utils/backup';
import { useUiStore } from '../../stores/uiStore';
import { syncNow } from '../../sync/engine';
import { cn } from '../../utils/cn';
import type { AccentColor, AlertOffset, CalendarSystem, Lang, ThemeMode, Weekday } from '../../domain/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs font-semibold text-fg-2">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="mt-0.5 text-xs leading-5 text-fg-2">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { settings, update } = useSettingsStore();
  const showSnackbar = useUiStore((s) => s.showSnackbar);
  const confirm = useConfirm();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const syncStatus = useSyncStore((s) => s.status);
  const lastSyncedAtMs = useSyncStore((s) => s.lastSyncedAtMs);

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  const syncLine = () => {
    if (syncStatus === 'syncing') return t('auth.syncing');
    if (syncStatus === 'error') return t('auth.syncError');
    if (syncStatus === 'offline') return t('auth.offline');
    if (syncStatus === 'unavailable') return t('auth.syncUnavailable');
    if (lastSyncedAtMs === null) return t('auth.neverSynced');
    const time = new Date(lastSyncedAtMs).toLocaleTimeString(i18n.language === 'fa' ? 'fa-IR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return t('auth.lastSyncedAt', { time });
  };

  const onSyncNow = async () => {
    const outcome = await syncNow();
    if (outcome === 'synced') showSnackbar(t('auth.syncedToast'));
    else if (outcome === 'failed') showSnackbar(t('auth.syncError'));
  };

  const onSignOut = async () => {
    const ok = await confirm('auth.signOutConfirmTitle', 'auth.signOutConfirmMessage');
    if (!ok) return;
    await signOut();
    showSnackbar(t('auth.signedOutToast'));
  };

  const onExport = async () => {
    const backup = await createBackup(settings);
    downloadBackup(backup);
    showSnackbar(t('backup.exportedToast'));
  };

  const onImportFile = async (file: File) => {
    try {
      const { result } = await importBackup(await file.text());
      showSnackbar(t('backup.importedToast_other', { count: result.reminders }));
      if (result.settingsApplied) showSnackbar(t('backup.settingsAppliedToast'));
    } catch (error) {
      const key = error instanceof Error && !error.message.startsWith('[') ? error.message : 'backup.importFailed';
      showSnackbar(t(key, { defaultValue: t('backup.importFailed') }));
    }
  };

  const onToggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      update({ notificationsEnabled: false });
      return;
    }
    const result = await requestNotificationPermission();
    setPermission(result);
    update({ notificationsEnabled: result === 'granted' });
    if (result === 'denied') showSnackbar(t('settings.permissionDenied'));
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('settings.title')} />

      <Section title={t('settings.accountTitle')}>
        {user ? (
          <>
            <Row label={t('auth.signedInAs')} hint={syncLine()}>
              <span className="max-w-40 truncate text-sm font-medium" dir="ltr">
                {user.displayName ?? user.username}
              </span>
            </Row>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={syncStatus === 'syncing'}
                onClick={() => void onSyncNow()}
              >
                {t('auth.syncNow')}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => void onSignOut()}>
                {t('auth.signOut')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Row label={t('auth.neverSynced')} hint={t('settings.accountHint')}>
              <span />
            </Row>
            <Button onClick={() => navigate('/auth')}>
              {t('auth.loginTab')} / {t('auth.registerTab')}
            </Button>
          </>
        )}
      </Section>

      <Section title={t('settings.languageLabel')}>
        <SegmentedControl<Lang>
          label={t('settings.languageLabel')}
          value={settings.lang}
          onChange={(lang) => update({ lang })}
          options={[
            { value: 'fa', label: 'فارسی' },
            { value: 'en', label: 'English' },
          ]}
        />
        <SegmentedControl<CalendarSystem>
          label={t('settings.calendarLabel')}
          value={settings.calendar}
          onChange={(calendar) => update({ calendar })}
          options={[
            { value: 'jalali', label: t('settings.jalali') },
            { value: 'gregorian', label: t('settings.gregorian') },
          ]}
        />
      </Section>

      <Section title={t('settings.appearanceLabel')}>
        <Row label={t('settings.themeLabel')}>
          <SegmentedControl<ThemeMode>
            value={settings.themeMode}
            onChange={(themeMode) => update({ themeMode })}
            options={[
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
              { value: 'system', label: t('settings.themeSystem') },
            ]}
            className="w-52"
          />
        </Row>
        <div>
          <p className="mb-2 text-sm">{t('settings.accentLabel')}</p>
          <div className="flex gap-2.5">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                type="button"
                aria-label={t('accent.' + accent.id)}
                aria-pressed={settings.accent === accent.id}
                title={t('accent.' + accent.id)}
                onClick={() => update({ accent: accent.id as AccentColor })}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition',
                  settings.accent === accent.id ? 'border-fg-1 scale-110' : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: accent.swatch }}
              />
            ))}
          </div>
        </div>
        <Row label={t('settings.weekStartLabel')}>
          <SegmentedControl<Weekday>
            value={settings.weekStart}
            onChange={(weekStart) => update({ weekStart })}
            options={[
              { value: 6, label: t('settings.weekSat') },
              { value: 0, label: t('settings.weekSun') },
              { value: 1, label: t('settings.weekMon') },
            ]}
            className="w-56"
          />
        </Row>
      </Section>

      <Section title={t('settings.notificationsTitle')}>
        <Toggle
          label={t('settings.enableLabel')}
          checked={settings.notificationsEnabled && permission === 'granted'}
          onChange={(enabled) => void onToggleNotifications(enabled)}
        />
        <p className="text-xs leading-5 text-fg-2">{t('settings.enableHint')}</p>
        <Row label={t('settings.notifyTimeLabel')}>
          <input
            type="time"
            value={settings.notifyTime}
            onChange={(event) => update({ notifyTime: event.target.value })}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:border-accent-500 focus:outline-none"
          />
        </Row>
        <div>
          <p className="mb-2 text-sm">{t('settings.defaultAlertsLabel')}</p>
          <AlertPicker
            offsets={settings.defaultAlertOffsets}
            onChange={(offsets) => update({ defaultAlertOffsets: offsets as AlertOffset[] })}
          />
        </div>
      </Section>

      <Section title={t('settings.backupTitle')}>
        <p className="text-xs leading-5 text-fg-2">{t('settings.importHint')}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => void onExport()}>
            {t('settings.exportLabel')}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => fileInput.current?.click()}>
            {t('settings.importLabel')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onImportFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </Section>

      <Section title={t('settings.aboutTitle')}>
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
          <p className="text-sm leading-6 text-fg-2">{t('settings.aboutBody')}</p>
        </div>
        <p className="text-xs text-fg-2">
          {t('settings.versionLabel')} 1.0.0 · {t('app.tagline')}
        </p>
      </Section>
    </div>
  );
}
