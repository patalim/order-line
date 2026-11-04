import { gridSize } from '../game/layout.js';

const GAP = 8;

function faceContent(content) {
  if (content.type === 'image') {
    const img = document.createElement('img');
    img.src = content.value;
    img.alt = '';
    img.draggable = false;
    return img;
  }
  const span = document.createElement('span');
  span.textContent = content.value;
  if ([...content.value].length > 4) span.className = 'long';
  return span;
}

function makeCard(card, onPick, numbered) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'card';
  el.dataset.status = 'down';
  el.setAttribute('aria-label', numbered ? `蓋著的牌 ${card.id + 1} 號` : '蓋著的牌');
  const inner = document.createElement('span');
  inner.className = 'inner';
  const back = document.createElement('span');
  back.className = 'face back';
  // 牌背：問號，或依位置編號（讓小朋友翻錯時比較沒有挫折感，也方便老師喊「請翻 5 號」）。
  back.textContent = numbered ? String(card.id + 1) : '?';
  if (numbered) back.classList.add('numbered', `digits-${String(card.id + 1).length >= 3 ? 3 : 2}`);
  const front = document.createElement('span');
  front.className = 'face front';
  front.append(faceContent(card.content));
  inner.append(back, front);
  el.append(inner);
  // 滑鼠與觸控都走 Pointer Events；鍵盤按 Enter／空白時 click 的 detail 為 0。
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    onPick(card.id);
  });
  el.addEventListener('click', (e) => {
    if (e.detail === 0) onPick(card.id);
  });
  return el;
}

// container 內放牌桌；牌的邊長依可用空間與欄列數即時計算，直橫向都會填滿。
export function createBoard(container, cards, onPick, { numbered = false } = {}) {
  const { cols, rows } = gridSize(cards.length);
  const board = document.createElement('div');
  board.className = 'board';
  board.style.setProperty('--gap', `${GAP}px`);
  board.style.gridTemplateColumns = `repeat(${cols}, var(--card))`;
  const els = cards.map((c) => makeCard(c, onPick, numbered));
  board.append(...els);
  container.replaceChildren(board);

  const fit = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const size = Math.floor(Math.min((w - GAP * (cols - 1)) / cols, (h - GAP * (rows - 1)) / rows));
    board.style.setProperty('--card', `${Math.max(size, 40)}px`);
  };
  const observer = new ResizeObserver(fit);
  observer.observe(container);
  fit();

  return {
    update(state) {
      state.cards.forEach((c, i) => {
        const el = els[i];
        const status = state.previewing ? 'up' : c.status; // 記憶時間：全部亮出
        if (el.dataset.status === status) return;
        el.dataset.status = status;
        el.setAttribute('aria-label', status === 'down' ? (numbered ? `蓋著的牌 ${c.id + 1} 號` : '蓋著的牌') : `已翻開：${c.content.type === 'image' ? '圖片' : c.content.value}`);
      });
    },
    focusFirstDown(state) {
      els[state.cards.findIndex((c) => c.status === 'down')]?.focus();
    },
    destroy() {
      observer.disconnect();
    },
  };
}
