// 野球モード（試合とスカウト）の決まり。画面（DOM）には触れない純粋な関数だけを置く。
// 設計: docs/2026-11-25-野球モード-設計.md
import { PLAYERS } from '../data/players.js';

export const RARITIES = ['N', 'R', 'SR', 'L'];
export const RARITY_LABEL = { N: 'ノーマル', R: 'レア', SR: 'スーパーレア', L: 'レジェンド' };
// 出る確率（%）。画面にもこのまま出す
export const ODDS = { N: 55, R: 30, SR: 12, L: 3 };
// 相手チームの1試合の点の合計の幅（リーグは架空）
export const LEAGUES = [
  { name: 'ルーキーリーグ', team: 'ひよっこスターズ', min: 0, max: 2 },
  { name: '2軍リーグ', team: 'ブルーウェーブス', min: 1, max: 3 },
  { name: '1軍リーグ', team: 'サンダーホークス', min: 2, max: 5 },
  { name: '日本一決定戦', team: 'ギャラクシーキングス', min: 3, max: 6 },
];
export const INNINGS = 3;
export const MAX_AT_BATS = 12;
export const WIN_TO_PROMOTE = 3;
export const POINTS_PER_TICKET = 10;
export const MAX_STAR = 5;
export const STAR_OVERFLOW_POINTS = 5;
const POWER = { N: 10, R: 20, SR: 35, L: 60 };

const BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
const BY_RARITY = Object.fromEntries(RARITIES.map(r => [r, PLAYERS.filter(p => p.rarity === r)]));

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const count = (v, max = Infinity) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);

export function emptyBaseball() {
  return { points: 0, tickets: 0, players: {}, league: 0, leagueWins: 0, wins: 0, losses: 0, draws: 0, lineup: [], stats: {} };
}

// 保存してあった記録の形を確かめる。おかしな項目だけ初期値にする
export function cleanBaseball(raw) {
  const bb = emptyBaseball();
  if (!isObj(raw)) return bb;
  bb.points = count(raw.points, POINTS_PER_TICKET - 1);
  bb.tickets = count(raw.tickets);
  bb.league = count(raw.league, LEAGUES.length - 1);
  bb.leagueWins = count(raw.leagueWins);
  bb.wins = count(raw.wins);
  bb.losses = count(raw.losses);
  bb.draws = count(raw.draws);
  if (isObj(raw.players)) {
    for (const id of Object.keys(raw.players)) {
      const n = raw.players[id];
      if (BY_ID.has(id) && Number.isInteger(n) && n >= 1 && n <= MAX_STAR) bb.players[id] = n;
    }
  }
  // オーダー: 持っている選手か null（助っ人）。重複なし・9人まで
  if (Array.isArray(raw.lineup)) {
    const seen = new Set();
    for (const id of raw.lineup.slice(0, 9)) {
      if (id === null) bb.lineup.push(null);
      else if (typeof id === 'string' && bb.players[id] && !seen.has(id)) { seen.add(id); bb.lineup.push(id); }
    }
  }
  // 成績: 打数 ≧ ヒット ≧ ホームラン
  if (isObj(raw.stats)) {
    for (const id of Object.keys(raw.stats)) {
      const x = raw.stats[id];
      if (!BY_ID.has(id) || !isObj(x)) continue;
      const ok = [x.ab, x.h, x.hr].every(v => Number.isInteger(v) && v >= 0) && x.hr <= x.h && x.h <= x.ab;
      if (ok) bb.stats[id] = { ab: x.ab, h: x.h, hr: x.hr };
    }
  }
  return bb;
}

// ---- 試合 ----
export function newGame(league, rng = Math.random) {
  const L = LEAGUES[Math.min(Math.max(league | 0, 0), LEAGUES.length - 1)];
  const total = L.min + Math.floor(rng() * (L.max - L.min + 1));
  const opp = Array(INNINGS).fill(0);
  for (let i = 0; i < total; i++) opp[Math.floor(rng() * INNINGS)]++;
  return { league: LEAGUES.indexOf(L), batter: 0, inning: 1, outs: 0, bases: [false, false, false], runs: 0, opp, streak: 0, prevOk: false, atBats: 0, pinchUsed: false };
}

