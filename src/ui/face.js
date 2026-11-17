import { h } from './dom.js';

// 一張牌的內容（第二張牌）：文字或圖片。連連看的右邊使用。
export function contentFace(content) {
  if (content.type === 'image') return [h('img', { class: 'face-img', src: content.value, alt: '', draggable: 'false' })];
  return [h('span', { class: 'face-text' }, content.value)];
}

// 一組配對的「題目面」（第一張牌）：文字，或圖片加上說明文字。大小排序與連連看共用。
export function pairFace(pair) {
  if (pair.a.type === 'image') {
    return [
      h('img', { class: 'face-img', src: pair.a.value, alt: pair.label ?? '', draggable: 'false' }),
      pair.label ? h('span', { class: 'face-text' }, pair.label) : null,
    ];
  }
  return [h('span', { class: 'face-text' }, pair.a.value)];
}
