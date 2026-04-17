import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Base para GitHub Pages: https://erick-amaya.github.io/Nokia-Project-Platform/
  // Si usas dominio propio (ej. app.ingetel.com) cambia esto a '/'
  base: '/Nokia-Project-Platform/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Show update prompt automatically when new SW is ready
      injectRegister: 'auto',
      workbox: {
        // Pre-cache all assets from the build
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't let SW cache Supabase API calls — always go to network
        navigateFallback: '/Nokia-Project-Platform/index.html',
        navigateFallbackAllowlist: [/^\/Nokia-Project-Platform/],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Liquidador Nokia 2026',
        short_name: 'Nokia Billing',
        description: 'Seguimiento y liquidación de sitios Nokia — Ingetel 2026',
        theme_color: '#144E4A',
        background_color: '#f0f2f0',
        display: 'standalone',
        orientation: 'any',
        start_url: '/Nokia-Project-Platform/',
        scope: '/Nokia-Project-Platform/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          { name: 'Dashboard',  short_name: 'Dashboard',  url: '/Nokia-Project-Platform/dashboard', description: 'Ver resumen del proyecto' },
          { name: 'Sitios TI',  short_name: 'TI',         url: '/Nokia-Project-Platform/ti',        description: 'Consolidado TI' },
          { name: 'Analítica',  short_name: 'Analítica',  url: '/Nokia-Project-Platform/analitica', description: 'Gráficas del proyecto' },
        ],
        categories: ['business', 'productivity'],
      },
    }),
  ],
})
