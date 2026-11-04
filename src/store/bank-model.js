// 題庫資料模型（純函式，不碰儲存與 DOM）。
// bank = { id, name, pairs: [{ id, a, b }], updatedAt }
// 牌面 content = { type: 'text', value } 或 { type: 'image', value: dataURL }

export const LIMITS = { nameMax: 40, textMax: 40, imageDataUrlMax: 3_000_000, pairsMax: 500 };

const IMAGE_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function newId(rng = Math.random) {
  return `${Date.now().toString(36)}-${Math.floor(rng() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

export function isValidContent(c) {
  if (c === null || typeof c !== 'object' || typeof c.value !== 'string') return false;
  if (c.type === 'text') return c.value.trim() !== '' && [...c.value].length <= LIMITS.textMax;
  if (c.type === 'image') return c.value.length <= LIMITS.imageDataUrlMax && IMAGE_URL.test(c.value);
  return false;
}

export function createBank(name, rng) {
  return { id: newId(rng), name, pairs: [], updatedAt: Date.now() };
}

export function blankPair(rng) {
  return { id: newId(rng), a: { type: 'text', value: '' }, b: { type: 'text', value: '' } };
}

// 深拷貝並換新 id，只保留已知欄位（內建旗標等不會跟著複製）。
export function cloneBank(bank, name, rng) {
  return {
    id: newId(rng),
    name,
    pairs: bank.pairs.map((p) => ({ id: newId(rng), a: { ...p.a }, b: { ...p.b } })),
    updatedAt: Date.now(),
  };
}

// 回傳錯誤訊息陣列（空陣列＝有效）。
export function validateBank(bank, { minPairs = 0 } = {}) {
  const errors = [];
  if (bank === null || typeof bank !== 'object') return ['題庫格式不正確'];
  if (typeof bank.id !== 'string' || bank.id === '') errors.push('缺少題庫 id');
  if (typeof bank.name !== 'string' || bank.name.trim() === '') errors.push('題庫名稱不可空白');
  else if ([...bank.name].length > LIMITS.nameMax) errors.push(`題庫名稱不可超過 ${LIMITS.nameMax} 字`);
  if (!Array.isArray(bank.pairs)) return [...errors, '缺少配對清單'];
  if (bank.pairs.length < minPairs) errors.push(`至少需要 ${minPairs} 組配對`);
  if (bank.pairs.length > LIMITS.pairsMax) return [...errors, `配對不可超過 ${LIMITS.pairsMax} 組`];
  const seen = new Set();
  bank.pairs.forEach((p, i) => {
    const n = i + 1;
    if (p === null || typeof p !== 'object' || typeof p.id !== 'string' || p.id === '') errors.push(`第 ${n} 組缺少 id`);
    else if (seen.has(p.id)) errors.push(`第 ${n} 組的 id 重複`);
    else seen.add(p.id);
    if (!isValidContent(p?.a)) errors.push(`第 ${n} 組的第一張牌還沒填好`);
    if (!isValidContent(p?.b)) errors.push(`第 ${n} 組的第二張牌還沒填好`);
  });
  return errors;
}
