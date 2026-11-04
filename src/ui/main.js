import { buildDeck } from '../game/deck.js';
import { createGame, flip, resolve, needsResolve, endPreview, isMatch } from '../game/state.js';
import { rankPlayers } from '../game/rank.js';
import { formatTime } from '../game/layout.js';
import { loadSettings, saveSettings } from '../store/settings.js';
import { recordResult } from '../store/records.js';
import { createBoard } from './board.js';
import { play, setSoundEnabled } from './audio.js';
import { loadAllBanks } from '../store/banks.js';
import { app, h, show, onLeave } from './dom.js';
import { showBankList } from './editor.js';

const MAX_PLAYERS = 6;
const MATCH_DELAY = 700;
const MISS_DELAY = 1100;

// ---------------- 設定畫面 ----------------
async function showSetup() {
  const { banks } = await loadAllBanks();
  show(() => {
    const settings = loadSettings();
    let bank = banks.find((b) => b.id === settings.bankId) ?? banks[0];
    let playerCount = Math.min(settings.players.length, MAX_PLAYERS);
    const names = Array.from({ length: MAX_PLAYERS }, (_, i) => settings.players[i] ?? `玩家 ${i + 1}`);

    const hint = h('p', { class: 'hint', role: 'alert' });
    const startBtn = h('button', { class: 'primary start', type: 'button' }, '開始遊戲');
    const customInput = h('input', { type: 'number', id: 'custom', min: 2, step: 1, 'aria-label': '自選組數' });
    const nameBox = h('div', { class: 'names' });
    const bankSelect = h('select', { id: 'bank' }, banks.map((b) => h('option', { value: b.id }, `${b.name}（${b.pairs.length} 組）`)));
    bankSelect.value = bank.id;

    const radioGroup = (name, items, current, onChange, extraClass = '') =>
      h('div', { class: `choices ${extraClass}`.trim() }, items.map(([value, label]) => {
        const input = h('input', { type: 'radio', name, value, checked: String(current) === String(value) });
        input.addEventListener('change', () => onChange(value));
        return h('label', {}, input, label);
      }));

    let size = settings.size;
    let memorySeconds = Number(settings.memorySeconds) || 0;
    let cardBack = settings.cardBack === 'number' ? 'number' : 'question';
    const cardBackGroup = radioGroup('cardBack', [['question', '？ 問號'], ['number', '1 2 3 編號']], cardBack, (v) => { cardBack = v; });
    const memoryGroup = radioGroup('memory', [[0, '關閉'], [3, '3 秒'], [5, '5 秒'], [10, '10 秒']], memorySeconds, (v) => { memorySeconds = Number(v); }, 'compact');
    const sizeGroup = radioGroup('size', [['4', '4×4（8 組）'], ['6', '6×6（18 組）'], ['custom', '自選']], size, (v) => { size = v; refresh(); });
    const playerGroup = radioGroup('players', Array.from({ length: MAX_PLAYERS }, (_, i) => [i + 1, `${i + 1} 人`]), playerCount, (v) => { playerCount = Number(v); refresh(); }, 'compact');
    customInput.value = settings.customPairs;
    customInput.addEventListener('input', refresh);
    const chain = h('input', { type: 'checkbox', id: 'chain', checked: settings.chainOnMatch });
    const sound = h('input', { type: 'checkbox', id: 'sound', checked: settings.sound });
    bankSelect.addEventListener('change', () => { bank = banks.find((b) => b.id === bankSelect.value); refresh(); });

    function pairCount() {
      return size === 'custom' ? Number(customInput.value) : Number(size) ** 2 / 2;
    }
    function refresh() {
      customInput.disabled = size !== 'custom';
      customInput.max = bank.pairs.length;
      nameBox.replaceChildren(...Array.from({ length: playerCount }, (_, i) => {
        const input = h('input', { type: 'text', value: names[i], maxlength: 12, 'aria-label': `第 ${i + 1} 位玩家名字` });
        input.addEventListener('input', () => { names[i] = input.value; });
        return input;
      }));
      const n = pairCount();
      let msg = '';
      if (!Number.isInteger(n) || n < 2) msg = '組數至少要 2 組。';
      else if (n > bank.pairs.length) msg = `這個題庫只有 ${bank.pairs.length} 組配對，請選較小的牌數。`;
      hint.textContent = msg;
      startBtn.disabled = msg !== '';
    }

    startBtn.addEventListener('click', () => {
      const players = names.slice(0, playerCount).map((n, i) => n.trim() || `玩家 ${i + 1}`);
      const next = { ...settings, bankId: bank.id, size, customPairs: Number(customInput.value) || settings.customPairs, players, chainOnMatch: chain.checked, memorySeconds, cardBack, sound: sound.checked };
      saveSettings(next);
      setSoundEnabled(next.sound);
      play('flip'); // 在使用者操作內啟動 AudioContext
      startGame(bank, pairCount(), { players, chainOnMatch: next.chainOnMatch, memorySeconds, cardBack });
    });

    app.append(h('section', { class: 'setup' },
      h('h1', {}, '翻牌配對'),
      h('div', { class: 'field' }, h('label', { class: 'title', for: 'bank' }, '題庫'),
        h('div', { class: 'bank-pick' }, bankSelect,
          h('button', { type: 'button', onclick: () => showBankList({ onBack: showSetup }) }, '題庫管理'))),
      h('fieldset', { class: 'field' }, h('legend', {}, '牌數'), sizeGroup,
        h('div', { class: 'inline', style: 'margin-top:10px' }, h('label', { for: 'custom' }, '自選組數：'), customInput)),
      h('fieldset', { class: 'field' }, h('legend', {}, '玩家人數'), playerGroup, h('div', { style: 'margin-top:10px' }, nameBox)),
      h('fieldset', { class: 'field' }, h('legend', {}, '牌背（蓋起來時顯示）'), cardBackGroup),
      h('fieldset', { class: 'field' }, h('legend', {}, '記憶時間（開局先看幾秒）'), memoryGroup),
      h('div', { class: 'field' },
        h('label', { class: 'inline' }, chain, '配對成功可再翻一次（多人時）'),
        h('label', { class: 'inline' }, sound, '音效')),
      hint, startBtn));
    refresh();
  });
}

