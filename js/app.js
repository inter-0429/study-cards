// 画面。ロジックは engine.js、保存は store.js にある。
import {
  createState, recordAnswer, rankFor, touchDay, isEnabled, pickMission, pickGame, pickTimedIndex,
  pickTraining, unitProgress, activeVillainCount, villainRetries, checkInput, underDailyMax, DAILY_MAX,
  unitSkills, subjectSummary, SKILL_LABEL, SKILL_MIN_ATTEMPTS, includeNewUnits, whyWrong,
} from './engine.js';
import { load, save } from './store.js';
import {
  makeRecord, makeBossRecord, enqueue, flush, pending, isOn, setConnection,
  withDevice, getDeviceName, setDeviceName, deviceId, deviceKind, DEVICE_NAME_MAX, correctText, givenText,
} from './sync.js';
import {
  bossesOf, pickBossQuestions, judgeBoss, nextReward, bossWins, BOSS_PASS, REWARD, BOSS_XP,
  urasOf, uraOpen,
} from './boss.js';
import { SCORES, playScore } from './sound.js';
import {
  RARITIES, RARITY_LABEL, ODDS, LEAGUES, INNINGS, WIN_TO_PROMOTE, POINTS_PER_TICKET,
  newGame, atBat, isOver, finishGame, oppRunsShown, earnPoints, applyResult, scout, playerById, teamPower, canPinchHit,
  lineupOf, autoLineup, setSlot, recordStat, starOf,
} from './baseball.js';
import { PLAYERS } from '../data/players.js';
import { playSfx } from './bbsound.js';
import { SUBJECTS, ALL_UNITS, ALL_QS, subjectOfUnit } from '../data/subjects.js';

const TIMED_SECONDS = 10;
const app = document.getElementById('app');
const storage = (() => { try { return window.localStorage; } catch { return null; } })();

// あとから足した教科の単元は、最初は範囲に入れる（前の版の記録は歴史の単元だけを知っている）
let state = includeNewUnits(touchDay(load(storage), Date.now()),
  ALL_UNITS.map(u => u.id), SUBJECTS.find(S => S.id === 'rekishi').units.map(u => u.id));
persist();

function persist() { save(storage, state); }

// 解いた結果を保護者のスプレッドシートへ送る（設定で接続コードを貼ったときだけ）
function sendLater() { flush(storage).catch(() => {}); }
// 送る記録に付ける「どの端末で解いたか」とかかった秒数（送る設定のときだけ。端末番号もそのとき作る）
function sendExtra(sec) { return isOn(storage) ? withDevice(storage, navigator.userAgent, { sec }) : {}; }

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
const unitById = id => ALL_UNITS.find(u => u.id === id);
const villainCount = S => activeVillainCount(state, S.questions);
const enabledUnits = S => S.units.filter(u => isEnabled(state, u.id));
const pct = x => Math.round(x * 100);
// 開きっぱなしで日をまたいでも連続日数を正しく数える
function refreshDay() { state = touchDay(state, Date.now()); persist(); }
// 選択問題でまちがえたとき、選んだ選択肢が「なぜちがうか」の枠。出せないときは null
function whyBox(q, given) {
  const t = whyWrong(q, given);
  return t ? el('div', { class: 'why' }, el('div', { class: 'whyHead' }, `「${q.choices[given]}」がちがう理由`), el('p', {}, t)) : null;
}

