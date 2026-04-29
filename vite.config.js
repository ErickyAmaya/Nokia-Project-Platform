import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'

const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    // Genera dist/version.json con timestamp de build — usado por checkVersion para auto-reload PWA
    {
      name: 'version-json',
      apply: 'build',
      writeBundle() {
        fs.writeFileSync('dist/version.json', JSON.stringify({ v: Date.now() }))
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${base.replace(/\//g, '\\/')}`)],
        navigateFallbackDenylist: [/^\/api/, /version\.json/],
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
        name: 'Nokia-Platform',
        short_name: 'Nokia-Platform',
        description: 'Seguimiento y liquidación de sitios Nokia — Ingetel 2026',
        theme_color: '#144E4A',
        background_color: '#f0f2f0',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          { name: 'Dashboard',  short_name: 'Dashboard',  url: `${base}dashboard`, description: 'Ver resumen del proyecto' },
          { name: 'Sitios TI',  short_name: 'TI',         url: `${base}ti`,        description: 'Consolidado TI' },
          { name: 'Analítica',  short_name: 'Analítica',  url: `${base}analitica`, description: 'Gráficas del proyecto' },
        ],
        categories: ['business', 'productivity'],
      },
    }),
  ],
})
