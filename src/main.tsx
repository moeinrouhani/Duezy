import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/vazirmatn';
import './index.css';
import { i18n } from './i18n';
import App, { router } from './App';
import { openDatabase } from './db/db';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { registerSW } from 'virtual:pwa-register';
import { noteServiceWorkerUpdate } from './pwa/update';

async function bootstrap() {
  await openDatabase();

  // Keep i18n in sync with the persisted language before first render.
  const { settings } = useSettingsStore.getState();
  if (i18n.language !== settings.lang) await i18n.changeLanguage(settings.lang);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // PWA: route notification deep-links; keep the (rare, autoUpdate-mode)
  // waiting-worker hook so Settings can force an update on demand.
  const updateSw = registerSW({
    onNeedRefresh() {
      noteServiceWorkerUpdate(updateSw);
      const { showSnackbar } = useUiStore.getState();
      showSnackbar(i18n.t('common.updateAvailable'), {
        label: i18n.t('common.reload'),
        onAction: () => location.reload(),
      });
    },
  });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'navigate' && typeof event.data.url === 'string') {
      router.navigate(event.data.url.replace(/^#/, ''));
    }
  });
}

void bootstrap();
