// ボス戦の出題・採点・ごほうび。画面（DOM）には触れない純粋な関数だけを置く。
// お金はアプリでは扱わない。金額は「表示と記録」だけで、ごほうびはおうちの人が渡す。
import { isEnabled, localDay, rankFor } from './engine.js';

export const BOSS_PASS = 80; // この点数以上で撃破
export const UNIT_BOSS_SIZE = 20;
export const SUBJECT_BOSS_SIZE = 40;
export const REWARD = { unit: { first: 100, again: 10 }, subject: { first: 1000, again: 100 } };
export const BOSS_XP = { unit: 50, subject: 200 };

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function unitBoss(unit, subject) {
  return { id: `boss-${unit.id}`, kind: 'unit', name: `${unit.title}の影`, subject, unit, unitIds: [unit.id] };
}

export function subjectBoss(subject) {
  return { id: `boss-${subject.id}`, kind: 'subject', name: `${subject.name}の番人`, subject, unitIds: subject.units.map(u => u.id) };
}

// 教科ボスが先頭、そのあと単元ボスを単元の順に
export const bossesOf = S => [subjectBoss(S), ...S.units.map(u => unitBoss(u, S))];

// 単元ボス: その単元から（範囲の設定は見ない）。教科ボス: 範囲に入っている単元から、問題数の割合に合わせて。
export function pickBossQuestions(boss, questions, state, rng = Math.random) {
  if (boss.kind === 'unit') {
    return shuffle(questions.filter(q => q.unit === boss.unitIds[0]), rng).slice(0, UNIT_BOSS_SIZE);
  }
  const groups = boss.unitIds
    .filter(id => isEnabled(state, id))
    .map(id => ({ id, qs: shuffle(questions.filter(q => q.unit === id), rng) }))
    .filter(g => g.qs.length > 0);
  const total = groups.reduce((n, g) => n + g.qs.length, 0);
  if (total <= SUBJECT_BOSS_SIZE) return shuffle(groups.flatMap(g => g.qs), rng);
  // 割合で配り、端数は大きい順に1問ずつ足す（最大剰余法）
  const exact = groups.map(g => (g.qs.length * SUBJECT_BOSS_SIZE) / total);
  const take = exact.map(Math.floor);
  let left = SUBJECT_BOSS_SIZE - take.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; take[i]++; left--; }
  return shuffle(groups.flatMap((g, i) => g.qs.slice(0, take[i])), rng);
}

export function scoreOf(correct, total) {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

const blank = () => ({ tries: 0, wins: 0, best: 0, rewardDay: null });
const recOf = (state, id) => ({ ...blank(), ...((state.bosses || {})[id] || {}) });

// 次に倒したときのごほうび。today = 今日はもうもらった（2回目以降は1日1回まで）
export function nextReward(state, boss, now = Date.now()) {
  const r = recOf(state, boss.id);
  const money = REWARD[boss.kind];
  if (r.wins === 0) return { amount: money.first, first: true, today: false };
  if (r.rewardDay === localDay(now)) return { amount: 0, first: false, today: true };
  return { amount: money.again, first: false, today: false };
}

// 採点して、記録（bosses・経験値）を更新した新しい state を返す。もとの state は変えない
export function judgeBoss(state, boss, correct, total, now = Date.now()) {
  const s = clone(state);
  s.bosses = s.bosses || {};
  const rec = recOf(s, boss.id);
  const score = scoreOf(correct, total);
  const passed = total > 0 && score >= BOSS_PASS;
  const rankBefore = rankFor(s.xp).name;
  let reward = 0, nth = 0, first = false, xp = 0;
  if (passed) {
    const nr = nextReward(s, boss, now);
    reward = nr.amount;
    first = nr.first;
    rec.wins++;
    nth = rec.wins;
    if (reward > 0) rec.rewardDay = localDay(now);
    xp = BOSS_XP[boss.kind];
    s.xp += xp;
  }
  rec.tries++;
  rec.best = Math.max(rec.best, score);
  s.bosses[boss.id] = rec;
  const rankAfter = rankFor(s.xp).name;
  return { score, passed, reward, nth, first, xp, best: rec.best, rankUp: rankAfter !== rankBefore ? rankAfter : null, state: s };
}

// 教科の中で1回以上倒したボスの数
export function bossWins(state, S) {
  return bossesOf(S).filter(b => recOf(state, b.id).wins > 0).length;
}
