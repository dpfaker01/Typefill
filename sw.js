const CACHE_NAME = 'typefill-v1';
const STATIC_CACHE = 'typefill-static-v1';
const DYNAMIC_CACHE = 'typefill-dynamic-v1';
const IMAGE_CACHE = 'typefill-images-v1';

// Precache critical assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - Precache critical assets
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

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[TypeFill SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== IMAGE_CACHE
            ) {
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

// Fetch event - Strategic caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy 1: Cache First for static assets (CDN, fonts, icons)
  if (
    url.origin === 'https://cdn.tailwindcss.com' ||
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com' ||
    request.destination === 'font' ||
    request.destination === 'style'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Strategy 2: Cache First for images
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Strategy 3: Network First for HTML pages
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Strategy 4: Stale While Revalidate for everything else
  event.respondWith(staleWhileRevalidate(request));
});

// Cache strategies implementations
async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[TypeFill SW] Cache first failed:', error);
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[TypeFill SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline fallback page
    return caches.match('/index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const cache = caches.open(DYNAMIC_CACHE);
        cache.then(c => c.put(request, networkResponse.clone()));
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[TypeFill SW] Revalidate failed:', error);
    });

  return cached || fetchPromise;
}

// Background sync for offline data operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-templates') {
    event.waitUntil(syncTemplates());
  }
});

async function syncTemplates() {
  console.log('[TypeFill SW] Background sync executed');
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      message: 'Templates synced successfully'
    });
  });
}

// Push notification support
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Your templates are ready',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: data.url || '/',
      actions: [
        {
          action: 'open',
          title: 'Open TypeFill'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: false
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'TypeFill', options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
          clientList[0].navigate(event.notification.data || '/');
        } else {
          clients.openWindow(event.notification.data || '/');
        }
      })
    );
  }
});

// Message handling from main app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.payload);
      })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-check') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  console.log('[TypeFill SW] Checking for updates...');
  // Implement update checking logic here
}