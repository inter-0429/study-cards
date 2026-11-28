// ゲームの中心ロジック。画面（DOM）には触れない純粋な関数だけを置く。
import { URA } from '../data/ura.js';
import { emptyBaseball } from './baseball.js';

export const XP_CORRECT = 10;
export const XP_TIMED_BONUS = 5;
export const XP_VILLAIN_DEFEAT = 30;
export const VILLAIN_AFTER_WRONG = 2;
export const VILLAIN_DEFEAT_STREAK = 2;
export const CARD_AFTER_CORRECT = 2;
export const SET_SIZE = 5;
// 出す問題の形の割合（2026-11-17 オーナー）: 半分を記入（書く問題）、残りを 4択・○×・並べ替え で同じ数ずつ
export const WRITTEN_SHARE = 0.5;
// 同じ問題は1日にこの回数まで（答えだけ覚えるのを防ぐ。2026-11-17 オーナー）
export const DAILY_MAX = 3;

// プレイヤーのレベル（2026-11-22 オーナー: 1000 まで）。
// レベル L になるのに必要な経験値の合計 = LEVEL_XP ×（L−1）^1.5（小数は切り捨て）。Lv 1000 は 315,753。
// 次のレベルまでは、はじめは正解1問分、Lv 1000 の手前でも正解50問分ほど。
export const MAX_LEVEL = 1000;
export const LEVEL_XP = 10;
// 称号は、そのレベルになったら付く
export const RANKS = [
  { name: '候補生', level: 1 },
  { name: '見習い', level: 15 },
  { name: '一次合格', level: 30 },
  { name: '二次合格', level: 60 },
  { name: '最終試験挑戦者', level: 90 },
  { name: '合格者', level: 120 },
  { name: '一人前のヒーロー', level: 200 },
  { name: 'トップヒーロー', level: 350 },
  { name: '歴戦のヒーロー', level: 500 },
  { name: '英雄', level: 700 },
  { name: '伝説のヒーロー', level: 1000 },
];

export function xpForLevel(level) {
  return Math.floor(LEVEL_XP * Math.pow(level - 1, 1.5));
}

// 記録は JSON にできる値だけなので、古い iPhone でも動くこの方法で複製する
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function createState() {
  return { xp: 0, qs: {}, cards: [], days: { last: null, count: 0 }, enabled: null, sound: true, bosses: {}, baseball: emptyBaseball() };
}

export function rankFor(xp) {
  const v = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  while (level < MAX_LEVEL && v >= xpForLevel(level + 1)) level++;
  let t = 0;
  while (t + 1 < RANKS.length && level >= RANKS[t + 1].level) t++;
  const title = RANKS[t].name;
  // name はレベルが上がるたびに変わる（ランクアップの判定と表示に使う）
  const name = `Lv ${level} ${title}`;
  const min = xpForLevel(level);
  if (level >= MAX_LEVEL) return { name, level, title, min, next: null, progress: 1 };
  const next = xpForLevel(level + 1);
  return { name, level, title, min, next, progress: (v - min) / (next - min) };
}

