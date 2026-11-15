// 画面。ロジックは engine.js、保存は store.js にある。
import {
  createState, recordAnswer, rankFor, touchDay, isEnabled, pickMission, pickTimedIndex,
  pickTraining, unitProgress, fieldStats, FIELDS, activeVillainCount, villainRetries, checkInput,
} from './engine.js';
import { load, save } from './store.js';
import { makeRecord, enqueue, flush, pending, isOn, setConnection } from './sync.js';
import { UNITS } from '../data/units.js';
import { ALL_QUESTIONS } from '../data/index.js';

const TIMED_SECONDS = 10;
const app = document.getElementById('app');
const storage = (() => { try { return window.localStorage; } catch { return null; } })();

let state = touchDay(load(storage), Date.now());
persist();

function persist() { save(storage, state); }

// 解いた結果を保護者のスプレッドシートへ送る（設定で接続コードを貼ったときだけ）
function sendLater() { flush(storage).catch(() => {}); }

// ---- 小さな道具 ----
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  e.append(...nodes(kids));
  return e;
}
// 入れ子の配列を平らにし、null・false を捨て、文字は文字のまま入れる
function nodes(kids) {
  return kids.flat(Infinity).filter(k => k != null && k !== false).map(k => (k.nodeType ? k : String(k)));
}
function screen(...kids) { app.replaceChildren(...nodes(kids)); window.scrollTo(0, 0); }
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const unitById = id => UNITS.find(u => u.id === id);
const villainCount = () => activeVillainCount(state, ALL_QUESTIONS);
// 開きっぱなしで日をまたいでも連続日数を正しく数える
function refreshDay() { state = touchDay(state, Date.now()); persist(); }

// ---- 音（ファイルなし。その場で作る） ----
let audio = null;
function beep(kind) {
  if (!state.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [660, 880], ng: [220, 160], up: [523, 659, 784, 1046], card: [880, 1175] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = kind === 'ng' ? 'sawtooth' : 'triangle';
      o.frequency.value = f;
      const t = audio.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.18);
    });
  } catch { /* 音が出せなくても続ける */ }
}

// ---- ホーム ----
function home() {
  refreshDay();
  const r = rankFor(state.xp);
  const stats = fieldStats(state, ALL_QUESTIONS);
  const maxStat = Math.max(10, ...Object.values(stats));
  const enabledCount = UNITS.filter(u => isEnabled(state, u.id)).length;
  const v = villainCount();
  const firstTime = Object.keys(state.qs).length === 0;
  screen(
    firstTime ? el('div', { class: 'panel guide' },
      el('h3', {}, 'はじめに'),
      el('p', {}, 'これは歴史総合の問題を、ゲームのように解いて覚えるアプリです。'),
      el('p', {}, 'まずは下の黄色いボタン「今日のミッション」を押して、5問に答えてみよう。'),
      el('button', { class: 'small', onclick: help }, 'くわしい遊び方を見る')) : null,
    el('div', { class: 'panel' },
      el('div', { class: 'muted' }, 'ヒーロー候補生のランク（正解すると経験値がたまって上がる）'),
      el('div', { class: 'rank' }, r.name),
      el('div', { class: 'bar' }, el('span', { style: `width:${Math.round(r.progress * 100)}%` })),
      el('div', { class: 'row mt' },
        el('span', { class: 'muted' }, r.next === null ? `経験値 ${state.xp}・最高ランク！` : `経験値 ${state.xp}・次のランクまで ${r.next - state.xp}`),
        el('span', { class: 'spacer' }),
        el('span', { class: 'badge gold' }, `連続 ${state.days.count} 日`)),
    ),
    enabledCount === 0
      ? el('div', { class: 'panel' }, el('p', {}, '挑戦できる試験がありません。'), el('p', { class: 'muted' }, '「ステージ」で範囲に入れる試験を選んでください。'))
      : el('button', { class: 'primary', onclick: () => startQuiz('mission', pickMission(state, ALL_QUESTIONS)) }, '今日のミッション（5問）'),
    el('p', { class: 'muted center note' }, '毎日まずはここ。5問で3分くらい。移動中におすすめ'),
    el('button', { class: 'secondary', disabled: enabledCount === 0, onclick: startTraining },
      v > 0 ? `特訓（15分）・ヴィラン ${v} 体` : '特訓（15分）'),
    el('p', { class: 'muted center note' }, 'まちがえた問題を集中して復習。家で時間があるときに'),
    el('div', { class: 'grid2' },
      el('button', { onclick: stages }, 'ステージ'),
      el('button', { onclick: cards }, `カード ${state.cards.length}`),
      el('button', { onclick: songs }, '歌カード'),
      el('button', { onclick: () => settings(false) }, '設定')),
    el('button', { class: 'mt', onclick: help }, '遊び方・ボタンの説明'),
    el('div', { class: 'panel mt' },
      el('h3', {}, '能力値'),
      el('p', { class: 'muted' }, '分野ごとに正解した数。短いバーの分野が苦手なところ'),
      FIELDS.map(f => el('div', { class: 'stat' },
        el('span', {}, f),
        el('div', { class: 'bar' }, el('span', { style: `width:${Math.round(stats[f] / maxStat * 100)}%` })),
        el('span', { class: 'muted' }, stats[f])))),
  );
}

