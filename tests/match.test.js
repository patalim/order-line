import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchRound, createMatchState, pickMatch, checkMatchLinks, revealMatchRound, matchCorrect } from '../src/game/match.js';
import { seededRng } from '../src/game/rng.js';

const text = (value) => ({ type: 'text', value });
const pair = (id, value) => ({ id, a: text(id), value });
const pairs = [pair('a', 5), pair('b', 1), pair('c', 9), pair('d', 3), { id: 'x', a: text('x'), b: text('y') }];

const round4 = () => buildMatchRound(pairs.slice(0, 4), 4, seededRng(1));
const rightOf = (round, id) => round.right.findIndex((r) => r.owner === id);
// 連一條線：先點左邊再點右邊
const link = (round, state, leftId, rightIndex) => pickMatch(round, pickMatch(round, state, 'L', leftId), 'R', rightIndex);

test('buildMatchRound：不需要數值，右邊是同一批第二張牌', () => {
  const round = round4();
  assert.equal(round.cards.length, 4);
  assert.deepEqual(round.cards.map((c) => c.id).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(round.right.map((r) => r.content.value).sort(), ['1', '3', '5', '9']); // 沒有 b 時由數值產生
  assert.deepEqual(round.right.map((r) => r.index), [0, 1, 2, 3]);
  assert.deepEqual(buildMatchRound(pairs, 4, seededRng(9)).right, buildMatchRound(pairs, 4, seededRng(9)).right);
  assert.throws(() => buildMatchRound(pairs, 1), RangeError);
  assert.throws(() => buildMatchRound(pairs, 6), /不足/); // 題庫只有 5 組

  const all = buildMatchRound(pairs, 5, seededRng(3)); // 沒有數值、只有兩張牌的配對也能玩
  assert.deepEqual(all.cards.map((c) => c.id).sort(), ['a', 'b', 'c', 'd', 'x']);
  assert.ok(all.right.some((r) => r.content.value === 'y'));
});

test('任意配對：文字配文字、圖片配文字、文字配圖片，以第二張牌的牌面判定', () => {
  const img = (v) => ({ type: 'image', value: `data:image/png;base64,${v}` });
  const mixed = [
    { id: 'p1', a: img('AAAA'), b: text('貓') },
    { id: 'p2', a: text('dog'), b: img('BBBB') },
    { id: 'p3', a: text('3 + 4'), b: text('7') },
    { id: 'p4', a: text('5 + 2'), b: text('7') }, // 兩題共用同一個答案
  ];
  const round = buildMatchRound(mixed, 4, seededRng(5));
  const at = (id) => round.right.findIndex((r) => r.owner === id);
  assert.equal(matchCorrect(round, 'p1', at('p1')), true);
  assert.equal(matchCorrect(round, 'p2', at('p2')), true);
  assert.equal(matchCorrect(round, 'p1', at('p2')), false);
  assert.equal(matchCorrect(round, 'p3', at('p4')), true); // 答案牌面相同，互換也對
  assert.equal(matchCorrect(round, 'p4', at('p3')), true);
  assert.equal(matchCorrect(round, 'p3', at('p1')), false);
  let s = createMatchState();
  for (const id of ['p1', 'p2', 'p3', 'p4']) s = link(round, s, id, at(id));
  assert.equal(revealMatchRound(round, s).perfect, true);
});

test('pickMatch：先點左再點右就連線；先點右再點左也行', () => {
  const round = round4();
  let s = pickMatch(round, createMatchState(), 'L', 'a');
  assert.deepEqual(s.sel, { side: 'L', key: 'a' });
  s = pickMatch(round, s, 'R', 2);
  assert.deepEqual(s.links, { a: 2 });
  assert.equal(s.sel, null);
  s = pickMatch(round, s, 'R', 3);
  s = pickMatch(round, s, 'L', 'b');
  assert.deepEqual(s.links, { a: 2, b: 3 });
});

test('pickMatch：一對一，新的線會取代兩端原有的線', () => {
  const round = round4();
  let s = link(round, createMatchState(), 'a', 0);
  s = link(round, s, 'a', 1); // 同一個左邊換右邊 → 舊線消失
  assert.deepEqual(s.links, { a: 1 });
  s = pickMatch(round, s, 'L', 'b'); // 選 b，再點已被 a 連走的右邊 1
  s = pickMatch(round, s, 'R', 1);
  assert.deepEqual(s.links, { b: 1 }); // a 的線被搶走
});

test('pickMatch：點已連線的項目 → 拆線並選取；再點一次取消選取', () => {
  const round = round4();
  let s = link(round, createMatchState(), 'a', 2);
  s = pickMatch(round, s, 'L', 'a');
  assert.deepEqual(s.links, {});
  assert.deepEqual(s.sel, { side: 'L', key: 'a' });
  s = pickMatch(round, s, 'L', 'a');
  assert.equal(s.sel, null);
  s = link(round, s, 'b', 0);
  s = pickMatch(round, s, 'R', 0); // 從右邊點已連線的項目
  assert.deepEqual(s.links, {});
  assert.deepEqual(s.sel, { side: 'R', key: 0 });
  s = pickMatch(round, s, 'R', 1); // 同一邊改選另一個
  assert.deepEqual(s.sel, { side: 'R', key: 1 });
});

test('核對：答對鎖定、答錯標記；不洩漏答案', () => {
  const round = round4();
  let s = createMatchState();
  s = link(round, s, 'a', rightOf(round, 'a')); // 對
  s = link(round, s, 'b', rightOf(round, 'c')); // 錯
  const r = checkMatchLinks(round, s);
  assert.deepEqual(r.state.locked, ['a']);
  assert.deepEqual(r.state.flagged, ['b']);
  assert.equal(r.correct, 1);
  assert.equal(r.wrong, 1);
  assert.equal(r.linked, 2);
  assert.equal(r.total, 4);
  assert.equal(checkMatchLinks(round, createMatchState()).linked, 0);
});

test('核對後：鎖定的線不能改；下一位玩家第一次操作會清掉錯的線', () => {
  const round = round4();
  let s = link(round, createMatchState(), 'a', rightOf(round, 'a'));
  s = link(round, s, 'b', rightOf(round, 'c'));
  s = checkMatchLinks(round, s).state;

  assert.equal(pickMatch(round, s, 'L', 'a'), s); // 鎖定的左邊：完全忽略
  assert.equal(pickMatch(round, s, 'R', rightOf(round, 'a')), s); // 鎖定的右邊也一樣

  const next = pickMatch(round, s, 'L', 'c'); // 開始新操作
  assert.deepEqual(next.links, { a: rightOf(round, 'a') }); // b 的錯線被清掉
  assert.deepEqual(next.flagged, []);
  assert.deepEqual(next.locked, ['a']);
  assert.deepEqual(next.sel, { side: 'L', key: 'c' });

  // 接著把剩下的連對，再核對一次：鎖定累加
  let t = pickMatch(round, next, 'R', rightOf(round, 'c'));
  t = link(round, t, 'b', rightOf(round, 'b'));
  const again = checkMatchLinks(round, t);
  assert.deepEqual([...again.state.locked].sort(), ['a', 'b', 'c']);
  assert.equal(again.wrong, 0);
});

test('數值相同（並列）連到任一個都算對', () => {
  const tied = [pair('p', 4), pair('q', 4), pair('r', 8)];
  const round = buildMatchRound(tied, 3, seededRng(2));
  const pRight = rightOf(round, 'p');
  const qRight = rightOf(round, 'q');
  assert.equal(matchCorrect(round, 'p', qRight), true); // p 連到 q 的 4 也對
  assert.equal(matchCorrect(round, 'p', rightOf(round, 'r')), false);
  let s = link(round, createMatchState(), 'p', qRight);
  s = link(round, s, 'q', pRight);
  s = link(round, s, 'r', rightOf(round, 'r'));
  const done = revealMatchRound(round, s);
  assert.equal(done.perfect, true);
});

test('揭曉：算對幾組、未連的算錯、回傳每一組的正確答案；之後不能再點', () => {
  const round = round4();
  let s = link(round, createMatchState(), 'a', rightOf(round, 'a'));
  s = link(round, s, 'b', rightOf(round, 'c'));
  const r = revealMatchRound(round, s); // c、d 沒連
  assert.equal(r.correct, 1);
  assert.equal(r.total, 4);
  assert.equal(r.perfect, false);
  const byId = Object.fromEntries(r.results.map((x) => [x.id, x]));
  assert.equal(byId.a.ok, true);
  assert.equal(byId.b.ok, false);
  assert.equal(byId.b.answer, rightOf(round, 'b'));
  assert.equal(byId.c.linkedTo, undefined);
  assert.equal(byId.c.answer, rightOf(round, 'c'));
  assert.equal(r.state.revealed, true);
  assert.equal(pickMatch(round, r.state, 'L', 'c'), r.state);
});
