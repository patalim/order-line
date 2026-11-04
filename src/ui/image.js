import { detectImageType, fitSize } from '../store/image-format.js';

const MAX_FILE_BYTES = 15 * 1024 * 1024;

// 讀取使用者選的圖片：以檔頭判斷格式（拒絕 SVG 等）、縮到最長邊約 600px，回傳 data URL。
// 失敗時丟出帶繁體中文訊息的 Error，可直接顯示給使用者。
export async function processImageFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('圖片檔案太大（上限 15 MB）');
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = detectImageType(head);
  if (!type) throw new Error('只接受 PNG、JPG、GIF、WebP 圖片（不接受 SVG）');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('無法讀取這張圖片，檔案可能已損壞');
  }
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    // 照片存 JPEG 較小；其餘（可能有透明）存 PNG。GIF 動畫只保留第一格。
    return type === 'jpeg' ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