// ---- 遊び方 ----
const HELP = [
  ['このアプリでやること', [
    '歴史総合の問題を解いて、テストに出る語句を覚えるアプリです。',
    '正解すると経験値がたまり、ヒーロー候補生のランクが上がります。',
  ]],
  ['毎日の使い方', [
    '① 移動中など毎日1回：「今日のミッション（5問）」を押して答える。',
    '② 家で時間があるとき：「特訓（15分）」で、まちがえた問題を集中して復習。',
    '③ テスト前：「ステージ」でテスト範囲ではない試験を「範囲から外す」。そうすると範囲の問題だけが出る。',
  ]],
  ['問題の種類', [
    '4択：4つの中から正しいものを選ぶ。',
    '○×：文が正しければ○、まちがっていれば×。',
    '並べ替え：出来事を古い順にタップして「決定」。',
    '入力：答えを打ちこんで「決定」。漢字でも、ひらがなでもOK。思い出せないときは「わからない」。',
    '「時間制限」と出た問題は10秒以内に正解するとボーナス +5。',
  ]],
  ['ヴィラン（苦手な問題）', [
    '同じ問題を2回まちがえると、その問題が「ヴィラン」になります。',
    'ヴィランは今日のミッションや特訓に何度も出ます。2回続けて正解すると撃破でき、経験値 +30。',
  ]],
  ['ボタンの説明', [
    'ステージ：教科書の章ごとの試験。「挑戦する」でその章だけ5問、「要点を見る」でまとめを読める。',
    'カード：2回正解した大事な語句が集まる図鑑。',
    '歌カード：リズムで覚える覚え歌。声に出して読んでみよう。',
    '設定：音のオン・オフと、記録を消してやり直す。おうちの人が「結果を送る」の設定をする場所もここ。',
    '能力値：政治・外交・戦争・経済・社会の分野ごとに正解した数。短い分野が苦手なところ。',
    '連続○日：毎日続けると増える。1日空くと1からやり直し。',
  ]],
  ['経験値の増え方', [
    '正解 +10、時間制限の問題に正解 +5、ヴィラン撃破 +30。',
    'ランク：候補生 → 見習い（100）→ 一次合格（300）→ 二次合格（600）→ 最終試験挑戦者（1000）→ 合格者（1500）',
  ]],
];

function help() {
  screen(
    el('div', { class: 'row' }, el('h1', {}, '遊び方'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: home }, 'もどる')),
    HELP.map(([title, lines]) => el('div', { class: 'panel' }, el('h3', {}, title), lines.map(t => el('p', {}, t)))),
    el('button', { class: 'primary', onclick: home }, 'ホームへ'),
  );
}

// ---- 問題 ----
let session = null;

function startQuiz(mode, questions, opts = {}) {
  if (!questions.length) { home(); return; }
  session = {
    mode, questions, idx: 0, timedIdx: pickTimedIndex(questions), retried: false,
    xp: 0, combo: 0, maxCombo: 0, newCards: [], defeated: 0, born: 0, rankUp: null, correct: 0,
    label: opts.label || (mode === 'mission' ? '今日のミッション' : ''), onDone: opts.onDone || result,
  };
  showQuestion();
}

