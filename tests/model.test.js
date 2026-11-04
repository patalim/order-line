import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatValue, hasValue, resolveB, numericPairs } from '../src/game/pair.js';
import { buildDeck } from '../src/game/deck.js';
import { validateBank, cloneBank, LIMITS } from '../src/store/bank-model.js';
import { exportBank, exportLibrary, parseImport, parseAnyImport } from '../src/store/bank-io.js';
import { cardToPair, topicToBank, topicsToBanks, readLegacyBanks, LEGACY_TOPICS_KEY, LEGACY_DECK_KEY } from '../src/store/legacy.js';
import { parseCSV, banksFromRows } from '../src/store/csv.js';
import { sampleBanks } from '../src/data/samples.js';

const text = (value) => ({ type: 'text', value });
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const bankOf = (pairs, name = '題庫') => ({ id: 'b1', name, pairs, updatedAt: 1 });

test('pair：formatValue／hasValue／resolveB／numericPairs', () => {
  assert.equal(formatValue(9.8, 'g'), '9.8 g');
  assert.equal(formatValue(5), '5');
  assert.equal(hasValue({ value: 0 }), true);
  assert.equal(hasValue({ value: NaN }), false);
  assert.equal(hasValue({}), false);
  assert.deepEqual(resolveB({ value: 7, unit: 'kg' }), text('7 kg'));
  assert.deepEqual(resolveB({ b: text('x'), value: 7 }), text('x'));
  assert.deepEqual(numericPairs([{ id: 1, value: 1 }, { id: 2 }, { id: 3, value: 0 }]).map((p) => p.id), [1, 3]);
});

test('validateBank：b 可省略（需有數值），並檢查 value／unit／label', () => {
  const ok = { id: 'p1', a: text('蘋果'), value: 10.4, unit: 'g' };
  assert.deepEqual(validateBank(bankOf([ok])), []);
  assert.match(validateBank(bankOf([{ id: 'p1', a: text('蘋果') }]))[0], /第二張牌/);
  assert.match(validateBank(bankOf([{ ...ok, value: Infinity }])).join('|'), /數值不正確/);
  assert.match(validateBank(bankOf([{ ...ok, unit: 'x'.repeat(LIMITS.unitMax + 1) }]))[0], /單位/);
  assert.match(validateBank(bankOf([{ ...ok, label: 'x'.repeat(LIMITS.labelMax + 1) }]))[0], /說明文字/);
  assert.deepEqual(validateBank(bankOf([{ id: 'p1', a: text('a'), b: text('b') }])), []); // 舊格式照常有效
});

test('buildDeck：沒有 b 時用數值＋單位當第二張牌', () => {
  const deck = buildDeck([{ id: 'p', a: text('蘋果'), value: 10.4, unit: 'g' }], 1, () => 0.5);
  const contents = deck.map((c) => c.content.value).sort();
  assert.deepEqual(contents, ['10.4 g', '蘋果']);
  assert.ok(deck.every((c) => c.key !== c.partnerKey));
});

test('cloneBank：保留 value／unit／label／b，換新 id', () => {
  const src = bankOf([{ id: 'p', a: { type: 'image', value: JPEG }, value: 3, unit: 'g', label: '蘋果', extra: 1 }]);
  const copy = cloneBank(src, '副本');
  assert.notEqual(copy.pairs[0].id, 'p');
  assert.deepEqual({ ...copy.pairs[0], id: 'p' }, { id: 'p', a: src.pairs[0].a, value: 3, unit: 'g', label: '蘋果' });
  assert.notEqual(copy.pairs[0].a, src.pairs[0].a);
});

test('匯出入：版本 2 往返不失真；版本 1 舊檔仍可匯入', () => {
  const src = bankOf([
    { id: 'p1', a: text('蘋果'), value: 10.4, unit: 'g' },
    { id: 'p2', a: text('3+4'), b: text('7') },
  ]);
  const r = parseImport(exportBank(src));
  assert.ok(r.ok);
  assert.deepEqual(r.bank.pairs.map(({ id, ...rest }) => rest), [
    { a: text('蘋果'), value: 10.4, unit: 'g' },
    { a: text('3+4'), b: text('7') },
  ]);
  const v1 = JSON.stringify({ format: 'memory-match-bank', version: 1, bank: { name: '舊', pairs: [{ a: text('a'), b: text('b') }] } });
  assert.ok(parseImport(v1).ok);
  const future = JSON.stringify({ format: 'memory-match-bank', version: 99, bank: { name: 'x', pairs: [] } });
  assert.equal(parseImport(future).ok, false);
});

test('整個題庫庫：匯出再匯入，全有或全無', () => {
  const banks = [
    bankOf([{ id: 'p1', a: text('a'), value: 1 }], '甲'),
    bankOf([{ id: 'p2', a: text('b'), value: 2 }], '乙'),
  ];
  const r = parseAnyImport(exportLibrary(banks));
  assert.ok(r.ok);
  assert.deepEqual(r.banks.map((b) => b.name), ['甲', '乙']);
  const bad = JSON.parse(exportLibrary(banks));
  bad.banks[1].pairs[0].value = 'abc';
  const r2 = parseAnyImport(JSON.stringify(bad));
  assert.equal(r2.ok, false);
  assert.match(r2.errors[0], /乙/);
});

