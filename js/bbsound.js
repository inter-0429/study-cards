// 野球モードの効果音（打球音・歓声・アウト・スカウト）。音のファイルは使わず、その場で作る。
// どれもこのアプリのために作ったオリジナル。実在の球場・ゲーム・応援歌の音やメロディは使わない。
// 1つの音は「部品」の並び:
//   tone:  発振器（f0 から f1 へ音の高さが変わる）
//   noise: ざーっという音をフィルターに通したもの（歓声・打球のアタック・拍手）
//   score: sound.js の楽譜（メロディ）
import { SCORES, playScore, scoreLength } from './sound.js';

const tone = (type, f0, f1, t, d, g) => ({ k: 'tone', type, f0, f1, t, d, g });
const noise = (filter, f, q, t, d, g, attack = 0.005) => ({ k: 'noise', filter, f, q, t, d, g, attack });
const score = (name, t) => ({ k: 'score', name, t });

// カキーン: 短いアタック＋金属のような高い響き
const BAT = [
  noise('highpass', 2000, 0.7, 0, 0.05, 0.3),
  tone('sine', 1900, 1300, 0, 0.35, 0.2),
  tone('triangle', 2900, 2500, 0, 0.2, 0.12),
];
// 歓声: ざわめきがふくらんで消える
const cheer = (t, d, g) => noise('bandpass', 1000, 0.6, t, d, g, Math.min(0.5, d * 0.25));
// 拍手: 短いぱちぱちを少しずつずらして重ねる
const claps = (t, n, g) => Array.from({ length: n }, (_, i) => noise('highpass', 2500, 0.8, t + i * 0.09 + (i % 3) * 0.02, 0.04, g));

export const SFX = {
  hit: [...BAT, cheer(0.1, 1.2, 0.12)],
  double: [...BAT, cheer(0.1, 1.6, 0.18), ...claps(0.3, 6, 0.08)],
  hr: [...BAT, cheer(0.1, 2.8, 0.3), ...claps(0.4, 14, 0.1), score('homerun', 0.45)],
  out: [
    tone('sine', 140, 55, 0, 0.18, 0.4),
    noise('lowpass', 400, 0.7, 0, 0.12, 0.3),
    noise('bandpass', 500, 1, 0.12, 0.7, 0.06, 0.1),
    tone('triangle', 330, 220, 0.15, 0.35, 0.05),
  ],
  change: [tone('square', 784, 784, 0, 0.12, 0.14), tone('square', 659, 659, 0.15, 0.12, 0.14), tone('square', 523, 523, 0.3, 0.25, 0.14)],
  win: [cheer(0, 3.2, 0.28), ...claps(0.2, 24, 0.1)],
  playball: [score('playball', 0)],
  drumroll: Array.from({ length: 26 }, (_, i) => noise('highpass', 1500, 0.8, i * 0.04, 0.035, 0.02 + i * 0.003)),
  // スカウトでボールの色が1段上がるとき: 上がっていく音＋きらっ
  stepup: [tone('triangle', 523, 1047, 0, 0.3, 0.16), tone('sine', 1568, 2093, 0.18, 0.3, 0.1), noise('highpass', 4000, 0.7, 0.2, 0.25, 0.04)],
  // カードをめくる音
  flip: [noise('bandpass', 2200, 1.2, 0, 0.08, 0.12), tone('sine', 1200, 1600, 0, 0.08, 0.05)],
  revealN: [tone('sine', 880, 880, 0, 0.3, 0.2)],
  revealR: [tone('sine', 880, 880, 0, 0.2, 0.2), tone('sine', 1175, 1175, 0.1, 0.35, 0.2)],
  revealSR: [
    tone('sine', 1047, 1047, 0, 0.2, 0.18), tone('sine', 1319, 1319, 0.07, 0.2, 0.1),
    tone('sine', 1568, 1568, 0.14, 0.2, 0.18), tone('sine', 2093, 2093, 0.21, 0.6, 0.18),
    cheer(0.2, 1.2, 0.12),
  ],
  revealL: [score('rankUp', 0), cheer(0.2, 2.6, 0.26), ...claps(0.5, 16, 0.1)],
};

const partEnd = p => (p.k === 'score' ? p.t + scoreLength(SCORES[p.name]) : p.t + p.d);

export function sfxLength(name) {
  const parts = SFX[name];
  return parts ? Math.max(...parts.map(partEnd)) : 0;
}

// ざーっという音の元（1秒分）。AudioContext ごとに1回だけ作る
const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.max(1, Math.floor(ctx.sampleRate || 44100));
    b = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function envelope(g, t0, peak, attack, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
}

// ctx = AudioContext。知らない名前や鳴らせないときは何もしない
export function playSfx(ctx, name) {
  const parts = SFX[name];
  if (!parts) return;
  const start = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  for (const p of parts) {
    if (p.k === 'score') { playScore(ctx, SCORES[p.name], p.t + 0.02); continue; }
    const t0 = start + p.t;
    const g = ctx.createGain();
    if (p.k === 'tone') {
      const o = ctx.createOscillator();
      o.type = p.type;
      o.frequency.setValueAtTime(p.f0, t0);
      if (p.f1 !== p.f0) o.frequency.exponentialRampToValueAtTime(p.f1, t0 + p.d);
      envelope(g, t0, p.g, 0.005, p.d);
      o.connect(g).connect(master);
      o.start(t0);
      o.stop(t0 + p.d + 0.02);
    } else {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = p.filter;
      f.frequency.value = p.f;
      f.Q.value = p.q;
      envelope(g, t0, p.g, p.attack, p.d);
      src.connect(f).connect(g).connect(master);
      src.start(t0);
      src.stop(t0 + p.d + 0.02);
    }
  }
}