function showQuestion() {
  const s = session;
  const q = s.questions[s.idx];
  const timed = s.idx === s.timedIdx;
  const unit = unitById(q.unit);
  const rec = state.qs[q.id];
  let answered = false;
  let timer = null;
  let focusEl = null;

  const fb = el('div');
  const area = el('div');
  const timerBar = el('span', { style: 'width:100%' });

  // given: 子どもの答え（4択=番号・○×=true/false・並べ替え=押した順・入力=文字）。答えていないときは null
  function finish(ok, showCorrect, given) {
    if (answered) return;
    answered = true;
    stopTimer();
    refreshDay();
    const r = recordAnswer(state, q, ok, { timed: timed && ok, now: Date.now() });
    state = r.state; persist();
    enqueue(storage, makeRecord(q, unit, ok, given ?? null, Date.now()));
    sendLater();
    for (const e of r.events) {
      if (e.type === 'xp') s.xp += e.amount;
      if (e.type === 'card') s.newCards.push(e.term);
      if (e.type === 'villainDefeated') s.defeated++;
      if (e.type === 'villainBorn') s.born++;
      if (e.type === 'rankUp') s.rankUp = e.rank;
    }
    if (ok) { s.correct++; s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo); } else s.combo = 0;
    beep(ok ? 'ok' : 'ng');
    showCorrect();
    const defeated = r.events.some(e => e.type === 'villainDefeated');
    const born = r.events.some(e => e.type === 'villainBorn');
    fb.replaceChildren(el('div', { class: `feedback ${ok ? 'ok' : 'ng'} ${ok ? 'pop' : 'shake'}` },
      el('div', { class: 'big' }, ok ? (s.combo >= 3 ? `○ ${s.combo}コンボ！` : '○ 正解！') : '× ざんねん'),
      defeated ? el('p', {}, el('span', { class: 'badge villain' }, 'ヴィラン撃破！ +30')) : null,
      born ? el('p', {}, el('span', { class: 'badge villain' }, 'この問題がヴィランになった…次で倒そう')) : null,
      el('p', {}, q.exp),
      el('button', { class: 'primary mt', onclick: next }, s.idx + 1 < s.questions.length ? '次へ' : '結果を見る')));
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (q.type === 'choice') {
    const order = shuffled([0, 1, 2, 3]);
    const btns = order.map(i => el('button', { class: 'choice', onclick: () => finish(i === q.answer, () => mark(i), i) }, q.choices[i]));
    const mark = (picked) => btns.forEach((b, k) => {
      b.disabled = true;
      if (order[k] === q.answer) b.classList.add('correct');
      else if (order[k] === picked) b.classList.add('wrong');
    });
    area.append(...btns);
    s.timeout = () => finish(false, () => mark(-1), null);
  } else if (q.type === 'tf') {
    const yes = el('button', { onclick: () => finish(q.answer === true, () => mark(true), true) }, '○');
    const no = el('button', { onclick: () => finish(q.answer === false, () => mark(false), false) }, '×');
    const mark = (picked) => [[yes, true], [no, false]].forEach(([b, v]) => {
      b.disabled = true;
      if (v === q.answer) b.classList.add('correct');
      else if (v === picked) b.classList.add('wrong');
    });
    area.append(el('div', { class: 'tf' }, yes, no));
    s.timeout = () => finish(false, () => mark(null), null);
  } else if (q.type === 'input') {
    const box = el('input', {
      type: 'text', class: 'answer', placeholder: 'ここに答えを入力', autocomplete: 'off',
      autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done',
    });
    const decide = el('button', { class: 'primary', disabled: true, onclick: () => submit() }, '決定');
    const giveup = el('button', { class: 'small ghost', onclick: () => finish(false, () => show(false), null) }, 'わからない');
    const after = el('div');
    const submit = () => {
      if (answered || !box.value.trim()) return;
      const ok = checkInput(q, box.value);
      finish(ok, () => show(ok), box.value);
    };
    function show(ok) {
      box.disabled = true;
      box.classList.add(ok ? 'correct' : 'wrong');
      decide.remove(); giveup.remove(); hint.remove();
      after.append(el('p', { class: 'answerline' }, '正解：', el('b', {}, q.answers[0])));
    }
    box.addEventListener('input', () => { decide.disabled = !box.value.trim(); });
    box.addEventListener('keydown', e => {
      // 漢字に変換している途中の Enter は決定にしない
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); submit(); }
    });
    const hint = el('p', { class: 'muted' }, '漢字でも、ひらがなでもOK');
    area.append(box, hint, after, el('div', { class: 'mt' }), decide, el('div', { class: 'row mt' }, giveup));
    s.timeout = () => finish(false, () => show(false), box.value.trim() || null);
    focusEl = box;
  } else {
    const picked = [];
    const nums = q.choices.map(() => el('span', { class: 'num empty' }, '0'));
    const btns = q.choices.map((c, i) => el('button', { class: 'choice', onclick: () => pick(i) }, nums[i], c));
    // 表示の順番を毎回変える（押す位置で覚えないように）。答え合わせは元の番号で行う
    const shown = shuffled(q.choices.map((_, i) => i));
    const decide = el('button', { class: 'primary', disabled: true, onclick: () => finish(picked.every((v, k) => v === q.answer[k]), showOrder, picked.slice()) }, '決定');
    const reset = el('button', { class: 'small ghost', onclick: () => { picked.length = 0; refresh(); } }, 'やり直す');
    function pick(i) { if (answered || picked.includes(i)) return; picked.push(i); refresh(); }
    function refresh() {
      nums.forEach((n, i) => { const p = picked.indexOf(i); n.textContent = p + 1; n.classList.toggle('empty', p < 0); });
      btns.forEach((b, i) => b.classList.toggle('picked', picked.includes(i)));
      decide.disabled = picked.length !== q.choices.length;
    }
    function showOrder() {
      btns.forEach((b, i) => {
        b.disabled = true;
        const right = q.answer.indexOf(i);
        nums[i].textContent = right + 1; nums[i].classList.remove('empty');
        b.classList.add(picked.indexOf(i) === right ? 'correct' : 'wrong');
      });
      decide.remove(); reset.remove();
    }
    area.append(el('p', { class: 'muted' }, '古いものからタップしてね'), ...shown.map(i => btns[i]), el('div', { class: 'row' }, reset), el('div', { class: 'mt' }), decide);
    s.timeout = () => finish(false, showOrder, picked.length ? picked.slice() : null);
  }

  screen(
    el('div', { class: 'row' },
      el('span', { class: 'badge' }, s.label || unit.stage),
      el('span', { class: 'spacer' }),
      el('span', { class: 'muted' }, `${s.idx + 1} / ${s.questions.length}`),
      el('button', { class: 'small ghost', onclick: () => { stopTimer(); home(); } }, 'やめる')),
    el('p', { class: 'muted' }, `${unit.stage}「${unit.title}」`,
      rec?.villain ? ' ' : null, rec?.villain ? el('span', { class: 'badge villain' }, 'ヴィラン') : null),
    timed ? el('div', {}, el('p', { class: 'badge gold' }, `時間制限 ${TIMED_SECONDS}秒・ボーナス+5`), el('div', { class: 'bar timer' }, timerBar)) : null,
    el('div', { class: 'qtext' }, q.q),
    area, fb,
  );
  if (focusEl) focusEl.focus();

  // 時間制限: 画面を離れている間（ロック・ほかのアプリ）は止める
  let remaining = TIMED_SECONDS * 1000;
  let last = 0;
  function tick() {
    const now = Date.now();
    remaining -= now - last;
    last = now;
    timerBar.style.width = `${Math.max(0, remaining / (TIMED_SECONDS * 1000)) * 100}%`;
    if (remaining <= 0) s.timeout();
  }
  function startTimer() { if (!timer && !answered) { last = Date.now(); timer = setInterval(tick, 100); } }
  function pauseTimer() { if (timer) { tick(); clearInterval(timer); timer = null; } }
  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVis);
  }
  function onVis() { if (document.hidden) pauseTimer(); else startTimer(); }
  if (timed) {
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) startTimer();
  }

  function next() {
    s.idx++;
    if (s.idx >= s.questions.length && s.mode === 'training' && !s.retried) {
      // 特訓: 正解したけれどまだ倒せていないヴィランを、ラウンドの最後にもう一度出す
      s.retried = true;
      s.questions = [...s.questions, ...villainRetries(state, s.questions)];
    }
    if (s.idx < s.questions.length) showQuestion(); else s.onDone(s);
  }
}

