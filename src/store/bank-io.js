import { newId, validateBank, copyPair } from './bank-model.js';
import { topicsToBanks } from './legacy.js';

// 題庫匯出入：單一 JSON，含版本號，圖片以 data URL 內嵌。
//   單一題庫  format 'memory-match-bank'（版本 1 沒有 value/unit/label，版本 2 有；兩種都能匯入）
//   整個題庫庫 format 'order-line-library'
// 另外能匯入舊版 order-line 匯出的 { topics: [...] } 或 { cards: [...] }。
export const FILE_FORMAT = 'memory-match-bank';
export const FILE_VERSION = 2;
export const LIBRARY_FORMAT = 'order-line-library';
export const LIBRARY_VERSION = 1;

const exportPair = (p) => {
  const { id, ...rest } = copyPair(p, '');
  return rest;
};
const exportBody = (bank) => ({ name: bank.name, pairs: bank.pairs.map(exportPair) });

export function exportBank(bank) {
  return JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, bank: exportBody(bank) }, null, 1);
}

export function exportLibrary(banks) {
  return JSON.stringify({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, banks: banks.map(exportBody) }, null, 1);
}

const pickContent = (c) => c && { type: c.type, value: c.value };

// 只取已知欄位並換新 id，不信任檔案裡的其他東西。
function readPair(p, rng) {
  const out = { id: newId(rng), a: pickContent(p?.a) };
  if (p?.b != null) out.b = pickContent(p.b);
  for (const key of ['value', 'unit', 'label']) {
    if (p?.[key] !== undefined && p[key] !== null) out[key] = p[key];
  }
  return out;
}

function readBank(src, rng) {
  return {
    id: newId(rng),
    name: typeof src.name === 'string' ? src.name.trim() : src.name,
    pairs: src.pairs.map((p) => readPair(p, rng)),
    updatedAt: Date.now(),
  };
}

const failed = (...errors) => ({ ok: false, errors });

// 全有或全無：先完整驗證，任何一處不合格就整個拒絕，不回傳半成品。
// 成功時回傳全新 id 的題庫（不會覆蓋既有題庫），且只含已知欄位。
export function parseImport(text, rng) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return failed('這不是有效的 JSON 檔案');
  }
  if (data === null || typeof data !== 'object' || data.format !== FILE_FORMAT) {
    return failed('這不是本遊戲匯出的題庫檔案');
  }
  if (!Number.isInteger(data.version) || data.version < 1) return failed('檔案的版本號不正確');
  if (data.version > FILE_VERSION) return failed('這個檔案來自較新版本的遊戲，請先更新遊戲再匯入');
  const src = data.bank;
  if (src === null || typeof src !== 'object' || !Array.isArray(src.pairs)) return failed('缺少題庫內容');
  const bank = readBank(src, rng);
  const errors = validateBank(bank, { minPairs: 1 });
  return errors.length ? failed(...errors) : { ok: true, bank };
}

// 讀取任何支援的檔案內容，回傳 { ok: true, banks: [...] }（可能不只一個題庫）或 { ok: false, errors }。
export function parseAnyImport(text, rng) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return failed('這不是有效的 JSON 檔案');
  }
  if (data === null || typeof data !== 'object') return failed('檔案內容不正確');

  let banks;
  if (data.format === FILE_FORMAT) {
    const r = parseImport(text, rng);
    return r.ok ? { ok: true, banks: [r.bank] } : r;
  }
  if (data.format === LIBRARY_FORMAT) {
    if (!Number.isInteger(data.version) || data.version < 1) return failed('檔案的版本號不正確');
    if (data.version > LIBRARY_VERSION) return failed('這個檔案來自較新版本的遊戲，請先更新遊戲再匯入');
    if (!Array.isArray(data.banks) || data.banks.some((b) => b === null || typeof b !== 'object' || !Array.isArray(b.pairs))) {
      return failed('缺少題庫內容');
    }
    banks = data.banks.map((b) => readBank(b, rng));
  } else if (Array.isArray(data.topics) || Array.isArray(data.cards) || Array.isArray(data)) {
    // 舊版 order-line：{ topics: [{ name, cards }] }、{ cards: [...] } 或純陣列
    const topics = Array.isArray(data.topics) ? data.topics : [{ name: '匯入的題庫', cards: Array.isArray(data) ? data : data.cards }];
    if (topics.some((t) => t === null || typeof t !== 'object' || !Array.isArray(t.cards))) return failed('缺少卡片內容');
    banks = topicsToBanks(topics, { rng });
  } else {
    return failed('這不是本遊戲匯出的檔案');
  }

  if (!banks.length) return failed('檔案裡沒有可匯入的題庫');
  const errors = banks.flatMap((b) => validateBank(b, { minPairs: 1 }).map((e) => `「${b.name}」${e}`));
  return errors.length ? failed(...errors) : { ok: true, banks };
}
