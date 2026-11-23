// 設定存 localStorage；讀寫失敗（無痕模式、被封鎖）時用預設值，畫面照常可用。
const SETTINGS_KEY = 'memory-match:settings';
const defaults = { sound: true, turnLimit: 0, memorySeconds: 0, cardBack: 'question', bankId: null, size: '4', customPairs: 10, players: ['玩家 1'], sortBankId: null, sortCount: 4, sortDirection: 'asc', matchBankId: null, matchCount: 5 };

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    // 舊版的「配對成功可再翻一次」：關閉 → 每人一次翻 1 組；開啟 → 不限（翻錯才換人）。
    if (saved.turnLimit === undefined && saved.chainOnMatch === false) saved.turnLimit = 1;
    delete saved.chainOnMatch;
    return { ...defaults, ...saved };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* 存不了就算了 */
  }
}
