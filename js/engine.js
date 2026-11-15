// ゲームの中心ロジック。画面（DOM）には触れない純粋な関数だけを置く。

export const XP_CORRECT = 10;
export const XP_TIMED_BONUS = 5;
export const XP_VILLAIN_DEFEAT = 30;
export const VILLAIN_AFTER_WRONG = 2;
export const VILLAIN_DEFEAT_STREAK = 2;
export const CARD_AFTER_CORRECT = 2;
export const SET_SIZE = 5;

export const RANKS = [
  { name: '候補生', min: 0 },
  { name: '見習い', min: 100 },
  { name: '一次合格', min: 300 },
  { name: '二次合格', min: 600 },
  { name: '最終試験挑戦者', min: 1000 },
  { name: '合格者', min: 1500 },
];

// 記録は JSON にできる値だけなので、古い iPhone でも動くこの方法で複製する
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function createState() {
  return { xp: 0, qs: {}, cards: [], days: { last: null, count: 0 }, enabled: null, sound: true };
}

export function rankFor(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].min) i++;
  const cur = RANKS[i];
  const nxt = RANKS[i + 1];
  if (!nxt) return { name: cur.name, min: cur.min, next: null, progress: 1 };
  return { name: cur.name, min: cur.min, next: nxt.min, progress: (xp - cur.min) / (nxt.min - cur.min) };
}

export function recordAnswer(state, q, ok, { timed = false, now = Date.now() } = {}) {
  const s = clone(state);
  const events = [];
  const rec = s.qs[q.id] || { seen: 0, correct: 0, wrong: 0, streak: 0, lastAt: null, villain: false };
  rec.seen++;
  rec.lastAt = now;
  const rankBefore = rankFor(s.xp).name;
  if (ok) {
    rec.correct++;
    rec.streak++;
    let xp = XP_CORRECT + (timed ? XP_TIMED_BONUS : 0);
    if (rec.villain && rec.streak >= VILLAIN_DEFEAT_STREAK) {
      rec.villain = false;
      xp += XP_VILLAIN_DEFEAT;
      events.push({ type: 'villainDefeated', id: q.id });
    }
    s.xp += xp;
    events.unshift({ type: 'xp', amount: xp });
    if (q.card && rec.correct >= CARD_AFTER_CORRECT && !s.cards.includes(q.card)) {
      s.cards.push(q.card);
      events.push({ type: 'card', term: q.card });
    }
  } else {
    rec.wrong++;
    rec.streak = 0;
    if (!rec.villain && rec.wrong >= VILLAIN_AFTER_WRONG) {
      rec.villain = true;
      events.push({ type: 'villainBorn', id: q.id });
    }
  }
  s.qs[q.id] = rec;
  const rankAfter = rankFor(s.xp).name;
  if (rankAfter !== rankBefore) events.push({ type: 'rankUp', rank: rankAfter });
  return { state: s, events };
}

// ---- 問題選び ----

export const FIELDS = ['政治', '外交', '戦争', '経済', '社会'];

