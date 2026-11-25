// オリジナルのファンファーレ（このアプリのために作った短い曲）。音のファイルは使わず、その場で鳴らす。
// 既存のゲームなどの音・メロディは使わない。
// 楽譜は { n: 音の名前, t: 始まり（拍）, d: 長さ（拍）, v: 楽器 } の並び。

export const VOICES = {
  lead: { type: 'square', gain: 0.05 },   // メロディ（ラッパ風）
  pad: { type: 'triangle', gain: 0.05 },  // 和音
  bass: { type: 'triangle', gain: 0.11 }, // 低い音
  spark: { type: 'sine', gain: 0.05 },    // きらきら
};

// ランクアップ: 下から駆け上がって、明るい和音で決める（約1秒）
const RANK_UP = {
  beat: 0.13,
  notes: [
    { n: 'G4', t: 0, d: 0.5, v: 'lead' }, { n: 'C5', t: 0.5, d: 0.5, v: 'lead' }, { n: 'E5', t: 1, d: 0.5, v: 'lead' },
    { n: 'D5', t: 1.5, d: 0.5, v: 'lead' }, { n: 'G5', t: 2, d: 1.5, v: 'lead' },
    { n: 'F5', t: 3.5, d: 0.5, v: 'lead' }, { n: 'A5', t: 4, d: 0.5, v: 'lead' }, { n: 'C6', t: 4.5, d: 3, v: 'lead' },
    { n: 'G2', t: 2, d: 1.5, v: 'bass' }, { n: 'C3', t: 4.5, d: 3, v: 'bass' },
    { n: 'C5', t: 4.5, d: 3, v: 'pad' }, { n: 'E5', t: 4.5, d: 3, v: 'pad' }, { n: 'G5', t: 4.5, d: 3, v: 'pad' },
  ],
};

// ボス撃破: 4小節の行進風のファンファーレ＋最後にきらきら（約2.3秒）
const BOSS = {
  beat: 0.14,
  notes: [
    // メロディ
    { n: 'C5', t: 0, d: 1, v: 'lead' }, { n: 'G4', t: 1, d: 0.5, v: 'lead' }, { n: 'C5', t: 1.5, d: 0.5, v: 'lead' },
    { n: 'E5', t: 2, d: 1, v: 'lead' }, { n: 'D5', t: 3, d: 0.5, v: 'lead' }, { n: 'E5', t: 3.5, d: 0.5, v: 'lead' },
    { n: 'F5', t: 4, d: 1, v: 'lead' }, { n: 'A5', t: 5, d: 0.5, v: 'lead' }, { n: 'G5', t: 5.5, d: 0.5, v: 'lead' },
    { n: 'F5', t: 6, d: 0.5, v: 'lead' }, { n: 'E5', t: 6.5, d: 0.5, v: 'lead' }, { n: 'D5', t: 7, d: 1, v: 'lead' },
    { n: 'E5', t: 8, d: 0.5, v: 'lead' }, { n: 'G5', t: 8.5, d: 0.5, v: 'lead' }, { n: 'C6', t: 9, d: 1, v: 'lead' },
    { n: 'B5', t: 10, d: 0.5, v: 'lead' }, { n: 'A5', t: 10.5, d: 0.5, v: 'lead' }, { n: 'B5', t: 11, d: 1, v: 'lead' },
    { n: 'C6', t: 12, d: 4, v: 'lead' },
    // 和音
    { n: 'E4', t: 0, d: 2, v: 'pad' }, { n: 'G4', t: 2, d: 2, v: 'pad' },
    { n: 'A4', t: 4, d: 2, v: 'pad' }, { n: 'B4', t: 6, d: 2, v: 'pad' },
    { n: 'C5', t: 8, d: 2, v: 'pad' }, { n: 'D5', t: 10, d: 2, v: 'pad' },
    { n: 'E5', t: 12, d: 4, v: 'pad' }, { n: 'G5', t: 12, d: 4, v: 'pad' },
    // 低い音
    { n: 'C3', t: 0, d: 2, v: 'bass' }, { n: 'C3', t: 2, d: 2, v: 'bass' }, { n: 'F2', t: 4, d: 2, v: 'bass' },
    { n: 'G2', t: 6, d: 2, v: 'bass' }, { n: 'A2', t: 8, d: 2, v: 'bass' }, { n: 'G2', t: 10, d: 2, v: 'bass' },
    { n: 'C2', t: 12, d: 4, v: 'bass' }, { n: 'C3', t: 12, d: 4, v: 'bass' },
    // きらきら
    { n: 'C6', t: 12.5, d: 0.25, v: 'spark' }, { n: 'E6', t: 12.75, d: 0.25, v: 'spark' },
    { n: 'G6', t: 13, d: 0.25, v: 'spark' }, { n: 'C7', t: 13.25, d: 1.5, v: 'spark' },
  ],
};