// ---------------- 遊戲畫面 ----------------
function startGame(bank, pairs, opts) {
  const { players, chainOnMatch, memorySeconds = 0, cardBack = 'question' } = opts;
  show(() => {
    let state = createGame({ cards: buildDeck(bank.pairs, pairs), players, chainOnMatch, preview: memorySeconds > 0 });
    let startedAt = null;
    let finalMs = 0;
    let timerId = null;
    let resolveId = null;
    let resultId = null;
    let previewId = null;
    let previewLeft = memorySeconds;

    const moves = h('span', { class: 'stat' });
    const time = h('span', { class: 'stat' });
    const scores = h('div', { class: 'scores', 'aria-live': 'polite' });
    const soundBtn = h('button', { type: 'button' });
    const wrap = h('div', { class: 'board-wrap' });
    const previewText = h('span', { role: 'status' });
    const preview = h('div', { class: 'preview' }, previewText,
      h('button', { type: 'button', class: 'primary', onclick: () => finishPreview() }, '開始！'));

    const elapsed = () => (startedAt == null ? 0 : (state.finished ? finalMs : performance.now() - startedAt));

    function renderHud() {
      moves.textContent = `步數 ${state.moves}`;
      time.textContent = `時間 ${formatTime(elapsed())}`;
      soundBtn.textContent = loadSettings().sound ? '🔊 音效開' : '🔇 音效關';
      if (state.players.length > 1) {
        scores.replaceChildren(...state.players.map((p, i) =>
          h('span', { class: `score${i === state.current && !state.finished ? ' turn' : ''}` },
            `${i === state.current && !state.finished ? '▶ ' : ''}${p.name}：${p.pairs} 組`)));
      }
    }

    // 孩子可能不小心點到「回設定」，遊戲進行中先確認。
    const leave = () => {
      if (startedAt != null && !state.finished && !confirm('遊戲還沒結束，確定要離開嗎？')) return;
      showSetup();
    };

    // 直向：資訊列在牌桌上方；橫向矮螢幕（平板橫放）：資訊列移到左側，牌桌吃滿高度。
    app.append(h('div', { class: 'game' },
      h('div', { class: 'panel' },
        h('div', { class: 'hud' },
          h('button', { type: 'button', onclick: leave }, '← 回設定'),
          moves, time, h('span', { class: 'spacer' }), soundBtn),
        state.players.length > 1 ? scores : null,
        state.previewing ? preview : null),
      wrap));

    soundBtn.addEventListener('click', () => {
      const s = loadSettings();
      s.sound = !s.sound;
      saveSettings(s);
      setSoundEnabled(s.sound);
      renderHud();
    });

    const board = createBoard(wrap, state.cards, (index) => {
      const next = flip(state, index);
      if (next === state) return;
      state = next;
      if (startedAt == null) {
        startedAt = performance.now();
        timerId = setInterval(renderHud, 250);
      }
      play('flip');
      board.update(state);
      renderHud();
      if (needsResolve(state)) {
        resolveId = setTimeout(doResolve, isMatch(state) ? MATCH_DELAY : MISS_DELAY);
      }
    }, { numbered: cardBack === 'number' });

    function finishPreview() {
      if (!state.previewing) return;
      clearInterval(previewId);
      state = endPreview(state);
      preview.remove();
      play('flip');
      board.update(state);
      renderHud();
    }

    function doResolve() {
      state = resolve(state);
      board.update(state);
      if (state.finished) {
        finalMs = performance.now() - startedAt;
        clearInterval(timerId);
        play('win');
      } else {
        play(state.lastResult);
      }
      renderHud();
      if (state.finished) resultId = setTimeout(showResult, 600);
    }

    // 單人局：顯示這局成績，並與「題庫＋牌數」的最佳紀錄比較。
    function singleResult() {
      const { record, newMoves, newTime } = recordResult(bank.id, state.cards.length, { moves: state.moves, timeMs: finalMs }, memorySeconds > 0);
      const row = (label, value, isNew, best) =>
        h('li', {}, h('span', {}, label),
          h('span', {}, value, h('small', { class: isNew ? 'badge' : 'muted' }, isNew ? ' 🏆 新紀錄！' : `　最佳 ${best}`)));
      return h('ul', { class: 'ranking' },
        memorySeconds > 0 ? h('li', {}, h('span', { class: 'muted' }, '記憶模式的紀錄與一般模式分開計算')) : null,
        row('步數', String(state.moves), newMoves, String(record.bestMoves)),
        row('時間', formatTime(finalMs), newTime, formatTime(record.bestTimeMs)));
    }

    function showResult() {
      const multi = state.players.length > 1;
      const body = multi
        ? h('ol', { class: 'ranking' }, rankPlayers(state.players).map((p) =>
            h('li', {}, h('span', {}, `第 ${p.rank} 名　${p.name}`), h('span', {}, `${p.pairs} 組`))))
        : singleResult();
      const dialog = h('dialog', {},
        h('h2', {}, multi ? '🎉 遊戲結束' : '🎉 過關！'), body,
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'primary', type: 'button', onclick: () => startGame(bank, pairs, opts) }, '再玩一次'),
          h('button', { type: 'button', onclick: showSetup }, '回設定')));
      app.append(dialog);
      dialog.showModal();
    }

    onLeave(() => {
      clearInterval(timerId);
      clearTimeout(resolveId);
      clearTimeout(resultId);
      clearInterval(previewId);
      board.destroy();
    });
    if (state.previewing) {
      board.update(state); // 全部亮出
      const tick = () => { previewText.textContent = `記住牌的位置！${previewLeft} 秒後蓋牌`; };
      tick();
      previewId = setInterval(() => {
        previewLeft -= 1;
        if (previewLeft <= 0) finishPreview();
        else tick();
      }, 1000);
    }
    renderHud();
  });
}

setSoundEnabled(loadSettings().sound);
showSetup();
