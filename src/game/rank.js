// 依配對數由多到少排名；同分並列，下一名跳號（1, 1, 3）。
export function rankPlayers(players) {
  const sorted = players
    .map((p, index) => ({ ...p, index }))
    .sort((x, y) => y.pairs - x.pairs || x.index - y.index);
  let rank = 0;
  return sorted.map((p, i) => {
    if (i === 0 || p.pairs !== sorted[i - 1].pairs) rank = i + 1;
    return { name: p.name, pairs: p.pairs, rank };
  });
}
