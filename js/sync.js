// 解いた結果を、保護者の Google スプレッドシートへ送る。
// - 送り先（接続コード）が設定されていないときは、何もためず・何も送らない。
// - 送るのは「解いた日時・問題番号・試験・形式・正誤・問題・正解・答え」と、
//   「端末の名前・端末番号・端末の種類・かかった秒数」（どの端末で解いたかの確認用）だけ。名前や学校名は持っていない。
// - 電波がないときは iPhone の中（localStorage）にためておき、つながったときに送る。
// - 接続コード（送り先のアドレス＋合言葉）は公開のプログラムには書かず、iPhone の「設定」で貼り付ける。

export const URL_KEY = 'hero-study-sync-url';
export const TOKEN_KEY = 'hero-study-sync-token';
export const OUTBOX_KEY = 'hero-study-outbox-v1';
export const MAX_PENDING = 500; // ためる上限（超えたら古いものから捨てる）
export const BATCH = 100; // 1回に送る上限（受け取り側の上限と同じ）
const TIMEOUT_MS = 15000;

// 送り先は Google Apps Script のウェブアプリだけ（https・余計な ? や # なし）
const URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10,200}\/exec$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

function read(s, k) {
  try { return (s && s.getItem(k)) || ''; } catch { return ''; }
}
function write(s, k, v) {
  try {
    if (!s) return false;
    if (v) s.setItem(k, v); else s.removeItem(k);
    return true;
  } catch { return false; }
}

export const isValidUrl = u => typeof u === 'string' && URL_RE.test(u);
export const isValidToken = t => typeof t === 'string' && TOKEN_RE.test(t);

export function getUrl(s) { const u = read(s, URL_KEY); return isValidUrl(u) ? u : ''; }
export function getToken(s) { const t = read(s, TOKEN_KEY); return isValidToken(t) ? t : ''; }

// 空にすると送らない。形がおかしいときは前の設定のまま false を返す
export function setUrl(s, u) {
  const v = String(u ?? '').trim();
  if (v && !isValidUrl(v)) return false;
  return write(s, URL_KEY, v);
}

// 接続コード = 「送り先のアドレス#合言葉」。受け取り側の「接続コードを作る」で表示されたものを貼る
// 戻り値: 'ok'（保存した）/ 'cleared'（送るのをやめた）/ 'bad'（形がちがう・前のまま）
export function setConnection(s, code) {
  const v = String(code ?? '').trim();
  if (!v) {
    write(s, URL_KEY, '');
    write(s, TOKEN_KEY, '');
    return 'cleared';
  }
  const i = v.lastIndexOf('#');
  if (i < 0) return 'bad';
  const url = v.slice(0, i);
  const token = v.slice(i + 1);
  if (!isValidUrl(url) || !isValidToken(token)) return 'bad';
  return write(s, URL_KEY, url) && write(s, TOKEN_KEY, token) ? 'ok' : 'bad';
}

export const isOn = s => !!getUrl(s) && !!getToken(s);

// ---- 1問ぶんの記録 ----
const TYPE = { choice: '4択', tf: '○×', order: '並べ替え', input: '入力' };
const NONE = '（答えなし）';
const pad = n => String(n).padStart(2, '0');

function stamp(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const joinOrder = (q, idx) => idx.map(i => String(q.choices[i] ?? '?')).join(' → ');

export function correctText(q) {
  if (q.type === 'choice') return String(q.choices[q.answer]);
  if (q.type === 'tf') return q.answer ? '○' : '×';
  if (q.type === 'order') return joinOrder(q, q.answer);
  return String((q.answers || [])[0] ?? '');
}

// given: 4択=選んだ番号 / ○×=true・false / 並べ替え=押した順の番号の配列 / 入力=打った文字。答えていないときは null
export function givenText(q, v) {
  if (v === null || v === undefined) return NONE;
  if (q.type === 'choice') return Number.isInteger(v) && q.choices[v] !== undefined ? String(q.choices[v]) : NONE;
  if (q.type === 'tf') return v === true ? '○' : v === false ? '×' : NONE;
  if (q.type === 'order') return Array.isArray(v) && v.length ? joinOrder(q, v) : NONE;
  const t = String(v).trim();
  return t ? t.slice(0, 100) : NONE;
}

// subjectName（教科名）があれば、試験の欄の先頭に入れる（例: 化学 一次試験「コロイド」）
// extra: どの端末から送られたか（withDevice）と、かかった秒数（sec）。なければ付けない
export function makeRecord(q, unit, ok, given, now, subjectName = '', extra = {}) {
  const stage = unit ? `${unit.stage}「${unit.title}」` : '';
  return {
    at: stamp(now),
    id: q.id,
    stage: subjectName && stage ? `${subjectName} ${stage}` : stage,
    type: TYPE[q.type] || String(q.type),
    ok: !!ok,
    q: q.q,
    answer: correctText(q),
    given: givenText(q, given),
    ...cleanExtra(extra),
  };
}

// ボス戦のまとめ1行。正誤＝撃破したか、問題＝「20問中17問正解」、正解の欄＝点数、答えの欄＝ごほうび
// res は boss.js の judgeBoss の戻り値
export function makeBossRecord(boss, res, correct, total, now, extra = {}) {
  const label = boss.kind === 'subject' ? '教科ボス' : `${boss.unit.stage}のボス`;
  return {
    at: stamp(now),
    id: boss.id,
    stage: `${boss.subject.name} ${label}「${boss.name}」`,
    type: 'ボス',
    ok: !!res.passed,
    q: `${total}問中${correct}問正解`,
    answer: `${res.score}点`,
    given: rewardText(res),
    ...cleanExtra(extra),
  };
}

export function rewardText(res) {
  if (!res.passed) return 'ごほうびなし（不合格）';
  if (res.reward > 0) return `${res.reward}円（${res.first ? '初めての撃破' : `${res.nth}回目の撃破`}）`;
  return `0円（${res.nth}回目の撃破・今日はもらい済み）`;
}

// ---- どの端末から送られたか ----
// dev = 端末の名前（設定でおうちの人がつける）、did = 端末ごとのランダム番号、ua = 端末の種類（iPhone・Safari など）
// 名前や学校名は送らない。端末の種類は細かい情報（バージョンなど）を落として、大まかな種類だけにする
export const DEVICE_NAME_KEY = 'hero-study-device-name';
export const DEVICE_ID_KEY = 'hero-study-device-id';
export const DEVICE_NAME_MAX = 20;
const DID_RE = /^[a-f0-9]{12}$/;

export function getDeviceName(s) { return cleanName(read(s, DEVICE_NAME_KEY)); }

function cleanName(v) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, DEVICE_NAME_MAX);
}

