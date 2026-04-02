import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // Lets Firebase Google sign-in use a popup (default COOP breaks window.closed in Chrome).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    // Same-origin API in dev: avoids embedded browsers / IPv6 localhost issues with http://localhost:3002
    proxy: {
      '/asif-api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/asif-api/, '') || '/',
      },
    },
  },
})
