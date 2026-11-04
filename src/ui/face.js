import { h } from './dom.js';

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
