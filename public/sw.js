/**
 * Sanket AI — Production Progressive Web App Service Worker
 * Handles offline fallback, static shell asset caching, and lightning-fast starts
 * while keeping real-time WebRTC and Socket.IO connections 100% bypass/live.
 */

const CACHE_NAME = 'sanket-pwa-v1.0';

// Essential assets for offline app shell
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/models/isl_labels.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. DO NOT intercept non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. DO NOT intercept Socket.IO, WebRTC, Firebase, or external dynamic API calls
  if (
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/api/') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('livekit')
  ) {
    return;
  }

  // 3. Static assets & Icons: Cache-First with Network fallback
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.startsWith('/models/isl_labels.json')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // 4. HTML Page Navigation: Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || new Response('Offline - No connection', { status: 503 });
        })
    );
    return;
  }

  // 5. Default: Network with Cache Fallback (Never returns undefined)
  event.respondWith(
    fetch(request).catch(async () => {
      const match = await caches.match(request);
      return match || new Response('', { status: 408, statusText: 'Offline or Network Timeout' });
    })
  );
});
