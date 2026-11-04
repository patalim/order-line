import { createScore, addToScore } from '../game/score.js';

// 這次開啟網頁期間的累計得分，大小排序與連連看共用；重新整理後歸零。
let score = createScore();

export const getScore = () => score;

export function recordRound(correct, total) {
  score = addToScore(score, correct, total);
  return score;
}

export function resetScore() {
  score = createScore();
}
