import { sampleBanks } from '../data/samples.js';
import { validateBank } from './bank-model.js';
import { listStoredBanks, putStoredBank, deleteStoredBank } from './db.js';
import { readLegacyBanks, MIGRATED_KEY } from './legacy.js';

// 第一次啟動時，把舊版 order-line 存在 localStorage 的主題轉成題庫存進 IndexedDB。
// 舊資料不會被刪除；轉換用固定 id，中途失敗下次會安全重跑。
async function migrateLegacy() {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
  } catch {
    return; // 讀不到 localStorage：沒有舊資料可遷移
  }
  const banks = readLegacyBanks((key) => localStorage.getItem(key), sampleBanks);
  for (const bank of banks) {
    if (validateBank(bank).length === 0) await saveBank(bank);
  }
  try {
    localStorage.setItem(MIGRATED_KEY, '1');
  } catch {
    /* 下次會再跑一次，結果相同 */
  }
}

// 回傳 { banks, storageOk }。內建題庫排前面（builtin: true，唯讀）；使用者題庫依更新時間新到舊。
// IndexedDB 讀不到時 storageOk 為 false，畫面仍可用內建題庫玩。
export async function loadAllBanks() {
  const builtin = sampleBanks.map((b) => ({ ...b, builtin: true }));
  try {
    await migrateLegacy();
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
