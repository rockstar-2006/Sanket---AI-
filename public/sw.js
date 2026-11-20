/**
 * Sanket AI — Production Progressive Web App Service Worker v2.0
 * Ultra-fast, non-blocking service worker that provides offline fallback
 * while never intercepting or stalling dynamic Next.js navigation or WebRTC.
 */

const CACHE_NAME = 'sanket-pwa-v3.0';

// Essential offline fallback assets only (never cache dynamic HTML routes like '/')
const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal notice:', err);
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

  // 2. DO NOT intercept Next.js internal chunks, APIs, WebSockets, or Cloud Providers
  // Passing through natively ensures 0ms latency and eliminates all mobile startup stalls!
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('livekit') ||
    url.hostname.includes('deepgram') ||
    url.hostname.includes('groq')
  ) {
    return;
  }

  // 3. Static Icons & Manifest: Cache-First with fast network fallback
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // 4. HTML Navigation: Direct Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match('/offline.html');
        return offlinePage || new Response('Offline - No connection', { status: 503 });
      })
    );
    return;
  }

  // 5. All other assets pass through to the browser's native fast network stack natively!
});
