const CACHE_NAME = 'bringfrisch-cache-v26';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './standalone_data.js',
  './recipes_imported.js',
  './bring_catalog.js',
  './fonts/roboto-flex-latin.woff2',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './recipe_importer.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-First: immer das Neueste laden, offline aus dem Cache.
// Nur Dateien der eigenen Seite cachen (keine Sync-Aufrufe an den Worker).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