// ホームラン: 駆け上がって高い音で決める（野球モード。約0.9秒）
const HOMERUN = {
  beat: 0.13,
  notes: [
    { n: 'G4', t: 0, d: 0.5, v: 'lead' }, { n: 'C5', t: 0.5, d: 0.5, v: 'lead' }, { n: 'E5', t: 1, d: 0.5, v: 'lead' },
    { n: 'G5', t: 1.5, d: 1, v: 'lead' }, { n: 'E5', t: 2.5, d: 0.5, v: 'lead' }, { n: 'G5', t: 3, d: 0.5, v: 'lead' },
    { n: 'C6', t: 3.5, d: 3, v: 'lead' },
    { n: 'C5', t: 3.5, d: 3, v: 'pad' }, { n: 'E5', t: 3.5, d: 3, v: 'pad' }, { n: 'G5', t: 3.5, d: 3, v: 'pad' },
    { n: 'C3', t: 0, d: 1.5, v: 'bass' }, { n: 'G2', t: 1.5, d: 2, v: 'bass' }, { n: 'C3', t: 3.5, d: 3, v: 'bass' },
    { n: 'C7', t: 4, d: 1.5, v: 'spark' },
  ],
};

// 試合開始: 短く明るい合図（野球モード。約0.8秒）
const PLAYBALL = {
  beat: 0.15,
  notes: [
    { n: 'C5', t: 0, d: 0.5, v: 'lead' }, { n: 'D5', t: 0.5, d: 0.5, v: 'lead' }, { n: 'E5', t: 1, d: 0.5, v: 'lead' },
    { n: 'G5', t: 1.5, d: 1, v: 'lead' }, { n: 'E5', t: 2.5, d: 0.5, v: 'lead' }, { n: 'G5', t: 3, d: 2, v: 'lead' },
    { n: 'C3', t: 0, d: 2, v: 'bass' }, { n: 'G2', t: 2, d: 1, v: 'bass' }, { n: 'C3', t: 3, d: 2, v: 'bass' },
  ],
};

export const SCORES = { rankUp: RANK_UP, boss: BOSS, homerun: HOMERUN, playball: PLAYBALL };

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'A4' → 440。半音の印（#・b）は使わない
export function noteFreq(name) {
  const m = /^([A-G])([0-8])$/.exec(name);
  if (!m) return NaN;
  const midi = 12 * (Number(m[2]) + 1) + SEMI[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function scoreLength(score) {
  return Math.max(...score.notes.map(x => x.t + x.d)) * score.beat;
}

// ctx = AudioContext。鳴らせないときは何もしない。delay: 何秒あとから鳴らすか
export function playScore(ctx, score, delay = 0) {
  const start = ctx.currentTime + 0.03 + delay;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  for (const x of score.notes) {
    const voice = VOICES[x.v];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = voice.type;
    o.frequency.value = noteFreq(x.n);
    const t0 = start + x.t * score.beat;
    const len = Math.max(0.06, x.d * score.beat * 0.92);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(voice.gain, t0 + 0.015);
    g.gain.setValueAtTime(voice.gain, t0 + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + len + 0.02);
  }
}
