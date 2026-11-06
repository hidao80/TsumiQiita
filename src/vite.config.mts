import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// CSPは src-tauri/tauri.conf.json の app.security.csp で付与する（Tauriが本番の配信時にヘッダーとして付ける）
export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react(), tailwindcss()],
  // tauri dev はこのポートを devUrl として開く
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
