// 電波がなくても動くように、アプリのファイルをすべて iPhone の中に保存する。
// v15: 地理総合を足した（data/chiri/）
// v17: プレイヤーのレベルを Lv 1〜100 にした
// v18: レベルの上限を Lv 1000 にした
// v19: 野球モード（試合とスカウト）を足した
// v25: 設定に「いまの版」と「更新する」、新しい版が届いたらお知らせ
// v24: スカウト券10枚のプレゼント（1回だけ）
// v23: ランクを B・A・S の3段階に（S 5%）
// v22: スカウトの演出を豪華に（照明・段階演出・フラッシュ・カードめくり・紙吹雪）
// v21: オーダー（打順）・選手の成績・強い選手は打球が伸びる
// v20: 野球モードの効果音（打球音・歓声・アウト・スカウト）
const CACHE = 'hero-study-v27';
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
  './js/boss.js',
  './js/baseball.js',
  './js/bbsound.js',
  './js/version.js',
  './js/sound.js',
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
  './data/yomi.js',
  './data/ura.js',
  './data/players.js',
  './data/why/index.js',
  './data/why/rekishi.js',
  './data/why/kagaku.js',
  './data/why/seibutsu.js',
  './data/why/butsuri.js',
  './data/why/suugaku.js',
  './data/why/suugakua.js',
  './data/why/suugaku2.js',
  './data/why/chiri.js',
  './data/kagaku/units.js',
  './data/kagaku/index.js',
  './data/kagaku/k01.js',
  './data/kagaku/k02.js',
  './data/kagaku/k03.js',
  './data/kagaku/k04.js',
  './data/kagaku/k05.js',
  './data/kagaku/k06.js',
  './data/kagaku/k07.js',
  './data/kagaku/iikae.js',
  './data/seibutsu/units.js',
  './data/seibutsu/index.js',
  './data/seibutsu/s01.js',
  './data/seibutsu/s02.js',
  './data/seibutsu/s03.js',
  './data/seibutsu/s04.js',
  './data/seibutsu/iikae.js',
  './data/butsuri/units.js',
  './data/butsuri/index.js',
  './data/butsuri/b01.js',
  './data/butsuri/b02.js',
  './data/butsuri/b03.js',
  './data/butsuri/b04.js',
  './data/butsuri/b05.js',
  './data/butsuri/iikae.js',
  './data/suugaku/units.js',
  './data/suugaku/index.js',
  './data/suugaku/m01.js',
  './data/suugaku/m02.js',
  './data/suugaku/m03.js',
  './data/suugaku/m04.js',
  './data/suugaku/m05.js',
  './data/suugaku/m06.js',
  './data/suugaku/m07.js',
  './data/suugaku/m08.js',
  './data/suugaku/m09.js',
  './data/suugakua/units.js',
  './data/suugakua/index.js',
  './data/suugakua/a01.js',
  './data/suugakua/a02.js',
  './data/suugakua/a03.js',
  './data/suugakua/a04.js',
  './data/suugakua/a05.js',
  './data/suugakua/a06.js',
  './data/suugakua/a07.js',
  './data/suugakua/a08.js',
  './data/suugakua/a09.js',
  './data/suugaku2/units.js',
  './data/suugaku2/index.js',
  './data/suugaku2/t01.js',
  './data/suugaku2/t02.js',
  './data/suugaku2/t03.js',
  './data/suugaku2/t04.js',
  './data/suugaku2/t05.js',
  './data/suugaku2/t06.js',
  './data/suugaku2/t07.js',
  './data/suugaku2/iikae.js',
  './data/chiri/units.js',
  './data/chiri/index.js',
  './data/chiri/c01.js',
  './data/chiri/c02.js',
  './data/chiri/c03.js',
  './data/chiri/c04.js',
  './data/chiri/c05.js',
  './data/chiri/c06.js',
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
