import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectImageType, fitSize } from '../src/store/image-format.js';
import { isValidContent, validateBank, cloneBank, createBank, blankPair, newId } from '../src/store/bank-model.js';
import { sampleBanks } from '../src/data/samples.js';

const bytes = (...b) => Uint8Array.from(b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

test('detectImageType：四種格式', () => {
  assert.equal(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), 'png');
  assert.equal(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'jpeg');
  assert.equal(detectImageType(bytes(...ascii('GIF89a'), 1, 0)), 'gif');
  assert.equal(detectImageType(bytes(...ascii('GIF87a'))), 'gif');
  assert.equal(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBPVP8 '))), 'webp');
});

test('detectImageType：SVG、HTML、空檔、WAV 都拒絕', () => {
  assert.equal(detectImageType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))), null);
  assert.equal(detectImageType(bytes(...ascii('<?xml version="1.0"?><svg/>'))), null);
  assert.equal(detectImageType(bytes(...ascii('<html>'))), null);
  assert.equal(detectImageType(bytes()), null);
  assert.equal(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVEfmt '))), null);
});

test('fitSize：最長邊縮到 600、維持比例、不放大', () => {
  assert.deepEqual(fitSize(1200, 600), { width: 600, height: 300 });
  assert.deepEqual(fitSize(600, 1800), { width: 200, height: 600 });
  assert.deepEqual(fitSize(300, 200), { width: 300, height: 200 });
  assert.deepEqual(fitSize(600, 600), { width: 600, height: 600 });
  assert.deepEqual(fitSize(10000, 1), { width: 600, height: 1 });
});

const PNG_URL = 'data:image/png;base64,iVBORw0KGgo=';
const text = (value) => ({ type: 'text', value });

test('isValidContent：文字', () => {
  assert.equal(isValidContent(text('蘋果')), true);
  assert.equal(isValidContent(text('   ')), false);
  assert.equal(isValidContent(text('字'.repeat(41))), false);
  assert.equal(isValidContent({ type: 'text', value: 5 }), false);
  assert.equal(isValidContent(null), false);
  assert.equal(isValidContent({ type: 'video', value: 'x' }), false);
});

test('isValidContent：圖片只接受四種 data URL，拒絕 SVG 與腳本', () => {
  assert.equal(isValidContent({ type: 'image', value: PNG_URL }), true);
  assert.equal(isValidContent({ type: 'image', value: 'data:image/jpeg;base64,/9j/4AAQ' }), true);
  assert.equal(isValidContent({ type: 'image', value: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }), false);
  assert.equal(isValidContent({ type: 'image', value: 'data:text/html;base64,PHNjcmlwdD4=' }), false);
  assert.equal(isValidContent({ type: 'image', value: 'https://example.com/a.png' }), false);
  assert.equal(isValidContent({ type: 'image', value: 'javascript:alert(1)' }), false);
  assert.equal(isValidContent({ type: 'image', value: 'data:image/png;base64,AAAA" onerror="x' }), false);
  assert.equal(isValidContent({ type: 'image', value: '' }), false);
});

test('validateBank：有效題庫、混用圖文', () => {
  const bank = {
    id: 'b1', name: '混合', updatedAt: 1,
    pairs: [
      { id: 'p1', a: { type: 'image', value: PNG_URL }, b: text('貓') },
      { id: 'p2', a: text('1+1'), b: text('2') },
    ],
  };
  assert.deepEqual(validateBank(bank), []);
  assert.deepEqual(validateBank(bank, { minPairs: 2 }), []);
});

test('validateBank：回報各種錯誤與組號', () => {
  assert.ok(validateBank(null).length > 0);
  assert.ok(validateBank({ id: 'x', name: ' ', pairs: [] }).some((e) => e.includes('名稱')));
  assert.ok(validateBank({ id: 'x', name: 'n', pairs: 'no' }).some((e) => e.includes('配對清單')));
  assert.ok(validateBank({ id: 'x', name: 'n', pairs: [] }, { minPairs: 2 }).some((e) => e.includes('至少')));
  const errs = validateBank({ id: 'x', name: 'n', pairs: [
    { id: 'p', a: text('a'), b: text('') },
    { id: 'p', a: text('a'), b: text('b') },
  ] });
  assert.ok(errs.some((e) => e.includes('第 1 組') && e.includes('第二張')));
  assert.ok(errs.some((e) => e.includes('第 2 組') && e.includes('重複')));
});

test('cloneBank：換新 id、深拷貝、只保留已知欄位', () => {
  const src = { ...sampleBanks[0], builtin: true, secret: 1 };
  const copy = cloneBank(src, '副本');
  assert.notEqual(copy.id, src.id);
  assert.equal(copy.name, '副本');
  assert.equal('builtin' in copy, false);
  assert.equal('secret' in copy, false);
  assert.equal(copy.pairs.length, src.pairs.length);
  assert.notEqual(copy.pairs[0].id, src.pairs[0].id);
  assert.deepEqual(copy.pairs[0].a, src.pairs[0].a);
  copy.pairs[0].a.value = '改';
  assert.notEqual(src.pairs[0].a.value, '改');
  assert.equal(new Set(copy.pairs.map((p) => p.id)).size, copy.pairs.length);
});

test('createBank／blankPair／newId', () => {
  assert.deepEqual(createBank('新').pairs, []);
  assert.equal(blankPair().a.value, '');
  assert.notEqual(newId(), newId());
});

test('內建範例題庫都是有效題庫', () => {
  for (const bank of sampleBanks) assert.deepEqual(validateBank(bank, { minPairs: 18 }), [], bank.name);
});
