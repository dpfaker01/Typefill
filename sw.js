const STATIC_CACHE = 'typefill-static-v1';
const DYNAMIC_CACHE = 'typefill-dynamic-v1';

// Precache critical assets with RELATIVE paths
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[TypeFill SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[TypeFill SW] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[TypeFill SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[TypeFill SW] Precache failed:', err);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[TypeFill SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[TypeFill SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[TypeFill SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http schemes
  if (!request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      // Return cached version or fetch from network
      if (cached) {
        return cached;
      }
      
      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, cacheCopy);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.error('[TypeFill SW] Fetch failed:', error);
          // Return offline fallback if available
          return caches.match('./index.html');
        });
    })
  );
});
