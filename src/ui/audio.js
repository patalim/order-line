// Web Audio 合成音效，不用音檔。AudioContext 等第一次使用者操作後才建立。
let ctx = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
}

function getCtx() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(c, { freq, start = 0, dur = 0.15, type = 'sine', gain = 0.2, slideTo }) {
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const sounds = {
  flip: (c) => tone(c, { freq: 520, dur: 0.07, type: 'triangle', gain: 0.12 }),
  match: (c) => {
    tone(c, { freq: 660, dur: 0.14 });
    tone(c, { freq: 880, start: 0.12, dur: 0.22 });
  },
  miss: (c) => tone(c, { freq: 300, slideTo: 150, dur: 0.3, type: 'sawtooth', gain: 0.1 }),
  win: (c) => {
    [523, 659, 784, 1047].forEach((freq, i) => tone(c, { freq, start: i * 0.14, dur: 0.3 }));
  },
};

export function play(name) {
  if (!enabled) return;
  const c = getCtx();
  if (c) sounds[name]?.(c);
}