// 1打席。ok: 正解したか、written: 記入問題か、batter: 打つ選手（null は助っ人）、star: その★
export function atBat(game, { ok, written, batter = null, star = 1 }, rng = Math.random) {
  const g = { ...game, bases: [...game.bases], opp: [...game.opp] };
  g.atBats++;
  g.batter = ((g.batter | 0) + 1) % 9;
  let result;
  let scored = 0;
  if (!ok) {
    result = 'out';
    g.streak = 0;
    g.prevOk = false;
    g.outs++;
    if (g.outs >= 3) { g.inning++; g.outs = 0; g.bases = [false, false, false]; }
    return { game: g, result, scored };
  }
  if (written) result = g.prevOk ? 'hr' : 'double';
  else result = g.streak + 1 >= 3 ? 'double' : 'single';
  const up = boostResult(result, batter, star, rng);
  result = up.result;
  const [b1, b2, b3] = g.bases;
  if (result === 'single') { scored = +b3; g.bases = [true, b1, b2]; }
  else if (result === 'double') { scored = +b2 + +b3; g.bases = [false, true, b1]; }
  else { scored = +b1 + +b2 + +b3 + 1; g.bases = [false, false, false]; }
  g.runs += scored;
  g.streak++;
  g.prevOk = true;
  return { game: g, result, scored, boosted: up.boosted };
}

export function isOver(game) {
  return game.inning > INNINGS || game.atBats >= MAX_AT_BATS;
}

// スコアボードに出す相手の点。終わったイニングの分だけ。試合が終われば全部
export function oppRunsShown(game) {
  const done = isOver(game) ? INNINGS : Math.min(game.inning - 1, INNINGS);
  return game.opp.slice(0, done).reduce((a, b) => a + b, 0);
}

export function finishGame(game) {
  const opp = game.opp.reduce((a, b) => a + b, 0);
  return game.runs > opp ? 'win' : game.runs < opp ? 'lose' : 'draw';
}

// ---- ポイント・券・成績 ----
function addPoints(bb, n) {
  const p = bb.points + n;
  return { ...bb, points: p % POINTS_PER_TICKET, tickets: bb.tickets + Math.floor(p / POINTS_PER_TICKET) };
}

// 記入の正解は3ポイント、ほかの正解は1ポイント
export function earnPoints(bb, { ok, written }) {
  if (!ok) return bb;
  return addPoints(bb, written ? 3 : 1);
}

export function applyResult(bb, outcome) {
  const b = { ...bb };
  let promoted = false;
  if (outcome === 'win') {
    b.wins++;
    b.tickets++;
    b.leagueWins++;
    if (b.leagueWins >= WIN_TO_PROMOTE && b.league < LEAGUES.length - 1) {
      b.league++;
      b.leagueWins = 0;
      promoted = true;
    }
  } else if (outcome === 'lose') b.losses++;
  else b.draws++;
  return { bb: b, promoted };
}

// ---- スカウト ----
function rollRarity(rng, minR = false) {
  if (minR) {
    // レア以上だけで、同じ比べ方の確率にする
    const total = ODDS.R + ODDS.SR + ODDS.L;
    const x = rng() * total;
    return x < ODDS.L ? 'L' : x < ODDS.L + ODDS.SR ? 'SR' : 'R';
  }
  const x = rng() * 100;
  return x < ODDS.L ? 'L' : x < ODDS.L + ODDS.SR ? 'SR' : x < ODDS.L + ODDS.SR + ODDS.R ? 'R' : 'N';
}

// n は 1 か 10。券が足りなければ何も引かない
export function scout(bb, n, rng = Math.random) {
  if (!(n === 1 || n === 10) || bb.tickets < n) return { bb, pulls: [] };
  let b = { ...bb, players: { ...bb.players }, tickets: bb.tickets - n };
  const rarities = [];
  for (let i = 0; i < n; i++) rarities.push(rollRarity(rng));
  if (n === 10 && rarities.every(r => r === 'N')) rarities[9] = rollRarity(rng, true);
  const pulls = [];
  for (const rarity of rarities) {
    const list = BY_RARITY[rarity];
    const p = list[Math.floor(rng() * list.length)];
    const had = b.players[p.id] || 0;
    if (had >= MAX_STAR) b = addPoints(b, STAR_OVERFLOW_POINTS);
    else b.players[p.id] = had + 1;
    pulls.push({ id: p.id, rarity, isNew: had === 0, star: Math.min(had + 1, MAX_STAR) });
  }
  return { bb: b, pulls };
}

