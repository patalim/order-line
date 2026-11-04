// 畫面共用小工具：建立元素、切換畫面（切換時自動執行上一個畫面註冊的清理）。
export const app = document.getElementById('app');

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter((c) => c != null));
  return el;
}

let cleanup = () => {};
let leaveGuard = null;

// 畫面要在「離開前確認」時註冊：回傳 false 代表使用者選擇留下。切換畫面時自動清除。
export function setLeaveGuard(fn) {
  leaveGuard = fn;
}

export const canLeave = () => (leaveGuard ? leaveGuard() : true);

// 標示目前在上方選單的哪一個頁籤。
export function setNav(key) {
  document.querySelectorAll('#nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.key === key ? 'page' : 'false'));
}

export function show(render) {
  cleanup();
  cleanup = () => {};
  leaveGuard = null;
  app.replaceChildren();
  render();
}

// 在 render 內呼叫，註冊離開這個畫面時要做的清理（計時器等）。
export function onLeave(fn) {
  cleanup = fn;
}
