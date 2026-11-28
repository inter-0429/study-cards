// 記録の保存。iPhone のブラウザの中（localStorage）だけに保存し、外には送らない。
import { createState } from './engine.js';
import { cleanBaseball } from './baseball.js';

export const KEY = 'hero-study-v1';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function sanitize(raw) {
  const s = createState();
  if (!isObj(raw)) return s;
  if (typeof raw.xp === 'number' && Number.isFinite(raw.xp) && raw.xp >= 0) s.xp = raw.xp;
  if (isObj(raw.qs)) s.qs = raw.qs;
  if (Array.isArray(raw.cards)) s.cards = raw.cards.filter(c => typeof c === 'string');
  if (isObj(raw.days) && (raw.days.last === null || typeof raw.days.last === 'string')
      && typeof raw.days.count === 'number') s.days = { last: raw.days.last, count: raw.days.count };
  if (raw.enabled === null || (Array.isArray(raw.enabled) && raw.enabled.every(x => typeof x === 'string'))) {
    s.enabled = raw.enabled;
  }
  if (typeof raw.sound === 'boolean') s.sound = raw.sound;
  if (Array.isArray(raw.known) && raw.known.every(x => typeof x === 'string')) s.known = raw.known;
  if (Array.isArray(raw.calcOnly) && raw.calcOnly.every(x => typeof x === 'string')) s.calcOnly = raw.calcOnly;
  if (isObj(raw.bosses)) s.bosses = cleanBosses(raw.bosses);
  s.baseball = cleanBaseball(raw.baseball);
  return s;
}

// ボス戦の記録。形のおかしいボスは捨てる（ほかのボスと、ほかの記録はそのまま）
const isCount = v => Number.isInteger(v) && v >= 0;
function cleanBosses(raw) {
  const out = {};
  for (const [id, r] of Object.entries(raw)) {
    if (!/^(boss|ura)-[a-z0-9]{1,20}$/.test(id) || !isObj(r)) continue;
    if (!isCount(r.tries) || !isCount(r.wins) || r.wins > r.tries) continue;
    if (typeof r.best !== 'number' || !(r.best >= 0 && r.best <= 100)) continue;
    if (!(r.rewardDay === null || (typeof r.rewardDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.rewardDay)))) continue;
    out[id] = { tries: r.tries, wins: r.wins, best: r.best, rewardDay: r.rewardDay };
  }
  return out;
}

export function load(storage) {
  try {
    const txt = storage && storage.getItem(KEY);
    if (!txt) return createState();
    return sanitize(JSON.parse(txt));
  } catch {
    return createState();
  }
}

export function save(storage, state) {
  try {
    if (!storage) return false;
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