// ---- 音（ファイルなし。その場で作る） ----
let audio = null;
function audioCtx() {
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}
// オリジナルのファンファーレ（rankUp: ランクアップ / boss: ボス撃破）
function fanfare(kind) {
  if (!state.sound) return;
  try { playScore(audioCtx(), SCORES[kind]); } catch { /* 音が出せなくても続ける */ }
}
// 野球モードの効果音（bbsound.js）
function sfx(name) {
  if (!state.sound) return;
  try { playSfx(audioCtx(), name); } catch { /* 音が出せなくても続ける */ }
}
function beep(kind) {
  if (!state.sound) return;
  try {
    audioCtx();
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

// ---- ホーム（教科の一覧） ----
function rankPanel() {
  const r = rankFor(state.xp);
  return el('div', { class: 'panel' },
    el('div', { class: 'muted' }, 'ヒーロー候補生のレベル（全教科の正解で経験値がたまって上がる・最高 Lv 1000）'),
    el('div', { class: 'rank' }, r.name),
    el('div', { class: 'bar' }, el('span', { style: `width:${pct(r.progress)}%` })),
    el('div', { class: 'row mt' },
      el('span', { class: 'muted' }, r.next === null ? `経験値 ${state.xp}・最高レベル！` : `経験値 ${state.xp}・次のレベルまで ${r.next - state.xp}`),
      el('span', { class: 'spacer' }),
      el('span', { class: 'badge gold' }, `連続 ${state.days.count} 日`)));
}

function missionButton(S) {
  return el('button', { class: 'primary', disabled: enabledUnits(S).length === 0,
    onclick: () => startQuiz('mission', pickMission(state, S.questions), { subject: S }) }, '今日のミッション（5問）');
}

function subjectCard(S) {
  const sum = subjectSummary(state, S);
  const noRange = enabledUnits(S).length === 0;
  return el('div', { class: 'panel subject' },
    el('div', { class: 'row' }, el('h3', {}, S.name), el('span', { class: 'spacer' }),
      sum.villains ? el('span', { class: 'badge villain' }, `ヴィラン ${sum.villains}体`) : null),
    sum.attempts === 0
      ? el('p', { class: 'muted' }, 'まだ解いていません')
      : [el('div', { class: 'row' }, el('span', {}, `正答率 ${pct(sum.accuracy)}%`), el('span', { class: 'spacer' }),
        el('span', { class: 'muted' }, `答えた数 ${sum.attempts}`)),
      el('div', { class: 'bar' }, el('span', { style: `width:${pct(sum.accuracy)}%` }))],
    sum.weakest ? el('p', { class: 'mt' }, el('span', { class: 'badge lv-weak' }, '苦手'), ' ',
      `${sum.weakest.unit.stage}「${sum.weakest.unit.title}」 ${pct(sum.weakest.accuracy)}%`) : null,
    noRange ? el('p', { class: 'muted mt' }, '範囲に入っている試験がありません。「開く」→「ステージ」で選んでください。') : null,
    el('div', { class: 'mt' }), missionButton(S), gameButton(S),
    el('button', { class: 'mt', onclick: () => subjectHome(S) }, `${S.name}を開く`),
    el('p', { class: 'muted center note' }, '特訓・ステージ・試験ごとの得意と苦手はここから'));
}

function home() {
  refreshDay();
  const firstTime = Object.keys(state.qs).length === 0;
  screen(
    firstTime ? el('div', { class: 'panel guide' },
      el('h3', {}, 'はじめに'),
      el('p', {}, 'これは問題をゲームのように解いて覚えるアプリです。'),
      el('p', {}, '教科を選んで、黄色いボタン「今日のミッション」を押して、5問に答えてみよう。'),
      el('button', { class: 'small', onclick: help }, 'くわしい遊び方を見る')) : null,
    rankPanel(),
    baseballPanel(),
    el('p', { class: 'muted note' }, '教科ごとの正答率と、いちばん苦手な試験が出ます。毎日まずはミッション（5問で3分くらい）'),
    SUBJECTS.map(subjectCard),
    el('div', { class: 'grid2' },
      el('button', { onclick: help }, '遊び方'),
      el('button', { onclick: () => settings(false) }, '設定')),
  );
}

// ---- 教科の画面 ----
function skillsPanel(S) {
  const rows = unitSkills(state, S.questions, S.units);
  return el('div', { class: 'panel mt' },
    el('h3', {}, '試験ごとの得意・苦手'),
    el('p', { class: 'muted' }, `正答率（正解した割合）の低い順。答えた数が${SKILL_MIN_ATTEMPTS}回より少ない試験は「まだ少ない」`),
    rows.map(r => el('div', { class: `skill ${r.level}` },
      el('span', {}, `${r.unit.stage}「${r.unit.title}」`),
      el('span', { class: `badge lv-${r.level}` }, r.level === 'few' ? SKILL_LABEL.few : `${SKILL_LABEL[r.level]} ${pct(r.accuracy)}%`),
      el('div', { class: 'bar' }, el('span', { style: `width:${r.level === 'few' ? 0 : pct(r.accuracy)}%` })))));
}

function subjectHome(S) {
  refreshDay();
  const v = villainCount(S);
  const noRange = enabledUnits(S).length === 0;
  const owned = new Set(state.cards);
  const terms = new Set(S.questions.filter(q => q.card).map(q => q.card));
  screen(
    el('div', { class: 'row' }, el('button', { class: 'small', onclick: home }, '← 教科の一覧'), el('span', { class: 'spacer' }), el('h1', {}, S.name)),
    noRange ? el('div', { class: 'panel' }, el('p', {}, '挑戦できる試験がありません。'), el('p', { class: 'muted' }, '「ステージ」で範囲に入れる試験を選んでください。')) : null,
    missionButton(S),
    el('p', { class: 'muted center note' }, '毎日まずはここ。5問で3分くらい。移動中におすすめ'),
    gameButton(S),
    el('p', { class: 'muted center note' }, '問題が打席になる野球の試合。正解でスカウトポイント'),
    el('button', { class: 'secondary', disabled: noRange, onclick: () => startTraining(S) },
      v > 0 ? `特訓（15分）・ヴィラン ${v} 体` : '特訓（15分）'),
    el('p', { class: 'muted center note' }, 'まちがえた問題と苦手な試験を集中して復習。家で時間があるときに'),
    el('button', { class: 'boss', onclick: () => bossList(S) }, `ボス戦（撃破 ${bossWins(state, S)} / ${bossesOf(S).length}）`),
    el('p', { class: 'muted center note' }, `本番のテストの形。${BOSS_PASS}点以上で撃破するとごほうび`),
    el('div', { class: 'grid2' },
      el('button', { onclick: () => stages(S) }, 'ステージ'),
      el('button', { onclick: () => cards(S) }, `カード ${[...terms].filter(t => owned.has(t)).length}`),
      el('button', { onclick: () => songs(S) }, '歌カード'),
      el('button', { onclick: () => help(() => subjectHome(S)) }, '遊び方')),
    skillsPanel(S),
  );
}

// ---- 遊び方 ----
const HELP = [
  ['このアプリでやること', [
    '歴史総合・化学などの問題を解いて、テストに出る語句を覚えるアプリです。',
    '最初の画面で教科を選びます。正解すると経験値がたまり、ヒーロー候補生のレベルが上がります（レベルは全教科で1つ・最高 Lv 1000）。',
  ]],
  ['毎日の使い方', [
    '① 移動中など毎日1回：教科の「今日のミッション（5問）」を押して答える。',
    '② 家で時間があるとき：教科を開いて「特訓（15分）」で、まちがえた問題を集中して復習。',
    '③ テスト前：教科を開いて「ステージ」で、テスト範囲ではない試験を「範囲から外す」。そうすると範囲の問題だけが出る。',
  ]],
  ['得意・苦手の見かた', [
    '最初の画面：教科ごとの正答率と、いちばん苦手な試験。',
    '教科を開いた画面：試験ごとの正答率。80%以上は「得意」、60%より下は「苦手」。答えた数が5回より少ないうちは「まだ少ない」。',
  ]],
  ['問題の種類', [
    '4択：4つの中から正しいものを選ぶ。',
    '○×：文が正しければ○、まちがっていれば×。',
    '並べ替え：問題文の順番（古い順・小さい順など）にタップして「決定」。',
    '入力：答えを打ちこんで「決定」。漢字でも、ひらがなでもOK。思い出せないときは「わからない」。',
    '「時間制限」と出た問題は10秒以内に正解するとボーナス +5。',
  ]],
  ['ボス戦（本番のテストの形）', [
    '教科を開いて「ボス戦」。試験ごとの「単元ボス」（20問）と、教科全体の「教科ボス」（40問）がいる。',
    `答えても正解・不正解は出ず、最後にまとめて採点。${BOSS_PASS}点以上で撃破！ 時間制限はなし。`,
    `ごほうび：単元ボスは初めて倒すと${REWARD.unit.first}円、2回目からは${REWARD.unit.again}円。教科ボスは初めて${REWARD.subject.first}円、2回目からは${REWARD.subject.again}円。`,
    '2回目からのごほうびは、同じボスで1日1回まで（挑戦は何回でもできる）。倒したらおうちの人に見せてね。',
    `撃破すると経験値ボーナス（単元ボス +${BOSS_XP.unit}、教科ボス +${BOSS_XP.subject}）。途中で「やめる」と、その回は記録されない。`,
  ]],
  ['⚾ 野球モード（試合とスカウト）', [
    '教科を開いて「⚾ 試合」。問題が打席になる。正解はヒット、3連続正解は二塁打、記入問題の正解は二塁打で、前の打席も正解ならホームラン。まちがえるとアウト。',
    '3イニング（問題は最大12問）で、相手チームより点が多ければ勝ち。3勝するとリーグが上がって、相手が強くなる。',
    '正解するとスカウトポイント。記入問題の正解は3ポイント、ほかの正解は1ポイント（ミッション・特訓・試合。ボス戦はなし）。10ポイントでスカウト券1枚。試合に勝つと券がもう1枚。',
    'スカウト券で選手を引ける（すべて架空の選手120人）。同じ選手が出たら★が増える（★5まで）。スーパーレア以上が3人そろうと、試合で1回だけ「代打」が使える（まちがえた打席のアウトを取り消して、次の問題で打ち直す）。',
  ]],
  ['ヴィラン（苦手な問題）', [
    '同じ問題を2回まちがえると、その問題が「ヴィラン」になります。',
    'ヴィランは今日のミッションや特訓に何度も出ます。2回続けて正解すると撃破でき、経験値 +30。',
  ]],
  ['ボタンの説明', [
    'ステージ：教科書の内容ごとの試験。「挑戦する」でその試験だけ5問、「要点を見る」でまとめを読める。',
    'カード：2回正解した大事な語句が集まる図鑑。',
    '歌カード：リズムで覚える覚え歌。声に出して読んでみよう。',
    '設定：音のオン・オフと、記録を消してやり直す。おうちの人が「結果を送る」の設定をする場所もここ。',
    '連続○日：毎日続けると増える。1日空くと1からやり直し。',
  ]],
  ['経験値の増え方', [
    '正解 +10、時間制限の問題に正解 +5、ヴィラン撃破 +30。',
    'レベルと称号：Lv 1 候補生 → Lv 15 見習い → Lv 30 一次合格 → Lv 60 二次合格 → Lv 90 最終試験挑戦者 → Lv 120 合格者 → Lv 200 一人前のヒーロー → Lv 350 トップヒーロー → Lv 500 歴戦のヒーロー → Lv 700 英雄 → Lv 1000 伝説のヒーロー。上のレベルほど、次に上がるまでの経験値が多くなる',
  ]],
];

// back: もどる先（教科の画面から開いたときは、その教科の画面へ戻る）
function help(back = home) {
  if (typeof back !== 'function') back = home; // ボタンから直接呼ばれたとき（クリックの情報が渡る）
  screen(
    el('div', { class: 'row' }, el('h1', {}, '遊び方'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: back }, 'もどる')),
    HELP.map(([title, lines]) => el('div', { class: 'panel' }, el('h3', {}, title), lines.map(t => el('p', {}, t)))),
    el('button', { class: 'primary', onclick: back }, 'もどる'),
  );
}

// ---- 問題 ----
let session = null;

// 同じ問題は1日 DAILY_MAX 回まで。出せる問題がなくなったときのお知らせ
function dailyDone(S) {
  const back = () => (S ? subjectHome(S) : home());
  screen(
    el('h1', { class: 'center' }, '今日はここまで！'),
    el('div', { class: 'panel' },
      el('p', {}, `この範囲の問題は、今日はもう1問${DAILY_MAX}回ずつ解いたよ。`),
      el('p', {}, '同じ問題をくり返すより、ほかの試験に進むか、明日またやるほうが覚えられるよ。'),
      el('p', { class: 'muted' }, 'ボス戦はいつでも挑戦できるよ。')),
    el('button', { class: 'primary', onclick: back }, 'もどる'),
  );
}

function startQuiz(mode, questions, opts = {}) {
  if (!questions.length) {
    if (mode !== 'boss') { dailyDone(opts.subject || null); return; }
    if (opts.subject) subjectHome(opts.subject); else home(); return;
  }
  const subject = opts.subject || subjectOfUnit(questions[0].unit);
  session = {
    mode, questions, subject, idx: 0, timedIdx: mode === 'boss' || mode === 'game' ? -1 : pickTimedIndex(questions), retried: false,
    game: mode === 'game' ? newGame(state.baseball.league) : null, pendingOut: false, pts: 0, tickets0: state.baseball.tickets,
    lineup: mode === 'game' ? lineupOf(state.baseball) : null, tally: {},
    xp: 0, combo: 0, maxCombo: 0, newCards: [], defeated: 0, born: 0, rankUp: null, correct: 0,
    answers: [], startedAt: Date.now(), // ボス戦: 答えをためておき、最後にまとめて採点する
    label: opts.label || (mode === 'mission' ? `${subject.name} 今日のミッション` : ''), onDone: opts.onDone || result,
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
  const shownAt = Date.now();
  // ボス戦は答えるとすぐ次の問題になるので、2回タップが次の問題の答えにならないよう、出した直後は少し受け付けない
  const BOSS_GUARD_MS = 400;

  const fb = el('div');
  const area = el('div');
  const timerBar = el('span', { style: 'width:100%' });
  const sbWrap = el('div', {}, s.game ? scoreboard(s.game) : null);

  // given: 子どもの答え（4択=番号・○×=true/false・並べ替え=押した順・入力=文字）。答えていないときは null
  function finish(ok, showCorrect, given) {
    if (answered) return;
    if (s.mode === 'boss' && Date.now() - shownAt < BOSS_GUARD_MS) return;
    answered = true;
    stopTimer();
    const sec = (Date.now() - shownAt) / 1000;
    if (s.mode === 'boss') {
      // 正誤は見せずに次へ。記録は最後にまとめて（途中でやめたら何も記録しない）
      s.answers.push({ q, ok, given: given ?? null, sec, at: Date.now() });
      next();
      return;
    }
    refreshDay();
    const r = recordAnswer(state, q, ok, { timed: timed && ok, now: Date.now() });
    state = r.state;
    const written = q.type === 'input';
    state = { ...state, baseball: earnPoints(state.baseball, { ok, written }) };
    if (ok) s.pts += written ? 3 : 1;
    persist();
    const extra = sendExtra(sec);
    enqueue(storage, makeRecord(q, unit, ok, given ?? null, Date.now(), subjectOfUnit(q.unit)?.name, s.mode === 'game' ? { ...extra, mode: 'game' } : extra));
    sendLater();
    for (const e of r.events) {
      if (e.type === 'xp') s.xp += e.amount;
      if (e.type === 'card') s.newCards.push(e.term);
      if (e.type === 'villainDefeated') s.defeated++;
      if (e.type === 'villainBorn') s.born++;
      if (e.type === 'rankUp') s.rankUp = e.rank;
    }
    if (ok) { s.correct++; s.combo++; s.maxCombo = Math.max(s.maxCombo, s.combo); } else s.combo = 0;
    let play = null;
    if (s.mode === 'game') {
      if (!ok && !s.game.pinchUsed && canPinchHit(state.baseball)) s.pendingOut = true;
      else play = playBall(s, ok, written);
      sbWrap.replaceChildren(scoreboard(s.game));
    }
    if (s.mode === 'game') {
      sfx(play ? { single: 'hit', double: 'double', hr: 'hr', out: 'out' }[play.result] : 'out');
      if (play?.change) setTimeout(() => sfx('change'), 900);
    } else beep(ok ? 'ok' : 'ng');
    showCorrect();
    const defeated = r.events.some(e => e.type === 'villainDefeated');
    const born = r.events.some(e => e.type === 'villainBorn');
    fb.replaceChildren(el('div', { class: `feedback ${ok ? 'ok' : 'ng'} ${ok ? 'pop' : 'shake'}` },
      el('div', { class: 'big' }, ok ? (s.combo >= 3 ? `○ ${s.combo}コンボ！` : '○ 正解！') : '× ざんねん'),
      defeated ? el('p', {}, el('span', { class: 'badge villain' }, 'ヴィラン撃破！ +30')) : null,
      born ? el('p', {}, el('span', { class: 'badge villain' }, 'この問題がヴィランになった…次で倒そう')) : null,
      play ? playLine(play) : null,
      s.pendingOut ? el('button', { class: 'boss mt', onclick: pinchHit }, '代打！ このアウトを取り消して次の問題で打ち直す（1試合に1回）') : null,
      whyBox(q, given),
      el('p', {}, q.exp),
      el('button', { class: 'primary mt', onclick: next }, s.idx + 1 < s.questions.length && !(s.game && isOver(s.game)) ? '次へ' : '結果を見る')));
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
    area.append(el('p', { class: 'muted' }, '問題文の順番になるようにタップしてね'), ...shown.map(i => btns[i]), el('div', { class: 'row' }, reset), el('div', { class: 'mt' }), decide);
    s.timeout = () => finish(false, showOrder, picked.length ? picked.slice() : null);
  }

  screen(
    el('div', { class: 'row' },
      el('span', { class: 'badge' }, s.label || unit.stage),
      el('span', { class: 'spacer' }),
      el('span', { class: 'muted' }, `${s.idx + 1} / ${s.questions.length}`),
      el('button', { class: 'small ghost', onclick: () => {
        if (s.mode === 'boss') {
          if (!window.confirm('ボス戦をやめる？ この回の答えは記録されません。')) return;
          bossList(s.subject);
          return;
        }
        if (s.mode === 'game' && !window.confirm('試合をやめる？ 勝ち負けは記録されません（答えた分とポイントは残る）。')) return;
        stopTimer(); subjectHome(s.subject);
      } }, 'やめる')),
    s.mode === 'game' ? sbWrap : null,
    s.mode === 'game' ? batterBox(s) : null,
    el('p', { class: 'muted' }, `${s.subject.name} ${unit.stage}「${unit.title}」`,
      rec?.villain ? ' ' : null, rec?.villain ? el('span', { class: 'badge villain' }, 'ヴィラン') : null),
    s.mode === 'boss' ? el('div', { class: 'bar boss' }, el('span', { style: `width:${pct(s.idx / s.questions.length)}%` })) : null,
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

  function pinchHit() {
    s.pendingOut = false;
    s.game = { ...s.game, pinchUsed: true };
    // 同じ問題は正解が見えているので出さない。アウトを数えずに次の問題へ
    next();
  }

  function next() {
    if (s.pendingOut) { s.pendingOut = false; playBall(s, false, false); }
    if (s.game && isOver(s.game)) { s.onDone(s); return; }
    s.idx++;
    if (s.idx >= s.questions.length && s.mode === 'training' && !s.retried) {
      // 特訓: 正解したけれどまだ倒せていないヴィランを、ラウンドの最後にもう一度出す
      s.retried = true;
      s.questions = [...s.questions, ...villainRetries(state, s.questions).filter(q => underDailyMax(state, q))];
    }
    if (s.idx < s.questions.length) showQuestion(); else s.onDone(s);
  }
}

function result(s) {
  if (s.rankUp) fanfare('rankUp'); else if (s.newCards.length) beep('card');
  screen(
    el('h1', { class: 'center' }, s.correct === s.questions.length ? '全問正解！' : 'ミッション完了'),
    s.rankUp ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'レベルアップ！'), el('div', { class: 'rank' }, s.rankUp)) : null,
    el('div', { class: 'panel' },
      el('p', {}, `正解 ${s.correct} / ${s.questions.length}`),
      el('p', {}, `獲得経験値 +${s.xp}`),
      s.pts ? el('p', {}, `スカウトポイント +${s.pts}（券 ${state.baseball.tickets}枚）`) : null,
      s.maxCombo >= 2 ? el('p', {}, `最大 ${s.maxCombo} コンボ`) : null,
      s.defeated ? el('p', {}, el('span', { class: 'badge villain' }, `ヴィラン撃破 ${s.defeated} 体`)) : null,
      s.born ? el('p', { class: 'muted' }, `新しいヴィラン ${s.born} 体。特訓で倒そう`) : null),
    s.newCards.length ? el('div', { class: 'panel' }, el('h3', {}, '新しいカード'),
      el('div', { class: 'cardgrid' }, s.newCards.map(c => el('div', { class: 'card pop' }, c)))) : null,
    el('button', { class: 'primary', onclick: () => startQuiz(s.mode, s.mode === 'mission' ? pickMission(state, s.subject.questions) : unitQuestions(s.questions[0].unit), { label: s.label, subject: s.subject }) }, 'もう1セット'),
    el('div', { class: 'mt' }),
    el('button', { onclick: () => subjectHome(s.subject) }, `${s.subject.name}の画面へ`),
    el('div', { class: 'mt' }),
    el('button', { class: 'ghost', onclick: home }, '教科の一覧へ'),
  );
}

// ---- 野球モード（試合とスカウト） ----
const PLAY_LABEL = { single: 'ヒット！', double: '二塁打！', hr: 'ホームラン！！', out: 'アウト' };

// 今のバッター（オーダーの選手。null は助っ人）
function currentBatter(s) {
  const id = s.lineup[s.game.batter % 9] || null;
  return { id, p: id ? playerById(id) : null, star: id ? starOf(state.baseball, id) : 1, order: (s.game.batter % 9) + 1 };
}

function playBall(s, ok, written) {
  const before = s.game.inning;
  const b = currentBatter(s);
  const r = atBat(s.game, { ok, written, batter: b.p, star: b.star });
  s.game = r.game;
  if (b.id) {
    state = { ...state, baseball: recordStat(state.baseball, b.id, r.result) };
    persist();
    const t = s.tally[b.id] || { h: 0, hr: 0 };
    s.tally[b.id] = { h: t.h + (r.result === 'out' ? 0 : 1), hr: t.hr + (r.result === 'hr' ? 1 : 0) };
  }
  return { ...r, name: b.p ? b.p.name : '助っ人', change: r.game.inning !== before && !isOver(r.game), oppInning: s.game.opp[before - 1] };
}

function batterBox(s) {
  const b = currentBatter(s);
  return el('div', { class: `batter ${b.p ? `r-${b.p.rarity}` : ''}` },
    el('b', {}, `${b.order}番`),
    b.p ? [el('span', { class: `rtag r-${b.p.rarity}` }, RARITY_LABEL[b.p.rarity]), el('span', { class: 'bname' }, b.p.name),
      el('span', { class: 'muted' }, `${b.p.pos} ${'★'.repeat(b.star)}`)]
      : el('span', { class: 'muted' }, '助っ人（スカウトで選手を集めよう）'));
}

function playLine(p) {
  return el('div', { class: `play ${p.result} pop` },
    el('div', { class: 'pbname' }, p.name),
    el('div', { class: 'big' }, PLAY_LABEL[p.result], p.scored ? ` ${p.scored}点！` : ''),
    p.boosted ? el('p', { class: 'gold' }, 'パワーで長打に！') : null,
    p.change ? el('p', {}, `スリーアウト チェンジ！ 相手の攻撃は ${p.oppInning}点`) : null);
}

function scoreboard(g) {
  const L = LEAGUES[g.league];
  const inn = Math.min(g.inning, INNINGS);
  return el('div', { class: 'scoreboard' },
    el('div', { class: 'row' }, el('span', { class: 'badge' }, L.name), el('span', { class: 'spacer' }),
      el('b', {}, `${inn}回`), el('span', { class: 'outs' }, '●'.repeat(g.outs) + '○'.repeat(3 - g.outs))),
    el('div', { class: 'score' },
      el('span', { class: 'tname' }, 'きみのチーム'), el('b', {}, String(g.runs)), el('span', { class: 'muted' }, '－'),
      el('b', {}, String(oppRunsShown(g))), el('span', { class: 'tname' }, L.team)),
    el('div', { class: 'diamond' }, [['b2', 1], ['b3', 2], ['b1', 0]].map(([c, i]) => el('span', { class: `base ${c}${g.bases[i] ? ' on' : ''}` }))));
}

function gameButton(S) {
  return el('button', { class: 'game', disabled: enabledUnits(S).length === 0, onclick: () => startGame(S) }, '⚾ 試合（3〜5分）');
}

function startGame(S) {
  const qs = pickGame(state, S.questions);
  if (!qs.length) { dailyDone(S); return; }
  startQuiz('game', qs, { subject: S, label: `⚾ ${S.name} 試合`, onDone: gameResult });
  sfx('playball');
}

function gameResult(s) {
  const outcome = finishGame(s.game);
  const L = LEAGUES[s.game.league];
  const r = applyResult(state.baseball, outcome);
  state = { ...state, baseball: r.bb };
  persist();
  if (outcome === 'win') { fanfare('boss'); sfx('win'); } else if (s.rankUp) fanfare('rankUp');
  const got = state.baseball.tickets - s.tickets0;
  const title = { win: '勝利！', lose: '負け…', draw: '引き分け' }[outcome];
  const oppTotal = s.game.opp.reduce((x, y) => x + y, 0);
  const heroId = Object.keys(s.tally).sort((x, y) => (s.tally[y].hr * 4 + s.tally[y].h) - (s.tally[x].hr * 4 + s.tally[x].h))[0];
  const hero = heroId && s.tally[heroId].h > 0 ? playerById(heroId) : null;
  screen(
    el('h1', { class: `center ${outcome === 'win' ? 'pop' : ''}` }, `⚾ ${title}`),
    scoreboard({ ...s.game, inning: INNINGS + 1, outs: 0, bases: [false, false, false] }),
    hero ? el('div', { class: 'panel center' }, el('div', { class: 'muted' }, '今日のヒーロー'), el('div', { class: 'rank' }, hero.name),
      el('p', {}, `ヒット ${s.tally[heroId].h}本${s.tally[heroId].hr ? `（ホームラン ${s.tally[heroId].hr}本）` : ''}`)) : null,
    r.promoted ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'リーグ昇格！'), el('div', { class: 'rank' }, LEAGUES[state.baseball.league].name)) : null,
    s.rankUp ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'レベルアップ！'), el('div', { class: 'rank' }, s.rankUp)) : null,
    el('div', { class: 'panel' },
      el('p', {}, `${L.team}に ${s.game.runs} 対 ${oppTotal}`),
      el('p', {}, `正解 ${s.correct} / ${s.game.atBats}・獲得経験値 +${s.xp}`),
      el('p', {}, `スカウトポイント +${s.pts}${outcome === 'win' ? '・勝利ボーナスで券 +1' : ''}`),
      el('p', { class: 'gold' }, `スカウト券 ${state.baseball.tickets}枚${got > 0 ? `（この試合で +${got}）` : ''}`),
      outcome !== 'win' ? el('p', { class: 'muted' }, '記入問題で正解すると長打が出やすいよ') : null,
      s.defeated ? el('p', {}, el('span', { class: 'badge villain' }, `ヴィラン撃破 ${s.defeated} 体`)) : null),
    el('button', { class: 'primary', onclick: () => startGame(s.subject) }, 'もう1試合'),
    el('div', { class: 'mt' }),
    el('button', { class: 'boss', onclick: () => scoutScreen(() => subjectHome(s.subject)) }, `スカウトへ（券 ${state.baseball.tickets}枚）`),
    el('div', { class: 'mt' }),
    el('button', { class: 'ghost', onclick: () => subjectHome(s.subject) }, `${s.subject.name}の画面へ`),
  );
}

