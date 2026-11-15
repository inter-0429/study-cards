// 電波がなくても動くように、アプリのファイルをすべて iPhone の中に保存する。
const CACHE = 'hero-study-v7';
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
  './js/sync.js',
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
  './data/subjects.js',
  './data/kagaku/units.js',
  './data/kagaku/index.js',
  './data/kagaku/k01.js',
  './data/kagaku/k02.js',
  './data/kagaku/k03.js',
  './data/kagaku/k04.js',
  './data/kagaku/k05.js',
  './data/seibutsu/units.js',
  './data/seibutsu/index.js',
  './data/seibutsu/s01.js',
  './data/seibutsu/s02.js',
  './data/seibutsu/s03.js',
  './data/seibutsu/s04.js',
  './data/butsuri/units.js',
  './data/butsuri/index.js',
  './data/butsuri/b01.js',
  './data/butsuri/b02.js',
  './data/butsuri/b03.js',
  './data/butsuri/b04.js',
  './data/butsuri/b05.js',
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
