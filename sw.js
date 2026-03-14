// TypeFill Pro Service Worker v5.2.0
// CRITICAL UPDATE - Version bump triggers immediate cache refresh
// Version: 5.2.0
// Feature: TypeFill Pro - Unlimited Variables, Choices, and Privacy Masks
// Last Updated: 2025-03-11
// 
// UPDATE MECHANISM:
// 1. Change VERSION constant below to trigger update
// 2. skipWaiting() forces immediate activation
// 3. clients.claim() takes control of all open pages
// 4. Network-first strategy ensures fresh HTML is always loaded

const VERSION = '5.2.0';
const CACHE_NAME = `typefill-pro-v${VERSION}`;
const RUNTIME_CACHE = `typefill-pro-runtime-v${VERSION}`;
const BUILD_TIMESTAMP = Date.now();

// Static assets to cache on install
const STATIC_ASSETS = [
    './',
    './index.html?v=5.2.0',
    './manifest.json?v=5.2.0',
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

// ============================================
// INSTALL EVENT - Cache static assets
// ============================================
self.addEventListener('install', (event) => {
    console.log(`[TypeFill SW v${VERSION}] Installing new version...`);
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log('[TypeFill SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.log('[TypeFill SW] Some static assets failed to cache:', err);
                    // Continue even if some assets fail
                    return Promise.resolve();
                });
            }),
            // Cache external assets for offline use
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
            console.log(`[TypeFill SW v${VERSION}] Installation complete`);
            // CRITICAL: Force the new service worker to activate immediately
            // This bypasses the waiting state and activates right away
            return self.skipWaiting();
        })
    );
});

// ============================================
// ACTIVATE EVENT - Clean old caches & claim clients
// ============================================
self.addEventListener('activate', (event) => {
    console.log(`[TypeFill SW v${VERSION}] Activating...`);
    
    event.waitUntil(
        // Delete ALL old caches (including different versions)
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => {
                        // Delete any cache that doesn't match our current version
                        return name !== CACHE_NAME && name !== RUNTIME_CACHE;
                    })
                    .map((name) => {
                        console.log('[TypeFill SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log(`[TypeFill SW v${VERSION}] Old caches cleared`);
            // CRITICAL: Claim all clients immediately to force update
            // This takes control of all open pages without requiring a reload
            return self.clients.claim();
        }).then(() => {
            // Notify all clients about the update
            return self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: VERSION,
                        timestamp: BUILD_TIMESTAMP,
                        action: 'RELOAD_REQUIRED'
                    });
                });
                console.log(`[TypeFill SW v${VERSION}] Notified ${clients.length} clients`);
            });
        })
    );
});

// ============================================
// FETCH EVENT - Network-first for HTML, cache-first for assets
// ============================================
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
    
    // ==========================================
    // NETWORK-FIRST STRATEGY FOR HTML
    // This ensures users ALWAYS get the latest version
    // ==========================================
    if (request.mode === 'navigate' || 
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' || 
        url.pathname === '') {
        
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Cache the fresh response for offline use
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Network failed, try cache as fallback
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Last resort: return cached index.html
                        return caches.match('./index.html');
                    });
                })
        );
        return;
    }
    
    // ==========================================
    // STALE-WHILE-REVALIDATE FOR SAME-ORIGIN ASSETS
    // Returns cached version immediately, updates in background
    // ==========================================
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                // Start network fetch in background
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
                
                // Return cached response immediately, or wait for network
                return cachedResponse || fetchPromise;
            })
        );
        return;
    }
    
    // ==========================================
    // NETWORK-FIRST FOR EXTERNAL RESOURCES
    // Fonts, CDNs, etc. - prefer fresh, fallback to cache
    // ==========================================
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
                    
                    // Return empty response for fonts/styles to prevent errors
                    if (request.destination === 'font' || request.destination === 'style') {
                        return new Response('', { 
                            status: 200,
                            headers: { 'Content-Type': request.destination === 'font' ? 'font/woff2' : 'text/css' }
                        });
                    }
                    
                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});

// ============================================
// MESSAGE HANDLER - Handle messages from main app
// ============================================
self.addEventListener('message', (event) => {
    // Force skip waiting
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[TypeFill SW] Received SKIP_WAITING message');
        self.skipWaiting();
    }
    
    // Get version info
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0]?.postMessage({ 
            version: VERSION, 
            timestamp: BUILD_TIMESTAMP,
            cacheName: CACHE_NAME
        });
    }
    
    // Cache specific URLs
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
    
    // Check for updates
    if (event.data && event.data.type === 'CHECK_UPDATE') {
        self.registration?.update().then(() => {
            event.ports[0]?.postMessage({ checked: true });
        }).catch(err => {
            event.ports[0]?.postMessage({ checked: false, error: err.message });
        });
    }
});

// Log service worker loaded
console.log(`[TypeFill SW v${VERSION}] Service Worker loaded - Ready for immediate activation`);
