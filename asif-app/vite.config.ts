import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // Capacitor ML Kit uses registerPlugin({ web: () => import('./web') }). Without eager
  // optimization, the pre-bundled web-*.js chunk can 404 after HMR / server restarts (stale ?v= hash).
  optimizeDeps: {
    include: [
      '@capacitor/core',
      '@capacitor/device',
      '@capacitor/preferences',
      '@capacitor-mlkit/barcode-scanning',
      '@capacitor-mlkit/barcode-scanning/dist/esm/web.js',
    ],
  },
  server: {
    port: 5175,
    strictPort: true,
  },
})
