/* Templateify Pro — Service Worker
   CACHE_NAME: templateify-v7.1.0 (Session 6 native plugin wiring release)
   Aligned with index.html v7.1.0 Pro and manifest.json v7.1.0.

   Session 6 note: Adds haptics, app shortcuts, splash screen, and status bar
   wiring to the web app. Native plugin configs live in capacitor.config.json.
   The SW itself is unchanged in strategy from v7.0.0 — only the version bumped.

   Strategy (unchanged):
   - install: precache app shell + 6 icons + 9 CDN URLs.
   - activate: delete any cache whose name !== CACHE_NAME, then claim clients.
   - fetch: network-first for navigations + CDN, cache-first for same-origin assets.
*/

const CACHE_NAME = 'templateify-v7.1.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-16x16.png',
  './icons/icon-32x32.png',
  './icons/icon-180x180.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/icon-512x512-maskable.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-python.min.js',
  'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] addAll failed, falling back to per-URL put:', err);
        return Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.put(url, fetch(url, { mode: 'no-cors' }).catch(() => new Response('', { status: 200 })))
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim()).then(() => {
      return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', cacheName: CACHE_NAME }));
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || new Response('', { status: 504 })))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