function baseballPanel() {
  const bb = state.baseball;
  const top = bb.league >= LEAGUES.length - 1;
  return el('div', { class: 'panel bbpanel' },
    el('div', { class: 'row' }, el('h3', {}, '⚾ 野球'), el('span', { class: 'spacer' }), el('span', { class: 'badge gold' }, `スカウト券 ${bb.tickets}枚`)),
    el('p', {}, LEAGUES[bb.league].name, top ? '（最上位リーグ）' : `（あと ${WIN_TO_PROMOTE - bb.leagueWins} 勝で昇格）`),
    el('p', { class: 'muted' }, `通算 ${bb.wins}勝 ${bb.losses}敗 ${bb.draws}分・スカウトポイント ${bb.points} / ${POINTS_PER_TICKET}`),
    el('div', { class: 'bar' }, el('span', { style: `width:${pct(bb.points / POINTS_PER_TICKET)}%` })),
    el('p', { class: 'muted note' }, '教科を開いて「⚾ 試合」。正解でスカウトポイント（記入問題の正解は3ポイント）'),
    el('div', { class: 'grid2' },
      el('button', { onclick: () => scoutScreen(home) }, 'スカウト'),
      el('button', { onclick: () => roster(home) }, `名鑑 ${Object.keys(bb.players).length} / ${PLAYERS.length}`)),
    el('button', { class: 'mt', onclick: () => orderScreen(home) }, 'オーダー（打順）を組む'));
}

