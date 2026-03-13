// TypeFill Pro Service Worker v5.2.0
// FORCE UPDATE - Sub-folders, Lock/Unlock, Quick Actions
// Version: 5.2.0
// Feature: Sub-folders, Editor Lock, Quick Action Buttons, Folder Sorting
// Last Updated: 2025-01-11

const CACHE_NAME = 'typefill-pro-v5.2.0';
const RUNTIME_CACHE = 'typefill-pro-runtime-v5.2.0';
const VERSION = '5.2.0';
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
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('[TypeFill SW v' + VERSION + '] Installing...');
    
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then((cache) => {
                console.log('[TypeFill SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.log('[TypeFill SW] Some static assets failed to cache:', err);
                    return Promise.resolve();
                });
            }),
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
            return self.skipWaiting();
        })
    );
});

// Activate event
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
            return self.clients.claim();
        }).then(() => {
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

// Fetch event
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;
    
    // Network-first for HTML
    if (request.mode === 'navigate' || 
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html')) {
        
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        return caches.match('./index.html');
                    });
                })
        );
        return;
    }
    
    // Stale-while-revalidate for same-origin
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);
                return cachedResponse || fetchPromise;
            })
        );
    } else {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
    }
});

// Message handling
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data?.type === 'GET_VERSION') {
        event.ports[0]?.postMessage({ version: VERSION, timestamp: BUILD_TIMESTAMP });
    }
    
    if (event.data?.type === 'FORCE_UPDATE') {
        caches.keys().then(cacheNames => {
            return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        }).then(() => {
            self.skipWaiting();
            event.ports[0]?.postMessage({ success: true });
        });
    }
});

console.log('[TypeFill SW v' + VERSION + '] Service Worker loaded');
