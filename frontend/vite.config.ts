import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createHash } from 'node:crypto'

export default defineConfig({
  plugins: [react(), {
    name: 'offline-app-shell',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(name => /\.(js|css)$/.test(name)).map(name => `/${name}`)
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 16)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const CACHE = 'lingshan-shell-${version}';
const ASSETS = ${JSON.stringify(['/', '/index.html', ...assets])};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lingshan-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
 const request = event.request; const url = new URL(request.url);
 if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname === '/health') return;
 if (request.mode === 'navigate') {
  event.respondWith(fetch(request).catch(() => caches.match('/index.html').then(response => response || Response.error()))); return;
 }
 event.respondWith(caches.open(CACHE).then(async cache => {
  const cached = await cache.match(request); if (cached) return cached;
  const response = await fetch(request); if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/models/') || /\\.(js|css|png|jpg|webp)$/.test(url.pathname))) await cache.put(request, response.clone()); return response;
 }));
});` })
    },
  }],
  base: '/',
  resolve: {
    alias: {
      // Fix: Vite 8 Rolldown can't resolve @pixi/* sub-packages from pixi.js v7
      '@pixi/core': path.resolve(__dirname, 'node_modules/pixi.js/node_modules/@pixi/core'),
      '@pixi/display': path.resolve(__dirname, 'node_modules/pixi.js/node_modules/@pixi/display'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8010',
        ws: true,
      },
    },
  },
})
