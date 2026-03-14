// TypeFill Pro Service Worker v5.1.0
// FORCE UPDATE - Version bump triggers immediate cache refresh
// Version: 5.1.0
// Feature: TypeFill Pro - Unlimited Variables, Choices, and Privacy Masks
// Last Updated: 2025-01-11
// FIX: Network-first strategy for HTML to ensure updates are applied immediately

const CACHE_NAME = 'typefill-pro-v5.1.0';
const RUNTIME_CACHE = 'typefill-pro-runtime-v5.1.0';
const VERSION = '5.1.0';
const BUILD_TIMESTAMP = Date.now();

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
            // Claim all clients immediately to force update
            return self.clients.claim();
        }).then(() => {
            // Notify all clients about the update
            return self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: VERSION,
                        timestamp: BUILD_TIMESTAMP
                    });
                });
            });
        })
    );
});

// Fetch event - NETWORK FIRST for HTML, cache-first for other assets
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
    
    // For HTML/navigation requests: NETWORK-FIRST to ensure updates
    if (request.mode === 'navigate' || 
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html')) {
        
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Cache the fresh response
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return cached index.html for navigation
                        return caches.match('./index.html');
                    });
                })
        );
        return;
    }
    
    // For same-origin requests: Stale-while-revalidate strategy
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                // Return cached version immediately
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        // Update cache with fresh response
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
                        return cachedResponse;
                    });
                
                // Return cached response or wait for network
                return cachedResponse || fetchPromise;
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
        event.ports[0].postMessage({ version: VERSION, timestamp: BUILD_TIMESTAMP });
    }
    
    if (event.data && event.data.type === 'CACHE_URLS') {
        const urls = event.data.urls;
        caches.open(RUNTIME_CACHE).then((cache) => {
            cache.addAll(urls);
        });
    }
    
    // Force clear all caches and reload
    if (event.data && event.data.type === 'FORCE_UPDATE') {
        console.log('[TypeFill SW] Force update requested');
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            self.skipWaiting();
            event.ports[0]?.postMessage({ success: true });
        });
    }
});

console.log('[TypeFill SW v' + VERSION + '] Service Worker loaded');
