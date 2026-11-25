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
  return { points: 0, tickets: 0, players: {}, league: 0, leagueWins: 0, wins: 0, losses: 0, draws: 0 };
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
  return bb;
}

// ---- 試合 ----
export function newGame(league, rng = Math.random) {
  const L = LEAGUES[Math.min(Math.max(league | 0, 0), LEAGUES.length - 1)];
  const total = L.min + Math.floor(rng() * (L.max - L.min + 1));
  const opp = Array(INNINGS).fill(0);
  for (let i = 0; i < total; i++) opp[Math.floor(rng() * INNINGS)]++;
  return { league: LEAGUES.indexOf(L), inning: 1, outs: 0, bases: [false, false, false], runs: 0, opp, streak: 0, prevOk: false, atBats: 0, pinchUsed: false };
}

// 1打席。ok: 正解したか、written: 記入問題か
export function atBat(game, { ok, written }) {
  const g = { ...game, bases: [...game.bases], opp: [...game.opp] };
  g.atBats++;
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
  const [b1, b2, b3] = g.bases;
  if (result === 'single') { scored = +b3; g.bases = [true, b1, b2]; }
  else if (result === 'double') { scored = +b2 + +b3; g.bases = [false, true, b1]; }
  else { scored = +b1 + +b2 + +b3 + 1; g.bases = [false, false, false]; }
  g.runs += scored;
  g.streak++;
  g.prevOk = true;
  return { game: g, result, scored };
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
