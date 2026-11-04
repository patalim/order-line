// 大小排序與連連看共用的累計得分（純函式；不可變，每次回傳新物件）。
export const createScore = () => ({ total: 0, max: 0, rounds: 0 });

export const addToScore = (score, correct, total) => ({
  total: score.total + correct,
  max: score.max + total,
  rounds: score.rounds + 1,
});
