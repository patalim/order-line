import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSortRound, checkSort } from '../src/game/sort.js';
import { createScore, addToScore } from '../src/game/score.js';
import { seededRng } from '../src/game/rng.js';

const text = (value) => ({ type: 'text', value });
const pair = (id, value) => ({ id, a: text(id), value });
const pairs = [pair('a', 5), pair('b', 1), pair('c', 9), pair('d', 3), pair('e', 7), { id: 'x', a: text('x'), b: text('y') }];
const ids = (list) => list.map((p) => p.id);

test('buildSortRound：只抽有數值的配對，answer 依方向排序', () => {
  const asc = buildSortRound(pairs, 4, 'asc', seededRng(1));
  assert.equal(asc.cards.length, 4);
  assert.ok(!ids(asc.cards).includes('x'));
  assert.deepEqual(asc.answer.map((p) => p.value), [...asc.answer.map((p) => p.value)].sort((m, n) => m - n));
  const desc = buildSortRound(pairs, 5, 'desc', seededRng(2));
  assert.deepEqual(desc.answer.map((p) => p.value), [9, 7, 5, 3, 1]);
  assert.deepEqual(ids(desc.cards).sort(), ['a', 'b', 'c', 'd', 'e']);
});

test('buildSortRound：同一個種子結果相同；開局不會剛好排好', () => {
  assert.deepEqual(ids(buildSortRound(pairs, 5, 'asc', seededRng(7)).cards), ids(buildSortRound(pairs, 5, 'asc', seededRng(7)).cards));
  for (let seed = 0; seed < 200; seed++) {
    const r = buildSortRound(pairs, 3, 'asc', seededRng(seed));
    assert.notDeepEqual(r.cards.map((p) => p.value), r.answer.map((p) => p.value), `seed ${seed}`);
  }
});

test('buildSortRound：數值全部相同時不會無限重試', () => {
  const same = [pair('p', 4), pair('q', 4), pair('r', 4)];
  assert.equal(buildSortRound(same, 3, 'asc', seededRng(1)).cards.length, 3);
});

test('buildSortRound：參數不合法時丟出錯誤', () => {
  assert.throws(() => buildSortRound(pairs, 1), RangeError);
  assert.throws(() => buildSortRound(pairs, 2.5), RangeError);
  assert.throws(() => buildSortRound(pairs, 6), /不足/); // 只有 5 組有數值
});

test('checkSort：全對、部分對、順序相反', () => {
  const round = buildSortRound(pairs, 5, 'asc', seededRng(3));
  const perfect = checkSort(round, ids(round.answer));
  assert.equal(perfect.perfect, true);
  assert.equal(perfect.correct, 5);
  const reversed = checkSort(round, ids(round.answer).reverse());
  assert.equal(reversed.correct, 1); // 只有正中間那張剛好在原位
  assert.deepEqual(reversed.results.map((r) => r.ok), [false, false, true, false, false]);
  const swapped = ids(round.answer);
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.equal(checkSort(round, swapped).correct, 3);
});

test('checkSort：數值相同的牌（並列）任何順序都算對', () => {
  const tied = [pair('p', 2), pair('q', 5), pair('r', 5), pair('s', 8)];
  const round = buildSortRound(tied, 4, 'asc', seededRng(4));
  assert.equal(checkSort(round, ['p', 'q', 'r', 's']).perfect, true);
  assert.equal(checkSort(round, ['p', 'r', 'q', 's']).perfect, true);
  assert.equal(checkSort(round, ['q', 'p', 'r', 's']).correct, 2);
});

test('checkSort：排列和這一回合的牌不符時丟出錯誤', () => {
  const round = buildSortRound(pairs, 3, 'asc', seededRng(5));
  const [x, y, z] = ids(round.cards);
  assert.throws(() => checkSort(round, [x, y]), RangeError);
  assert.throws(() => checkSort(round, [x, x, y]), RangeError);
  assert.throws(() => checkSort(round, [x, y, 'zzz']), RangeError);
  assert.ok(z);
});

test('累計得分：不可變、逐回合累加', () => {
  const s0 = createScore();
  const s1 = addToScore(s0, 3, 4);
  const s2 = addToScore(s1, 4, 4);
  assert.deepEqual(s0, { total: 0, max: 0, rounds: 0 });
  assert.deepEqual(s2, { total: 7, max: 8, rounds: 2 });
});
