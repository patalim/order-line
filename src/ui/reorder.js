// 拖曳排序（Pointer Events，滑鼠與觸控共用；沒有第三方套件）。
// container 的每個直接子元素需有 data-reorder-item 屬性與 data-id。
// 也支援鍵盤：把焦點放在牌上，按 ← ↑ 往前、→ ↓ 往後。
// 牌需設 touch-action: none（CSS），觸控拖曳時頁面才不會跟著捲動。

const DRAG_THRESHOLD = 6;

export function createReorder(container, { onChange } = {}) {
  let enabled = true;
  let drag = null;
  const items = () => [...container.children];
  const order = () => items().map((el) => el.dataset.id);
  const itemOf = (node) => {
    const el = node?.closest?.('[data-reorder-item]');
    return el && el.parentElement === container ? el : null;
  };

  // 讓被拖的牌跟著指標：先清掉位移取得它在版面上的位置，再算出要位移多少。
  function follow(e) {
    drag.el.style.transform = 'none';
    const r = drag.el.getBoundingClientRect();
    drag.el.style.transform = `translate(${e.clientX - drag.dx - r.left}px, ${e.clientY - drag.dy - r.top}px)`;
  }

  function onDown(e) {
    if (!enabled || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = itemOf(e.target);
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag = { el, pointerId: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    el.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      drag.el.classList.add('dragging');
      drag.el.style.pointerEvents = 'none'; // 之後 elementFromPoint 才找得到下面的牌
    }
    const under = itemOf(document.elementFromPoint(e.clientX, e.clientY));
    if (under && under !== drag.el) {
      const kids = items();
      container.insertBefore(drag.el, kids.indexOf(drag.el) < kids.indexOf(under) ? under.nextSibling : under);
    }
    follow(e);
  }

  function finish(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { el, moved } = drag;
    drag = null;
    el.style.transform = '';
    el.style.pointerEvents = '';
    el.classList.remove('dragging');
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (moved) onChange?.(order());
  }

  function onKey(e) {
    const el = itemOf(e.target);
    if (!enabled || !el) return;
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!back && !forward) return;
    e.preventDefault();
    const neighbor = back ? el.previousElementSibling : el.nextElementSibling;
    if (!neighbor) return;
    container.insertBefore(el, back ? neighbor : neighbor.nextSibling);
    el.focus();
    onChange?.(order());
  }

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
  container.addEventListener('keydown', onKey);

  return {
    order,
    setEnabled(on) { enabled = on; },
    destroy() {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', finish);
      container.removeEventListener('pointercancel', finish);
      container.removeEventListener('keydown', onKey);
    },
  };
}
