/* ==========================================================================
   Service worker — Molinaro Cantieri
   Avvio offline dello scheletro app; i dati Firestore restano gestiti dalla
   cache di Firestore (che gestisce anche la coda di scrittura offline).
   Dopo ogni modifica ai file, incrementa VERSIONE.
   ========================================================================== */

const VERSIONE = 'v1';
const CACHE = `molinaro-cantieri-${VERSIONE}`;

const GUSCIO = [
  './', './index.html', './app.html',
  './css/app.css',
  './js/firebase.js', './js/auth.js', './js/store.js', './js/ui.js',
  './js/dettatura.js', './js/app.js',
  './manifest.json',
  './assets/logo-molinaro.png', './assets/icon-192.png', './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.allSettled(GUSCIO.map((u) => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const IGNORA = [
  'firestore.googleapis.com', 'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com', 'firebaseinstallations.googleapis.com'
];
const SDK = 'www.gstatic.com';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (IGNORA.some((d) => url.hostname.endsWith(d))) return;

  // SDK Firebase + font Google: versionati/immutabili → cache-first
  if (url.hostname === SDK || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    e.respondWith(caches.match(req).then((c) => c || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((ch) => ch.put(req, cp)); }
      return r;
    }).catch(() => c)));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      const cp = r.clone(); caches.open(CACHE).then((ch) => ch.put(req, cp)); return r;
    }).catch(() => caches.match(req).then((c) => c || caches.match('./app.html'))));
    return;
  }

  e.respondWith(caches.match(req).then((c) => {
    const net = fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((ch) => ch.put(req, cp)); }
      return r;
    }).catch(() => c);
    return c || net;
  }));
});