function statLine(id) {
  const x = state.baseball.stats?.[id];
  return x && x.ab ? el('div', { class: 'pstat' }, `${x.ab}打数 ${x.h}安打 ${x.hr}本塁打`) : null;
}

function playerCard(p, star, isNew = false) {
  return el('div', { class: `pcard r-${p.rarity}` },
    el('div', { class: 'prar' }, RARITY_LABEL[p.rarity], isNew ? el('span', { class: 'badge gold' }, 'NEW') : null),
    el('div', { class: 'pnum' }, `#${p.num} ${p.pos}`),
    el('div', { class: 'pname' }, p.name),
    el('div', { class: 'pstar' }, '★'.repeat(star) + '☆'.repeat(5 - star)),
    el('div', { class: 'pnote' }, p.note),
    statLine(p.id));
}

function scoutScreen(back) {
  const bb = state.baseball;
  screen(
    el('div', { class: 'row' }, el('h1', {}, 'スカウト'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: back }, 'もどる')),
    el('div', { class: 'panel' },
      el('div', { class: 'rank' }, `スカウト券 ${bb.tickets}枚`),
      el('p', { class: 'muted' }, `ポイント ${bb.points} / ${POINTS_PER_TICKET}（記入問題の正解は3、ほかの正解は1。試合に勝つと券 +1）`),
      el('div', { class: 'bar' }, el('span', { style: `width:${pct(bb.points / POINTS_PER_TICKET)}%` }))),
    el('button', { class: 'primary', disabled: bb.tickets < 1, onclick: () => doScout(1, back) }, '1回スカウト（券1枚）'),
    el('div', { class: 'mt' }),
    el('button', { class: 'boss', disabled: bb.tickets < 10, onclick: () => doScout(10, back) }, '10連スカウト（券10枚・レア以上1人確定）'),
    bb.tickets < 1 ? el('p', { class: 'muted center note' }, '券がないときは、教科の「⚾ 試合」やミッションで正解してポイントをためよう') : null,
    el('div', { class: 'panel mt' }, el('h3', {}, '出る確率'),
      [...RARITIES].reverse().map(r => el('div', { class: 'row' }, el('span', { class: `rtag r-${r}` }, RARITY_LABEL[r]), el('span', { class: 'spacer' }), el('span', {}, `${ODDS[r]}%`)))),
    el('button', { onclick: () => roster(back) }, '名鑑を見る'),
  );
}