test('舊版 order-line：卡片轉成配對（有圖片 → 圖片＋label）', () => {
  const plain = cardToPair({ id: 'c1', name: '蘋果', value: 10.4, unit: 'g', img: null }, 'x');
  assert.deepEqual(plain, { id: 'x', a: text('蘋果'), value: 10.4, unit: 'g' });
  const withImg = cardToPair({ id: 'c2', name: '香蕉', value: '12.2', unit: '', img: JPEG }, 'y');
  assert.deepEqual(withImg, { id: 'y', a: { type: 'image', value: JPEG }, value: 12.2, label: '香蕉' });
  assert.equal(cardToPair({ name: '', value: 1 }, 'z'), null);
  assert.equal(cardToPair({ name: 'a', value: 'x' }, 'z'), null);
  const badImg = cardToPair({ name: '圖', value: 1, img: 'data:image/svg+xml;base64,AAAA' }, 'w');
  assert.deepEqual(badImg.a, text('圖')); // 不合格的圖片退回文字
});

test('舊版 order-line：匯出檔（topics／cards／陣列）都能匯入', () => {
  const topics = [{ name: '甲', cards: [{ id: 'a', name: 'x', value: 1, unit: 'g' }] }, { name: '空', cards: [] }];
  const r = parseAnyImport(JSON.stringify({ app: 'order-line', version: 2, topics }));
  assert.ok(r.ok);
  assert.deepEqual(r.banks.map((b) => b.name), ['甲']); // 空主題略過
  assert.ok(parseAnyImport(JSON.stringify({ cards: topics[0].cards })).ok);
  assert.ok(parseAnyImport(JSON.stringify(topics[0].cards)).ok);
  assert.equal(parseAnyImport('[]').ok, false);
  assert.equal(parseAnyImport('{"x":1}').ok, false);
});

test('遷移：固定 id、可重跑、略過沒改過的內建範例', () => {
  const sample = sampleBanks.find((b) => b.id === 'sample-fruit');
  const fruitTopic = {
    id: 't0', name: sample.name,
    cards: sample.pairs.map((p, i) => ({ id: `fruit-${i}`, name: p.a.value, value: p.value, unit: p.unit })),
  };
  const mine = { id: 't1', name: '我的', cards: [{ id: 'c1', name: '梨', value: 9.8, unit: 'g' }] };
  const store = { [LEGACY_TOPICS_KEY]: JSON.stringify([fruitTopic, mine]) };
  const get = (k) => store[k] ?? null;
  const banks = readLegacyBanks(get, sampleBanks);
  assert.deepEqual(banks.map((b) => b.id), ['ol-t1']);
  assert.equal(banks[0].pairs[0].id, 'ol-c1');
  assert.deepEqual(readLegacyBanks(get, sampleBanks).map((b) => b.id), ['ol-t1']); // 重跑結果相同
  assert.equal(validateBank(banks[0]).length, 0);

  fruitTopic.cards[0].value = 99; // 改過的範例要保留
  store[LEGACY_TOPICS_KEY] = JSON.stringify([fruitTopic]);
  assert.equal(readLegacyBanks(get, sampleBanks).length, 1);
});

test('遷移：只有舊版單一題庫（v1）、壞資料、沒資料', () => {
  const v1 = { [LEGACY_DECK_KEY]: JSON.stringify([{ id: 'c1', name: '梨', value: 9.8 }]) };
  const banks = readLegacyBanks((k) => v1[k] ?? null);
  assert.equal(banks.length, 1);
  assert.equal(banks[0].name, '我的題庫');
  assert.deepEqual(readLegacyBanks(() => null), []);
  assert.deepEqual(readLegacyBanks(() => '{壞掉'), []);
  assert.deepEqual(readLegacyBanks(() => { throw new Error('blocked'); }), []);
});

test('topicToBank：名稱過長會截斷、無效卡片略過', () => {
  const bank = topicToBank({ id: 't', name: 'x'.repeat(100), cards: [{ name: 'a', value: 1 }, { name: '', value: 2 }] }, { idPrefix: 'ol-' });
  assert.equal([...bank.name].length, LIMITS.nameMax);
  assert.equal(bank.pairs.length, 1);
  assert.equal(topicsToBanks([{ cards: [] }]).length, 0);
});

test('CSV：三欄與四欄（含主題）格式、引號與標題列', () => {
  assert.deepEqual(parseCSV('﻿a,"b,c"\r\n"x""y",2\n'), [['a', 'b,c'], ['x"y', '2']]);
  const three = banksFromRows(parseCSV('名稱,數值,單位\n蘋果,10.4,g\n香蕉,12.2,g\n壞列,abc,g\n'), '我的');
  assert.equal(three.banks.length, 1);
  assert.equal(three.banks[0].name, '我的');
  assert.equal(three.banks[0].pairs.length, 2);
  assert.equal(three.skipped, 1);

  const four = banksFromRows(parseCSV('主題,名稱,數值,單位\n水果,蘋果,10.4,g\n動物,貓,4,kg\n水果,香蕉,"1,200",g\n'));
  assert.deepEqual(four.banks.map((b) => [b.name, b.pairs.length]), [['水果', 2], ['動物', 1]]);
  assert.equal(four.banks[0].pairs[1].value, 1200);
  assert.ok(four.banks.every((b) => validateBank(b).length === 0));
  assert.deepEqual(banksFromRows([]).banks, []);
});

test('內建範例：水果含糖量題庫有 20 組、全部有數值且有效', () => {
  const fruit = sampleBanks.find((b) => b.id === 'sample-fruit');
  assert.equal(fruit.pairs.length, 20);
  assert.equal(numericPairs(fruit.pairs).length, 20);
  assert.deepEqual(validateBank(fruit), []);
});