// 空にすると名前なし。戻り値は保存した名前（保存できなければ null）
export function setDeviceName(s, name) {
  const v = cleanName(name);
  return write(s, DEVICE_NAME_KEY, v) ? v : null;
}

// 端末ごとのランダム番号。なければ作って保存する（作れないときは空）
export function deviceId(s, cryptoObj = globalThis.crypto) {
  const cur = read(s, DEVICE_ID_KEY);
  if (DID_RE.test(cur)) return cur;
  try {
    const b = new Uint8Array(6);
    cryptoObj.getRandomValues(b);
    const id = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return write(s, DEVICE_ID_KEY, id) ? id : '';
  } catch { return ''; }
}

export function deviceKind(ua) {
  const u = String(ua || '');
  const dev = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android'
    : /Macintosh/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'その他';
  const br = /Line\//.test(u) ? 'LINE' : /EdgiOS|EdgA?\//.test(u) ? 'Edge' : /FxiOS|Firefox\//.test(u) ? 'Firefox'
    : /CriOS|Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'その他';
  return `${dev}・${br}`;
}

export function withDevice(s, ua, extra = {}) {
  return { ...extra, dev: getDeviceName(s), did: deviceId(s), ua: deviceKind(ua) };
}

// 送ってよい形のものだけ残す
function cleanExtra(x) {
  const out = {};
  if (!x || typeof x !== 'object') return out;
  if (typeof x.dev === 'string') out.dev = cleanName(x.dev);
  if (typeof x.did === 'string' && DID_RE.test(x.did)) out.did = x.did;
  if (typeof x.ua === 'string') out.ua = x.ua.slice(0, 40);
  if (Number.isFinite(x.sec) && x.sec >= 0) out.sec = Math.min(86400, Math.round(x.sec));
  return out;
}

// ---- ためる・送る ----
export function pending(s) {
  try {
    const list = JSON.parse(read(s, OUTBOX_KEY) || '[]');
    return Array.isArray(list) ? list.filter(r => r && typeof r === 'object' && !Array.isArray(r)) : [];
  } catch { return []; }
}

export function enqueue(s, rec) {
  if (!getUrl(s)) return false;
  const list = pending(s);
  list.push(rec);
  return write(s, OUTBOX_KEY, JSON.stringify(list.slice(-MAX_PENDING)));
}

let busy = false;

// 送れた件数を返す。電波がない・失敗したときは 0 で、ためたものは残す
export async function flush(s, fetchFn = globalThis.fetch && globalThis.fetch.bind(globalThis)) {
  if (!s || busy || typeof fetchFn !== 'function') return 0;
  const url = getUrl(s);
  if (!url) return 0;
  const rows = pending(s).slice(0, BATCH);
  if (!rows.length) return 0;
  busy = true;
  try {
    const opts = {
      method: 'POST',
      mode: 'no-cors', // 返事は読めない（読めなくても届く）。中身は text/plain の JSON
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify({ v: 1, token: getToken(s), rows }),
    };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      opts.signal = AbortSignal.timeout(TIMEOUT_MS);
    }
    await fetchFn(url, opts);
  } catch {
    return 0;
  } finally {
    busy = false;
  }
  // 送っている間に増えた分は残す
  write(s, OUTBOX_KEY, JSON.stringify(pending(s).slice(rows.length)));
  return rows.length;
}
