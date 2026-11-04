// 以檔頭（magic bytes）判斷圖片格式，不看副檔名或 MIME。
// SVG 是文字（可含腳本），不在支援清單內，一律回傳 null。

export const MAX_IMAGE_EDGE = 600;
export const MIME = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

const startsWith = (bytes, sig, offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

export function detectImageType(bytes) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'gif';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'webp';
  return null;
}

// 最長邊縮到 max 以內，維持比例；已經夠小就不放大。
export function fitSize(width, height, max = MAX_IMAGE_EDGE) {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
