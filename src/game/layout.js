// 牌桌的欄列數：盡量接近正方形，16 張 → 4×4、36 張 → 6×6。
export function gridSize(cardCount) {
  if (!Number.isInteger(cardCount) || cardCount < 1) throw new RangeError('牌數必須是正整數');
  let cols = Math.ceil(Math.sqrt(cardCount));
  // 找最接近正方形且剛好排滿的因數；排不滿（質數等）就用 ceil(sqrt) 欄，最後一列留空。
  for (let c = cols; c <= Math.min(cardCount, cols * 2); c++) {
    if (cardCount % c === 0 && c / (cardCount / c) <= 2) return { cols: c, rows: cardCount / c };
  }
  return { cols, rows: Math.ceil(cardCount / cols) };
}

// 兩位數秒數顯示：125 秒 → "2:05"
export function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
