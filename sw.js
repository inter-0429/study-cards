// 電波がなくても動くように、アプリのファイルをすべて iPhone の中に保存する。
const CACHE = 'hero-study-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './js/app.js',
  './js/engine.js',
  './js/store.js',
  './data/index.js',
  './data/units.js',
  './data/u01.js',
  './data/u02.js',
  './data/u03.js',
  './data/u04.js',
  './data/u05.js',
  './data/u06.js',
  './data/u07.js',
  './data/u08.js',
  './data/u09.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