export function recordAnswer(state, q, ok, { timed = false, now = Date.now() } = {}) {
  const s = clone(state);
  const events = [];
  const rec = s.qs[q.id] || { seen: 0, correct: 0, wrong: 0, streak: 0, lastAt: null, villain: false };
  rec.seen++;
  rec.lastAt = now;
  const day = localDay(now);
  rec.dayCount = rec.day === day ? (rec.dayCount || 0) + 1 : 1;
  rec.day = day;
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

// あとから足した教科の単元は、最初は範囲に入れる。
// known = 記録が「知っている」単元の一覧。前の版の記録には無いので legacyKnown（歴史の単元）とみなす。
// 範囲の一覧（enabled）にある単元と、まだ知らなかった単元を範囲に入れ、全部そろえば null（＝全部）にする。
export function includeNewUnits(state, allIds, legacyKnown) {
  const s = clone(state);
  const known = Array.isArray(s.known) ? s.known : legacyKnown;
  if (Array.isArray(s.enabled)) {
    const on = id => s.enabled.includes(id) || !known.includes(id);
    const next = allIds.filter(on);
    s.enabled = next.length === allIds.length ? null : next;
  }
  s.known = allIds.slice();
  return s;
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 書く問題への変換（裏ボスと同じ表 data/ura.js を使う） ----

// 1字ずつの書き方の表（data/ura.js）から、全部漢字の形を作る
const kanjiForm = spec => spec.split(' ').filter(Boolean).map(t => (t.includes('|') ? t.slice(0, t.indexOf('|')) : t)).join('');
// 4択問題を「選択肢なしで書く問題」にする。表にない4択と、○×・並べ替えは使わない。入力問題はそのまま
export function toWritten(q) {
  if (q.type === 'input') return q;
  if (q.type !== 'choice' || !URA[q.id]) return null;
  const answers = [String(q.choices[q.answer]), ...URA[q.id].map(kanjiForm)];
  return { ...q, type: 'input', answers: [...new Set(answers)], yomi: URA[q.id], choices: undefined, answer: undefined, why: undefined, written: true };
}
// 同じ単元に、答えが同じ入力問題があるときは、その4択は出さない（同じ問題が2回出ないように）
export function writtenQuestions(qs) {
  const ws = qs.map(toWritten).filter(Boolean);
  const inputAns = new Map();
  for (const q of ws.filter(q => !q.written)) {
    const set = inputAns.get(q.unit) || new Set();
    for (const a of q.answers) set.add(normalizeAnswer(a));
    inputAns.set(q.unit, set);
  }
  return ws.filter(q => !q.written || !q.answers.some(a => (inputAns.get(q.unit) || new Set()).has(normalizeAnswer(a))));
}

// ---- 形の割合をそろえる・1日の回数 ----

// 今日この問題を解いた回数
export function todayCount(state, q, now = Date.now()) {
  const r = state.qs[q.id];
  return r && r.day === localDay(now) ? (r.dayCount || 0) : 0;
}
export function underDailyMax(state, q, now = Date.now()) {
  return todayCount(state, q, now) < DAILY_MAX;
}

// size 問のうち、各形を何問にするか。記入は半分（端数は rng で切り上げか切り捨て）、残りを3つの形に同じ数ずつ
export function formatTargets(size, rng = Math.random) {
  const exact = size * WRITTEN_SHARE;
  const frac = exact - Math.floor(exact);
  const written = Math.floor(exact) + (frac > 0 && rng() < frac ? 1 : 0);
  const rest = size - written;
  const kinds = shuffle(['choice', 'tf', 'order'], rng);
  const t = { written, choice: 0, tf: 0, order: 0 };
  kinds.forEach((k, i) => { t[k] = Math.floor(rest / 3) + (i < rest % 3 ? 1 : 0); });
  return t;
}

// 優先順のリストから size 問を選び、形の割合に近づける。
// lists: [{ qs, max, must }]。must のリストは形に関係なく max 問まで先に入れる（ヴィランなど）。
// 書く形にできる4択は、記入が足りないとき選択肢なしで出す。足りない形があれば、ほかの形で埋める。
// 1つの組の中で、記入の答えが同じ問題は2つ入れない（同じ問題が2回出ないように）。
export function mixSet(lists, size, { rng = Math.random } = {}) {
  const target = formatTargets(size, rng);
  const count = { written: 0, choice: 0, tf: 0, order: 0, other: 0 };
  const picked = [];
  const ids = new Set();
  const answerKeys = new Set();
  const keyOf = w => normalizeAnswer(String(w.answers[0]).replace(/（.*）$/, ''));
  const dupAnswer = q => { const w = toWritten(q); return !!w && answerKeys.has(keyOf(w)); };
  const formOf = (q, strict) => {
    if (q.type === 'input') return !dupAnswer(q) && (!strict || count.written < target.written) ? 'written' : null;
    if (q.type === 'choice' && toWritten(q) && !dupAnswer(q) && count.written < target.written) return 'written';
    if (q.type === 'choice' && strict && dupAnswer(q)) return null;
    // 記入の分の席は残しておく（先に入れたヴィランなどで、ほかの形が多くなっても記入が減らないように）
    const others = picked.length - count.written;
    if (q.type === 'choice' || q.type === 'tf' || q.type === 'order') return !strict || (count[q.type] < target[q.type] && others < size - target.written) ? q.type : null;
    return strict ? null : 'other';
  };
  const add = (q, form) => {
    ids.add(q.id);
    count[form]++;
    const shown = form === 'written' && q.type === 'choice' ? toWritten(q) : q;
    const w = toWritten(q);
    if (w) answerKeys.add(keyOf(w)); // 4択で出しても、同じ答えの記入とは同じ組に入れない
    picked.push(shown);
  };
  const run = (mode) => {
    for (const l of lists) {
      if (mode === 'must' && !l.must) continue;
      if (mode !== 'must' && l.must) continue; // 先に入れるリストは max 問までで終わり
      let n = mode === 'must' ? (l.max ?? size) : size;
      for (const q of l.qs) {
        if (picked.length >= size || n <= 0) break;
        if (ids.has(q.id)) continue;
        const form = formOf(q, mode === 'strict');
        if (!form) continue;
        add(q, form); n--;
      }
    }
  };
  run('must');   // 先に入れるもの（形は気にしない）
  run('strict'); // 形の割合どおりに
  run('fill');   // 足りない分をほかの形で
  return picked;
}

// ---- 計算だけモード（教科ごと。2026-11-28 追加） ----
// state.calcOnly = 計算問題だけ出す教科の id の一覧。前の版の記録には無い（＝どの教科もふつう）
export const CALC_FIELD = '計算';
export function hasCalc(subject) { return subject.questions.some(q => q.field === CALC_FIELD); }
export function isCalcOnly(state, subjectId) { return Array.isArray(state.calcOnly) && state.calcOnly.includes(subjectId); }
export function toggleCalcOnly(state, subjectId) {
  const cur = Array.isArray(state.calcOnly) ? state.calcOnly : [];
  return { ...state, calcOnly: cur.includes(subjectId) ? cur.filter(x => x !== subjectId) : [...cur, subjectId] };
}
// ミッション・試合・特訓に使う問題。計算だけモードなら計算問題だけ
export function playQuestions(state, subject) {
  return isCalcOnly(state, subject.id) ? subject.questions.filter(q => q.field === CALC_FIELD) : subject.questions;
}
// ステージの「挑戦する」に使う問題。計算問題が1問もない試験（集合と命題など）は、全部の問題を出す
export function stageQuestions(state, subject, unitId) {
  const all = subject.questions.filter(q => q.unit === unitId);
  if (!isCalcOnly(state, subject.id)) return all;
  const calc = all.filter(q => q.field === CALC_FIELD);
  return calc.length ? calc : all;
}

export function pickMission(state, questions, rng = Math.random, now = Date.now()) {
  const pool = questions.filter(q => isEnabled(state, q.unit) && underDailyMax(state, q, now));
  const rec = q => state.qs[q.id];
  const seenOldest = pool.filter(q => rec(q) && !rec(q).villain).sort((a, b) => (rec(a).lastAt ?? 0) - (rec(b).lastAt ?? 0));
  const picked = mixSet([
    { qs: shuffle(pool.filter(q => rec(q)?.villain), rng), max: 2, must: true },
    { qs: shuffle(pool.filter(q => !rec(q)), rng), max: 2, must: true },
    { qs: seenOldest },
    { qs: shuffle(pool, rng) },
  ], SET_SIZE, { rng });
  return shuffle(picked, rng);
}

// 野球の試合の問題（最大12問）。選び方はミッションと同じ（記入が半分・ヴィラン優先・1日3回まで）
export const GAME_SIZE = 12;
export function pickGame(state, questions, rng = Math.random, now = Date.now()) {
  const pool = questions.filter(q => isEnabled(state, q.unit) && underDailyMax(state, q, now));
  const rec = q => state.qs[q.id];
  const seenOldest = pool.filter(q => rec(q) && !rec(q).villain).sort((a, b) => (rec(a).lastAt ?? 0) - (rec(b).lastAt ?? 0));
  const picked = mixSet([
    { qs: shuffle(pool.filter(q => rec(q)?.villain), rng), max: 3, must: true },
    { qs: shuffle(pool.filter(q => !rec(q)), rng), max: 3, must: true },
    { qs: seenOldest },
    { qs: shuffle(pool, rng) },
  ], Math.min(GAME_SIZE, pool.length), { rng });
  return shuffle(picked, rng);
}

// ---- 入力問題の答え合わせ ----

// 打ち方のゆれをそろえる: 全角→半角、カタカナ→ひらがな、小さいぁぃぅぇぉ→大きい字、空白と「・」などの記号を消す
export function normalizeAnswer(text) {
  return String(text ?? '')
    .normalize('NFKC')
    // 常用漢字の字体と、よく変換で出る字体をそろえる（充塡・充填 など）
    .replace(/[塡剝頰]/g, c => ({ 塡: '填', 剝: '剥', 頰: '頬' })[c])
    .toLowerCase()
    .replace(/[ァ-ヴ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[ゕゖヵヶ]/g, 'か')
    .replace(/[ぁぃぅぇぉ]/g, c => String.fromCharCode(c.charCodeAt(0) + 1))
    .replace(/[-‐‑–—―─]/g, 'ー')
    .replace(/[\s・･·.,、。，．「」『』"'=＝]/g, '');
}

// まぜ書きの形を全部作る。spec の書き方は data/yomi.js の説明のとおり
const YOMI_MAX = 4096;
const yomiCache = new Map();
export function expandYomi(spec) {
  if (yomiCache.has(spec)) return yomiCache.get(spec);
  let forms = [''];
  for (const tok of String(spec).split(' ').filter(Boolean)) {
    const i = tok.indexOf('|');
    const opts = i < 0 ? [tok] : [tok.slice(0, i), ...tok.slice(i + 1).split('/')];
    forms = forms.flatMap(f => opts.map(o => f + o));
    if (forms.length > YOMI_MAX) break; // 長すぎる指定でも固まらない
  }
  const out = new Set(forms.slice(0, YOMI_MAX).map(normalizeAnswer));
  yomiCache.set(spec, out);
  return out;
}

export function checkInput(q, text) {
  const t = normalizeAnswer(text);
  if (!t.length) return false;
  return q.answers.some(a => normalizeAnswer(a) === t) || (q.yomi || []).some(spec => expandYomi(spec).has(t));
}

// 時間制限つきにする問題の位置。並べ替え・入力は操作が多く、計算問題は考える時間がいるので対象外。なければ -1
export function pickTimedIndex(questions, rng = Math.random) {
  const skip = q => q.type === 'order' || q.type === 'input' || q.field === '計算';
  const idx = questions.map((q, i) => (skip(q) ? -1 : i)).filter(i => i >= 0);
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
  return { total: qs.length, cleared, attempts, accuracy: attempts ? correct / attempts : 0, villains, done: qs.length > 0 && cleared === qs.length };
}

// ---- 得意・苦手 ----
export const SKILL_MIN_ATTEMPTS = 5; // これより少ないうちは決めつけない
export const SKILL_GOOD = 0.8;
export const SKILL_WEAK = 0.6;
export const SKILL_LABEL = { good: '得意', ok: 'ふつう', weak: '苦手', few: 'まだ少ない' };

export function skillLevel(accuracy, attempts) {
  if (attempts < SKILL_MIN_ATTEMPTS) return 'few';
  if (accuracy >= SKILL_GOOD) return 'good';
  if (accuracy < SKILL_WEAK) return 'weak';
  return 'ok';
}

// 単元ごとの得意・苦手。正答率の低い順（同じなら単元の順）、「まだ少ない」は最後
export function unitSkills(state, questions, units) {
  const rows = units.map((unit, i) => {
    const p = unitProgress(state, questions, unit.id);
    return { unit, i, total: p.total, attempts: p.attempts, accuracy: p.accuracy, villains: p.villains, level: skillLevel(p.accuracy, p.attempts) };
  });
  rows.sort((a, b) => ((a.level === 'few') - (b.level === 'few')) || (a.level === 'few' ? 0 : a.accuracy - b.accuracy) || (a.i - b.i));
  return rows.map(({ i, ...r }) => r);
}

// 教科のまとめ（教科の一覧に出すもの）。weakest は「苦手」の単元のうち正答率がいちばん低いもの
export function subjectSummary(state, subject) {
  let correct = 0, wrong = 0, villains = 0;
  for (const q of subject.questions) {
    const r = state.qs[q.id];
    if (!r) continue;
    correct += r.correct;
    wrong += r.wrong;
    if (r.villain && isEnabled(state, q.unit)) villains++; // 教科の画面・特訓と同じく、範囲に入っている試験だけ
  }
  const attempts = correct + wrong;
  const weak = unitSkills(state, subject.questions, subject.units).find(r => r.level === 'weak');
  return { attempts, accuracy: attempts ? correct / attempts : 0, villains, weakest: weak ? { unit: weak.unit, accuracy: weak.accuracy } : null };
}

export function pickTraining(state, questions, units, rng = Math.random, now = Date.now()) {
  const ranked = units
    .filter(u => isEnabled(state, u.id))
    .map(u => ({ u, p: unitProgress(state, questions, u.id) }))
    .filter(x => x.p.total > 0)
    .sort((a, b) => (b.p.villains - a.p.villains) || (a.p.accuracy - b.p.accuracy))
    .slice(0, 3);
  return ranked.map(({ u }) => {
    const qs = questions.filter(q => q.unit === u.id && underDailyMax(state, q, now));
    const r = q => state.qs[q.id];
    const villains = shuffle(qs.filter(q => r(q)?.villain), rng);
    const missed = shuffle(qs.filter(q => !r(q)?.villain && r(q)?.wrong > 0), rng)
      .sort((a, b) => r(b).wrong - r(a).wrong);
    const rest = shuffle(qs.filter(q => !villains.includes(q) && !missed.includes(q)), rng);
    const picked = mixSet([
      { qs: villains, max: SET_SIZE, must: true },
      { qs: missed, max: SET_SIZE, must: true },
      { qs: rest },
    ], SET_SIZE, { rng });
    return { unit: u, questions: picked };
  }).filter(x => x.questions.length > 0);
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

// 選択問題でまちがえた選択肢を選んだとき、その選択肢が「なぜちがうか」。出せないときは null
export function whyWrong(q, given) {
  if (!q || q.type !== 'choice' || !Number.isInteger(given) || given === q.answer) return null;
  const t = Array.isArray(q.why) ? q.why[given] : null;
  return typeof t === 'string' && t ? t : null;
}
