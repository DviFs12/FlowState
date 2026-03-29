/**
 * FlowState — Service Worker v2
 * Cache-first for local assets, catches up on install.
 */
const CACHE = 'flowstate-v2';

const ASSETS = [
  './',
  './index.html',
  './pages/todo.html',
  './pages/schedule.html',
  './pages/settings.html',
  './pages/pomodoro-history.html',
  './css/style.css',
  './css/themes.css',
  './js/main.js',
  './js/pomodoro.js',
  './js/todo.js',
  './js/charts.js',
  './js/settings.js',
  './js/schedule.js',
  './js/schedule-banner.js',
  './js/pomodoro-history.js',
  './data/data.json',
  './manifest.json',
  './favicon.svg',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  } else {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
});
