/**
 * FlowState — Service Worker
 * Enables offline support (PWA)
 */

const CACHE_NAME = 'flowstate-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/pages/todo.html',
  '/pages/settings.html',
  '/css/style.css',
  '/css/themes.css',
  '/js/main.js',
  '/js/pomodoro.js',
  '/js/todo.js',
  '/js/charts.js',
  '/js/settings.js',
  '/data/data.json',
  '/manifest.json'
];

// Install: cache all assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for local assets, network-first for CDN
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Cache-first for local
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Network-first for CDN
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