function result(s) {
  if (s.rankUp) beep('up'); else if (s.newCards.length) beep('card');
  screen(
    el('h1', { class: 'center' }, s.correct === s.questions.length ? '全問正解！' : 'ミッション完了'),
    s.rankUp ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'ランクアップ！'), el('div', { class: 'rank' }, s.rankUp)) : null,
    el('div', { class: 'panel' },
      el('p', {}, `正解 ${s.correct} / ${s.questions.length}`),
      el('p', {}, `獲得経験値 +${s.xp}`),
      s.maxCombo >= 2 ? el('p', {}, `最大 ${s.maxCombo} コンボ`) : null,
      s.defeated ? el('p', {}, el('span', { class: 'badge villain' }, `ヴィラン撃破 ${s.defeated} 体`)) : null,
      s.born ? el('p', { class: 'muted' }, `新しいヴィラン ${s.born} 体。特訓で倒そう`) : null),
    s.newCards.length ? el('div', { class: 'panel' }, el('h3', {}, '新しいカード'),
      el('div', { class: 'cardgrid' }, s.newCards.map(c => el('div', { class: 'card pop' }, c)))) : null,
    el('button', { class: 'primary', onclick: () => startQuiz(s.mode, s.mode === 'mission' ? pickMission(state, ALL_QUESTIONS) : unitQuestions(s.questions[0].unit), { label: s.label }) }, 'もう1セット'),
    el('div', { class: 'mt' }),
    el('button', { onclick: home }, 'ホームへ'),
  );
}

