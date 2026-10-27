import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fa from './locales/fa.json';
import { localizeNumeric } from '../utils/digits';
import type { Lang } from '../domain/types';

export const SUPPORTED_LANGS: Lang[] = ['fa', 'en'];

/**
 * Numeric interpolations render with Persian digits when the active language
 * is fa: t('common.inDays', { count: 3 }) → «۳ روز دیگر».
 */
function formatValue(value: unknown, _format: string | undefined, lng: string | undefined): string {
  if (typeof value === 'number') return localizeNumeric(value, lng === 'fa' ? 'fa' : 'en');
  return String(value);
}

export const i18n: I18n = i18next.createInstance();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fa: { translation: fa },
  },
  lng: 'fa',
  fallbackLng: 'en',
  interpolation: { escapeValue: false, format: (value, format, lng) => formatValue(value, format, lng) },
  returnObjects: true,
});

/** Runtime language switch (html attrs are applied by useTheme). */
export async function setLanguage(lang: Lang): Promise<void> {
  if (i18n.language !== lang) await i18n.changeLanguage(lang);
}
