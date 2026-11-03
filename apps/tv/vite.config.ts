import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// En développement, Vite relaie le WebSocket et les fonds d'écran vers le serveur local.
export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true },
      '/wallpapers': 'http://127.0.0.1:8080',
    },
  },
  build: { target: 'es2022' },
});
