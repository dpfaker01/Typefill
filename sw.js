// TypeFill Pro Service Worker v5.2.0
// FORCE UPDATE - Version bump triggers immediate cache refresh
// Version: 5.2.0
// Feature: TypeFill Pro - Unlimited Variables, Choices, and Privacy Masks
// Last Updated: 2025-01-11
// ENHANCED: Aggressive cache clearing and immediate activation for APK deployments

const CACHE_NAME = 'typefill-pro-v5.2.0';
const RUNTIME_CACHE = 'typefill-pro-runtime-v5.2.0';
const VERSION = '5.2.0';
const BUILD_TIMESTAMP = Date.now();

// Static assets to cache on install - with cache-busting version
const STATIC_ASSETS = [
    './',
    './index.html?v=5.2.0',
    './manifest.json?v=5.2.0',
    './icons/icon-16x16.png?v=5.2.0',
    './icons/icon-32x32.png?v=5.2.0',
    './icons/icon-72x72.png?v=5.2.0',
    './icons/icon-96x96.png?v=5.2.0',
    './icons/icon-128x128.png?v=5.2.0',
    './icons/icon-144x144.png?v=5.2.0',
    './icons/icon-152x152.png?v=5.2.0',
    './icons/icon-180x180.png?v=5.2.0',
    './icons/icon-192x192.png?v=5.2.0',
    './icons/icon-384x384.png?v=5.2.0',
    './icons/icon-512x512.png?v=5.2.0'
];

// External resources to cache for offline use
const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install event - cache all static assets with forced activation
self.addEventListener('install', (event) => {
    console.log('[TypeFill SW v' + VERSION + '] Installing new version...');
    
    event.waitUntil(
        Promise.all([
            // Pre-emptively clear ALL old caches before installing new ones
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => {
                        console.log('[TypeFill SW] Pre-clearing cache:', name);
                        return caches.delete(name);
                    })
                );
            }),
            // Cache static assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log('[TypeFill SW] Caching static assets with version:', VERSION);
                // Cache without query strings for actual requests
                const assetsWithoutQuery = [
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
                return Promise.all(
                    assetsWithoutQuery.map(url => 
                        fetch(url, { cache: 'reload' })
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => {
                                console.log('[TypeFill SW] Failed to cache:', url);
                            })
                    )
                );
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
            console.log('[TypeFill SW v' + VERSION + '] Installation complete - forcing activation');
            // CRITICAL: Force the new service worker to activate immediately
            // This ensures APK-wrapped apps get the update right away
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches and claim all clients immediately
self.addEventListener('activate', (event) => {
    console.log('[TypeFill SW v' + VERSION + '] Activating...');
    
    event.waitUntil(
        // First, delete ALL old caches aggressively
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
            console.log('[TypeFill SW v' + VERSION + '] Old caches cleared');
            // CRITICAL: Claim all clients immediately to force update
            // This makes the new SW take control of all open pages instantly
            return self.clients.claim();
        }).then(() => {
            console.log('[TypeFill SW v' + VERSION + '] All clients claimed');
            // Notify all clients about the update
            return self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: VERSION,
                        timestamp: BUILD_TIMESTAMP,
                        forceReload: true
                    });
                });
                console.log('[TypeFill SW] Notified ' + clients.length + ' clients about update');
            });
        })
    );
});

// Fetch event - NETWORK FIRST for HTML (ensures updates are applied)
// Stale-while-revalidate for other assets
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
    // This is CRITICAL for APK-wrapped apps to get updates
    if (request.mode === 'navigate' || 
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html')) {
        
        event.respondWith(
            // Always try network first for HTML
            fetch(request, { cache: 'reload' })
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
    
    // For manifest.json: Always fetch from network first
    if (url.pathname.endsWith('manifest.json')) {
        event.respondWith(
            fetch(request, { cache: 'reload' })
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
                    return caches.match(request);
                })
        );
        return;
    }
    
    // For same-origin requests: Stale-while-revalidate strategy
    // Returns cached version immediately, updates in background
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                // Start network fetch regardless of cache
                const fetchPromise = fetch(request, { cache: 'reload' })
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
    
    // Force clear all caches and reload - for emergency updates
    if (event.data && event.data.type === 'FORCE_UPDATE') {
        console.log('[TypeFill SW] Force update requested');
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            self.skipWaiting();
            if (event.ports[0]) {
                event.ports[0].postMessage({ success: true });
            }
        });
    }
    
    // Check for update request
    if (event.data && event.data.type === 'CHECK_UPDATE') {
        console.log('[TypeFill SW] Update check requested');
        // Trigger a registration update check
        self.registration?.update?.().then(() => {
            console.log('[TypeFill SW] Registration update triggered');
        }).catch(err => {
            console.log('[TypeFill SW] Update check failed:', err);
        });
    }
});

console.log('[TypeFill SW v' + VERSION + '] Service Worker loaded at', new Date(BUILD_TIMESTAMP).toISOString());
