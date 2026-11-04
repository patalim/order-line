import { recordKey, updateRecord, sanitizeRecord } from '../game/records.js';

// 紀錄存 localStorage；讀寫失敗時視為沒有紀錄，遊戲照常可玩。
const RECORDS_KEY = 'memory-match:records';

function readAll() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '{}');
    return data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function getRecord(bankId, cardCount, memory = false) {
  return sanitizeRecord(readAll()[recordKey(bankId, cardCount, memory)]);
}

// 回傳 { record, newMoves, newTime }；寫入失敗時仍回傳這局的比較結果。
export function recordResult(bankId, cardCount, result, memory = false) {
  const all = readAll();
  const key = recordKey(bankId, cardCount, memory);
  const outcome = updateRecord(sanitizeRecord(all[key]), result);
  all[key] = outcome.record;
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(all));
  } catch {
    /* 存不了就算了 */
  }
  return outcome;
}
