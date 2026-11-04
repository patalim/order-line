// 內建範例題庫（純文字／emoji，不需上傳圖片）。
const emoji = (value) => ({ type: 'text', value });
const word = (value) => ({ type: 'text', value });

const animals = [
  ['🐶', '狗'], ['🐱', '貓'], ['🐰', '兔子'], ['🐻', '熊'], ['🐼', '貓熊'],
  ['🐘', '大象'], ['🦒', '長頸鹿'], ['🐸', '青蛙'], ['🐧', '企鵝'], ['🐢', '烏龜'],
  ['🦁', '獅子'], ['🐵', '猴子'], ['🐷', '豬'], ['🐮', '牛'], ['🐔', '雞'],
  ['🐟', '魚'], ['🦆', '鴨子'], ['🐴', '馬'],
];

const arithmetic = [
  ['3 + 4', '7'], ['6 + 5', '11'], ['8 + 9', '17'], ['12 − 5', '7'], ['15 − 8', '7'],
  ['2 × 6', '12'], ['3 × 7', '21'], ['4 × 8', '32'], ['5 × 9', '45'], ['6 × 6', '36'],
  ['18 ÷ 3', '6'], ['24 ÷ 4', '6'], ['35 ÷ 5', '7'], ['9 + 9', '18'], ['20 − 11', '9'],
  ['7 × 8', '56'], ['9 × 4', '36'], ['40 ÷ 8', '5'],
];

const toPairs = (prefix, rows, left, right) =>
  rows.map(([a, b], i) => ({ id: `${prefix}${i}`, a: left(a), b: right(b) }));

export const sampleBanks = [
  { id: 'sample-animals', name: '動物（圖配字）', pairs: toPairs('an', animals, emoji, word) },
  { id: 'sample-math', name: '算式配答案', pairs: toPairs('ma', arithmetic, word, word) },
];
