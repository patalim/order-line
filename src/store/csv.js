import { LIMITS, newId } from './bank-model.js';
import { cardToPair } from './legacy.js';

// CSV／Excel 的資料列轉成題庫。欄位：[主題,] 名稱, 數值, 單位。
// 第一欄標題是「主題」時為四欄格式，依主題分組成多個題庫；否則三欄格式，全部放進 fallbackName 這個題庫。

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function banksFromRows(rows, fallbackName = '匯入的題庫', rng) {
  const withTopic = rows.length > 0 && /^(主題|topic)$/i.test(String(rows[0][0] ?? '').trim());
  const groups = new Map();
  let skipped = 0;
  rows.forEach((r, i) => {
    const [topic, name, value, unit] = withTopic ? r : [fallbackName, ...r];
    const card = { name, value: String(value ?? '').replace(/,/g, ''), unit };
    const pair = cardToPair(card, newId(rng));
    if (!pair) {
      if (i > 0) skipped++; // 第一列沒有數值，視為標題
      return;
    }
    const key = String(topic ?? '').trim() || '未分類';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pair);
  });
  const banks = [...groups].map(([name, pairs]) => ({
    id: newId(rng),
    name: [...name].slice(0, LIMITS.nameMax).join(''),
    pairs: pairs.slice(0, LIMITS.pairsMax),
    updatedAt: Date.now(),
  }));
  return { banks, skipped };
}
