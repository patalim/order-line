# CLAUDE.md — 教學小遊戲（翻牌配對、大小排序、連連看）

教學用的小遊戲合集。老師（或使用者）自訂題庫與圖片，學生用滑鼠（或平板觸控）玩。三個遊戲共用同一份題庫。
需求與決策在 `docs/需求.md`，動手前先讀。

這個專案是由原本兩個專案（翻牌配對 memory-match、大小排序／連連看 order-line）整合而成；memory-match 的 commit 歷史已併入。

## 技術決策
- **純前端網站**：原生 HTML／CSS／JavaScript，**無建置工具、無第三方套件**（唯一例外：匯入 Excel 時才從 CDN 載入 SheetJS，見 `src/ui/spreadsheet.js`；沒有網路時退回只支援 CSV）。
- 靜態檔案，用 ES module 分檔。**雙擊 `index.html`（`file://`）無法載入 module**，開發時用 `python -m http.server`（或任何靜態伺服器）預覽，正式放 GitHub Pages（https://patalim.github.io/order-line/）。不需要後端、不需要帳號。
- 資料存在瀏覽器：題庫與圖片用 IndexedDB，設定與最佳紀錄用 localStorage。所有存取包 try/catch，讀不到時畫面仍要能用。
- 音效用 Web Audio 合成，不放音檔。
- 單機版 = 單一 HTML 檔：`node scripts/build-standalone.js` 產生 `dist/教學小遊戲.html`（只用 Node 內建模組）。因此 `import` 只能寫 `import { a } from './x.js'`（不用 default／`* as`／改名），`export` 只用 `export function／const／let／class`，各檔案的頂層名稱不可重複，否則打包會報錯。
- 桌面程式（.exe／.app）暫不做；之後可把單一 HTML 包進 Electron／Tauri，所以不要依賴伺服器。

## 資料模型（三個遊戲共用）
- 題庫 `bank = { id, name, pairs, updatedAt }`；配對 `pair = { id, a, b?, value?, unit?, label? }`。
- `a`、`b` 是牌面 `{ type: 'text'|'image', value }`。`b` 可省略：有 `value` 時，`b` 預設為「數值＋單位」（`game/pair.js` 的 `resolveB`）。
- `value`／`unit` 是選填的數值與單位；**大小排序與連連看只使用有 `value` 的配對**；`label` 是 `a` 為圖片時的說明文字。
- 翻牌配對用 `a ↔ b`；排序與連連看用 `a`（題目面）與 `value`／`unit`。
- 舊版 order-line 的資料（localStorage 的 `orderline.topics.v2`／`orderline.deck.v1`）在第一次啟動時由 `store/legacy.js` 遷移進 IndexedDB（固定 id、可重跑、不刪舊資料）。

## 程式分層
- `src/game/`：純函式的遊戲規則（洗牌、翻牌、配對判定、輪流、排序、連連看、計分）。**不碰 DOM、不碰儲存**，可在 Node 直接測試。狀態不可變，動作回傳新狀態。
- `src/store/`：題庫模型與驗證、匯出入、CSV、遷移、儲存。
- `src/ui/`：畫面。`dom.js` 提供 `h()`、`show()`（切換畫面並執行清理）、`setNav()` 與 `setLeaveGuard()`（離開前確認）。
- 亂數可注入（測試用固定種子），洗牌用 Fisher–Yates。

## 守則
- 介面文字用**繁體中文**。
- 按鈕與卡片要大、對比高；滑鼠與觸控都能操作（用 Pointer Events），版面要能隨螢幕縮放（平板直橫向、手機寬度），並支援深色模式。
- 上傳圖片：以檔頭判斷格式（PNG／JPG／GIF／WebP），**拒絕 SVG**；先縮圖到固定大小（最長邊約 600px）再存。
- 題庫匯出入：單一題庫 JSON（`memory-match-bank`，版本 2）與整個題庫庫 JSON（`order-line-library`），圖片以 data URL 內嵌；也能匯入舊版 order-line JSON、CSV、Excel。匯入前驗證格式，全有或全無。
- 並列（數值相同）一律算對：排序依位置比數值，連連看連到任一個相同數值都算對。
- 測試：`node --test`。提交前先跑。
- 提交前先問使用者；commit 訊息結尾加 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。
- 合併進 `main` 前要先經使用者確認（`main` 就是線上網站）。