// ---- ステージ ----
function unitQuestions(unitId) {
  return pickMission({ ...state, enabled: [unitId] }, ALL_QUESTIONS);
}

function stages() {
  screen(
    el('div', { class: 'row' }, el('h1', {}, 'ステージ'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: home }, 'もどる')),
    el('p', { class: 'muted' }, 'テストの範囲に入っていない試験は「範囲から外す」にしよう。外した試験は今日のミッションと特訓に出なくなる。'),
    UNITS.map(u => {
      const p = unitProgress(state, ALL_QUESTIONS, u.id);
      const on = isEnabled(state, u.id);
      return el('div', { class: 'panel' },
        el('div', { class: 'row' },
          el('span', { class: 'badge' }, u.stage),
          p.done ? el('span', { class: 'badge gold' }, '突破') : null,
          p.villains ? el('span', { class: 'badge villain' }, `ヴィラン ${p.villains}`) : null,
          on ? null : el('span', { class: 'badge off' }, '範囲外')),
        el('h3', { class: 'mt' }, u.title),
        el('div', { class: 'bar' }, el('span', { style: `width:${Math.round(p.cleared / p.total * 100)}%` })),
        el('p', { class: 'muted mt' }, `正解した問題 ${p.cleared} / ${p.total}`),
        el('div', { class: 'row wrap' },
          el('button', { class: 'small', onclick: () => startQuiz('unit', unitQuestions(u.id), { label: u.stage }) }, '挑戦する'),
          el('button', { class: 'small', onclick: () => summary(u, stages) }, '要点を見る'),
          el('button', { class: 'small ghost', onclick: () => toggleUnit(u.id) }, on ? '範囲から外す' : '範囲に入れる')));
    }),
    el('button', { onclick: home }, 'ホームへ'),
  );
}

function toggleUnit(id) {
  const cur = state.enabled === null ? UNITS.map(u => u.id) : state.enabled.slice();
  const nextList = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
  state = { ...state, enabled: nextList.length === UNITS.length ? null : UNITS.map(u => u.id).filter(x => nextList.includes(x)) };
  persist();
  stages();
}

