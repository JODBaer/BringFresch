const CACHE_NAME = 'bringfrisch-cache-v50';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './standalone_data.js',
  './recipes_imported.js',
  './bring_catalog.js',
  './core.js',
  './fonts/roboto-flex-latin.woff2',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './recipe_importer.js',
  './manifest.json',
  './rechtliches.html'
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
      // «bf-img» = Rezeptbilder der Wochenwahl, bleiben über App-Updates hinweg
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== 'bf-img').map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-First: immer das Neueste laden, offline aus dem Cache. Bei schwachem Empfang (keine Antwort nach
// SLOW_MS) kommt die Seite sofort aus dem Cache; das Netz lädt im Hintergrund weiter und füllt den Cache.
// Nur Dateien der eigenen Seite cachen (keine Sync-Aufrufe an den Worker).
const SLOW_MS = 2500;
let slowUntil = 0; // war gerade eine Antwort zu langsam, kommen die nächsten Dateien (30 s lang) direkt aus dem Cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  const net = fetch(event.request).then((response) => {
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
    }
    return response;
  });
  event.waitUntil(net.catch(() => {}));
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    try {
      if (cached && Date.now() < slowUntil) return cached;
      const first = await Promise.race([net, new Promise((r) => setTimeout(r, SLOW_MS, null))]);
      if (first) return first;
      slowUntil = Date.now() + 30000;
      return cached || net;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
