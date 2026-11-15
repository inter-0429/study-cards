// 記録の保存。iPhone のブラウザの中（localStorage）だけに保存し、外には送らない。
import { createState } from './engine.js';

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
  return s;
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
