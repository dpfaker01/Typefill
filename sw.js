// TypeFill Service Worker v4.1.0
// FORCE UPDATE - This version number change triggers app update
// Version: 4.1.0
// Feature: Privacy Masking for sensitive data
// Last Updated: 2025-01-06

const CACHE_NAME = 'typefill-v4.1.0';
const RUNTIME_CACHE = 'typefill-runtime-v4.1.0';
const VERSION = '4.1.0';

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-16x16.png',
    './icons/icon-32x32.png',
    './icons/icon-72x72.png',
    './icons/icon-96x96.png',
    './icons/icon-128x128.png',
    './icons/icon-144x144.png',
    './icons/icon-152x152.png',
    './icons/icon-180x180.png',
    './icons/icon-192x192.png',
    './icons/icon-384x384.png',
    './icons/icon-512x512.png'
];

// External resources to cache for offline use
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - cache all static assets
self.addEventListener('install', (event) => {
    console.log('[TypeFill SW v' + VERSION + '] Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log('[TypeFill SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.log('[TypeFill SW] Some static assets failed to cache:', err);
                    return Promise.resolve();
                });
            }),
            // Cache external assets
            caches.open(RUNTIME_CACHE).then((cache) => {
                console.log('[TypeFill SW] Caching external assets');
                return Promise.all(
                    EXTERNAL_ASSETS.map(url => 
                        fetch(url, { mode: 'cors' })
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => {
                                console.log('[TypeFill SW] Failed to cache external:', url);
                            })
                    )
                );
            })
        ]).then(() => {
            console.log('[TypeFill SW v' + VERSION + '] Installation complete');
            // Force the new service worker to activate immediately
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
    console.log('[TypeFill SW v' + VERSION + '] Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map((name) => {
                        console.log('[TypeFill SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[TypeFill SW v' + VERSION + '] Activation complete');
            // Claim all clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache first, fall back to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // For same-origin requests: Cache-first strategy
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(request)
                    .then((networkResponse) => {
                        // Cache the new response for future use
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('[TypeFill SW] Network fetch failed:', url.pathname);
                        
                        // For navigation requests, return the cached index.html
                        if (request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        // For other requests, return a simple offline response
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
        );
    } else {
        // For external requests: Network-first with cache fallback
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Cache successful responses
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Try cache as fallback
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        
                        // Return offline response for fonts/styles
                        if (request.destination === 'font' || request.destination === 'style') {
                            return new Response('', { status: 200 });
                        }
                        
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
                })
        );
    }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[TypeFill SW] Received SKIP_WAITING message');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: VERSION });
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        const urls = event.data.urls;
        caches.open(RUNTIME_CACHE).then((cache) => {
            cache.addAll(urls);
        });
    }
});

console.log('[TypeFill SW v' + VERSION + '] Service Worker loaded');
