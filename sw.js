// Cache-first service worker so the app works offline after the first visit.
// The deploy workflow replaces VERSION with the commit SHA. Unstamped ('dev')
// local builds go network-first so source edits show up on reload.
const VERSION = 'dev';
const CACHE = `selcall-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'src/encoder.js',
  'src/fsk.js',
  'src/audio.js',
  'manifest.webmanifest',
  'icons/icon.svg',
];

// No skipWaiting()/clients.claim(): a new worker only takes over once every open
// copy of the app is closed, so a page never mixes files from two deploys.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // Bypass the HTTP cache so a new worker never precaches stale files.
      .then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});

const fromCache = (req) => caches.match(req, { ignoreSearch: true });

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    VERSION === 'dev'
      ? fetch(e.request).catch(() => fromCache(e.request).then((hit) => hit ?? Response.error()))
      : fromCache(e.request).then((hit) => hit ?? fetch(e.request)),
  );
});
