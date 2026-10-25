/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// VITAL AGE — Vite-Konfiguration
// PWA (installierbar, offline-fähig) + Proxy auf den lokalen API-Server.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png'],
      manifest: {
        name: 'VITAL AGE',
        short_name: 'VitalAge',
        description:
          'Verstehe deinen Körper. Erkenne deine Trends. Verbessere deine Gewohnheiten.',
        theme_color: '#0B0F12',
        background_color: '#0B0F12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        lang: 'de',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // API-Nachfragen niemals aus dem Offline-Cache bedienen
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      // Der lokale API-Server (server/index.ts) läuft auf 8787
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
