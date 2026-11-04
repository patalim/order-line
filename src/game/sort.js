import { shuffle } from './rng.js';
import { numericPairs } from './pair.js';

// 大小排序的規則（純函式，不碰 DOM 與儲存）。

export const SORT_MAX = 12;

// 從有數值的配對隨機抽 count 張。direction：'asc' 由小到大、'desc' 由大到小。
// 回傳 { direction, cards（打亂後的配對）, answer（正確順序的配對） }。
export function buildSortRound(pairs, count, direction = 'asc', rng = Math.random) {
  const pool = numericPairs(pairs);
  if (!Number.isInteger(count) || count < 2) throw new RangeError('張數至少要 2 張');
  if (count > pool.length) throw new RangeError(`有數值的配對只有 ${pool.length} 組，不足 ${count} 張`);
  const picked = shuffle(pool, rng).slice(0, count);
  const sign = direction === 'desc' ? -1 : 1;
  const answer = [...picked].sort((x, y) => sign * (x.value - y.value));
  const sameOrder = (cards) => cards.every((p, i) => p.value === answer[i].value);
  let cards = shuffle(picked, rng);
  // 避免一開始就剛好排好（全部數值都相同時無法避免，就不重試）。
  const distinct = new Set(picked.map((p) => p.value)).size > 1;
  for (let i = 0; i < 20 && distinct && sameOrder(cards); i++) cards = shuffle(cards, rng);
  return { direction, cards, answer };
}

// order：玩家排好的配對 id（由左到右）。依位置判定，數值相同（並列）的牌任何順序都算對。
export function checkSort(round, order) {
  const byId = new Map(round.cards.map((p) => [p.id, p]));
  if (order.length !== round.cards.length || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
    throw new RangeError('排列和這一回合的牌不符');
  }
  const results = order.map((id, i) => ({ id, ok: byId.get(id).value === round.answer[i].value }));
  const correct = results.filter((r) => r.ok).length;
  return { results, correct, total: results.length, perfect: correct === results.length };
}
