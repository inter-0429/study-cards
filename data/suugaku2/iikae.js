// 数学Ⅱ（三角関数）「言いかえ」の記入問題（2026-11-17 追加）。
// 同じ問題のくり返しで「この問題の答えはこれ」と覚えてしまわないよう、4択と同じ考え方を、ちがう数・ちがう聞き方で書かせる。
// iPhone で打ちにくい π・√ は答えに入れない（□に入る数、度数、分数、英字で答える）。
// yomi: まぜ書き（漢字とひらがなをまぜた書き方）も正解にするための読み。書き方は data/yomi.js と同じ。
const N = '（数で答える）';
const F = '（分数で答える。例: 3/4、-1/2）';
const minus = n => [`-${n}`, `−${n}`];
export const QUESTIONS = [
  // ---- 一次試験 一般角と弧度法 ----
  { id: 't01-022', unit: 't01', field: '計算', type: 'input', q: `120° を弧度法で表すと □π/3。□に入る数は？${N}`, answers: ['2'], exp: '1° ＝ π/180。120 × π/180 ＝ 2π/3。' },
  { id: 't01-023', unit: 't01', field: '計算', type: 'input', q: `3π/2（ラジアン）は何度？${N}`, answers: ['270', '270°'], exp: 'π ＝ 180° なので、3 × 180 ÷ 2 ＝ 270°。' },
  { id: 't01-024', unit: 't01', field: '計算', type: 'input', q: `7π/6（ラジアン）は何度？${N}`, answers: ['210', '210°'], exp: '180 × 7 ÷ 6 ＝ 210°。' },
  { id: 't01-025', unit: 't01', field: '計算', type: 'input', q: `−π/2（ラジアン）は何度？${N}`, answers: [...minus(90), '-90°', '−90°'], exp: '180 ÷ 2 ＝ 90 なので −90°。' },
  { id: 't01-026', unit: 't01', field: '計算', type: 'input', q: `135° を弧度法で表すと □π/4。□に入る数は？${N}`, answers: ['3'], exp: '135 × π/180 ＝ 3π/4。' },
  { id: 't01-027', unit: 't01', field: '計算', type: 'input', q: `390° の動径と同じ位置にある角は何度？（0° ≦ θ ＜ 360°）${N}`, answers: ['30', '30°'], exp: '390° − 360° ＝ 30°。' },
  { id: 't01-028', unit: 't01', field: '性質', type: 'input', q: `−30° の動径は、第何象限にある？（数で答える。第4象限なら 4）`, answers: ['4', '第4象限', 'だいよんしょうげん'], yomi: ['第|だい 4 象|しょう 限|げん'], exp: '−30° は x 軸の正の向きから時計回りに 30°。右下なので第4象限。' },
  { id: 't01-029', unit: 't01', field: '計算', type: 'input', q: `半径 9、中心角 π/3 の扇形の弧の長さは □π。□に入る数は？${N}`, answers: ['3'], exp: '弧の長さ ＝ rθ ＝ 9 × π/3 ＝ 3π。' },
  { id: 't01-030', unit: 't01', field: '計算', type: 'input', q: `半径 6、中心角 π/3 の扇形の面積は □π。□に入る数は？${N}`, answers: ['6'], exp: '面積 ＝ ½r²θ ＝ ½ × 36 × π/3 ＝ 6π。' },
  { id: 't01-031', unit: 't01', field: '計算', type: 'input', q: `π（ラジアン）は何度？${N}`, answers: ['180', '180°'], exp: 'π ＝ 180°。これを使って、度とラジアンを直す。' },
  { id: 't01-032', unit: 't01', field: '計算', type: 'input', q: `−60° の動径と同じ位置にある角は何度？（0° ≦ θ ＜ 360°）${N}`, answers: ['300', '300°'], exp: '−60° ＋ 360° ＝ 300°。' },

  // ---- 二次試験 三角関数の定義と相互関係 ----
  { id: 't02-022', unit: 't02', field: '計算', type: 'input', q: `sin(π/6) の値は？${F}`, answers: ['1/2'], exp: 'π/6 ＝ 30°。sin 30° ＝ 1/2。' },
  { id: 't02-023', unit: 't02', field: '計算', type: 'input', q: `cos(2π/3) の値は？${F}`, answers: minus('1/2'), exp: '2π/3 ＝ 120°（第2象限）。x 座標が負なので cos は −1/2。' },
  { id: 't02-024', unit: 't02', field: '計算', type: 'input', q: `tan(π/4) の値は？${N}`, answers: ['1'], exp: 'π/4 ＝ 45°。tan 45° ＝ 1。' },
  { id: 't02-025', unit: 't02', field: '計算', type: 'input', q: `sin(π/2) の値は？${N}`, answers: ['1'], exp: '単位円で π/2 の点は (0, 1)。y 座標なので sin ＝ 1。' },
  { id: 't02-026', unit: 't02', field: '計算', type: 'input', q: `cos(π/2) の値は？${N}`, answers: ['0'], exp: '単位円で π/2 の点は (0, 1)。x 座標なので cos ＝ 0。' },
  { id: 't02-027', unit: 't02', field: '性質', type: 'input', q: 'θ が第2象限の角のとき、sinθ の符号は？（＋ か − で答える）', answers: ['+', 'プラス', '正', 'せい'], yomi: ['正|せい'], exp: '第2象限は左上。y 座標が正なので sin は ＋、x 座標が負なので cos は −。' },
  { id: 't02-028', unit: 't02', field: '計算', type: 'input', q: `sinθ ＝ 4/5 で、θ が第1象限の角のとき、cosθ の値は？${F}`, answers: ['3/5'], exp: 'cos²θ ＝ 1 − 16/25 ＝ 9/25。第1象限なので cosθ ＝ 3/5。' },
  { id: 't02-029', unit: 't02', field: '計算', type: 'input', q: `cosθ ＝ 5/13 で、θ が第4象限の角のとき、sinθ の値は？${F}`, answers: minus('12/13'), exp: 'sin²θ ＝ 1 − 25/169 ＝ 144/169。第4象限は y が負なので −12/13。' },
  { id: 't02-030', unit: 't02', field: '計算', type: 'input', q: `tanθ ＝ 1 のとき、cos²θ の値は？${F}`, answers: ['1/2'], exp: '1 ＋ tan²θ ＝ 1/cos²θ → 2 ＝ 1/cos²θ → cos²θ ＝ 1/2。' },
  { id: 't02-031', unit: 't02', field: '性質', type: 'input', q: 'θ が第3象限の角のとき、sinθ・cosθ・tanθ のうち、値が正になるのはどれ？（英字3文字）', answers: ['tan', 'tanθ', 'タンジェント'], exp: '第3象限は x も y も負。tan ＝ y/x は 負÷負 で正。' },
  { id: 't02-032', unit: 't02', field: '用語', type: 'input', q: '単位円周上の点 P(x, y) で、x 座標を表すのは sinθ と cosθ のどちら？（英字3文字）', answers: ['cos', 'cosθ', 'コサイン'], exp: 'P(cosθ, sinθ)。x が cos、y が sin。' },

  // ---- 三次試験 三角関数の性質とグラフ ----
  { id: 't03-022', unit: 't03', field: '性質', type: 'input', q: `y ＝ cosθ の周期は □π。□に入る数は？${N}`, answers: ['2'], exp: 'sin も cos も周期は 2π。tan だけ π。' },
  { id: 't03-023', unit: 't03', field: '性質', type: 'input', q: `y ＝ sin 3θ の周期は □π/3。□に入る数は？${N}`, answers: ['2'], exp: 'sin kθ の周期は 2π/k。2π/3。' },
  { id: 't03-024', unit: 't03', field: '性質', type: 'input', q: `y ＝ 2 sinθ の最大値は？${N}`, answers: ['2'], exp: '−1 ≦ sinθ ≦ 1 なので −2 ≦ 2 sinθ ≦ 2。' },
  { id: 't03-025', unit: 't03', field: '性質', type: 'input', q: `y ＝ 3 cosθ の最小値は？${N}`, answers: minus(3), exp: '−1 ≦ cosθ ≦ 1 なので、3 cosθ の最小値は −3。' },
  { id: 't03-026', unit: 't03', field: '性質', type: 'input', q: `y ＝ sin(θ/2) の周期は □π。□に入る数は？${N}`, answers: ['4'], exp: '2π ÷ (1/2) ＝ 4π。' },
  { id: 't03-027', unit: 't03', field: '性質', type: 'input', q: 'cos(−θ) ＝ □θ。□に入るのは sin・cos・tan のどれ？（英字3文字）', answers: ['cos'], exp: 'cos は偶関数なので cos(−θ) ＝ cosθ。' },
  { id: 't03-028', unit: 't03', field: '性質', type: 'input', q: 'sin(−θ) ＝ −□θ。□に入るのは sin・cos・tan のどれ？（英字3文字）', answers: ['sin'], exp: 'sin は奇関数なので sin(−θ) ＝ −sinθ。' },
  { id: 't03-029', unit: 't03', field: '性質', type: 'input', q: 'sin(π − θ) ＝ □θ。□に入るのは sin・cos・tan のどれ？（英字3文字）', answers: ['sin'], exp: '単位円で θ と π − θ の点は y 軸について対称。y 座標（sin）は同じ。' },
  { id: 't03-030', unit: 't03', field: '性質', type: 'input', q: 'cos(π − θ) ＝ −□θ。□に入るのは sin・cos・tan のどれ？（英字3文字）', answers: ['cos'], exp: 'y 軸について対称なので、x 座標（cos）は符号だけ変わる。' },
  { id: 't03-031', unit: 't03', field: '性質', type: 'input', q: 'y ＝ cosθ のグラフは、何に関して対称？（〇軸）', answers: ['y軸', 'わいじく', 'y'], yomi: ['y 軸|じく'], exp: 'cos(−θ) ＝ cosθ（偶関数）なので、y 軸に関して対称。' },
  { id: 't03-032', unit: 't03', field: '用語', type: 'input', q: 'y ＝ cosθ は、偶関数と奇関数のどちら？', answers: ['偶関数', 'ぐうかんすう'], yomi: ['偶|ぐう 関|かん 数|すう'], exp: 'cos(−θ) ＝ cosθ なので偶関数。sin と tan は奇関数。' },

  // ---- 四次試験 三角関数の方程式と不等式 ----
  { id: 't04-022', unit: 't04', field: '計算', type: 'input', q: `sinθ ＝ √3/2（0° ≦ θ ≦ 90°）の θ は何度？${N}`, answers: ['60', '60°'], exp: '30°・60°・90° の三角形で考える。sin 60° ＝ √3/2。' },
  { id: 't04-023', unit: 't04', field: '計算', type: 'input', q: `cosθ ＝ 1/2（0° ≦ θ ≦ 180°）の θ は何度？${N}`, answers: ['60', '60°'], exp: 'cos 60° ＝ 1/2。' },
  { id: 't04-024', unit: 't04', field: '計算', type: 'input', q: `cosθ ＝ −1/2（0° ≦ θ ≦ 180°）の θ は何度？${N}`, answers: ['120', '120°'], exp: 'x 座標が −1/2 になるのは第2象限の 120°。' },
  { id: 't04-025', unit: 't04', field: '計算', type: 'input', q: `tanθ ＝ √3（0° ≦ θ ＜ 90°）の θ は何度？${N}`, answers: ['60', '60°'], exp: 'tan 60° ＝ √3。' },
  { id: 't04-026', unit: 't04', field: '計算', type: 'input', q: `sinθ ＝ −1（0° ≦ θ ＜ 360°）の θ は何度？${N}`, answers: ['270', '270°'], exp: '単位円で y 座標が −1 になるのは真下の点 (0, −1)。270°。' },
  { id: 't04-027', unit: 't04', field: '性質', type: 'input', q: `0 ≦ θ ＜ 2π で、sinθ ＝ 1/2 を満たす θ は何個？${N}`, answers: ['2'], exp: 'π/6 と 5π/6 の 2 個。直線 y ＝ 1/2 と単位円の交点は 2 つ。' },
  { id: 't04-028', unit: 't04', field: '性質', type: 'input', q: `0 ≦ θ ＜ 2π で、tanθ ＝ 1 を満たす θ は何個？${N}`, answers: ['2'], exp: 'π/4 と 5π/4 の 2 個。tan の周期は π。' },
  { id: 't04-029', unit: 't04', field: '計算', type: 'input', q: `cosθ ＝ 0（0 ≦ θ ＜ 2π）の解は π/2 と □π/2。□に入る数は？${N}`, answers: ['3'], exp: 'x 座標が 0 になるのは真上 (π/2) と真下 (3π/2)。' },
  { id: 't04-030', unit: 't04', field: '計算', type: 'input', q: `sinθ ＝ 1/2（0 ≦ θ ＜ 2π）の解は π/6 と □π/6。□に入る数は？${N}`, answers: ['5'], exp: 'π − π/6 ＝ 5π/6。' },
  { id: 't04-031', unit: 't04', field: '性質', type: 'input', q: `sinθ ＝ 2 を満たす θ は何個？${N}`, answers: ['0'], exp: '−1 ≦ sinθ ≦ 1 なので、2 になることはない。' },
  { id: 't04-032', unit: 't04', field: '性質', type: 'input', q: `sinθ ＝ t とおいたとき、t がとれるいちばん大きい値は？${N}`, answers: ['1'], exp: '−1 ≦ t ≦ 1。置きかえたら必ず t の範囲を書く。' },

  // ---- 五次試験 加法定理 ----
  { id: 't05-022', unit: 't05', field: '性質', type: 'input', q: 'sin(α ＋ β) ＝ sinα cosβ ＋ □α sinβ。□に入るのは sin・cos のどちら？（英字3文字）', answers: ['cos'], exp: '「サイン・コサイン・コサイン・サイン」の順。' },
  { id: 't05-023', unit: 't05', field: '性質', type: 'input', q: 'cos(α ＋ β) ＝ cosα cosβ □ sinα sinβ。□に入る符号は？（＋ か − で答える）', answers: ['-', '−', 'マイナス'], exp: 'cos の加法定理は符号が逆になる。cos(α ＋ β) は −、cos(α − β) は ＋。' },
  { id: 't05-024', unit: 't05', field: '性質', type: 'input', q: 'cos(α − β) ＝ cosα cosβ □ sinα sinβ。□に入る符号は？（＋ か − で答える）', answers: ['+', 'プラス'], exp: 'cos(α − β) ＝ cosα cosβ ＋ sinα sinβ。' },
  { id: 't05-025', unit: 't05', field: '計算', type: 'input', q: `15° ＝ 45° − □°。□に入る数は？${N}`, answers: ['30'], exp: 'sin 15° ＝ sin(45° − 30°) として加法定理を使う。' },
  { id: 't05-026', unit: 't05', field: '計算', type: 'input', q: `165° ＝ 120° ＋ □°。□に入る数は？${N}`, answers: ['45'], exp: '値を知っている角（30°・45°・60° など）に分ける。' },
  { id: 't05-027', unit: 't05', field: '計算', type: 'input', q: `sin 45° cos 45° ＋ cos 45° sin 45° ＝ sin □°。□に入る数は？${N}`, answers: ['90'], exp: 'sin(45° ＋ 45°) ＝ sin 90° ＝ 1。' },
  { id: 't05-028', unit: 't05', field: '計算', type: 'input', q: `cos 50° cos 10° − sin 50° sin 10° ＝ cos □°。□に入る数は？${N}`, answers: ['60'], exp: 'cos(50° ＋ 10°) ＝ cos 60°。' },
  { id: 't05-029', unit: 't05', field: '計算', type: 'input', q: `sin 80° cos 20° − cos 80° sin 20° ＝ sin □°。□に入る数は？${N}`, answers: ['60'], exp: 'sin(80° − 20°) ＝ sin 60°。' },
  { id: 't05-030', unit: 't05', field: '計算', type: 'input', q: `cos 60° cos 30° − sin 60° sin 30° ＝ cos □°。□に入る数は？${N}`, answers: ['90'], exp: 'cos(60° ＋ 30°) ＝ cos 90° ＝ 0。' },
  { id: 't05-031', unit: 't05', field: '計算', type: 'input', q: `tanα ＝ 1/2、tanβ ＝ 1/3 のとき、tan(α ＋ β) の値は？${N}`, answers: ['1'], exp: '(1/2 ＋ 1/3) ÷ (1 − 1/6) ＝ (5/6) ÷ (5/6) ＝ 1。' },
  { id: 't05-032', unit: 't05', field: '計算', type: 'input', q: `tanα ＝ 1、tanβ ＝ 1 のとき、tan(α ＋ β) の分母 1 − tanα tanβ の値は？${N}`, answers: ['0'], exp: '分母が 0 なので値はない。α ＋ β ＝ 90° で tan 90° は定義されない。' },

  // ---- 六次試験 2倍角と半角の公式 ----
  { id: 't06-022', unit: 't06', field: '性質', type: 'input', q: 'sin 2α ＝ 2 sinα □α。□に入るのは sin・cos のどちら？（英字3文字）', answers: ['cos'], exp: 'sin(α ＋ α) ＝ sinα cosα ＋ cosα sinα ＝ 2 sinα cosα。' },
  { id: 't06-023', unit: 't06', field: '性質', type: 'input', q: `cos 2α ＝ 1 − □sin²α。□に入る数は？${N}`, answers: ['2'], exp: 'cos 2α ＝ cos²α − sin²α ＝ 1 − 2sin²α ＝ 2cos²α − 1。' },
  { id: 't06-024', unit: 't06', field: '性質', type: 'input', q: `cos 2α ＝ 2cos²α − □。□に入る数は？${N}`, answers: ['1'], exp: 'cos²α − sin²α の sin²α を 1 − cos²α に直すと 2cos²α − 1。' },
  { id: 't06-025', unit: 't06', field: '計算', type: 'input', q: `sinα ＝ 5/13、cosα ＝ 12/13 のとき、sin 2α の値は？${F}`, answers: ['120/169'], exp: 'sin 2α ＝ 2 × 5/13 × 12/13 ＝ 120/169。' },
  { id: 't06-026', unit: 't06', field: '計算', type: 'input', q: `cosα ＝ 1/2 のとき、cos 2α の値は？${F}`, answers: minus('1/2'), exp: 'cos 2α ＝ 2cos²α − 1 ＝ 2 × 1/4 − 1 ＝ −1/2。' },
  { id: 't06-027', unit: 't06', field: '計算', type: 'input', q: `sinα ＝ 1/2 のとき、cos 2α の値は？${F}`, answers: ['1/2'], exp: 'cos 2α ＝ 1 − 2sin²α ＝ 1 − 2 × 1/4 ＝ 1/2。' },
  { id: 't06-028', unit: 't06', field: '計算', type: 'input', q: `2 sin 15° cos 15° ＝ sin □°。□に入る数は？${N}`, answers: ['30'], exp: '2倍角の公式で sin(2 × 15°) ＝ sin 30°。' },
  { id: 't06-029', unit: 't06', field: '計算', type: 'input', q: `cos²15° − sin²15° ＝ cos □°。□に入る数は？${N}`, answers: ['30'], exp: 'cos 2α ＝ cos²α − sin²α で α ＝ 15°。' },
  { id: 't06-030', unit: 't06', field: '計算', type: 'input', q: `1 − 2sin²22.5° ＝ cos □°。□に入る数は？${N}`, answers: ['45'], exp: 'cos 2α ＝ 1 − 2sin²α で α ＝ 22.5°。2α ＝ 45°。' },
  { id: 't06-031', unit: 't06', field: '性質', type: 'input', q: `半角の公式 sin²α ＝ (1 − cos□α)/2。□に入る数は？${N}`, answers: ['2'], exp: 'cos 2α ＝ 1 − 2sin²α を sin²α について解いた形。' },
  { id: 't06-032', unit: 't06', field: '計算', type: 'input', q: `tanα ＝ 1 のとき、tan 2α の分母 1 − tan²α の値は？${N}`, answers: ['0'], exp: '分母が 0 なので tan 2α は定義されない（2α ＝ 90°）。' },

  // ---- 七次試験 三角関数の合成 ----
  { id: 't07-022', unit: 't07', field: '計算', type: 'input', q: `√3 sinθ ＋ cosθ ＝ □ sin(θ ＋ π/6)。□に入る数は？${N}`, answers: ['2'], exp: 'r ＝ √(3 ＋ 1) ＝ 2。点 (√3, 1) の角は π/6。' },
  { id: 't07-023', unit: 't07', field: '計算', type: 'input', q: `sinθ ＋ cosθ ＝ √2 sin(θ ＋ π/□)。□に入る数は？${N}`, answers: ['4'], exp: '点 (1, 1) の角は π/4。r ＝ √2。' },
  { id: 't07-024', unit: 't07', field: '計算', type: 'input', q: `4 sinθ ＋ 3 cosθ の最大値は？${N}`, answers: ['5'], exp: 'r ＝ √(16 ＋ 9) ＝ 5。最大値は r。' },
  { id: 't07-025', unit: 't07', field: '計算', type: 'input', q: `3 sinθ ＋ 4 cosθ の最小値は？${N}`, answers: minus(5), exp: 'r ＝ 5。−1 ≦ sin(θ ＋ α) ≦ 1 なので最小値は −5。' },
  { id: 't07-026', unit: 't07', field: '計算', type: 'input', q: `8 sinθ ＋ 6 cosθ の最大値は？${N}`, answers: ['10'], exp: 'r ＝ √(64 ＋ 36) ＝ 10。' },
  { id: 't07-027', unit: 't07', field: '計算', type: 'input', q: `12 sinθ − 5 cosθ の最大値は？${N}`, answers: ['13'], exp: 'r ＝ √(144 ＋ 25) ＝ 13。符号は最大値に関係しない。' },
  { id: 't07-028', unit: 't07', field: '計算', type: 'input', q: `sinθ ＋ cosθ を r sin(θ ＋ α) にしたとき、r² の値は？${N}`, answers: ['2'], exp: 'r² ＝ 1² ＋ 1² ＝ 2。r ＝ √2。' },
  { id: 't07-029', unit: 't07', field: '計算', type: 'input', q: `sinθ ＋ √3 cosθ を合成する。角 α は点 (1, √3) の動径の角。α は何度？${N}`, answers: ['60', '60°'], exp: '点 (1, √3) は x 軸から 60° の方向。sinθ ＋ √3 cosθ ＝ 2 sin(θ ＋ 60°)。' },
  { id: 't07-030', unit: 't07', field: '計算', type: 'input', q: `√3 sinθ ＋ cosθ を合成する。角 α は点 (√3, 1) の動径の角。α は何度？${N}`, answers: ['30', '30°'], exp: '点 (√3, 1) は x 軸から 30° の方向。' },
  { id: 't07-031', unit: 't07', field: '計算', type: 'input', q: `sinθ − cosθ を合成する。角 α は点 (1, −1) の動径の角（−180° ＜ α ≦ 180°）。α は何度？${N}`, answers: [...minus(45), '-45°', '−45°'], exp: '点 (1, −1) は第4象限で、x 軸から時計回りに 45°。' },
  { id: 't07-032', unit: 't07', field: '計算', type: 'input', q: `√3 sinθ − cosθ の最小値は？${N}`, answers: minus(2), exp: 'r ＝ √(3 ＋ 1) ＝ 2。最小値は −2。' },
];
