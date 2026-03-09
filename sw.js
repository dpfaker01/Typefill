// TypeFill Service Worker v4.1.0
// Version: 4.1.0
// Feature: Privacy Masking for sensitive data
// Last Updated: 2025-01-09

const CACHE_NAME = 'typefill-v4.1.0';
const RUNTIME_CACHE = 'typefill-runtime-v4.1.0';
const VERSION = '4.1.0';

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

const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    console.log('[TypeFill SW v' + VERSION + '] Installing...');
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then((cache) => {
                console.log('[TypeFill SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.log('[TypeFill SW] Some assets failed:', err);
                    return Promise.resolve();
                });
            }),
            caches.open(RUNTIME_CACHE).then((cache) => {
                return Promise.all(
                    EXTERNAL_ASSETS.map(url => 
                        fetch(url, { mode: 'cors' })
                            .then(response => { if (response.ok) return cache.put(url, response); })
                            .catch(() => console.log('[TypeFill SW] Failed to cache:', url))
                    )
                );
            })
        ]).then(() => {
            console.log('[TypeFill SW v' + VERSION + '] Installed');
            return self.skipWaiting();
        })
    );
});

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
            console.log('[TypeFill SW v' + VERSION + '] Activated');
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;
    
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        if (request.mode === 'navigate') return caches.match('./index.html');
                        return new Response('Offline', { status: 503 });
                    });
            })
        );
    } else {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, networkResponse.clone()));
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(request))
        );
    }
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
    if (event.data?.type === 'GET_VERSION') event.ports[0].postMessage({ version: VERSION });
});

console.log('[TypeFill SW v' + VERSION + '] Loaded');
