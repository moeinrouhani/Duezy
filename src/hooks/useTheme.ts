import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { setLanguage } from '../i18n';
import type { ThemeMode } from '../domain/types';

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

/**
 * Single writer for <html> attributes (lang, dir, data-accent, data-mode),
 * i18n language, and the system-theme listener. Mounted once in App.
 */
export function useTheme(): void {
  const lang = useSettingsStore((s) => s.settings.lang);
  const themeMode = useSettingsStore((s) => s.settings.themeMode);
  const accent = useSettingsStore((s) => s.settings.accent);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'fa' ? 'rtl' : 'ltr';
    root.dataset.accent = accent;
    void setLanguage(lang);
  }, [lang, accent]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.mode = resolveMode(themeMode);
    };
    apply();
    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }
  }, [themeMode]);
}
