import { sampleBanks } from '../data/samples.js';
import { validateBank } from './bank-model.js';
import { listStoredBanks, putStoredBank, deleteStoredBank } from './db.js';

// 回傳 { banks, storageOk }。內建題庫排前面（builtin: true，唯讀）；使用者題庫依更新時間新到舊。
// IndexedDB 讀不到時 storageOk 為 false，畫面仍可用內建題庫玩。
export async function loadAllBanks() {
  const builtin = sampleBanks.map((b) => ({ ...b, builtin: true }));
  try {
    const stored = (await listStoredBanks())
      .filter((b) => validateBank(b).length === 0) // 壞掉的紀錄直接略過，不讓整個畫面掛掉
      .sort((x, y) => y.updatedAt - x.updatedAt);
    return { banks: [...builtin, ...stored], storageOk: true };
  } catch {
    return { banks: builtin, storageOk: false };
  }
}

export async function saveBank(bank) {
  const errors = validateBank(bank);
  if (errors.length) throw new Error(errors[0]);
  await putStoredBank({ ...bank, updatedAt: Date.now() });
}

export const removeBank = deleteStoredBank;
