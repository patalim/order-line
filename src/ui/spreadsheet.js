// 讀取 Excel 檔（.xlsx／.xls）。為了維持「無第三方套件、可離線」，Excel 讀取元件只在需要時
// 才從 CDN 載入；沒有網路時會丟出帶繁體中文訊息的 Error，請使用者改用 CSV。
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

let xlsxLoading = null;

function loadXlsx() {
  if (globalThis.XLSX) return Promise.resolve(globalThis.XLSX);
  xlsxLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = XLSX_URL;
    script.onload = () => (globalThis.XLSX ? resolve(globalThis.XLSX) : reject(new Error('Excel 讀取元件載入失敗')));
    script.onerror = () => {
      xlsxLoading = null; // 之後有網路時可以重試
      reject(new Error('讀取 Excel 需要網路（要下載讀取元件）。沒有網路時，請先把檔案另存成 CSV 再匯入。'));
    };
    document.head.append(script);
  });
  return xlsxLoading;
}

// 回傳第一個工作表的資料列（二維陣列）。
export async function readSpreadsheetRows(file) {
  const XLSX = await loadXlsx();
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, defval: '' });
}
