// 設定存 localStorage；讀寫失敗（無痕模式、被封鎖）時用預設值，畫面照常可用。
const SETTINGS_KEY = 'memory-match:settings';
const defaults = { sound: true, chainOnMatch: true, memorySeconds: 0, cardBack: 'question', bankId: null, size: '4', customPairs: 10, players: ['玩家 1'] };

export function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
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
