const CACHE_NAME = 'typefill-v3-offline';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-32x32.png',
    './icons/icon-16x16.png',
    './icons/icon-180x180.png',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    console.log('[TypeFill SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[TypeFill SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[TypeFill SW] Cache failed:', err))
    );
});

self.addEventListener('activate', (event) => {
    console.log('[TypeFill SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[TypeFill SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;
    if (url.protocol === 'chrome-extension:') return;

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // If it's a CDN resource (Tailwind, Fonts), re-fetch it in the background to keep it updated
                if (isCDNResource(url)) {
                    fetchAndCache(request); 
                }
                return cachedResponse;
            }
            return fetchAndCache(request);
        }).catch(() => {
            if (request.mode === 'navigate') {
                return caches.match('./index.html');
            }
            return new Response('Offline - Resource not available', {
                status: 503,
                statusText: 'Service Unavailable'
            });
        })
    );
});

async function fetchAndCache(request) {
    try {
        const networkResponse = await fetch(request);

        // Allow caching if status is 200 OR if it's an opaque response (type === 'opaque') specifically for cross-origin CDNs
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
            return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, responseToCache);

        return networkResponse;
    } catch (error) {
        console.error('[TypeFill SW] Fetch failed:', error);
        throw error;
    }
}

function isCDNResource(url) {
    const cdnDomains = [
        'cdn.tailwindcss.com',
        'fonts.googleapis.com',
        'fonts.gstatic.com'
    ];
    return cdnDomains.some(domain => url.hostname.includes(domain));
}
