import { newId, validateBank } from './bank-model.js';

// 題庫匯出入：單一 JSON，含版本號，圖片以 data URL 內嵌。
export const FILE_FORMAT = 'memory-match-bank';
export const FILE_VERSION = 1;

export function exportBank(bank) {
  return JSON.stringify(
    {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      bank: {
        name: bank.name,
        pairs: bank.pairs.map((p) => ({ a: { ...p.a }, b: { ...p.b } })),
      },
    },
    null,
    1,
  );
}

// 全有或全無：先完整驗證，任何一處不合格就整個拒絕，不回傳半成品。
// 成功時回傳全新 id 的題庫（不會覆蓋既有題庫），且只含已知欄位。
export function parseImport(text, rng) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['這不是有效的 JSON 檔案'] };
  }
  if (data === null || typeof data !== 'object' || data.format !== FILE_FORMAT) {
    return { ok: false, errors: ['這不是本遊戲匯出的題庫檔案'] };
  }
  if (!Number.isInteger(data.version) || data.version < 1) {
    return { ok: false, errors: ['檔案的版本號不正確'] };
  }
  if (data.version > FILE_VERSION) {
    return { ok: false, errors: ['這個檔案來自較新版本的遊戲，請先更新遊戲再匯入'] };
  }
  const src = data.bank;
  if (src === null || typeof src !== 'object' || !Array.isArray(src.pairs)) {
    return { ok: false, errors: ['缺少題庫內容'] };
  }
  const bank = {
    id: newId(rng),
    name: typeof src.name === 'string' ? src.name.trim() : src.name,
    pairs: src.pairs.map((p) => ({
      id: newId(rng),
      a: p?.a && { type: p.a.type, value: p.a.value },
      b: p?.b && { type: p.b.type, value: p.b.value },
    })),
    updatedAt: Date.now(),
  };
  const errors = validateBank(bank, { minPairs: 1 });
  return errors.length ? { ok: false, errors } : { ok: true, bank };
}
