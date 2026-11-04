// IndexedDB 薄包裝：只有一個 banks 物件倉庫。
// 任何失敗（不支援、無痕模式、被封鎖）都會 reject，由 banks.js 接住並退回只用內建題庫。
const DB_NAME = 'memory-match';
const STORE = 'banks';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('此瀏覽器不支援 IndexedDB'));
    let req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      return reject(e);
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('無法開啟資料庫'));
    req.onblocked = () => reject(new Error('資料庫被其他分頁佔用'));
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('儲存被中止（可能是空間不足）'));
    });
  } finally {
    db.close();
  }
}

export const listStoredBanks = () => run('readonly', (s) => s.getAll());
export const putStoredBank = (bank) => run('readwrite', (s) => s.put(bank));
export const deleteStoredBank = (id) => run('readwrite', (s) => s.delete(id));
