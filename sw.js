// WealthOS Service Worker — Cache-first strategy for offline support
'use strict';

const CACHE_NAME = 'wealthos-v3';
const ASSETS = [
  '/',           // root path — catches http://host/ without index.html
  '/index.html',
  '/css/styles.css',
  '/css/print.css',
  '/js/data.js',
  '/js/tracker.js',
  '/js/networth.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install: cache all static assets, then activate immediately
self.addEventListener('install', event => {
  // skipWaiting called outside waitUntil so it is not blocked by cache.addAll
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Only serve index.html fallback for document (navigation) requests.
        // Returning index.html for CSS/JS would cause the browser to parse HTML
        // as a stylesheet/script, producing runtime errors.
        if (event.request.destination === 'document') return caches.match('/index.html');
        return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
