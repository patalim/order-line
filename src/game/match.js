import { shuffle } from './rng.js';
import { numericPairs } from './pair.js';

// 連連看的規則（純函式；狀態不可變，每個動作回傳新狀態）。
// 左邊是配對的題目面，右邊是打亂的數值；一對一連線。數值相同（並列）連到任一個都算對。
//
// state = {
//   links:   { [左邊配對 id]: 右邊索引 },
//   locked:  核對後答對、已鎖定的左邊配對 id（之後不能再改）,
//   flagged: 核對後答錯、等下一位玩家操作時清除的左邊配對 id,
//   sel:     目前選取的項目 { side: 'L'|'R', key } 或 null,
//   revealed: 是否已顯示正確答案,
// }

export const MATCH_MAX = 10;

export function buildMatchRound(pairs, count, rng = Math.random) {
  const pool = numericPairs(pairs);
  if (!Number.isInteger(count) || count < 2) throw new RangeError('組數至少要 2 組');
  if (count > pool.length) throw new RangeError(`有數值的配對只有 ${pool.length} 組，不足 ${count} 組`);
  const cards = shuffle(pool, rng).slice(0, count);
  const right = shuffle(cards.map((p) => ({ owner: p.id, value: p.value, unit: p.unit })), rng)
    .map((r, index) => ({ ...r, index }));
  return { cards, right };
}

export const createMatchState = () => ({ links: {}, locked: [], flagged: [], sel: null, revealed: false });

const leftOf = (state, rightIndex) => Object.keys(state.links).find((id) => state.links[id] === rightIndex);

// 左邊配對 leftId 連到右邊 rightIndex 是否正確（數值相同即正確）。
export function matchCorrect(round, leftId, rightIndex) {
  if (rightIndex === undefined) return false;
  const card = round.cards.find((c) => c.id === leftId);
  return card !== undefined && round.right[rightIndex].value === card.value;
}

// 點選一個項目。side 'L' 的 key 是配對 id，side 'R' 的 key 是右邊索引。
//  - 已鎖定的連線不能動；
//  - 任何有效的點選都會先清掉上一位玩家核對後答錯的線；
//  - 已選了另一邊 → 連線（兩邊原有的線會被取代）；
//  - 否則選取這個項目（它若已有連線，先拆線）；再點一次已選取的項目則取消選取。
export function pickMatch(round, state, side, key) {
  if (state.revealed) return state;
  const owner = side === 'L' ? key : leftOf(state, key);
  if (owner !== undefined && state.locked.includes(owner)) return state;

  const links = { ...state.links };
  for (const id of state.flagged) delete links[id];
  const next = { ...state, links, flagged: [] };
  const { sel } = next;

  if (sel && sel.side !== side) {
    const leftId = side === 'L' ? key : sel.key;
    const rightIndex = side === 'R' ? key : sel.key;
    for (const id of Object.keys(links)) {
      if (id === leftId || links[id] === rightIndex) delete links[id];
    }
    links[leftId] = rightIndex;
    return { ...next, sel: null };
  }
  if (sel && sel.key === key) return { ...next, sel: null };

  if (side === 'L') delete links[key];
  else for (const id of Object.keys(links)) if (links[id] === key) delete links[id];
  return { ...next, sel: { side, key } };
}

// 核對：答對的連線鎖定，答錯的標記起來。不顯示正確答案。
export function checkMatchLinks(round, state) {
  const locked = [...state.locked];
  const flagged = [];
  for (const [id, rightIndex] of Object.entries(state.links)) {
    if (locked.includes(id)) continue;
    (matchCorrect(round, id, rightIndex) ? locked : flagged).push(id);
  }
  return {
    state: { ...state, locked, flagged, sel: null },
    linked: Object.keys(state.links).length,
    correct: locked.length,
    wrong: flagged.length,
    total: round.cards.length,
  };
}

// 顯示正確答案並結算：results 每一項有 ok、linkedTo（玩家連到的右邊索引）與 answer（正確的右邊索引）。
export function revealMatchRound(round, state) {
  const results = round.cards.map((card) => {
    const linkedTo = state.links[card.id];
    const ok = matchCorrect(round, card.id, linkedTo);
    return { id: card.id, ok, linkedTo, answer: ok ? linkedTo : round.right.findIndex((r) => r.owner === card.id) };
  });
  const correct = results.filter((r) => r.ok).length;
  return {
    state: { ...state, flagged: [], sel: null, revealed: true },
    results,
    correct,
    total: results.length,
    perfect: correct === results.length,
  };
}
