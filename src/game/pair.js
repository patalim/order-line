// 配對資料的純函式（不碰 DOM 與儲存）。
// pair = { id, a, b?, value?, unit?, label? }
//   a / b：牌面 { type: 'text'|'image', value }。b 可省略：有數值時，b 預設為「數值＋單位」。
//   value / unit：選填的數值與單位，大小排序與連連看只會用到有數值的配對。
//   label：a 是圖片時顯示在圖片下方的說明文字。

export const formatValue = (value, unit) => `${value}${unit ? ` ${unit}` : ''}`;

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

// 配對的數值：優先用 value；沒有時，若第二張牌是純數字文字（例如「3+4 ↔ 7」的 7）就用它。
export function pairValue(pair) {
  if (Number.isFinite(pair?.value)) return pair.value;
  const b = pair?.b;
  if (b?.type === 'text' && PLAIN_NUMBER.test(b.value.trim())) return Number(b.value.trim());
  return undefined;
}

export const hasValue = (pair) => pairValue(pair) !== undefined;

// 翻牌配對用的第二張牌。
export const resolveB = (pair) => pair.b ?? { type: 'text', value: formatValue(pair.value, pair.unit) };

// 大小排序與連連看可用的配對（有數值的）；數值取自第二張牌時，會補上 value 讓後續程式統一使用。
export const numericPairs = (pairs) =>
  pairs.filter(hasValue).map((p) => (Number.isFinite(p.value) ? p : { ...p, value: pairValue(p) }));