function summary(u, back, nextLabel, onNext) {
  screen(
    el('span', { class: 'badge' }, u.stage),
    el('h1', { class: 'mt' }, `要点カード：${u.title}`),
    el('div', { class: 'panel' }, el('ol', { class: 'summary' }, u.summary.map(t => el('li', {}, t)))),
    onNext ? el('button', { class: 'primary', onclick: onNext }, nextLabel) : null,
    el('div', { class: 'mt' }),
    el('button', { onclick: back }, 'もどる'),
  );
}

// ---- 特訓 ----
function startTraining() {
  const rounds = pickTraining(state, ALL_QUESTIONS, UNITS);
  if (!rounds.length) { home(); return; }
  const villainsBefore = villainCount();
  let total = { xp: 0, defeated: 0, correct: 0, count: 0, newCards: [], rankUp: null };
  const runRound = (k) => {
    const rd = rounds[k];
    summary(rd.unit, home, `ラウンド ${k + 1} / ${rounds.length} を始める`, () => startQuiz('training', rd.questions, {
      label: `特訓 ${k + 1}/${rounds.length}`,
      onDone: (s) => {
        total.xp += s.xp; total.defeated += s.defeated; total.correct += s.correct; total.count += s.questions.length;
        total.newCards.push(...s.newCards); total.rankUp = s.rankUp || total.rankUp;
        if (k + 1 < rounds.length) runRound(k + 1); else trainingResult(total, villainsBefore);
      },
    }));
  };
  runRound(0);
}

function trainingResult(t, before) {
  if (t.rankUp) beep('up');
  const left = villainCount();
  screen(
    el('h1', { class: 'center' }, '特訓おつかれさま！'),
    t.rankUp ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'ランクアップ！'), el('div', { class: 'rank' }, t.rankUp)) : null,
    el('div', { class: 'panel' },
      el('p', {}, `正解 ${t.correct} / ${t.count}`),
      el('p', {}, `獲得経験値 +${t.xp}`),
      el('p', {}, el('span', { class: 'badge villain' }, `倒したヴィラン ${t.defeated} 体`)),
      el('p', { class: 'muted' }, left ? `残っているヴィラン ${left} 体（特訓前 ${before} 体）` : 'ヴィランは残っていない！')),
    t.newCards.length ? el('div', { class: 'panel' }, el('h3', {}, '新しいカード'),
      el('div', { class: 'cardgrid' }, t.newCards.map(c => el('div', { class: 'card pop' }, c)))) : null,
    el('button', { class: 'primary', onclick: home }, 'ホームへ'),
  );
}

// ---- カード（8枚ずつ＝8カウント） ----
function cards() {
  const owned = new Set(state.cards);
  const all = new Set(ALL_QUESTIONS.filter(q => q.card).map(q => q.card));
  screen(
    el('div', { class: 'row' }, el('h1', {}, 'カード'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: home }, 'もどる')),
    el('p', { class: 'muted' }, `集めたカード ${[...owned].filter(c => all.has(c)).length} / ${all.size}。同じ問題に2回正解するとカードになる。8枚で1フレーズ。`),
    UNITS.map(u => {
      const terms = [...new Set(ALL_QUESTIONS.filter(q => q.unit === u.id && q.card).map(q => q.card))];
      const got = terms.filter(t => owned.has(t)).length;
      const phrases = [];
      for (let i = 0; i < terms.length; i += 8) phrases.push(terms.slice(i, i + 8));
      return el('div', { class: 'panel' },
        el('div', { class: 'row' }, el('h3', {}, `${u.stage}`), el('span', { class: 'spacer' }),
          got === terms.length ? el('span', { class: 'badge gold' }, 'コンプリート') : el('span', { class: 'muted' }, `${got} / ${terms.length}`)),
        phrases.map((ph, i) => [
          el('div', { class: 'phrase' }, `フレーズ ${i + 1}（8カウント）`),
          el('div', { class: 'cardgrid' }, ph.map(t => owned.has(t) ? el('div', { class: 'card' }, t) : el('div', { class: 'card locked' }, '？？？'))),
        ]));
    }),
  );
}