export function playerById(id) {
  return BY_ID.get(id) || null;
}

export function starOf(bb, id) {
  return Math.min(bb.players[id] || 0, MAX_STAR);
}

function powerOf(p, star) {
  return Math.round(POWER[p.rarity] * (1 + 0.1 * (star - 1)));
}

// 持っている選手のうち、強い順に9人の合計
export function teamPower(bb) {
  return Object.keys(bb.players)
    .filter(id => BY_ID.has(id))
    .map(id => powerOf(BY_ID.get(id), starOf(bb, id)))
    .sort((a, b) => b - a)
    .slice(0, 9)
    .reduce((a, b) => a + b, 0);
}

// スーパーレア以上が3人いると、1試合に1回「代打」が使える
export function canPinchHit(bb) {
  return Object.keys(bb.players).filter(id => {
    const p = BY_ID.get(id);
    return p && (p.rarity === 'SR' || p.rarity === 'L');
  }).length >= 3;
}

// ---- オーダー・打球の伸び・成績（2026-11-25） ----
// 正解したときだけ、強い選手は打球が伸びる。[ヒット→二塁打 %, 二塁打→ホームラン %]。★が1つ増えるごとに +5%
export const BOOST = { N: [0, 0], R: [10, 0], SR: [25, 10], L: [40, 25] };
const STAR_BONUS = 5;

export function boostResult(result, player, star = 1, rng = Math.random) {
  if (!player || (result !== 'single' && result !== 'double')) return { result, boosted: false };
  const [s2d, d2h] = BOOST[player.rarity] || [0, 0];
  const base = result === 'single' ? s2d : d2h;
  if (base <= 0) return { result, boosted: false };
  const chance = base + STAR_BONUS * (Math.min(Math.max(star | 0, 1), MAX_STAR) - 1);
  if (rng() * 100 >= chance) return { result, boosted: false };
  return { result: result === 'single' ? 'double' : 'hr', boosted: true };
}

function ownedByPower(bb) {
  return Object.keys(bb.players).filter(id => BY_ID.has(id))
    .sort((a, b) => powerOf(BY_ID.get(b), starOf(bb, b)) - powerOf(BY_ID.get(a), starOf(bb, a)) || (a < b ? -1 : 1));
}

// 1番〜9番の選手 ID（null は助っ人）。組んだ順を守り、空き・持っていない選手の枠は強い順で埋める
export function lineupOf(bb) {
  const owned = new Set(Object.keys(bb.players).filter(id => BY_ID.has(id)));
  const used = new Set();
  const slots = Array.from({ length: 9 }, (_, i) => {
    const id = (bb.lineup || [])[i];
    if (typeof id === 'string' && owned.has(id) && !used.has(id)) { used.add(id); return id; }
    return null;
  });
  const rest = ownedByPower(bb).filter(id => !used.has(id));
  return slots.map(id => id ?? rest.shift() ?? null);
}

export function autoLineup(bb) {
  return { ...bb, lineup: ownedByPower(bb).slice(0, 9) };
}

// slot（0〜8）に選手を入れる。別の枠にいれば入れかえる
export function setSlot(bb, slot, id) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 8 || !bb.players[id] || !BY_ID.has(id)) return bb;
  const L = lineupOf(bb);
  const j = L.indexOf(id);
  if (j >= 0) L[j] = L[slot];
  L[slot] = id;
  return { ...bb, lineup: L };
}

export function recordStat(bb, id, result) {
  if (!id || !BY_ID.has(id)) return bb;
  const x = bb.stats?.[id] || { ab: 0, h: 0, hr: 0 };
  const y = { ab: x.ab + 1, h: x.h + (result === 'out' ? 0 : 1), hr: x.hr + (result === 'hr' ? 1 : 0) };
  return { ...bb, stats: { ...(bb.stats || {}), [id]: y } };
}
