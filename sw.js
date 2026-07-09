/* ============================================================================
 * Templateify Pro — Service Worker
 * Version: 6.3.1  (CACHE_NAME bumped to match the v6.3.1 patch on index.html)
 * Generated: 2026-07-09
 *
 * PWA Alignment (per HTML App Expert Skill §3.7):
 *   - CACHE_NAME is bumped on every regeneration so users receive the update.
 *   - PRECACHE_URLS mirrors EVERY CDN <script src> and <link rel="stylesheet">
 *     in index.html <head>, plus all manifest icons, the manifest itself,
 *     and the entry point ('./' + './index.html').
 *   - Network-first for CDN URLs (so library patches propagate); cache-first
 *     for same-origin app shell (instant load offline); offline fallback
 *     to './index.html' for navigation requests.
 *   - Handles { type: 'SKIP_WAITING' } so the in-page update flow can
 *     force-activate this SW without waiting for all tabs to close.
 * ========================================================================== */

const CACHE_NAME = 'templateify-v6.3.1';

// ---- Precache list (atomic with index.html <head>) --------------------------
// Every CDN <script src> and <link rel="stylesheet" href> from index.html
// must appear here, in the SAME order, so offline-first load works after
// the SW activates on first visit.
const PRECACHE_URLS = [
  // --- App shell ---
  './',
  './index.html',
  './manifest.json',

  // --- Icons (must match manifest.json icons[].src) ---
  'icons/icon-16x16.png',
  'icons/icon-32x32.png',
  'icons/icon-180x180.png',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/icon-512x512-maskable.png',

  // --- CDN: Tailwind (utility CSS, runtime-JIT) ---
  'https://cdn.tailwindcss.com',

  // --- CDN: File-upload / parsing stack (v6.2.0 pinned per index.html) ---
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',

  // --- CDN: Prism (code highlighting for .py / .ipynb uploads) ---
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-python.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css'
];

// Same-origin root, used for the offline fallback.
const OFFLINE_URL = './index.html';

// ============================================================================
// INSTALL — precache the app shell + CDN libraries, then skipWaiting so the
// new SW activates immediately (rather than waiting for all tabs to close).
// ============================================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Use addAll with best-effort semantics: if any single CDN URL fails
      // (rare — cdn.jsdelivr.net and cdn.tailwindcss.com are very reliable),
      // we still want the SW to install so the app shell works offline.
      // We attempt addAll first; on failure, fall back to per-URL puts.
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        console.warn('[SW] cache.addAll failed, falling back to per-URL put:', err);
        await Promise.all(
          PRECACHE_URLS.map(async (url) => {
            try {
              const response = await fetch(url, { cache: 'reload' });
              if (response && response.ok) {
                await cache.put(url, response.clone());
              }
            } catch (e) {
              console.warn('[SW] Failed to precache', url, e);
            }
          })
        );
      }
      await self.skipWaiting();
    })()
  );
});

// ============================================================================
// ACTIVATE — delete every cache that is not the current CACHE_NAME, then
// claim all open clients so the new SW takes effect on the current tab(s)
// without requiring a reload.
// ============================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
      await self.clients.claim();
      // Broadcast to all clients that a new SW has activated — the page can
      // listen for this and surface an "App updated — reload" toast.
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
      });
    })()
  );
});

// ============================================================================
// FETCH — caching strategy
//   * Never intercept non-GET requests (POST/PUT/DELETE go straight to network).
//   * Never intercept chrome-extension: or other non-http(s) schemes.
//   * For CDN cross-origin GETs: network-first (so library patches propagate),
//     fall back to cache on network failure, fall back to a blank 200 only if
//     neither is available (so the page doesn't crash on a missing library).
//   * For same-origin navigation requests (HTML pages): network-first, fall
//     back to cached index.html, fall back to OFFLINE_URL.
//   * For same-origin static assets (icons, manifest): cache-first, then
//     network, then no response.
// ============================================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET. Anything else (POST/PUT/DELETE/OPTIONS) bypasses the SW.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-http(s) schemes (chrome-extension:, file:, data:, blob:).
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // --- Strategy selection ---
  const isNavigation =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
  const isCDN = url.origin !== self.location.origin;
  const isCacheableAsset =
    !isCDN &&
    (url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.webp') ||
      url.pathname.endsWith('.ico') ||
      url.pathname.endsWith('.json') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.woff2'));

  if (isNavigation) {
    // Network-first for HTML navigations so the user always gets the latest
    // app shell when online; fall back to cache, then to OFFLINE_URL.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(OFFLINE_URL, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response('Offline and no cached page available.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    return;
  }

  if (isCDN) {
    // Network-first for CDN libraries so patches propagate. On failure,
    // serve from cache so the app still works offline.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Last resort — return a no-op so the page doesn't crash on a
          // missing library. The page's own missing-lib detector will surface
          // a user-facing fallback UI.
          return new Response('', {
            status: 200,
            headers: { 'Content-Type': 'application/javascript' }
          });
        }
      })()
    );
    return;
  }

  if (isCacheableAsset) {
    // Cache-first for same-origin static assets (icons, manifest, etc.).
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (err) {
          return new Response('', { status: 404 });
        }
      })()
    );
    return;
  }

  // All other same-origin GETs (e.g. fetch() calls from the app): try network,
  // fall back to cache. Don't intercept if neither has it.
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
      }
    })()
  );
});

// ============================================================================
// MESSAGE — handle in-page update flow. When the page detects a new SW is
// waiting, it can post { type: 'SKIP_WAITING' } to force-activate it.
// ============================================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================================================
// CONTROLLERCHANGE — log when the page picks up the new SW (useful for
// debugging the update flow).
// ============================================================================
self.addEventListener('controllerchange', () => {
  console.log('[SW] controllerchange — new SW is now controlling the page');
});

console.log('[SW] Templateify service worker v6.3.1 registered');