// ---- 歌カード ----
function songs() {
  screen(
    el('div', { class: 'row' }, el('h1', {}, '歌カード'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: home }, 'もどる')),
    el('p', { class: 'muted' }, '自分の好きなリズムで声に出してみよう。1行が1カウント。'),
    UNITS.map(u => el('div', { class: 'panel' },
      el('span', { class: 'badge' }, u.stage),
      u.songs.map(sg => [el('h3', { class: 'mt' }, sg.title), el('div', { class: 'song' }, sg.lines.join('\n'))]))),
  );
}

// ---- 設定 ----
const SYNC_MSG = {
  ok: '保存しました。これから解いた結果が送られます。',
  cleared: '送るのをやめました。',
  bad: '接続コードの形がちがいます。もう一度コピーして、そのまま貼り付けてください。',
};

// 結果を送る設定（保護者用）。貼った接続コードは画面に出さない
function syncPanel(msg) {
  const on = isOn(storage);
  const box = el('input', {
    type: 'text', class: 'answer', placeholder: '接続コードを貼り付け', autocomplete: 'off',
    autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '400',
  });
  const saveBtn = el('button', { class: 'small', onclick: () => {
    if (!box.value.trim()) return;
    const r = setConnection(storage, box.value);
    if (r === 'ok') sendLater();
    settings(false, SYNC_MSG[r]);
  } }, '保存');
  return el('div', { class: 'panel' },
    el('h3', {}, '結果を送る（おうちの人の設定）'),
    el('p', { class: 'muted' }, on
      ? `今は送る設定です。まだ送れていない記録：${pending(storage).length} 件（電波が戻ると自動で送ります）`
      : '今は送らない設定です。'),
    el('p', { class: 'muted' }, '送るのは、解いた日時・問題・正解・答え・正誤だけです。名前や学校名は送りません。'),
    msg ? el('p', {}, msg) : null,
    box,
    el('div', { class: 'row mt' }, saveBtn),
    on ? el('button', { class: 'small ghost mt', onclick: () => settings(false, SYNC_MSG[setConnection(storage, '')]) }, '送るのをやめる') : null);
}

function settings(confirming = false, syncMsg = null) {
  const on = isOn(storage);
  screen(
    el('div', { class: 'row' }, el('h1', {}, '設定'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: home }, 'もどる')),
    el('div', { class: 'panel' },
      el('div', { class: 'row' }, el('span', {}, '効果音'), el('span', { class: 'spacer' }),
        el('button', { class: 'small', onclick: () => { state = { ...state, sound: !state.sound }; persist(); settings(); } }, state.sound ? 'ON' : 'OFF'))),
    el('div', { class: 'panel' },
      el('h3', {}, '記録について'),
      on
        ? el('p', { class: 'muted' }, 'ランク・カードなどの記録はこの iPhone の中に保存されています。解いた結果（日時・問題・答え・正誤）は、おうちの人の Google スプレッドシートにも送られて、苦手なところの勉強に使います。')
        : el('p', { class: 'muted' }, '記録はこの iPhone の中だけに保存されていて、インターネットには送られません。'),
      el('p', { class: 'muted' }, 'Safari の「履歴とWebサイトデータを消去」をすると、記録も消えます。')),
    syncPanel(syncMsg),
    el('div', { class: 'panel' },
      el('h3', {}, '記録を消す'),
      confirming
        ? [el('p', {}, '本当に消す？ ランク・カード・ヴィランが全部はじめからになります。'),
          el('div', { class: 'grid2' },
            el('button', { class: 'danger', onclick: () => { state = touchDay(createState(), Date.now()); persist(); home(); } }, '消す'),
            el('button', { onclick: () => settings(false) }, 'やめる'))]
        : el('button', { class: 'small', onclick: () => settings(true) }, '記録を消す…')),
  );
}

home();

// ためてある結果を送る: 開いたとき・電波が戻ったとき・アプリに戻ってきたとき
sendLater();
window.addEventListener('online', sendLater);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sendLater(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
