/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: {
    // Shown in Settings → About so a device's running bundle is identifiable.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // autoUpdate: a newly deployed worker activates itself, so the next app
      // open serves the fresh bundle without the user having to react to a
      // prompt — missed prompts left devices on stale (buggy) builds.
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'Duezy — Due Date Reminders',
        short_name: 'Duezy',
        description: 'Track due dates, bills, installments and appointments. Offline-first, Persian and English.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f14',
        theme_color: '#0d9488',
        lang: 'en',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'api/**/*.spec.ts'],
  },
});
