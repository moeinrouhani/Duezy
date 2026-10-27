/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// Deep-link notification clicks into the app: focus an existing window and
// tell it to navigate, or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (url) client.postMessage({ type: 'navigate', url });
        await client.focus();
        return;
      }
      if (url) {
        await self.clients.openWindow(new URL(url, self.registration.scope).toString());
      }
    })(),
  );
});
