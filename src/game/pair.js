// 配對資料的純函式（不碰 DOM 與儲存）。
// pair = { id, a, b?, value?, unit?, label? }
//   a / b：牌面 { type: 'text'|'image', value }。b 可省略：有數值時，b 預設為「數值＋單位」。
//   value / unit：選填的數值與單位，大小排序與連連看只會用到有數值的配對。
//   label：a 是圖片時顯示在圖片下方的說明文字。

export const formatValue = (value, unit) => `${value}${unit ? ` ${unit}` : ''}`;

export const hasValue = (pair) => Number.isFinite(pair?.value);

// 翻牌配對用的第二張牌。
export const resolveB = (pair) => pair.b ?? { type: 'text', value: formatValue(pair.value, pair.unit) };

// 大小排序與連連看可用的配對（有數值的）。
export const numericPairs = (pairs) => pairs.filter(hasValue);
