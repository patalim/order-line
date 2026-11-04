// 最佳紀錄的更新規則（純函式）。單人局依「題庫＋牌數」分別記最少步數與最短時間。
// 記憶時間模式比較容易，紀錄與一般模式分開計算。
// 平手不算破紀錄；沒有舊紀錄時兩項都算新紀錄。

export const recordKey = (bankId, cardCount, memory = false) => `${bankId}|${cardCount}${memory ? '|memory' : ''}`;

export function updateRecord(prev, { moves, timeMs }) {
  const newMoves = prev?.bestMoves == null || moves < prev.bestMoves;
  const newTime = prev?.bestTimeMs == null || timeMs < prev.bestTimeMs;
  return {
    record: {
      bestMoves: newMoves ? moves : prev.bestMoves,
      bestTimeMs: newTime ? timeMs : prev.bestTimeMs,
    },
    newMoves,
    newTime,
  };
}

// 讀回來的資料可能被改壞，只接受兩項都是有限非負數的紀錄。
export function sanitizeRecord(r) {
  const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return r && ok(r.bestMoves) && ok(r.bestTimeMs) ? { bestMoves: r.bestMoves, bestTimeMs: r.bestTimeMs } : null;
}
