import { LIMITS, newId, isValidContent } from './bank-model.js';

// 舊版 order-line 的資料轉換：card = { id, name, value, unit, img }（img 為 data URL 或 null）、
// topic = { id, name, cards }。轉成新的配對／題庫格式：
//   有圖片 → a 是圖片、名稱放 label；沒有圖片 → a 是名稱文字。數值與單位照搬，b 由數值產生。

const clip = (text, max) => [...String(text ?? '').trim()].slice(0, max).join('');

export function cardToPair(card, id) {
  const name = clip(card?.name, LIMITS.textMax);
  const value = typeof card?.value === 'number' ? card.value : parseFloat(card?.value);
  if (!name || !Number.isFinite(value)) return null;
  const image = { type: 'image', value: card.img };
  const hasImage = typeof card.img === 'string' && isValidContent(image);
  const pair = { id, a: hasImage ? image : { type: 'text', value: name }, value };
  if (hasImage) pair.label = name;
  const unit = clip(card.unit, LIMITS.unitMax);
  if (unit) pair.unit = unit;
  return pair;
}

// idPrefix 有值時 id 由舊 id 推得（重複轉換結果相同，方便遷移時安全重跑）；否則每次產生新 id。
export function topicToBank(topic, { idPrefix = '', rng } = {}) {
  const used = new Set();
  const pairs = [];
  (Array.isArray(topic?.cards) ? topic.cards : []).forEach((card, i) => {
    let id = idPrefix ? `${idPrefix}${card?.id ?? i}` : newId(rng);
    if (used.has(id)) id = `${id}-${i}`;
    const pair = cardToPair(card, id);
    if (pair) {
      used.add(id);
      pairs.push(pair);
    }
  });
  return {
    id: idPrefix ? `${idPrefix}${topic?.id ?? newId(rng)}` : newId(rng),
    name: clip(topic?.name, LIMITS.nameMax) || '未命名題庫',
    pairs: pairs.slice(0, LIMITS.pairsMax),
    updatedAt: Date.now(),
  };
}

export function topicsToBanks(topics, opts) {
  return topics.map((t) => topicToBank(t, opts)).filter((b) => b.pairs.length > 0);
}

// ---- 從舊版 order-line 的 localStorage 遷移 ----
export const LEGACY_TOPICS_KEY = 'orderline.topics.v2';
export const LEGACY_DECK_KEY = 'orderline.deck.v1';
export const MIGRATED_KEY = 'orderline:migrated';

// 內容相同（忽略 id）：用來略過「沒改過的內建範例」，避免遷移後出現重複的範例題庫。
function sameContent(bank, other) {
  return bank.name === other.name && bank.pairs.length === other.pairs.length &&
    bank.pairs.every((p, i) => {
      const q = other.pairs[i];
      return p.a.value === q.a.value && p.value === q.value && (p.unit ?? '') === (q.unit ?? '');
    });
}

// getItem(key) 回傳字串或 null。只讀取，不修改舊資料。
export function readLegacyBanks(getItem, builtinBanks = []) {
  const parse = (key) => {
    try {
      return JSON.parse(getItem(key));
    } catch {
      return null;
    }
  };
  let banks = [];
  const topics = parse(LEGACY_TOPICS_KEY);
  const deck = parse(LEGACY_DECK_KEY);
  if (Array.isArray(topics) && topics.length) banks = topicsToBanks(topics, { idPrefix: 'ol-' });
  else if (Array.isArray(deck) && deck.length) banks = topicsToBanks([{ id: 'deck', name: '我的題庫', cards: deck }], { idPrefix: 'ol-' });
  return banks.filter((b) => !builtinBanks.some((s) => sameContent(b, s)));
}
