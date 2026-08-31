const CACHE_NAME = 'careershala-cache-v1';

// Core assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo_t.webp',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install Event: cache core app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.warn('[ServiceWorker] Pre-cache error:', error);
      })
  );
});

// Activate Event: clean up obsolete caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: handle caching strategy for offline support and faster loads
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignore browser extensions and unsupported protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Never cache backend API calls or Vite dev internal requests
  if (url.pathname.startsWith('/api') || url.pathname.includes('/@vite') || url.pathname.includes('/@fs') || url.pathname.includes('/node_modules/')) {
    return;
  }

  // 1. Navigation requests (HTML pages): Network-first with cache & offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // If offline, attempt exact request match or return cached index.html
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const indexResponse = await caches.match('/index.html');
          if (indexResponse) {
            return indexResponse;
          }
          return caches.match('/');
        })
    );
    return;
  }

  // 2. Static assets (CSS, JS, Web Workers, Images, Fonts): Cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to revalidate cache (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Background revalidation failed silently when offline
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and store in cache
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch((err) => {
          // Offline fallback for images if desired
          console.debug('[ServiceWorker] Fetch failed for:', request.url, err);
        });
    })
  );
});
