import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridSize, formatTime } from '../src/game/layout.js';

test('gridSize：標準難度', () => {
  assert.deepEqual(gridSize(16), { cols: 4, rows: 4 });
  assert.deepEqual(gridSize(36), { cols: 6, rows: 6 });
});

test('gridSize：自選牌數一律排得下所有牌', () => {
  for (let pairs = 1; pairs <= 40; pairs++) {
    const n = pairs * 2;
    const { cols, rows } = gridSize(n);
    assert.ok(cols * rows >= n, `${n} 張排不下`);
    assert.ok(cols * rows - n < cols, `${n} 張多出整列空位`);
  }
});

test('gridSize：不合法的牌數丟錯', () => {
  assert.throws(() => gridSize(0), RangeError);
});

test('formatTime', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(125000), '2:05');
  assert.equal(formatTime(59999), '0:59');
});
