import { h, app, show } from './dom.js';
import { loadAllBanks, saveBank, removeBank } from '../store/banks.js';
import { blankPair, cloneBank, createBank, isValidContent, validateBank, LIMITS } from '../store/bank-model.js';
import { processImageFile } from './image.js';
import { exportBank, parseImport } from '../store/bank-io.js';

const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

function downloadBank(bank) {
  const blob = new Blob([exportBank(bank)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeName = bank.name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || '題庫';
  const a = h('a', { href: url, download: `${safeName}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------------- 題庫清單 ----------------
export async function showBankList({ onBack }) {
  const { banks, storageOk } = await loadAllBanks();
  show(() => {
    const refresh = () => showBankList({ onBack });
    const fail = (e) => alert(`操作失敗：${e.message}`);

    const importInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    importInput.addEventListener('change', async () => {
      const file = importInput.files[0];
      importInput.value = '';
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) return alert('檔案太大，無法匯入（上限 100 MB）');
      const result = parseImport(await file.text());
      if (!result.ok) {
        const shown = result.errors.slice(0, 5).join('\n');
        const more = result.errors.length > 5 ? `\n…還有 ${result.errors.length - 5} 項問題` : '';
        return alert(`匯入失敗，題庫沒有任何變動：\n${shown}${more}`);
      }
      try {
        await saveBank(result.bank);
        alert(`已匯入「${result.bank.name}」（${result.bank.pairs.length} 組配對）`);
        refresh();
      } catch (e) {
        fail(e);
      }
    });

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
          h('button', { type: 'button', onclick: () => downloadBank(bank) }, '匯出'),
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
      h('p', { class: 'muted' }, '內建題庫不能修改；想改的話，先按「複製」再編輯副本。')));
  });
}

// ---------------- 題庫編輯 ----------------
function showBankEditor(source, { onDone, isNew = false }) {
  show(() => {
    const draft = { id: source.id, name: source.name, pairs: structuredClone(source.pairs), updatedAt: source.updatedAt };
    let dirty = isNew;
    const touch = () => { dirty = true; status.textContent = ''; };

    const status = h('span', { class: 'muted', role: 'status' });
    const nameInput = h('input', { type: 'text', value: draft.name, maxlength: LIMITS.nameMax, 'aria-label': '題庫名稱' });
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; touch(); });
    const list = h('ol', { class: 'pair-list' });

    function sideEditor(pair, side, n) {
      const content = pair[side];
      const label = side === 'a' ? '第一張牌' : '第二張牌';
      const error = h('p', { class: 'hint small', role: 'alert' });
      const setType = (type) => {
        if (content.type === type) return;
        pair[side] = { type, value: '' };
        touch();
        renderPairs();
      };
      const typeBtn = (type, text) =>
        h('button', { type: 'button', 'aria-pressed': String(content.type === type), onclick: () => setType(type) }, text);

      let body;
      if (content.type === 'text') {
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
      return h('div', { class: 'side' },
        h('div', { class: 'seg', role: 'group', 'aria-label': `第 ${n} 組${label}類型` }, typeBtn('text', '文字'), typeBtn('image', '圖片')),
        body, error);
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
          } }, '✕'));
      }));
      count.textContent = `共 ${draft.pairs.length} 組`;
    }
    const count = h('span', { class: 'muted' });

    async function save() {
      const errors = validateBank(draft);
      list.querySelectorAll('.pair-row').forEach((row, i) => {
        const p = draft.pairs[i];
        row.classList.toggle('incomplete', !isValidContent(p.a) || !isValidContent(p.b));
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
