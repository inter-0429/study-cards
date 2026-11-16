// 教科の一覧。教科を足すときは、ここに1つ足す（単元と問題の番号は教科をまたいで重ならないようにする）
import { UNITS as REKISHI_UNITS } from './units.js';
import { ALL_QUESTIONS as REKISHI_QS } from './index.js';
import { UNITS as KAGAKU_UNITS } from './kagaku/units.js';
import { QUESTIONS as KAGAKU_QS } from './kagaku/index.js';
import { UNITS as SEIBUTSU_UNITS } from './seibutsu/units.js';
import { QUESTIONS as SEIBUTSU_QS } from './seibutsu/index.js';
import { UNITS as BUTSURI_UNITS } from './butsuri/units.js';
import { QUESTIONS as BUTSURI_QS } from './butsuri/index.js';
import { UNITS as SUUGAKU_UNITS } from './suugaku/units.js';
import { QUESTIONS as SUUGAKU_QS } from './suugaku/index.js';
import { UNITS as SUUGAKUA_UNITS } from './suugakua/units.js';
import { QUESTIONS as SUUGAKUA_QS } from './suugakua/index.js';
import { UNITS as SUUGAKU2_UNITS } from './suugaku2/units.js';
import { QUESTIONS as SUUGAKU2_QS } from './suugaku2/index.js';
import { YOMI } from './yomi.js';
import { WHY } from './why/index.js';

export const SUBJECTS = [
  { id: 'rekishi', name: '歴史総合', units: REKISHI_UNITS, questions: REKISHI_QS, fields: ['政治', '外交', '戦争', '経済', '社会'] },
  { id: 'kagaku', name: '化学', units: KAGAKU_UNITS, questions: KAGAKU_QS, fields: ['用語', '現象', '構造', '計算'] },
  { id: 'seibutsu', name: '生物基礎', units: SEIBUTSU_UNITS, questions: SEIBUTSU_QS, fields: ['用語', 'しくみ', '細胞', '病気'] },
  { id: 'butsuri', name: '物理基礎', units: BUTSURI_UNITS, questions: BUTSURI_QS, fields: ['用語', '法則', '計算'] },
  { id: 'suugaku', name: '数学Ⅰ', units: SUUGAKU_UNITS, questions: SUUGAKU_QS, fields: ['用語', '性質', '計算'] },
  { id: 'suugakua', name: '数学A', units: SUUGAKUA_UNITS, questions: SUUGAKUA_QS, fields: ['用語', '性質', '計算'] },
  { id: 'suugaku2', name: '数学Ⅱ', units: SUUGAKU2_UNITS, questions: SUUGAKU2_QS, fields: ['用語', '性質', '計算'] },
];

export const ALL_UNITS = SUBJECTS.flatMap(s => s.units);
export const ALL_QS = SUBJECTS.flatMap(s => s.questions);

// 入力問題の「まぜ書き」（骨ずい など）も正解にするための読み（data/yomi.js）を問題に付ける
for (const q of ALL_QS) if (YOMI[q.id]) q.yomi = YOMI[q.id];
// 選択問題の「まちがえた選択肢の理由」（選択肢の順番どおり。正解の位置は null）
for (const q of ALL_QS) if (WHY[q.id]) q.why = WHY[q.id];
export const subjectById = id => SUBJECTS.find(s => s.id === id);
export const subjectOfUnit = unitId => SUBJECTS.find(s => s.units.some(u => u.id === unitId));
