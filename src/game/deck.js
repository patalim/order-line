import { shuffle } from './rng.js';

// 牌面內容的比對鍵：文字去頭尾空白；圖片用 data URL 本身（同一張圖縮圖結果相同）。
export const contentKey = (c) => `${c.type}:${c.type === 'text' ? c.value.trim() : c.value}`;

// pairs: [{ id, a: {type, value}, b: {type, value} }]
// 從題庫隨機抽 pairCount 組，每組產生兩張牌，再整副洗牌。
// 每張牌帶 key（自己的牌面）與 partnerKey（它的配對對象的牌面）；
// 多組配對共用同一個答案時（3+4 → 7、5+2 → 7），牌面相同的牌就能互換。
export function buildDeck(pairs, pairCount, rng = Math.random) {
  if (!Number.isInteger(pairCount) || pairCount < 1) {
    throw new RangeError('組數必須是正整數');
  }
  if (pairCount > pairs.length) {
    throw new RangeError(`題庫只有 ${pairs.length} 組配對，不足 ${pairCount} 組`);
  }
  const cards = [];
  for (const pair of shuffle(pairs, rng).slice(0, pairCount)) {
    const [ka, kb] = [contentKey(pair.a), contentKey(pair.b)];
    cards.push({ pairId: pair.id, content: pair.a, key: ka, partnerKey: kb });
    cards.push({ pairId: pair.id, content: pair.b, key: kb, partnerKey: ka });
  }
  return shuffle(cards, rng).map((card, i) => ({ id: i, ...card }));
}
