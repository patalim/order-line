import { h, app, show, onLeave, setNav, setLeaveGuard } from './dom.js';
import { loadAllBanks } from '../store/banks.js';
import { loadSettings, saveSettings } from '../store/settings.js';
import { buildMatchRound, createMatchState, pickMatch, checkMatchLinks, revealMatchRound, MATCH_MAX } from '../game/match.js';
import { numericPairs, formatValue } from '../game/pair.js';
import { formatTime } from '../game/layout.js';
import { pairFace } from './face.js';
import { getScore, recordRound, resetScore } from './session.js';
import { play } from './audio.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------- 設定畫面 ----------------
export async function showMatchSetup() {
  const { banks } = await loadAllBanks();
  const usable = banks.filter((b) => numericPairs(b.pairs).length >= 2);
  show(() => {
    setNav('match');
    if (!usable.length) {
      app.append(h('section', { class: 'setup' }, h('h1', {}, '連連看'),
        h('p', { class: 'hint' }, '目前沒有含「數值」的題庫（至少要有 2 組）。請到「題庫管理」新增，或匯入 CSV。')));
      return;
    }
    const settings = loadSettings();
    let bank = usable.find((b) => b.id === settings.matchBankId) ?? usable[0];

    const bankSelect = h('select', { id: 'match-bank' },
      usable.map((b) => h('option', { value: b.id }, `${b.name}（${numericPairs(b.pairs).length} 組）`)));
    bankSelect.value = bank.id;
    const countSelect = h('select', { id: 'match-count' });
    function fillCounts() {
      const max = Math.min(MATCH_MAX, numericPairs(bank.pairs).length);
      const keep = Number(countSelect.value) || settings.matchCount;
      countSelect.replaceChildren(...Array.from({ length: max - 1 }, (_, i) => h('option', { value: i + 2 }, `${i + 2} 組`)));
      countSelect.value = String(Math.min(Math.max(keep, 2), max));
    }
    bankSelect.addEventListener('change', () => { bank = usable.find((b) => b.id === bankSelect.value); fillCounts(); });
    fillCounts();

    app.append(h('section', { class: 'setup' },
      h('h1', {}, '連連看'),
      h('p', { class: 'muted' }, '先點左邊的卡片，再點右邊的數值，兩邊就會連起來。'),
      h('div', { class: 'field' }, h('label', { class: 'title', for: 'match-bank' }, '題庫'), bankSelect),
      h('div', { class: 'field' }, h('label', { class: 'title', for: 'match-count' }, '一次連幾組'), countSelect),
      h('button', { type: 'button', class: 'primary start', onclick: () => {
        const count = Number(countSelect.value);
        saveSettings({ ...settings, matchBankId: bank.id, matchCount: count });
        play('flip'); // 在使用者操作內啟動 AudioContext
        startMatchGame(bank, count);
      } }, '開始')));
  });
}

