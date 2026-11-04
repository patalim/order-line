# CLAUDE.md — 翻牌配對遊戲

教學用的翻牌配對小遊戲。老師（或使用者）自訂配對內容與圖片，學生用滑鼠（之後可能是平板）玩。
需求與決策在 `docs/需求.md`，動手前先讀。

## 技術決策
- **純前端網站**：原生 HTML／CSS／JavaScript，**無建置工具、無第三方套件**。
- 靜態檔案，用 ES module 分檔。**雙擊 `index.html`（`file://`）無法載入 module**，開發時用 `python -m http.server`（或任何靜態伺服器）預覽，正式放 GitHub Pages。不需要後端、不需要帳號。
- 資料存在瀏覽器：題庫與圖片用 IndexedDB，設定與最佳紀錄用 localStorage。所有存取包 try/catch，讀不到時畫面仍要能用。
- 音效用 Web Audio 合成，不放音檔。
- 單機版 = 單一 HTML 檔：`node scripts/build-standalone.js` 產生 `dist/翻牌配對.html`（只用 Node 內建模組）。因此 `import` 只能寫 `import { a } from './x.js'`（不用 default／`* as`／改名），`export` 只用 `export function／const／let／class`，各檔案的頂層名稱不可重複，否則打包會報錯。
- 桌面程式（.exe／.app）暫不做；之後可把單一 HTML 包進 Electron／Tauri，所以不要依賴伺服器。

## 程式分層
- `src/game/`：純函式的遊戲規則（洗牌、翻牌、配對判定、輪流、計分）。**不碰 DOM、不碰儲存**，可在 Node 直接測試。
- `src/store/`：題庫與紀錄的儲存。
- `src/ui/`：畫面。
- 亂數可注入（測試用固定種子），洗牌用 Fisher–Yates。

## 守則
- 介面文字用**繁體中文**。
- 按鈕與卡片要大、對比高；滑鼠與觸控都能操作（用 Pointer Events），版面要能隨螢幕縮放（平板直橫向）。
- 上傳圖片：以檔頭判斷格式（PNG／JPG／GIF／WebP），**拒絕 SVG**；先縮圖到固定大小（最長邊約 600px）再存。
- 題庫匯出入為單一 JSON（含版本號，圖片以 data URL 內嵌）；匯入前驗證格式，全有或全無。
- 測試：`node --test`。提交前先跑。
- 提交前先問使用者；commit 訊息結尾加 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。

## 工作順序
1. 遊戲核心（`src/game/`）＋測試
2. 遊戲畫面（翻牌動畫、步數、計時、輪流、音效）
3. 題庫編輯（三種配對、圖片上傳）
4. 最佳紀錄、題庫匯出入
5. 平板／觸控調整、說明文件
