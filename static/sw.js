const CACHE_NAME = 'bringfrisch-cache-v98';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './app_plan.js',
  './app_einkauf.js',
  './app_vorrat.js',
  './app_hof.js',
  './hoflaeden.js',
  './maerkte_spezial.js',
  './app_rezepte.js',
  './app_wahl.js',
  './app_alle.js',
  './app_sync.js',
  './app_einstellungen.js',
  './app_push.js',
  './app_theme.js',
  './app_start.js',
  './standalone_data.js',
  './recipes_imported.js',
  './bring_catalog.js',
  './core.js',
  './store.js',
  './fonts/roboto-flex-latin.woff2',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-badge-96.png',
  './recipe_importer.js',
  './manifest.json',
  './rechtliches.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: reload = am Browser-Cache vorbei (GitHub Pages: max-age=600), sonst landet die alte Version im neuen Cache
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // «bf-img» = Rezeptbilder der Wochenwahl, «bf-meta» = «als App installiert» – bleiben über App-Updates hinweg
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== 'bf-img' && k !== 'bf-meta').map((k) => caches.delete(k)))
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

  // no-cache: beim Server nachfragen (ETag, kostet fast nichts). Ohne das lieferte der Browser-Cache bis 10 Min. lang
  // die alte app.js, obwohl «Neue Version» schon die neue sah -> «Laden» drehte im Kreis (19.11., 1.14.0 -> 1.14.1).
  const net = fetch(event.request, { cache: 'no-cache' }).then((response) => {
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

// Benachrichtigungen (Web Push vom WG-Server, worker/src/push.js): Meldung zeigen; antippen öffnet Obsonare an der
// richtigen Stelle (open = "wahl" | "einkauf") – offenes Fenster nach vorne holen, sonst neu öffnen.
self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch (e) { msg = { title: 'Obsonare', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(isInstalled().then((installed) => self.registration.showNotification(msg.title || 'Obsonare', {
    body: msg.body || '',
    tag: msg.tag || undefined,
    renotify: !!msg.tag,
    // Installierte App: Android zeigt das App-Bild schon links – mit «icon» stand Obsonare doppelt (Joshua 19.11.).
    // Browser/Firefox: links steht das Browser-Zeichen, dort bleibt das grosse Bild.
    ...(installed ? {} : { icon: 'icon-192.png' }),
    badge: 'icon-badge-96.png',
    data: { open: msg.open || '' }
  })));
});

// Die App meldet beim Start «ich laufe installiert» (app_push.js); gemerkt im Cache «bf-meta», damit es auch gilt, wenn sie zu ist
const INSTALLED = './bf-installed';
const isInstalled = () => caches.open('bf-meta').then((c) => c.match(INSTALLED)).then((r) => !!r, () => false);
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'bf-installed') event.waitUntil(caches.open('bf-meta').then((c) => c.put(INSTALLED, new Response('1'))));
});

// Läuft die App als installierte App (Home-Bildschirm)? Jedes offene Fenster antwortet selbst (app_push.js), sonst «nein».
function isStandalone(win) {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(false), 400);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(!!(e.data && e.data.standalone)); };
    try { win.postMessage({ type: 'bf-mode' }, [ch.port2]); } catch (e) { clearTimeout(t); resolve(false); }
  });
}

// Antippen: zuerst ein offenes Fenster der installierten App. Ist nur ein Browser-Tab offen, öffnet Android trotzdem
// die App (openWindow landet in der installierten App) – sonst ging Einkauf/Wochenwahl im Browser auf (Joshua 19.11.).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const open = (event.notification.data && event.notification.data.open) || '';
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope).pathname;
    const wins = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((w) => new URL(w.url).pathname.startsWith(scope));
    const modes = await Promise.all(wins.map(isStandalone));
    const app = wins.find((w, i) => modes[i]);
    const tab = /Android/i.test(self.navigator.userAgent) ? null : wins[0];
    const win = app || tab;
    if (win) {
      win.postMessage({ type: 'bf-open', open });
      return win.focus();
    }
    return self.clients.openWindow(`./?open=${encodeURIComponent(open)}`);
  })());
});
