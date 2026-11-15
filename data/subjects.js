// 教科の一覧。教科を足すときは、ここに1つ足す（単元と問題の番号は教科をまたいで重ならないようにする）
import { UNITS as REKISHI_UNITS } from './units.js';
import { ALL_QUESTIONS as REKISHI_QS } from './index.js';
import { UNITS as KAGAKU_UNITS } from './kagaku/units.js';
import { QUESTIONS as KAGAKU_QS } from './kagaku/index.js';

export const SUBJECTS = [
  { id: 'rekishi', name: '歴史総合', units: REKISHI_UNITS, questions: REKISHI_QS, fields: ['政治', '外交', '戦争', '経済', '社会'] },
  { id: 'kagaku', name: '化学', units: KAGAKU_UNITS, questions: KAGAKU_QS, fields: ['用語', '現象', '構造', '計算'] },
];

export const ALL_UNITS = SUBJECTS.flatMap(s => s.units);
export const ALL_QS = SUBJECTS.flatMap(s => s.questions);
export const subjectById = id => SUBJECTS.find(s => s.id === id);
export const subjectOfUnit = unitId => SUBJECTS.find(s => s.units.some(u => u.id === unitId));