// ---------------- 遊戲畫面 ----------------
function startMatchGame(bank, count) {
  show(() => {
    setNav('match');
    const round = buildMatchRound(bank.pairs, count);
    let state = createMatchState();
    let reveal = null; // 揭曉後的結果
    const startedAt = performance.now();
    let finalMs = 0;

    const leftButtons = new Map(round.cards.map((card) =>
      [card.id, h('button', { type: 'button', class: 'match-item', 'data-side': 'L', 'data-key': card.id }, pairFace(card))]));
    const rightButtons = new Map(round.right.map((r) =>
      [r.index, h('button', { type: 'button', class: 'match-item', 'data-side': 'R', 'data-key': String(r.index) }, formatValue(r.value, r.unit))]));
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'match-lines');
    svg.setAttribute('aria-hidden', 'true');
    const board = h('div', { class: 'match-board' }, svg,
      h('div', { class: 'match-col' }, [...leftButtons.values()]),
      h('div', { class: 'match-col' }, [...rightButtons.values()]));

    const time = h('span', { class: 'stat' });
    const scoreEl = h('span', { class: 'stat' });
    const message = h('p', { class: 'sort-result', role: 'status' });
    const checkBtn = h('button', { type: 'button', onclick: check }, '核對答案（不顯示答案）');
    const revealBtn = h('button', { type: 'button', class: 'primary', onclick: showAnswer }, '顯示正確答案');
    const nextBtn = h('button', { type: 'button', class: 'primary', hidden: true, onclick: () => startMatchGame(bank, count) }, '下一回合');
    const resetBtn = h('button', { type: 'button', onclick: () => { resetScore(); renderHud(); } }, '重設計分');
    const timerId = setInterval(renderHud, 250);

    function renderHud() {
      time.textContent = `時間 ${formatTime(reveal ? finalMs : performance.now() - startedAt)}`;
      const s = getScore();
      scoreEl.textContent = `累計得分 ${s.total} / ${s.max}（${s.rounds} 回合）`;
    }

    const ownerOf = (rightIndex) => Object.keys(state.links).find((id) => state.links[id] === rightIndex);
    const resultOf = (leftId) => reveal?.results.find((r) => r.id === leftId);
    // 連線與兩端項目共用的狀態：揭曉後看對錯；平時看是否已鎖定（對）或被標記（錯）。
    function statusOf(leftId) {
      if (reveal) return resultOf(leftId).ok ? 'ok' : 'no';
      if (state.locked.includes(leftId)) return 'ok';
      if (state.flagged.includes(leftId)) return 'no';
      return '';
    }

    function render() {
      for (const [id, el] of leftButtons) {
        const linked = id in state.links;
        const selected = state.sel?.side === 'L' && state.sel.key === id;
        el.className = `match-item${linked ? ' linked' : ''}${selected ? ' sel' : ''}${linked ? ` ${statusOf(id)}` : ''}`;
        el.setAttribute('aria-pressed', String(selected));
      }
      for (const [index, el] of rightButtons) {
        const owner = ownerOf(index);
        const selected = state.sel?.side === 'R' && state.sel.key === index;
        el.className = `match-item${owner !== undefined ? ' linked' : ''}${selected ? ' sel' : ''}${owner !== undefined ? ` ${statusOf(owner)}` : ''}`;
        el.setAttribute('aria-pressed', String(selected));
      }
      board.classList.toggle('done', state.revealed);
      drawLines();
    }

    function drawLines() {
      const box = board.getBoundingClientRect();
      svg.setAttribute('width', box.width);
      svg.setAttribute('height', box.height);
      const segment = (leftId, rightIndex, cls) => {
        const a = leftButtons.get(leftId)?.getBoundingClientRect();
        const b = rightButtons.get(rightIndex)?.getBoundingClientRect();
        if (!a || !b) return null;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', cls);
        line.setAttribute('x1', a.right - box.left);
        line.setAttribute('y1', a.top + a.height / 2 - box.top);
        line.setAttribute('x2', b.left - box.left);
        line.setAttribute('y2', b.top + b.height / 2 - box.top);
        return line;
      };
      const lines = [];
      if (reveal) {
        // 答錯或沒連的：補上綠色虛線指出正確答案
        for (const r of reveal.results) if (!r.ok) lines.push(segment(r.id, r.answer, 'ans'));
      }
      for (const [id, rightIndex] of Object.entries(state.links)) lines.push(segment(id, rightIndex, statusOf(id)));
      svg.replaceChildren(...lines.filter(Boolean));
    }

    board.addEventListener('click', (e) => {
      const el = e.target.closest('.match-item');
      if (!el || state.revealed) return;
      const side = el.dataset.side;
      const next = pickMatch(round, state, side, side === 'L' ? el.dataset.key : Number(el.dataset.key));
      if (next === state) return;
      state = next;
      play('flip');
      render();
    });

    // 核對：答對的線變綠色並鎖定，答錯的線變紅色但不顯示答案，下一位玩家接著連。
    function check() {
      if (state.revealed) return;
      const r = checkMatchLinks(round, state);
      if (!r.linked) {
        message.textContent = '還沒有連任何線。';
        return;
      }
      state = r.state;
      play(r.wrong ? 'miss' : 'match');
      message.textContent = r.correct === r.total
        ? '全部答對了！請按「顯示正確答案」結算。'
        : `目前答對 ${r.correct} / ${r.total} 組（綠線已鎖定）。紅線會在下一位玩家操作時清除，請繼續連線。`;
      render();
    }

    function showAnswer() {
      if (state.revealed) return;
      finalMs = performance.now() - startedAt;
      clearInterval(timerId);
      reveal = revealMatchRound(round, state);
      state = reveal.state;
      recordRound(reveal.correct, reveal.total);
      play(reveal.perfect ? 'win' : reveal.correct > 0 ? 'match' : 'miss');
      message.textContent = reveal.perfect
        ? `🎉 全對！用時 ${formatTime(finalMs)}`
        : `答對 ${reveal.correct} / ${reveal.total} 組，用時 ${formatTime(finalMs)}（綠色虛線為正確答案）`;
      checkBtn.hidden = true;
      revealBtn.hidden = true;
      nextBtn.hidden = false;
      nextBtn.focus();
      render();
      renderHud();
    }

    const canLeaveNow = () => state.revealed || confirm('這一回合還沒結束，確定要離開嗎？');
    app.append(h('div', { class: 'sort-game' },
      h('div', { class: 'hud' },
        h('button', { type: 'button', onclick: () => { if (canLeaveNow()) showMatchSetup(); } }, '← 回設定'),
        time, scoreEl, h('span', { class: 'spacer' }), resetBtn),
      h('div', { class: 'sort-axis' }, h('span', {}, bank.name)),
      board, message,
      h('div', { class: 'sort-controls' }, checkBtn, revealBtn, nextBtn)));

    const observer = new ResizeObserver(drawLines);
    observer.observe(board);
    window.addEventListener('resize', drawLines);
    setLeaveGuard(canLeaveNow);
    onLeave(() => {
      clearInterval(timerId);
      observer.disconnect();
      window.removeEventListener('resize', drawLines);
    });
    board.querySelectorAll('img').forEach((img) => img.addEventListener('load', drawLines));
    render();
    renderHud();
  });
}
