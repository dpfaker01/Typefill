// TypeFill Service Worker - Full Offline Support
// Based on BP Tracker's proven offline architecture

const CACHE_NAME = 'typefill-v2.0-offline';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json'
    // CDN resources cached dynamically
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[TypeFill SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[TypeFill SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[TypeFill SW] Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[TypeFill SW] Cache failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[TypeFill SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[TypeFill SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[TypeFill SW] Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }

    // Strategy: Cache First for static assets, Network First for API calls
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                // Return cached version if available
                if (cachedResponse) {
                    // Check if it's a CDN resource that needs updating
                    if (isCDNResource(url)) {
                        // Return cached but also fetch update in background
                        fetchAndCache(request);
                        return cachedResponse;
                    }
                    return cachedResponse;
                }

                // Otherwise fetch from network
                return fetchAndCache(request);
            })
            .catch(() => {
                // If both cache and network fail, show offline page
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }

                // Return a simple offline response for other resources
                return new Response('Offline - Resource not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                });
            })
    );
});

// Helper function to fetch and cache
async function fetchAndCache(request) {
    try {
        const networkResponse = await fetch(request);

        // Don't cache non-successful responses
        if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
        }

        // Don't cache opaque responses (CDN cross-origin)
        if (networkResponse.type === 'opaque') {
            return networkResponse;
        }

        // Clone the response before caching
        const responseToCache = networkResponse.clone();

        const cache = await caches.open(CACHE_NAME);
        cache.put(request, responseToCache);

        return networkResponse;
    } catch (error) {
        console.error('[TypeFill SW] Fetch failed:', error);
        throw error;
    }
}

// Check if URL is a CDN resource
function isCDNResource(url) {
    const cdnDomains = [
        'cdn.tailwindcss.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com'
    ];

    return cdnDomains.some(domain => url.hostname.includes(domain));
}

// Background Sync for offline data operations
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-templates') {
        console.log('[TypeFill SW] Background sync triggered');
        event.waitUntil(syncTemplates());
    }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ version: CACHE_NAME });
        }
    }
});

// Helper: Sync templates (placeholder for future backend integration)
async function syncTemplates() {
    console.log('[TypeFill SW] Syncing templates...');
    return Promise.resolve();
}

console.log('[TypeFill SW] Service Worker loaded');