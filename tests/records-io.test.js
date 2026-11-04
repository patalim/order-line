import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordKey, updateRecord, sanitizeRecord } from '../src/game/records.js';
import { exportBank, parseImport, FILE_VERSION } from '../src/store/bank-io.js';
import { validateBank, LIMITS } from '../src/store/bank-model.js';
import { sampleBanks } from '../src/data/samples.js';

test('recordKey：題庫與牌數分開記', () => {
  assert.notEqual(recordKey('b', 16), recordKey('b', 36));
  assert.notEqual(recordKey('a', 16), recordKey('b', 16));
});

test('recordKey：記憶模式與一般模式分開，一般模式的 key 不變', () => {
  assert.equal(recordKey('b', 16), 'b|16');
  assert.equal(recordKey('b', 16, false), 'b|16');
  assert.notEqual(recordKey('b', 16, true), recordKey('b', 16));
});

test('updateRecord：第一次兩項都算新紀錄', () => {
  const r = updateRecord(null, { moves: 12, timeMs: 30000 });
  assert.deepEqual(r, { record: { bestMoves: 12, bestTimeMs: 30000 }, newMoves: true, newTime: true });
});

test('updateRecord：步數與時間各自比較', () => {
  const prev = { bestMoves: 10, bestTimeMs: 40000 };
  const r = updateRecord(prev, { moves: 9, timeMs: 50000 });
  assert.deepEqual(r, { record: { bestMoves: 9, bestTimeMs: 40000 }, newMoves: true, newTime: false });
});

test('updateRecord：平手不算破紀錄，也不改動舊紀錄物件', () => {
  const prev = { bestMoves: 10, bestTimeMs: 40000 };
  const r = updateRecord(prev, { moves: 10, timeMs: 40000 });
  assert.equal(r.newMoves, false);
  assert.equal(r.newTime, false);
  assert.deepEqual(prev, { bestMoves: 10, bestTimeMs: 40000 });
});

test('sanitizeRecord：壞資料回傳 null', () => {
  assert.deepEqual(sanitizeRecord({ bestMoves: 3, bestTimeMs: 1000, extra: 1 }), { bestMoves: 3, bestTimeMs: 1000 });
  for (const bad of [null, undefined, 5, 'x', {}, { bestMoves: '3', bestTimeMs: 1 }, { bestMoves: -1, bestTimeMs: 1 }, { bestMoves: NaN, bestTimeMs: 1 }, { bestMoves: 1 }]) {
    assert.equal(sanitizeRecord(bad), null);
  }
});

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const bank = {
  id: 'orig', name: '混合題庫', updatedAt: 1,
  pairs: [
    { id: 'p1', a: { type: 'image', value: PNG }, b: { type: 'text', value: '貓' } },
    { id: 'p2', a: { type: 'text', value: '1+1' }, b: { type: 'text', value: '2' } },
  ],
};

test('匯出再匯入：內容相同、id 全部換新、圖片保留', () => {
  const r = parseImport(exportBank(bank));
  assert.equal(r.ok, true);
  assert.equal(r.bank.name, '混合題庫');
  assert.notEqual(r.bank.id, 'orig');
  assert.notEqual(r.bank.pairs[0].id, 'p1');
  assert.deepEqual(r.bank.pairs.map((p) => [p.a, p.b]), bank.pairs.map((p) => [p.a, p.b]));
  assert.deepEqual(validateBank(r.bank), []);
});

test('匯出檔含格式標記與版本號', () => {
  const data = JSON.parse(exportBank(bank));
  assert.equal(data.format, 'memory-match-bank');
  assert.equal(data.version, FILE_VERSION);
});

test('內建題庫可匯出再匯入', () => {
  const r = parseImport(exportBank(sampleBanks[0]));
  assert.equal(r.ok, true);
  assert.equal(r.bank.pairs.length, sampleBanks[0].pairs.length);
});

const wrap = (inner, extra = {}) => JSON.stringify({ format: 'memory-match-bank', version: 1, bank: inner, ...extra });

test('匯入：格式不對一律拒絕', () => {
  assert.equal(parseImport('不是 json').ok, false);
  assert.equal(parseImport('null').ok, false);
  assert.equal(parseImport('[]').ok, false);
  assert.equal(parseImport(JSON.stringify({ version: 1, bank: {} })).ok, false);
  assert.equal(parseImport(wrap(null)).ok, false);
  assert.equal(parseImport(wrap({ name: 'x' })).ok, false);
});

test('匯入：版本號不對或較新就拒絕', () => {
  const inner = { name: 'x', pairs: [{ a: { type: 'text', value: 'a' }, b: { type: 'text', value: 'b' } }] };
  assert.equal(parseImport(wrap(inner, { version: FILE_VERSION + 1 })).ok, false);
  assert.equal(parseImport(wrap(inner, { version: 0 })).ok, false);
  assert.equal(parseImport(wrap(inner, { version: '1' })).ok, false);
  assert.equal(parseImport(wrap(inner)).ok, true);
});

test('匯入：全有或全無——只要一組壞了整個拒絕，且回報組號', () => {
  const good = { a: { type: 'text', value: 'a' }, b: { type: 'text', value: 'b' } };
  const r = parseImport(wrap({ name: 'x', pairs: [good, good, { a: { type: 'text', value: 'a' }, b: { type: 'text', value: '' } }] }));
  assert.equal(r.ok, false);
  assert.equal('bank' in r, false);
  assert.ok(r.errors.some((e) => e.includes('第 3 組')));
});

test('匯入：拒絕 SVG／網址／腳本圖片、空題庫、空名稱', () => {
  const text = { type: 'text', value: 't' };
  const img = (value) => wrap({ name: 'x', pairs: [{ a: { type: 'image', value }, b: text }] });
  assert.equal(parseImport(img('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).ok, false);
  assert.equal(parseImport(img('https://evil.example/a.png')).ok, false);
  assert.equal(parseImport(img('javascript:alert(1)')).ok, false);
  assert.equal(parseImport(img(PNG)).ok, true);
  assert.equal(parseImport(wrap({ name: 'x', pairs: [] })).ok, false);
  assert.equal(parseImport(wrap({ name: '  ', pairs: [{ a: text, b: text }] })).ok, false);
  assert.equal(parseImport(wrap({ name: 5, pairs: [{ a: text, b: text }] })).ok, false);
});

test('匯入：忽略多餘欄位，原型污染鍵不會進入結果', () => {
  const raw = '{"format":"memory-match-bank","version":1,"bank":{"name":"x","__proto__":{"polluted":1},"id":"hack","pairs":[{"id":"hack","extra":1,"a":{"type":"text","value":"a","onclick":"x"},"b":{"type":"text","value":"b"}}]}}';
  const r = parseImport(raw);
  assert.equal(r.ok, true);
  assert.notEqual(r.bank.id, 'hack');
  assert.notEqual(r.bank.pairs[0].id, 'hack');
  assert.deepEqual(Object.keys(r.bank.pairs[0]).sort(), ['a', 'b', 'id']);
  assert.deepEqual(r.bank.pairs[0].a, { type: 'text', value: 'a' });
  assert.equal({}.polluted, undefined);
});

test('匯入：配對數超過上限就拒絕', () => {
  const pair = { a: { type: 'text', value: 'a' }, b: { type: 'text', value: 'b' } };
  const r = parseImport(wrap({ name: 'x', pairs: Array.from({ length: LIMITS.pairsMax + 1 }, () => pair) }));
  assert.equal(r.ok, false);
});
