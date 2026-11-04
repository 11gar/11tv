import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '11TV',
        short_name: '11TV',
        description: 'Télécommande de la TV 11TV',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1d222c',
        theme_color: '#1d222c',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // L'interface est mise en cache ; l'API et le WebSocket passent toujours par le réseau.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  server: {
    port: 5174,
    // En développement, Vite relaie l'API et le WebSocket vers le serveur HTTPS local.
    proxy: {
      '/api': { target: 'https://127.0.0.1:8443', secure: false, changeOrigin: true },
      '/ws': { target: 'wss://127.0.0.1:8443', ws: true, secure: false, changeOrigin: true },
    },
  },
  build: { target: 'es2022' },
});
