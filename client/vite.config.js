import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // One engine registry, imported by both halves of the app.
    alias: { '@shared': shared },
  },
  server: {
    port: 5173,
    // shared/ sits outside client/, so the dev server must be told it may read it.
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,                 // the terminal's WebSocket rides the same prefix
      },
      '/workspace': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // The asset library. Without this every thumbnail on the Assets page, and every
      // sprite a game loads, 404s in dev while working in the built app - the same
      // path-contract bug that bit /workspace/assets on the server side.
      '/assets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
});
