import { h, app, show, setNav, setLeaveGuard } from './dom.js';
import { loadAllBanks, saveBank, removeBank } from '../store/banks.js';
import { blankPair, cloneBank, createBank, validateBank, LIMITS } from '../store/bank-model.js';
import { processImageFile } from './image.js';
import { readSpreadsheetRows } from './spreadsheet.js';
import { exportBank, exportLibrary, parseAnyImport } from '../store/bank-io.js';
import { parseCSV, banksFromRows } from '../store/csv.js';
import { formatValue, hasValue } from '../game/pair.js';

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const CSV_TEMPLATE = '主題,名稱,數值,單位\n食物含糖量,🥤 可樂 (350ml),37,g\n食物含糖量,🍪 餅乾 (1片),4,g\n食物含糖量,🍎 蘋果 (1顆),19,g\n食物含糖量,🍫 巧克力 (1條),25,g\n動物體重,🐘 大象,5000,kg\n動物體重,🐈 貓,4,kg\n動物體重,🐕 狗,20,kg\n動物體重,🐇 兔子,2,kg\n';

function downloadText(text, type, fileName) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const safeName = fileName.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '題庫';
  const a = h('a', { href: url, download: safeName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const pairIncomplete = (pair) => validateBank({ id: 'x', name: 'x', pairs: [pair] }).length > 0;

function showErrors(title, errors) {
  const shown = errors.slice(0, 5).join('\n');
  const more = errors.length > 5 ? `\n…還有 ${errors.length - 5} 項問題` : '';
  alert(`${title}\n${shown}${more}`);
}

// 讀取使用者選的檔案（JSON、CSV、Excel），回傳 { banks, skipped }；失敗時丟出帶訊息的 Error。
async function readImportFile(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('檔案太大，無法匯入（上限 100 MB）');
  const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, LIMITS.nameMax) || '匯入的題庫';
  if (/\.json$/i.test(file.name)) {
    const result = parseAnyImport(await file.text());
    if (!result.ok) throw Object.assign(new Error('匯入失敗，題庫沒有任何變動：'), { details: result.errors });
    return { banks: result.banks, skipped: 0 };
  }
  const rows = /\.xlsx?$/i.test(file.name) ? await readSpreadsheetRows(file) : parseCSV(await file.text());
  const { banks, skipped } = banksFromRows(rows, baseName);
  if (!banks.length) throw new Error('檔案裡沒有可匯入的資料（需要「名稱、數值、單位」欄位）');
  const errors = banks.flatMap((b) => validateBank(b, { minPairs: 1 }).map((e) => `「${b.name}」${e}`));
  if (errors.length) throw Object.assign(new Error('匯入失敗，題庫沒有任何變動：'), { details: errors });
  return { banks, skipped };
}

// ---------------- 題庫清單 ----------------
export async function showBankList({ onBack }) {
  const { banks, storageOk } = await loadAllBanks();
  show(() => {
    setNav('bank');
    const refresh = () => showBankList({ onBack });
    const fail = (e) => alert(`操作失敗：${e.message}`);

    const importInput = h('input', { type: 'file', accept: '.json,.csv,.txt,.xlsx,.xls', hidden: true });
    importInput.addEventListener('change', async () => {
      const file = importInput.files[0];
      importInput.value = '';
      if (!file) return;
      try {
        const { banks: incoming, skipped } = await readImportFile(file);
        for (const bank of incoming) await saveBank(bank);
        const pairs = incoming.reduce((sum, b) => sum + b.pairs.length, 0);
        alert(`已匯入 ${incoming.length} 個題庫（共 ${pairs} 組）` + (skipped ? `，略過 ${skipped} 列無效資料` : ''));
        refresh();
      } catch (e) {
        if (e.details) showErrors(e.message, e.details);
        else fail(e);
      }
    });

    const userBanks = banks.filter((b) => !b.builtin);
    const rows = banks.map((bank) =>
      h('li', { class: 'bank-row' },
        h('div', { class: 'bank-info' },
          h('strong', {}, bank.name), bank.builtin ? h('span', { class: 'tag' }, '內建') : null,
          h('span', { class: 'muted' }, `${bank.pairs.length} 組配對`)),
        h('div', { class: 'row-actions' },
          bank.builtin ? null : h('button', { type: 'button', onclick: () => showBankEditor(bank, { onDone: refresh }) }, '編輯'),
          storageOk ? h('button', { type: 'button', onclick: async () => {
            try { await saveBank(cloneBank(bank, `${bank.name}（副本）`)); refresh(); } catch (e) { fail(e); }
          } }, '複製') : null,
          h('button', { type: 'button', onclick: () => downloadText(exportBank(bank), 'application/json', `${bank.name}.json`) }, '匯出'),
          bank.builtin ? null : h('button', { type: 'button', class: 'danger', onclick: async () => {
            if (!confirm(`確定要刪除「${bank.name}」嗎？刪除後無法復原。`)) return;
            try { await removeBank(bank.id); refresh(); } catch (e) { fail(e); }
          } }, '刪除'))));

    app.append(h('section', { class: 'setup' },
      h('div', { class: 'editor-bar' },
        h('button', { type: 'button', onclick: onBack }, '← 回設定'),
        storageOk ? h('div', { class: 'row-actions' },
          h('button', { type: 'button', onclick: () => importInput.click() }, '匯入'),
          importInput,
          h('button', { type: 'button', class: 'primary', onclick: () => {
            const bank = createBank('新題庫');
            bank.pairs.push(blankPair(), blankPair());
            showBankEditor(bank, { onDone: refresh, isNew: true });
          } }, '＋ 新增題庫')) : null),
      h('h1', {}, '題庫管理'),
      storageOk ? null : h('p', { class: 'hint' }, '這個瀏覽器無法儲存題庫（可能是無痕模式或被封鎖），目前只能使用內建題庫。'),
      h('ul', { class: 'bank-list' }, rows),
      h('div', { class: 'row-actions bank-tools' },
        h('button', { type: 'button', onclick: () => {
          if (!userBanks.length) return alert('還沒有自己的題庫可以匯出');
          downloadText(exportLibrary(userBanks), 'application/json', `全部題庫-${new Date().toISOString().slice(0, 10)}.json`);
        } }, '匯出全部題庫'),
        h('button', { type: 'button', onclick: () => downloadText(`﻿${CSV_TEMPLATE}`, 'text/csv;charset=utf-8', '題庫範本.csv') }, '下載 CSV 範本')),
      h('p', { class: 'muted' }, '內建題庫不能修改；想改的話，先按「複製」再編輯副本。可匯入本遊戲匯出的 JSON、CSV（名稱、數值、單位；加「主題」欄可一次建立多個題庫）與 Excel 檔。')));
  });
}

// ---------------- 題庫編輯 ----------------
function showBankEditor(source, { onDone, isNew = false }) {
  show(() => {
    const draft = { id: source.id, name: source.name, pairs: structuredClone(source.pairs), updatedAt: source.updatedAt };
    let dirty = isNew;
    const touch = () => { dirty = true; status.textContent = ''; };
    setLeaveGuard(() => !dirty || confirm('還沒儲存，確定要離開嗎？'));

    const status = h('span', { class: 'muted', role: 'status' });
    const nameInput = h('input', { type: 'text', value: draft.name, maxlength: LIMITS.nameMax, 'aria-label': '題庫名稱' });
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; touch(); });
    const list = h('ol', { class: 'pair-list' });

    const updateAutoPreview = (pair) => {
      const el = list.querySelector(`[data-pair="${pair.id}"] .auto-preview`);
      if (el) el.textContent = hasValue(pair) ? `牌面：${formatValue(pair.value, pair.unit)}` : '請先填「數值」';
    };

    // side 'b' 的內容是 undefined 時代表「自動」：由數值與單位產生。
    function sideEditor(pair, side, n) {
      const content = pair[side];
      const auto = side === 'b' && content == null;
      const label = side === 'a' ? '第一張牌' : '第二張牌';
      const error = h('p', { class: 'hint small', role: 'alert' });
      const setType = (type) => {
        if (type === 'auto') {
          if (!auto) { delete pair.b; touch(); renderPairs(); }
          return;
        }
        if (!auto && content.type === type) return;
        pair[side] = { type, value: '' };
        if (side === 'a' && type === 'text') delete pair.label;
        touch();
        renderPairs();
      };
      const typeBtn = (type, text) =>
        h('button', { type: 'button', 'aria-pressed': String(type === 'auto' ? auto : !auto && content.type === type), onclick: () => setType(type) }, text);

      let body;
      if (auto) {
        body = h('p', { class: 'muted auto-preview' }, hasValue(pair) ? `牌面：${formatValue(pair.value, pair.unit)}` : '請先填「數值」');
      } else if (content.type === 'text') {
        body = h('input', { type: 'text', value: content.value, maxlength: LIMITS.textMax, placeholder: '輸入文字', 'aria-label': `第 ${n} 組${label}的文字` });
        body.addEventListener('input', () => { content.value = body.value; touch(); });
      } else {
        const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true });
        file.addEventListener('change', async () => {
          const picked = file.files[0];
          if (!picked) return;
          error.textContent = '處理圖片中…';
          try {
            pair[side] = { type: 'image', value: await processImageFile(picked) };
            touch();
            renderPairs();
          } catch (e) {
            error.textContent = e.message;
            file.value = '';
          }
        });
        body = h('div', { class: 'image-pick' },
          content.value ? h('img', { class: 'thumb', src: content.value, alt: `第 ${n} 組${label}的圖片` }) : null,
          h('button', { type: 'button', onclick: () => file.click() }, content.value ? '換圖片' : '選擇圖片'),
          file);
      }

      let caption = null;
      if (side === 'a' && content.type === 'image') {
        caption = h('input', { type: 'text', value: pair.label ?? '', maxlength: LIMITS.labelMax, placeholder: '說明文字（選填，顯示在圖片下方）', 'aria-label': `第 ${n} 組圖片的說明文字` });
        caption.addEventListener('input', () => {
          if (caption.value) pair.label = caption.value; else delete pair.label;
          touch();
        });
      }
      return h('div', { class: 'side' },
        h('div', { class: 'seg', role: 'group', 'aria-label': `第 ${n} 組${label}類型` },
          side === 'b' ? typeBtn('auto', '自動') : null, typeBtn('text', '文字'), typeBtn('image', '圖片')),
        body, caption, error);
    }

    // 數值與單位（選填）：大小排序與連連看會用到，第二張牌選「自動」時也由它產生。
    function valueEditor(pair, n) {
      const value = h('input', { type: 'number', step: 'any', value: pair.value ?? '', placeholder: '數值', 'aria-label': `第 ${n} 組的數值` });
      value.addEventListener('input', () => {
        const v = value.value === '' ? NaN : Number(value.value);
        if (Number.isFinite(v)) pair.value = v; else delete pair.value;
        touch();
        updateAutoPreview(pair);
      });
      const unit = h('input', { type: 'text', value: pair.unit ?? '', maxlength: LIMITS.unitMax, placeholder: '單位', 'aria-label': `第 ${n} 組的單位` });
      unit.addEventListener('input', () => {
        if (unit.value.trim()) pair.unit = unit.value.trim(); else delete pair.unit;
        touch();
        updateAutoPreview(pair);
      });
      return h('div', { class: 'pair-extra' }, h('span', { class: 'muted' }, '數值（選填）'), value, unit);
    }

    function renderPairs() {
      list.replaceChildren(...draft.pairs.map((pair, i) => {
        const n = i + 1;
        return h('li', { class: 'pair-row', 'data-pair': pair.id },
          h('span', { class: 'pair-no' }, String(n)),
          sideEditor(pair, 'a', n),
          h('span', { class: 'pair-link', 'aria-hidden': 'true' }, '↔'),
          sideEditor(pair, 'b', n),
          h('button', { type: 'button', class: 'danger', 'aria-label': `刪除第 ${n} 組`, onclick: () => {
            draft.pairs.splice(i, 1);
            touch();
            renderPairs();
          } }, '✕'),
          valueEditor(pair, n));
      }));
      count.textContent = `共 ${draft.pairs.length} 組`;
    }
    const count = h('span', { class: 'muted' });

    async function save() {
      const errors = validateBank(draft);
      list.querySelectorAll('.pair-row').forEach((row, i) => {
        row.classList.toggle('incomplete', pairIncomplete(draft.pairs[i]));
      });
      if (errors.length) {
        status.textContent = errors[0];
        status.className = 'hint';
        list.querySelector('.incomplete')?.scrollIntoView({ block: 'center' });
        return;
      }
      try {
        await saveBank(draft);
        dirty = false;
        status.className = 'muted';
        status.textContent = '已儲存';
      } catch (e) {
        status.className = 'hint';
        status.textContent = `儲存失敗：${e.message}`;
      }
    }

    app.append(h('section', { class: 'setup editor' },
      h('div', { class: 'editor-bar' },
        h('button', { type: 'button', onclick: () => {
          if (dirty && !confirm('還沒儲存，確定要離開嗎？')) return;
          onDone();
        } }, '← 返回'),
        status,
        h('button', { type: 'button', class: 'primary', onclick: save }, '儲存')),
      h('div', { class: 'field' }, h('label', { class: 'title' }, '題庫名稱', nameInput)),
      h('div', { class: 'field' },
        h('p', { class: 'muted' }, '每一組配對有兩張牌，各自可以是文字或圖片：圖配圖、圖配字、字配字都可以，也能混用。多個題目可以共用同一個答案（例如「3+4」「5+2」都配「7」）：各建一組，答案填一樣的，玩的時候牌面一樣的答案牌可以互換。'),
        h('p', { class: 'muted' }, '想玩「大小排序」或「連連看」，請在每組填上數值（與單位）。第二張牌選「自動」時，牌面會直接用數值與單位。'),
        count, list,
        h('button', { type: 'button', class: 'add-pair', onclick: () => {
          const pair = blankPair();
          draft.pairs.push(pair);
          touch();
          renderPairs();
          const row = list.querySelector(`[data-pair="${pair.id}"]`);
          row?.scrollIntoView({ block: 'center' });
          row?.querySelector('input')?.focus();
        } }, '＋ 新增一組配對'))));
    renderPairs();
  });
}
