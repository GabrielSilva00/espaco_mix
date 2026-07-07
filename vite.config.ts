import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const appVersion = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version as string;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    tailwindcss(),
    // HTTPS no dev: o SDK do Mercado Pago recusa tokenizar cartão em conexão
    // não-segura (http://localhost inclusive). Com isso, o checkout de cartão
    // funciona localmente em https://localhost:5173 (aceite o certificado).
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Espaço Mix – Recepção e Eventos',
        short_name: 'Espaço Mix',
        description: 'Plataforma premium de compra de ingressos e reserva de mesas para eventos exclusivos.',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        categories: ['entertainment', 'lifestyle'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precacheia apenas assets com hash no nome (JS/CSS/ícones/fontes) —
        // são imutáveis, então cache-first é seguro. O HTML é deliberadamente
        // EXCLUÍDO do precache: o documento é sempre buscado da rede
        // (NetworkFirst abaixo) para nunca servir um index.html antigo
        // apontando para bundles/config defasados (causava login/eventos quebrados).
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        // Desliga o handler de navegação baseado no index.html precacheado;
        // quem trata navegação é a regra NetworkFirst de runtimeCaching.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Documento HTML (navegações): sempre da rede; cai no cache só se offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache de fontes Google
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-motion':   ['motion'],
          'vendor-recharts': ['recharts'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-embla':    ['embla-carousel-react', 'embla-carousel-autoplay'],
        },
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    // Encaminha as chamadas de API para o backend Express (npm run dev:server).
    // Sem isso, o POST /api/* recebe resposta vazia do Vite e o pagamento quebra.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
