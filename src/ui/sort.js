import { h, app, show, onLeave, setNav, setLeaveGuard } from './dom.js';
import { loadAllBanks } from '../store/banks.js';
import { loadSettings, saveSettings } from '../store/settings.js';
import { buildSortRound, checkSort, SORT_MAX } from '../game/sort.js';
import { numericPairs, formatValue } from '../game/pair.js';
import { formatTime } from '../game/layout.js';
import { createReorder } from './reorder.js';
import { pairFace } from './face.js';
import { getScore, recordRound, resetScore } from './session.js';
import { play } from './audio.js';

// ---------------- 設定畫面 ----------------
export async function showSortSetup() {
  const { banks } = await loadAllBanks();
  const usable = banks.filter((b) => numericPairs(b.pairs).length >= 2);
  show(() => {
    setNav('sort');
    if (!usable.length) {
      app.append(h('section', { class: 'setup' }, h('h1', {}, '大小排序'),
        h('p', { class: 'hint' }, '目前沒有含「數值」的題庫（至少要有 2 組）。請到「題庫管理」新增，或匯入 CSV。')));
      return;
    }
    const settings = loadSettings();
    let bank = usable.find((b) => b.id === settings.sortBankId) ?? usable[0];

    const bankSelect = h('select', { id: 'sort-bank' },
      usable.map((b) => h('option', { value: b.id }, `${b.name}（${numericPairs(b.pairs).length} 組）`)));
    bankSelect.value = bank.id;
    const countSelect = h('select', { id: 'sort-count' });
    const dirSelect = h('select', { id: 'sort-dir' },
      h('option', { value: 'asc' }, '由小到大'), h('option', { value: 'desc' }, '由大到小'));
    dirSelect.value = settings.sortDirection === 'desc' ? 'desc' : 'asc';

    function fillCounts() {
      const max = Math.min(SORT_MAX, numericPairs(bank.pairs).length);
      const keep = Number(countSelect.value) || settings.sortCount;
      countSelect.replaceChildren(...Array.from({ length: max - 1 }, (_, i) => h('option', { value: i + 2 }, `${i + 2} 張`)));
      countSelect.value = String(Math.min(Math.max(keep, 2), max));
    }
    bankSelect.addEventListener('change', () => { bank = usable.find((b) => b.id === bankSelect.value); fillCounts(); });
    fillCounts();

    app.append(h('section', { class: 'setup' },
      h('h1', {}, '大小排序'),
      h('p', { class: 'muted' }, '拖曳卡片，依數值大小排好隊，最後按「揭曉答案」。'),
      h('div', { class: 'field' }, h('label', { class: 'title', for: 'sort-bank' }, '題庫'), bankSelect),
      h('div', { class: 'field' }, h('label', { class: 'title', for: 'sort-count' }, '一次排幾張'), countSelect),
      h('div', { class: 'field' }, h('label', { class: 'title', for: 'sort-dir' }, '排序方向'), dirSelect),
      h('button', { type: 'button', class: 'primary start', onclick: () => {
        const count = Number(countSelect.value);
        saveSettings({ ...settings, sortBankId: bank.id, sortCount: count, sortDirection: dirSelect.value });
        play('flip'); // 在使用者操作內啟動 AudioContext
        startSortGame(bank, count, dirSelect.value);
      } }, '開始')));
  });
}

// ---------------- 遊戲畫面 ----------------
function sortCard(pair, { reveal = false } = {}) {
  return h('div', { class: 'sort-card', 'data-id': pair.id },
    h('div', { class: 'sort-face' }, pairFace(pair)),
    h('div', { class: 'sort-value' }, formatValue(pair.value, pair.unit)),
    reveal ? null : h('div', { class: 'sort-mark', 'aria-hidden': 'true' }));
}

function startSortGame(bank, count, direction) {
  show(() => {
    setNav('sort');
    const round = buildSortRound(bank.pairs, count, direction);
    const startedAt = performance.now();
    let finalMs = 0;
    let revealed = false;

    const time = h('span', { class: 'stat' });
    const scoreEl = h('span', { class: 'stat' });
    const line = h('div', { class: 'sort-line', role: 'list', 'aria-label': '請依大小排序，可拖曳或用方向鍵移動' });
    for (const pair of round.cards) {
      const el = sortCard(pair);
      el.setAttribute('data-reorder-item', '');
      el.setAttribute('role', 'listitem');
      el.setAttribute('tabindex', '0');
      line.append(el);
    }
    const result = h('p', { class: 'sort-result', role: 'status' });
    const answerBox = h('div', { class: 'sort-answer', hidden: true },
      h('p', { class: 'muted' }, '正確順序'),
      h('div', { class: 'sort-line' }, round.answer.map((p) => sortCard(p, { reveal: true }))));
    const revealBtn = h('button', { type: 'button', class: 'primary', onclick: reveal }, '揭曉答案');
    const nextBtn = h('button', { type: 'button', class: 'primary', hidden: true, onclick: () => startSortGame(bank, count, direction) }, '下一回合');
    const resetBtn = h('button', { type: 'button', onclick: () => { resetScore(); renderHud(); } }, '重設計分');

    const reorder = createReorder(line);
    const timerId = setInterval(renderHud, 250);

    function renderHud() {
      time.textContent = `時間 ${formatTime(revealed ? finalMs : performance.now() - startedAt)}`;
      const s = getScore();
      scoreEl.textContent = `累計得分 ${s.total} / ${s.max}（${s.rounds} 回合）`;
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      finalMs = performance.now() - startedAt;
      clearInterval(timerId);
      reorder.setEnabled(false);
      const check = checkSort(round, reorder.order());
      const cards = new Map([...line.children].map((el) => [el.dataset.id, el]));
      for (const { id, ok } of check.results) {
        const el = cards.get(id);
        el.classList.add(ok ? 'ok' : 'no');
        el.querySelector('.sort-mark').textContent = ok ? '✔ 正確' : '✘ 錯誤';
      }
      line.classList.add('revealed');
      recordRound(check.correct, check.total);
      play(check.perfect ? 'win' : check.correct > 0 ? 'match' : 'miss');
      result.textContent = check.perfect
        ? `🎉 全對！用時 ${formatTime(finalMs)}`
        : `答對 ${check.correct} / ${check.total} 張，用時 ${formatTime(finalMs)}`;
      answerBox.hidden = check.perfect;
      revealBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus();
      renderHud();
    }

    const axisLabel = direction === 'asc' ? ['小', '大'] : ['大', '小'];
    app.append(h('div', { class: 'sort-game' },
      h('div', { class: 'hud' },
        h('button', { type: 'button', onclick: () => { if (canLeaveNow()) showSortSetup(); } }, '← 回設定'),
        time, scoreEl, h('span', { class: 'spacer' }), resetBtn),
      h('div', { class: 'sort-axis' }, h('span', {}, `← ${bank.name} ${axisLabel[0]}`), h('span', {}, `${bank.name} ${axisLabel[1]} →`)),
      line, result, answerBox,
      h('div', { class: 'sort-controls' }, revealBtn, nextBtn)));

    const canLeaveNow = () => revealed || confirm('這一回合還沒揭曉，確定要離開嗎？');
    setLeaveGuard(canLeaveNow);
    onLeave(() => {
      clearInterval(timerId);
      reorder.destroy();
    });
    renderHud();
  });
}
