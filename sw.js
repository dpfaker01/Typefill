/* =====================================================================
 * TypeFill Pro - Service Worker
 * Version: 5.3.1
 * Aligned with: index.html v5.3.1 Pro, manifest.json v5.3.1
 *
 * Caching strategy:
 *   - Same-origin static assets (index.html, manifest.json, icons):
 *       Cache-first, fallback to network, populate cache on miss.
 *   - Cross-origin CDN assets (Tailwind, Google Fonts):
 *       Stale-while-revalidate — serve from cache, refresh in background.
 *   - Same-origin non-GET requests (none currently): pass through.
 *   - Everything else: network-first, fallback to cache.
 *
 * Update flow:
 *   - On install: precache PRECACHE_URLS, skipWaiting().
 *   - On activate: delete old caches, clients.claim(), broadcast
 *     { type: 'SW_UPDATED', version: '5.3.1', forceReload: true } to all
 *     controlled clients so they refresh automatically (the index.html
 *     message listener handles this).
 * ===================================================================== */

const APP_VERSION = '5.3.1 Pro';
const CACHE_NAME = 'typefill-v5.3.1';
const CACHE_VERSION_SUFFIX = 'v5.3.1';

// Same-origin assets to precache during install. Cross-origin CDN URLs
// are fetched lazily on first use (see fetch handler).
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icons/icon-16x16.png',
  './icons/icon-32x32.png',
  './icons/icon-180x180.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// CDN origins that we cache with stale-while-revalidate.
const CDN_ORIGIN_PATTERNS = [
  /^https:\/\/cdn\.tailwindcss\.com\//,
  /^https:\/\/fonts\.googleapis\.com\//,
  /^https:\/\/fonts\.gstatic\.com\//
];


// ---------- install ----------
self.addEventListener('install', (event) => {
  console.log('[TypeFill SW] Installing version', CACHE_NAME);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cache each URL individually so a single 404 (e.g. an icon that
      // isn't shipped yet) doesn't abort the whole install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const resp = await fetch(url, { cache: 'no-cache' });
            if (resp && resp.ok) {
              await cache.put(url, resp.clone());
            } else {
              console.warn('[TypeFill SW] Precache skip (non-OK):', url, resp?.status);
            }
          } catch (err) {
            console.warn('[TypeFill SW] Precache skip (error):', url, err.message);
          }
        })
      );
      await self.skipWaiting();
      console.log('[TypeFill SW] Installed and skipWaiting() called');
    })()
  );
});


// ---------- activate ----------
self.addEventListener('activate', (event) => {
  console.log('[TypeFill SW] Activating version', CACHE_NAME);
  event.waitUntil(
    (async () => {
      // Delete every cache that isn't the current one.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => {
            console.log('[TypeFill SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
      await self.clients.claim();

      // Notify all controlled clients that the SW has updated so the page
      // can show a toast and (if forceReload=true) reload automatically.
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      for (const client of clientList) {
        client.postMessage({
          type: 'SW_UPDATED',
          version: APP_VERSION,
          forceReload: true
        });
      }
      console.log('[TypeFill SW] Activated and', clientList.length, 'client(s) notified');
    })()
  );
});


// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only intercept GET; let everything else (POST, PUT, etc.) hit the network.
  if (req.method !== 'GET') return;

  // Don't intercept chrome-extension:// or non-http(s) requests.
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Cross-origin CDN assets → stale-while-revalidate.
  const isCdn = CDN_ORIGIN_PATTERNS.some((re) => re.test(req.url));
  if (isCdn) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Same-origin navigation requests → network-first (so users always get
  // the latest HTML when online), falling back to cached index.html.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // Same-origin static assets → cache-first.
  event.respondWith(cacheFirst(req));
});


// ---------- strategies ----------
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp && resp.ok && resp.type === 'basic') {
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    // Last resort: if we have a cached match for a same-origin URL by
    // ignoring query/vary, return it.
    return cached || Response.error();
  }
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      cache.put(req, resp.clone());
      // Also keep './' and './index.html' aliases in sync.
      cache.put('./', resp.clone());
      cache.put('./index.html', resp.clone());
    }
    return resp;
  } catch (err) {
    // Offline: try exact match first, then common aliases.
    const cached =
      (await cache.match(req)) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./'));
    if (cached) return cached;
    return new Response(
      '<h1>Offline</h1><p>TypeFill Pro is not available offline yet. Please reconnect.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((resp) => {
      if (resp && (resp.ok || resp.type === 'opaque')) {
        cache.put(req, resp.clone());
      }
      return resp;
    })
    .catch((err) => {
      console.warn('[TypeFill SW] SWR network error for', req.url, err.message);
      return null;
    });
  // If we have a cached response, return it immediately and refresh in
  // the background. Otherwise wait for the network response.
  return cached || (await networkPromise) || Response.error();
}


// ---------- message handler (manual skipWaiting from page) ----------
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    event.source && event.source.postMessage({
      type: 'VERSION',
      version: APP_VERSION,
      cache: CACHE_NAME
    });
  }
});

console.log('[TypeFill SW] Loaded', CACHE_NAME);
