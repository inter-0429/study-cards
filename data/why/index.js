// 選択問題で、まちがえた選択肢を選んだときに出す「なぜちがうか」を、全教科ぶんまとめる。
import { WHY as REKISHI } from './rekishi.js';
import { WHY as KAGAKU } from './kagaku.js';
import { WHY as SEIBUTSU } from './seibutsu.js';
import { WHY as BUTSURI } from './butsuri.js';
import { WHY as SUUGAKU } from './suugaku.js';
import { WHY as SUUGAKUA } from './suugakua.js';
import { WHY as SUUGAKU2 } from './suugaku2.js';
import { WHY as CHIRI } from './chiri.js';

export const WHY = { ...REKISHI, ...KAGAKU, ...SEIBUTSU, ...BUTSURI, ...SUUGAKU, ...SUUGAKUA, ...SUUGAKU2, ...CHIRI };
