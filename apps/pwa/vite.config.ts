import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/** Base path of the deployment, e.g. "/CuppaScore/" on GitHub Pages; "/" locally (README §14.3). */
function basePath(): string {
  const raw = process.env.BASE_PATH?.trim() || '/';
  const withLead = raw.startsWith('/') ? raw : `/${raw}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

const base = basePath();

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'CupLog',
        short_name: 'CupLog',
        description: 'Log and rate every cup of coffee.',
        start_url: `${base}?source=homescreen`,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1e1410',
        theme_color: '#1e1410',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Log a cup', url: `${base}#/log?mode=home`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Log café coffee', url: `${base}#/log?mode=cafe`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // region catalogs (catalog/*.csv, F4) are precached so they load offline after the first visit
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,csv}'],
        navigateFallback: `${base}index.html`,
        // catalog.json changes independently of the app shell: serve fresh when online (README §6.1, E3)
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/catalog(\.min)?\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'catalog' },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? 'dev'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
});