// スカウトの演出（豪華版）: スポットライト → ボールの色が段階的に上がる → フラッシュ → カードを1枚ずつめくる
let scoutRun = null; // 画面を移ったら古い演出の続きを止める
const STEP_TEXT = { N: 'スカウト中…', R: 'おっ…？', SR: 'これは…！', L: 'まさか…！！' };
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

function confetti(best) {
  if (reducedMotion()) return;
  const colors = best === 'L' ? ['#ff9ad5', '#b06cff', '#5ad1ff', '#ffd640', '#7ff0b0'] : ['#ffd640', '#ffb300', '#fff3b0', '#ffffff'];
  const box = el('div', { class: 'confetti-box' });
  for (let i = 0; i < (best === 'L' ? 70 : 40); i++) {
    box.append(el('span', { class: 'confetti', style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(2 + Math.random() * 1.5).toFixed(2)}s` }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4500);
}

function doScout(n, back) {
  const r = scout(state.baseball, n);
  if (!r.pulls.length) { scoutScreen(back); return; }
  state = { ...state, baseball: r.bb };
  persist();
  const best = r.pulls.reduce((m, p) => (RARITIES.indexOf(p.rarity) > RARITIES.indexOf(m) ? p.rarity : m), 'N');
  const token = {};
  scoutRun = token;
  const later = (ms, fn) => setTimeout(() => { if (scoutRun === token) fn(); }, ms);
  const steps = RARITIES.slice(0, RARITIES.indexOf(best) + 1);

  const ball = el('div', { class: 'ball rolling r-N' });
  const text = el('p', { class: 'steptext' }, STEP_TEXT.N);
  const stage = el('div', { class: 'stage' },
    el('div', { class: 'spot l' }), el('div', { class: 'spot r' }),
    ball, text,
    el('button', { class: 'small ghost skip', onclick: () => showResult(true) }, 'スキップ ▶▶'));
  sfx('drumroll');
  screen(stage);

  // ボールの色を1段ずつ上げる
  steps.slice(1).forEach((rar, k) => later(900 + k * 650, () => {
    ball.className = `ball rolling r-${rar}`;
    text.textContent = STEP_TEXT[rar];
    text.classList.remove('pop'); void text.offsetWidth; text.classList.add('pop');
    sfx('stepup');
  }));
  const flashAt = 900 + (steps.length - 1) * 650 + 300;
  later(flashAt, () => {
    document.body.append(el('div', { class: `flash r-${best}` }));
    setTimeout(() => document.querySelector('.flash')?.remove(), 800);
    sfx(`reveal${best}`);
    if (best === 'L') {
      stage.classList.add('shake');
      text.replaceChildren(el('span', { class: 'legend-text' }, 'LEGEND'));
    }
  });
  later(flashAt + (best === 'L' ? 1300 : 700), () => showResult(false));

  function showResult(skipped) {
    if (scoutRun !== token) return;
    scoutRun = null;
    if (skipped) sfx(`reveal${best}`);
    if (best === 'SR' || best === 'L') confetti(best);
    const cards = r.pulls.map(p => {
      const front = playerCard(playerById(p.id), p.star, p.isNew);
      front.classList.add('flip-front');
      if (p.rarity === 'SR' || p.rarity === 'L') front.classList.add('shine');
      return el('div', { class: `flip r-${p.rarity}` }, el('div', { class: 'flip-inner' }, front, el('div', { class: 'flip-back' }, '⚾')));
    });
    screen(
      el('h1', { class: `center ${best === 'L' ? 'legend-text big' : ''}` }, best === 'L' ? 'レジェンド登場！！' : best === 'SR' ? 'スーパーレア！' : 'スカウト結果'),
      el('div', { class: 'pgrid' }, cards),
      el('button', { class: 'primary', disabled: state.baseball.tickets < n, onclick: () => doScout(n, back) }, `もう一度（券 ${n}枚・のこり ${state.baseball.tickets}枚）`),
      el('div', { class: 'mt' }),
      el('button', { onclick: () => scoutScreen(back) }, 'スカウトの画面へ'),
      el('div', { class: 'mt' }),
      el('button', { class: 'ghost', onclick: () => roster(back) }, '名鑑を見る'),
    );
    // 1枚ずつめくる（いいカードほど最後に）
    const gap = reducedMotion() ? 0 : (n === 10 ? 160 : 300);
    const order = r.pulls.map((p, i) => i).sort((x, y) => RARITIES.indexOf(r.pulls[x].rarity) - RARITIES.indexOf(r.pulls[y].rarity));
    order.forEach((i, k) => setTimeout(() => {
      cards[i].classList.add('open');
      sfx(RARITIES.indexOf(r.pulls[i].rarity) >= 2 ? `reveal${r.pulls[i].rarity}` : 'flip');
    }, 150 + k * gap));
  }
}

function roster(back) {
  const bb = state.baseball;
  const sr = PLAYERS.filter(p => (p.rarity === 'SR' || p.rarity === 'L') && bb.players[p.id]).length;
  screen(
    el('div', { class: 'row' }, el('h1', {}, '選手名鑑'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: back }, 'もどる')),
    el('div', { class: 'panel' },
      el('p', {}, `集めた選手 ${Object.keys(bb.players).length} / ${PLAYERS.length}`),
      el('p', {}, `チーム力 ${teamPower(bb)}（強い順に9人の合計）`),
      el('p', { class: canPinchHit(bb) ? 'gold' : 'muted' }, canPinchHit(bb) ? '代打が使える！（スーパーレア以上が3人）' : `代打まで：スーパーレア以上があと ${3 - sr} 人`)),
    [...RARITIES].reverse().map(r => {
      const list = PLAYERS.filter(p => p.rarity === r);
      return el('div', { class: 'panel' },
        el('div', { class: 'row' }, el('h3', {}, el('span', { class: `rtag r-${r}` }, RARITY_LABEL[r])), el('span', { class: 'spacer' }),
          el('span', { class: 'muted' }, `${list.filter(p => bb.players[p.id]).length} / ${list.length}`)),
        el('div', { class: 'pgrid' }, list.map(p => (bb.players[p.id]
          ? playerCard(p, Math.min(bb.players[p.id], 5))
          : el('div', { class: `pcard locked r-${r}` }, el('div', { class: 'pname' }, '？？？'), el('div', { class: 'pnum' }, p.pos))))));
    }),
  );
}

// ---- オーダー（打順） ----
function orderScreen(back) {
  const bb = state.baseball;
  const L = lineupOf(bb);
  const owned = Object.keys(bb.players).length;
  screen(
    el('div', { class: 'row' }, el('h1', {}, 'オーダー'), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: back }, 'もどる')),
    el('p', { class: 'muted' }, '打順の枠を押して選手を選ぶ。正解したとき、強い選手は打球が伸びる（スーパーレア・レジェンドはホームランも）。'),
    owned === 0 ? el('p', { class: 'panel' }, 'まだ選手がいません。スカウトで選手を集めよう。空いた枠は「助っ人」が打ちます。') : null,
    L.map((id, i) => {
      const p = id ? playerById(id) : null;
      return el('button', { class: `slot ${p ? `r-${p.rarity}` : ''}`, disabled: owned === 0, onclick: () => pickForSlot(i, back) },
        el('b', {}, `${i + 1}番`),
        p ? [el('span', { class: `rtag r-${p.rarity}` }, RARITY_LABEL[p.rarity]), el('span', { class: 'bname' }, p.name),
          el('span', { class: 'muted' }, `${p.pos} ${'★'.repeat(starOf(bb, id))}`)] : el('span', { class: 'muted' }, '助っ人'));
    }),
    el('div', { class: 'mt' }),
    el('button', { class: 'primary', disabled: owned === 0, onclick: () => { state = { ...state, baseball: autoLineup(state.baseball) }; persist(); orderScreen(back); } }, 'おまかせ（強い順に並べる）'),
  );
}

function pickForSlot(slot, back) {
  const bb = state.baseball;
  const L = lineupOf(bb);
  const ids = Object.keys(bb.players).filter(id => playerById(id))
    .sort((x, y) => RARITIES.indexOf(playerById(y).rarity) - RARITIES.indexOf(playerById(x).rarity) || starOf(bb, y) - starOf(bb, x));
  screen(
    el('div', { class: 'row' }, el('h1', {}, `${slot + 1}番に入れる選手`), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: () => orderScreen(back) }, 'もどる')),
    el('p', { class: 'muted' }, 'ほかの打順にいる選手を選ぶと、入れかわる。'),
    el('div', { class: 'pgrid' }, ids.map(id => {
      const c = playerCard(playerById(id), starOf(bb, id));
      const at = L.indexOf(id);
      if (at >= 0) c.prepend(el('span', { class: 'badge gold' }, at === slot ? 'いまここ' : `いま${at + 1}番`));
      c.classList.add('pick');
      c.addEventListener('click', () => { state = { ...state, baseball: setSlot(state.baseball, slot, id) }; persist(); orderScreen(back); });
      return c;
    })),
  );
}

// ---- ステージ ----
function unitQuestions(unitId) {
  return pickMission({ ...state, enabled: [unitId] }, ALL_QS);
}

function stages(S) {
  const back = () => subjectHome(S);
  screen(
    el('div', { class: 'row' }, el('h1', {}, `${S.name}のステージ`), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: back }, 'もどる')),
    el('p', { class: 'muted' }, 'テストの範囲に入っていない試験は「範囲から外す」にしよう。外した試験は今日のミッションと特訓に出なくなる。'),
    S.units.map(u => {
      const p = unitProgress(state, S.questions, u.id);
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
          el('button', { class: 'small', onclick: () => startQuiz('unit', unitQuestions(u.id), { label: `${S.name} ${u.stage}`, subject: S }) }, '挑戦する'),
          el('button', { class: 'small', onclick: () => summary(u, () => stages(S)) }, '要点を見る'),
          el('button', { class: 'small ghost', onclick: () => toggleUnit(u.id, S) }, on ? '範囲から外す' : '範囲に入れる')));
    }),
    el('button', { onclick: back }, `${S.name}の画面へ`),
  );
}

// 範囲の ON/OFF は単元ごと。全教科の単元がすべて ON のときは null（＝全部）にしておく
function toggleUnit(id, S) {
  const all = ALL_UNITS.map(u => u.id);
  const cur = state.enabled === null ? all : state.enabled.slice();
  const nextList = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
  state = { ...state, enabled: all.every(x => nextList.includes(x)) ? null : all.filter(x => nextList.includes(x)) };
  persist();
  stages(S);
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
function startTraining(S) {
  const rounds = pickTraining(state, S.questions, S.units);
  if (!rounds.length) { dailyDone(S); return; }
  const villainsBefore = villainCount(S);
  let total = { xp: 0, defeated: 0, correct: 0, count: 0, newCards: [], rankUp: null };
  const runRound = (k) => {
    const rd = rounds[k];
    summary(rd.unit, () => subjectHome(S), `ラウンド ${k + 1} / ${rounds.length} を始める`, () => startQuiz('training', rd.questions, {
      label: `${S.name} 特訓 ${k + 1}/${rounds.length}`, subject: S,
      onDone: (s) => {
        total.xp += s.xp; total.defeated += s.defeated; total.correct += s.correct; total.count += s.questions.length;
        total.newCards.push(...s.newCards); total.rankUp = s.rankUp || total.rankUp;
        if (k + 1 < rounds.length) runRound(k + 1); else trainingResult(total, villainsBefore, S);
      },
    }));
  };
  runRound(0);
}

function trainingResult(t, before, S) {
  if (t.rankUp) fanfare('rankUp');
  const left = villainCount(S);
  screen(
    el('h1', { class: 'center' }, '特訓おつかれさま！'),
    t.rankUp ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'レベルアップ！'), el('div', { class: 'rank' }, t.rankUp)) : null,
    el('div', { class: 'panel' },
      el('p', {}, `正解 ${t.correct} / ${t.count}`),
      el('p', {}, `獲得経験値 +${t.xp}`),
      el('p', {}, el('span', { class: 'badge villain' }, `倒したヴィラン ${t.defeated} 体`)),
      el('p', { class: 'muted' }, left ? `残っているヴィラン ${left} 体（特訓前 ${before} 体）` : 'ヴィランは残っていない！')),
    t.newCards.length ? el('div', { class: 'panel' }, el('h3', {}, '新しいカード'),
      el('div', { class: 'cardgrid' }, t.newCards.map(c => el('div', { class: 'card pop' }, c)))) : null,
    el('button', { class: 'primary', onclick: () => subjectHome(S) }, `${S.name}の画面へ`),
  );
}

// ---- ボス戦 ----
const yen = n => `${n}円`;
function rewardLabel(b) {
  if (b.ura) return 'ごほうびは、おうちの人と決めてね';
  const nr = nextReward(state, b, Date.now());
  if (nr.first) return `ごほうび ${yen(nr.amount)}（初めて倒したとき）`;
  if (nr.today) return `今日のごほうびはもらい済み（明日からまた ${yen(REWARD[b.kind].again)}）`;
  return `ごほうび ${yen(nr.amount)}（今日まだ倒していない）`;
}
const bossRec = b => (state.bosses || {})[b.id] || { tries: 0, wins: 0, best: 0 };
const bossSize = (b, S) => pickBossQuestions(b, S.questions, state, () => 0).length;

function bossPanel(b, S) {
  const r = bossRec(b);
  const n = bossSize(b, S);
  const head = (b.ura ? '裏・' : '') + (b.kind === 'subject' ? '教科ボス' : `${b.unit.stage}のボス`);
  if (b.ura && !uraOpen(state, b)) {
    return el('div', { class: 'panel bosscard ura locked' },
      el('div', { class: 'row' }, el('span', { class: 'badge' }, head), el('span', { class: 'spacer' }), el('span', { class: 'badge off' }, 'まだ出てこない')),
      el('h3', { class: 'mt' }, '「？？？」'),
      el('p', { class: 'muted' }, `ふつうのボスを1回倒すと出てくる。`));
  }
  return el('div', { class: `panel bosscard ${b.kind}${b.ura ? ' ura' : ''}` },
    el('div', { class: 'row' },
      el('span', { class: 'badge' }, head),
      el('span', { class: 'spacer' }),
      r.wins ? el('span', { class: 'badge gold' }, `撃破 ${r.wins}回`) : el('span', { class: 'badge off' }, '未撃破')),
    el('h3', { class: 'mt' }, `「${b.name}」`),
    b.kind === 'unit' ? el('p', { class: 'muted' }, b.unit.title) : null,
    el('p', {}, `${n}問${b.ura ? '（全部書く問題）' : ''}・${BOSS_PASS}点以上で撃破`),
    el('p', { class: 'reward' }, rewardLabel(b)),
    r.tries ? el('p', { class: 'muted' }, `最高 ${r.best}点・挑戦 ${r.tries}回`) : null,
    n === 0 ? el('p', { class: 'muted' }, '範囲に入っている試験がありません。「ステージ」で選んでください。') : null,
    el('button', { class: b.kind === 'subject' || b.ura ? 'boss' : 'small', disabled: n === 0, onclick: () => bossIntro(b, S) }, '挑戦する'));
}

function bossList(S) {
  refreshDay();
  const [main, ...units] = bossesOf(S);
  screen(
    el('div', { class: 'row' }, el('h1', {}, `${S.name}のボス`), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: () => subjectHome(S) }, 'もどる')),
    el('p', { class: 'muted' }, `本番のテストの形。答えても正解は出ず、最後にまとめて採点。${BOSS_PASS}点以上で撃破！ 撃破 ${bossWins(state, S)} / ${units.length + 1}`),
    bossPanel(main, S),
    el('h2', { class: 'mt' }, '単元ボス'),
    units.map(b => bossPanel(b, S)),
    el('h2', { class: 'mt' }, `裏ボス（撃破 ${bossWins(state, S, true)} / ${units.length + 1}）`),
    el('p', { class: 'muted' }, '選択肢なし。答えを全部自分で書く上級戦。ひらがなで書いても正解。ふつうのボスを倒すと出てくる。'),
    urasOf(S).map(b => bossPanel(b, S)),
    el('button', { onclick: () => subjectHome(S) }, `${S.name}の画面へ`),
  );
}

function bossIntro(b, S) {
  const n = bossSize(b, S);
  if (!n) { bossList(S); return; }
  screen(
    el('span', { class: 'badge' }, (b.ura ? '裏・' : '') + (b.kind === 'subject' ? `${S.name}の教科ボス` : `${S.name} ${b.unit.stage}のボス`)),
    el('h1', { class: 'mt bossname' }, `「${b.name}」があらわれた！`),
    el('div', { class: 'panel' },
      el('p', {}, `問題 ${n}問。${BOSS_PASS}点以上で撃破。`),
      el('p', {}, '答えても正解・不正解は出ない。最後にまとめて採点するよ。時間制限はなし。'),
      b.ura ? el('p', {}, '裏ボスは選択肢なし。答えを全部自分で書こう。ひらがなでも正解になるよ。') : null,
      el('p', { class: 'reward' }, rewardLabel(b)),
      el('p', { class: 'muted' }, '途中で「やめる」と、この回は記録されない。')),
    el('button', { class: 'boss', onclick: () => {
      const qs = pickBossQuestions(b, S.questions, state);
      startQuiz('boss', qs, { subject: S, label: `ボス「${b.name}」`, onDone: s => bossResult(b, S, s) });
    } }, '挑戦する'),
    el('div', { class: 'mt' }),
    el('button', { onclick: () => bossList(S) }, 'もどる'),
  );
}

const mmss = sec => `${Math.floor(sec / 60)}分${String(Math.round(sec % 60)).padStart(2, '0')}秒`;

function bossResult(b, S, s) {
  refreshDay();
  const now = Date.now();
  const rankBefore = rankFor(state.xp).name;
  let xp = 0, born = 0, defeated = 0;
  const newCards = [];
  // 答えた問題は、ふだんと同じく正誤の記録（得意・苦手・ヴィラン）と経験値に入れ、1問ずつ送る
  for (const a of s.answers) {
    const r = recordAnswer(state, a.q, a.ok, { now });
    state = r.state;
    for (const e of r.events) {
      if (e.type === 'xp') xp += e.amount;
      if (e.type === 'card') newCards.push(e.term);
      if (e.type === 'villainBorn') born++;
      if (e.type === 'villainDefeated') defeated++;
    }
    enqueue(storage, makeRecord(a.q, unitById(a.q.unit), a.ok, a.given, a.at || now, S.name, sendExtra(a.sec)));
  }
  const total = s.answers.length;
  const correct = s.answers.filter(a => a.ok).length;
  const spent = (now - s.startedAt) / 1000;
  const j = judgeBoss(state, b, correct, total, now);
  state = j.state;
  persist();
  enqueue(storage, makeBossRecord(b, j, correct, total, now, sendExtra(spent)));
  sendLater();
  xp += j.xp;
  const rankAfter = rankFor(state.xp).name;
  const rankUp = rankAfter !== rankBefore ? rankAfter : null;
  if (j.passed) fanfare('boss'); else if (rankUp) fanfare('rankUp');

  const wrong = s.answers.filter(a => !a.ok);
  const need = Math.max(0, Math.ceil((BOSS_PASS * total) / 100 - 1e-9) - correct);
  screen(
    el('div', { class: `panel center ${j.passed ? 'win pop' : 'lose'}` },
      el('div', { class: 'muted' }, `「${b.name}」`),
      el('div', { class: 'score' }, `${j.score}点`),
      el('div', { class: 'big' }, j.passed ? '撃破！' : '不合格…'),
      el('p', {}, `正解 ${correct} / ${total}・かかった時間 ${mmss(spent)}`),
      el('p', { class: 'muted' }, `最高 ${j.best}点`)),
    j.passed && b.ura
      ? el('div', { class: 'panel reward-panel pop' },
        el('div', { class: 'big' }, '裏ボス撃破！'),
        el('p', {}, `${j.first ? '初めての撃破' : `${j.nth}回目の撃破`}！ おうちの人にこの画面を見せてね。`))
      : j.passed
      ? el('div', { class: 'panel reward-panel pop' },
        j.reward > 0
          ? [el('div', { class: 'big' }, `ごほうび ${yen(j.reward)}`),
            el('p', {}, j.first ? '初めての撃破！ おうちの人にこの画面を見せてね。' : `${j.nth}回目の撃破！ おうちの人にこの画面を見せてね。`)]
          : [el('p', {}, `${j.nth}回目の撃破！ でも今日のごほうびはもうもらっているよ。`),
            el('p', { class: 'muted' }, `明日また倒すと ${yen(REWARD[b.kind].again)}。`)])
      : el('div', { class: 'panel' }, el('p', {}, need > 0 ? `あと ${need}問 正解で撃破（${BOSS_PASS}点）だった！` : 'おしい！'), el('p', { class: 'muted' }, 'まちがえた問題を見直して、もう一度挑戦しよう。')),
    rankUp ? el('div', { class: 'panel center pop' }, el('div', { class: 'muted' }, 'レベルアップ！'), el('div', { class: 'rank' }, rankUp)) : null,
    el('div', { class: 'panel' },
      el('p', {}, `獲得経験値 +${xp}${j.xp ? `（撃破ボーナス +${j.xp} を含む）` : ''}`),
      defeated ? el('p', {}, el('span', { class: 'badge villain' }, `ヴィラン撃破 ${defeated} 体`)) : null,
      born ? el('p', { class: 'muted' }, `新しいヴィラン ${born} 体。特訓で倒そう`) : null),
    newCards.length ? el('div', { class: 'panel' }, el('h3', {}, '新しいカード'),
      el('div', { class: 'cardgrid' }, newCards.map(c => el('div', { class: 'card pop' }, c)))) : null,
    wrong.length ? el('div', { class: 'panel' },
      el('h3', {}, `まちがえた問題（${wrong.length}問）`),
      wrong.map(a => el('div', { class: 'review' },
        el('p', { class: 'muted' }, `${unitById(a.q.unit).stage}「${unitById(a.q.unit).title}」`),
        el('p', { class: 'rq' }, a.q.q),
        el('p', {}, '正解：', el('b', { class: 'okText' }, correctText(a.q))),
        el('p', {}, 'きみの答え：', el('span', { class: 'ngText' }, givenText(a.q, a.given))),
        whyBox(a.q, a.given),
        a.q.exp ? el('p', { class: 'muted' }, a.q.exp) : null))) : el('div', { class: 'panel center' }, el('p', {}, '全問正解！')),
    el('button', { class: 'boss', onclick: () => bossIntro(b, S) }, 'もう一度挑戦'),
    el('div', { class: 'mt' }),
    el('button', { onclick: () => bossList(S) }, 'ボスの一覧へ'),
    el('div', { class: 'mt' }),
    el('button', { class: 'ghost', onclick: () => subjectHome(S) }, `${S.name}の画面へ`),
  );
}

// ---- カード（8枚ずつ＝8カウント） ----
function cards(S) {
  const owned = new Set(state.cards);
  const all = new Set(S.questions.filter(q => q.card).map(q => q.card));
  screen(
    el('div', { class: 'row' }, el('h1', {}, `${S.name}のカード`), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: () => subjectHome(S) }, 'もどる')),
    el('p', { class: 'muted' }, `集めたカード ${[...owned].filter(c => all.has(c)).length} / ${all.size}。同じ問題に2回正解するとカードになる。8枚で1フレーズ。`),
    S.units.map(u => {
      const terms = [...new Set(S.questions.filter(q => q.unit === u.id && q.card).map(q => q.card))];
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
function songs(S) {
  screen(
    el('div', { class: 'row' }, el('h1', {}, `${S.name}の歌カード`), el('span', { class: 'spacer' }), el('button', { class: 'small', onclick: () => subjectHome(S) }, 'もどる')),
    el('p', { class: 'muted' }, '自分の好きなリズムで声に出してみよう。1行が1カウント。'),
    S.units.map(u => el('div', { class: 'panel' },
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
    el('p', { class: 'muted' }, '送るのは、解いた日時・問題・正解・答え・正誤・ボス戦の点数とごほうび、どの端末で解いたか（下の名前・番号・種類）、かかった秒数だけです。名前や学校名は送りません。'),
    msg ? el('p', {}, msg) : null,
    box,
    el('div', { class: 'row mt' }, saveBtn),
    on ? el('button', { class: 'small ghost mt', onclick: () => settings(false, SYNC_MSG[setConnection(storage, '')]) }, '送るのをやめる') : null,
    on ? devicePanel() : null);
}

// この端末の名前（おうちの人がつける）。結果といっしょに送り、どの端末で解いたかを確かめる
function devicePanel() {
  const box = el('input', {
    type: 'text', class: 'answer', placeholder: '例: 自分のiPhone', autocomplete: 'off',
    autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: String(DEVICE_NAME_MAX),
    value: getDeviceName(storage),
  });
  const kind = deviceKind(navigator.userAgent);
  return el('div', { class: 'mt' },
    el('h3', { class: 'mt' }, 'この端末の名前'),
    el('p', { class: 'muted' }, `結果といっしょに、端末の名前・端末番号（${deviceId(storage) || 'なし'}）・端末の種類（${kind}）・1問にかかった秒数を送ります。名前は${DEVICE_NAME_MAX}文字まで。本名は入れないでください。`),
    box,
    el('div', { class: 'row mt' }, el('button', { class: 'small', onclick: () => {
      const v = setDeviceName(storage, box.value);
      settings(false, v === null ? '端末の名前を保存できませんでした。' : v ? `端末の名前を「${v}」にしました。` : '端末の名前を消しました。');
    } }, '名前を保存')));
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
        ? el('p', { class: 'muted' }, 'レベル・カードなどの記録はこの iPhone の中に保存されています。解いた結果（日時・問題・答え・正誤）は、おうちの人の Google スプレッドシートにも送られて、苦手なところの勉強に使います。')
        : el('p', { class: 'muted' }, '記録はこの iPhone の中だけに保存されていて、インターネットには送られません。'),
      el('p', { class: 'muted' }, 'Safari の「履歴とWebサイトデータを消去」をすると、記録も消えます。')),
    syncPanel(syncMsg),
    el('div', { class: 'panel' },
      el('h3', {}, '記録を消す'),
      confirming
        ? [el('p', {}, '本当に消す？ レベル・カード・ヴィランが全部はじめからになります。'),
          el('p', { class: 'muted' }, 'ボス戦の撃破とごほうびの記録は消えずに残ります。'),
          el('div', { class: 'grid2' },
            // ボスの記録は残す（消して倒し直すと「初めての撃破」のごほうびがまた出てしまうため）
            el('button', { class: 'danger', onclick: () => { state = touchDay({ ...createState(), bosses: state.bosses || {} }, Date.now()); persist(); home(); } }, '消す'),
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