export function isEnabled(state, unitId) {
  return state.enabled === null || state.enabled.includes(unitId);
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickMission(state, questions, rng = Math.random) {
  const pool = questions.filter(q => isEnabled(state, q.unit));
  const rec = q => state.qs[q.id];
  const picked = [];
  const take = (list, n) => {
    for (const q of list) {
      if (picked.length >= SET_SIZE || n <= 0) break;
      if (!picked.includes(q)) { picked.push(q); n--; }
    }
  };
  take(shuffle(pool.filter(q => rec(q)?.villain), rng), 2);
  take(shuffle(pool.filter(q => !rec(q)), rng), 2);
  const seenOldest = pool.filter(q => rec(q) && !rec(q).villain).sort((a, b) => (rec(a).lastAt ?? 0) - (rec(b).lastAt ?? 0));
  take(seenOldest, SET_SIZE);
  take(shuffle(pool, rng), SET_SIZE);
  return shuffle(picked, rng);
}

// ---- 入力問題の答え合わせ ----

// 打ち方のゆれをそろえる: 全角→半角、カタカナ→ひらがな、小さいぁぃぅぇぉ→大きい字、空白と「・」などの記号を消す
export function normalizeAnswer(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヴ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[ゕゖヵヶ]/g, 'か')
    .replace(/[ぁぃぅぇぉ]/g, c => String.fromCharCode(c.charCodeAt(0) + 1))
    .replace(/[-‐‑–—―─]/g, 'ー')
    .replace(/[\s・･·.,、。，．「」『』"'=＝]/g, '');
}

export function checkInput(q, text) {
  const t = normalizeAnswer(text);
  return t.length > 0 && q.answers.some(a => normalizeAnswer(a) === t);
}

// 時間制限つきにする問題の位置。並べ替え・入力は操作が多いので対象外。なければ -1
export function pickTimedIndex(questions, rng = Math.random) {
  const idx = questions.map((q, i) => (q.type === 'order' || q.type === 'input' ? -1 : i)).filter(i => i >= 0);
  if (!idx.length) return -1;
  return idx[Math.floor(rng() * idx.length)];
}

// 範囲に入っている単元のヴィランの数
export function activeVillainCount(state, questions) {
  return questions.filter(q => isEnabled(state, q.unit) && state.qs[q.id]?.villain).length;
}

// 特訓のラウンド末尾にもう一度出す問題（正解したがまだ倒せていないヴィラン）
export function villainRetries(state, questions) {
  return questions.filter(q => state.qs[q.id]?.villain && state.qs[q.id].streak >= 1);
}

export function unitProgress(state, questions, unitId) {
  const qs = questions.filter(q => q.unit === unitId);
  let cleared = 0, correct = 0, wrong = 0, villains = 0;
  for (const q of qs) {
    const r = state.qs[q.id];
    if (!r) continue;
    if (r.correct > 0) cleared++;
    correct += r.correct;
    wrong += r.wrong;
    if (r.villain) villains++;
  }
  const attempts = correct + wrong;
  return { total: qs.length, cleared, accuracy: attempts ? correct / attempts : 0, villains, done: qs.length > 0 && cleared === qs.length };
}

export function pickTraining(state, questions, units, rng = Math.random) {
  const ranked = units
    .filter(u => isEnabled(state, u.id))
    .map(u => ({ u, p: unitProgress(state, questions, u.id) }))
    .filter(x => x.p.total > 0)
    .sort((a, b) => (b.p.villains - a.p.villains) || (a.p.accuracy - b.p.accuracy))
    .slice(0, 3);
  return ranked.map(({ u }) => {
    const qs = questions.filter(q => q.unit === u.id);
    const r = q => state.qs[q.id];
    const villains = shuffle(qs.filter(q => r(q)?.villain), rng);
    const missed = shuffle(qs.filter(q => !r(q)?.villain && r(q)?.wrong > 0), rng)
      .sort((a, b) => r(b).wrong - r(a).wrong);
    const rest = shuffle(qs.filter(q => !villains.includes(q) && !missed.includes(q)), rng);
    return { unit: u, questions: [...villains, ...missed, ...rest].slice(0, SET_SIZE) };
  });
}

export function fieldStats(state, questions) {
  const out = Object.fromEntries(FIELDS.map(f => [f, 0]));
  for (const q of questions) {
    const r = state.qs[q.id];
    if (r && q.field in out) out[q.field] += r.correct;
  }
  return out;
}

// ---- 日付 ----

export function localDay(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dayBefore(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  return localDay(new Date(y, m - 1, d - 1, 12).getTime());
}

export function touchDay(state, now = Date.now()) {
  const today = localDay(now);
  const s = clone(state);
  if (s.days.last === today) return s;
  s.days = { last: today, count: s.days.last === dayBefore(today) ? s.days.count + 1 : 1 };
  return s;
}
