/*
 * Reward sound effects, synthesized in code (no audio files needed).
 *   RewardSounds.render('trophy')  -> { sampleRate, samples: Float32Array }
 *   RewardSounds.play('trophy')    -> plays it in the browser via Web Audio (call after a tap)
 * Needs rewards.js loaded first (it holds each reward's sound cues).
 */
(function (root) {
'use strict';
const Rewards = root.Rewards || (typeof require !== 'undefined' ? require('./rewards.js') : null);
const SR = 44100;

let seed = 1;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const hz = semis => 523.25 * Math.pow(2, semis / 12); // from C5

function add(buf, start, len, fn) {
  const s0 = Math.floor(start * SR), n = Math.floor(len * SR);
  for (let i = 0; i < n && s0 + i < buf.length; i++) if (s0 + i >= 0) buf[s0 + i] += fn(i / SR);
}
function bell(buf, t, f, vol = 0.35, dur = 0.9) {
  add(buf, t, dur, x => vol * Math.exp(-x * 5) * Math.min(1, x * 400) *
    (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x) + 0.12 * Math.sin(6 * Math.PI * f * x)));
}
function filteredNoise(buf, t, dur, vol, cutoff /* fn(x)->0..1 */, env) {
  let y = 0;
  add(buf, t, dur, x => { const a = cutoff(x); y += a * (noise() - y); return vol * env(x) * y; });
}

const SOUNDS = {
  pop(b, t) {
    let ph = 0;
    add(b, t, 0.09, x => { ph += 2 * Math.PI * (900 - 6500 * x) / SR; return 0.5 * Math.exp(-x * 40) * Math.sin(ph); });
  },
  note(b, t, k) { bell(b, t, hz(PENTA[k] || 0)); },
  sparkle(b, t) { for (let i = 0; i < 7; i++) bell(b, t + i * 0.05, hz(PENTA[5 + ((i * 3) % 6)] + 12), 0.12, 0.35); },
  shimmer(b, t) { for (let i = 0; i < 10; i++) bell(b, t + i * 0.045, hz(PENTA[(i * 2) % 10] + 12), 0.09, 0.5); },
  whoosh(b, t) { filteredNoise(b, t, 0.45, 0.5, x => 0.05 + 0.4 * Math.sin(Math.PI * x / 0.45), x => Math.sin(Math.PI * x / 0.45)); },
  boom(b, t) {
    let ph = 0;
    add(b, t, 0.6, x => { ph += 2 * Math.PI * (90 - 60 * x) / SR; return 0.6 * Math.exp(-x * 6) * Math.sin(ph); });
    filteredNoise(b, t, 0.5, 0.6, () => 0.08, x => Math.exp(-x * 8));
  },
  thud(b, t) { let ph = 0; add(b, t, 0.2, x => { ph += 2 * Math.PI * (130 - 300 * x) / SR; return 0.7 * Math.exp(-x * 20) * Math.sin(ph); }); },
  coin(b, t) { bell(b, t, 1318.5, 0.2, 0.25); bell(b, t + 0.06, 1975.5, 0.2, 0.35); },
  fanfare(b, t) {
    [0, 4, 7, 12].forEach((s, i) => bell(b, t + i * 0.09, hz(s), 0.22, 0.5));
    [0, 4, 7, 12].forEach(s => add(b, t + 0.36, 0.7, x => {
      const f = hz(s), e = Math.min(1, x * 30) * Math.exp(-x * 3);
      return 0.07 * e * (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(4 * Math.PI * f * x) + 0.2 * Math.sin(6 * Math.PI * f * x));
    }));
  },
  boing(b, t) {
    let ph = 0;
    add(b, t, 0.3, x => { ph += 2 * Math.PI * (180 + 500 * x / 0.3 + 30 * Math.sin(x * 70)) / SR; return 0.35 * Math.sin(Math.PI * x / 0.3) * Math.sin(ph); });
  },
  rumble(b, t) { filteredNoise(b, t, 0.85, 0.8, () => 0.03, x => Math.min(1, x * 5) * Math.min(1, (0.85 - x) * 6)); },
  tick(b, t) { add(b, t, 0.03, x => 0.3 * Math.exp(-x * 150) * Math.sin(2 * Math.PI * 1500 * x)); },
  creak(b, t) {
    let ph = 0;
    add(b, t, 0.3, x => { ph += 2 * Math.PI * (170 + 300 * x) / SR; const saw = (ph / (2 * Math.PI)) % 1 * 2 - 1; return 0.12 * Math.sin(Math.PI * x / 0.3) * saw; });
  },
};


function render(id) {
  seed = 1;
  const dur = Rewards.duration(id);
  const buf = new Float32Array(Math.ceil((dur + 0.6) * SR));
  Rewards.sfx(id).forEach(([t, type]) => { const [name, arg] = type.split(':'); SOUNDS[name](buf, t, +arg); });
  let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0.89 ? 0.89 / peak : 1;
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * gain * 1.1);
  return { sampleRate: SR, samples: buf };
}
let ac = null;
const cache = {};
function play(id) {
  if (typeof AudioContext === 'undefined') return null;
  ac = ac || new AudioContext();
  if (ac.state === 'suspended') ac.resume();
  if (!cache[id]) {
    const { samples } = render(id);
    const ab = ac.createBuffer(1, samples.length, SR); ab.copyToChannel(samples, 0); cache[id] = ab;
  }
  const src = ac.createBufferSource(); src.buffer = cache[id]; src.connect(ac.destination); src.start();
  return src;
}
const RewardSounds = { render, play, sampleRate: SR };
if (typeof module !== 'undefined' && module.exports) module.exports = RewardSounds;
root.RewardSounds = RewardSounds;
})(typeof window !== 'undefined' ? window : globalThis);
