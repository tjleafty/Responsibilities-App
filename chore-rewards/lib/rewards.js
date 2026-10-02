/*
 * Chore reward animations: a small, dependency-free canvas library.
 *
 *   Rewards.play(canvas, 'trophy', { theme: Rewards.themes.space, text: { title: 'All done!' } })
 *   Rewards.render(ctx, 'trophy', t, { width, height, theme })   // deterministic single frame
 *   Rewards.list            // [{ id, name, use, duration, defaults }]
 *   Rewards.sfx('trophy')   // sound cues [[seconds, 'type'], ...] (matching WAVs live in sounds/)
 *   Rewards.adaptTheme(obj) // fills any missing theme keys from the default theme
 *
 * Every animation is drawn on a virtual 720x720 "stage" centred in the canvas, so it
 * works at any size or aspect ratio (phone portrait, tablet, 16:9 video). Backgrounds
 * and confetti fill the whole canvas. Pass { transparent: true } to draw over your app.
 */
(function (root) {
'use strict';
const TAU = Math.PI * 2;

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, s, e) => clamp((t - s) / (e - s));
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeIn = x => x * x * x;
const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const bounce = x => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
const rand = (i, k = 0) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------- colour ----------
function hexRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function alpha(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
}

// ---------- themes ----------
const DEFAULT_THEME = {
  id: 'sunny', name: 'Sunny Day', font: 'Fredoka',
  bg: '#FFF4E0', bg2: '#FFE9C7', ink: '#2D2A4A', surface: '#FFFFFF',
  primary: '#5B8DEF', secondary: '#FF7AA2', accent: '#FF8A3D', success: '#3CC48B',
  gold: '#FFC93C', goldDark: '#E0A400',
  confetti: ['#FF7AA2', '#FFC93C', '#3CC48B', '#5B8DEF', '#B28DFF'],
  mascot: { skin: '#A96E4E', hair: '#2D2A4A', shirt: '#3CC48B', pants: '#3B4A8C', shoes: '#FF6B6B' },
  pattern: 'dots',      // dots | stars | bubbles | leaves | none
  shape: 'confetti',    // confetti | star | heart | bubble | leaf | circle
  flame: ['#FF6B3D', '#FFC93C', '#FFF6D0'],
  night: '#1E1B3A',
  drawMascot: null,     // optional (ctx, pose) => void to swap in a theme's own character
};

const THEMES = {
  sunny: DEFAULT_THEME,
  space: {
    id: 'space', name: 'Outer Space', bg: '#1B1F4B', bg2: '#3A4090', ink: '#1E1B3A',
    primary: '#7B5CFF', secondary: '#36D6E7', accent: '#FF5CA8', success: '#2FD39A',
    gold: '#FFD84D', goldDark: '#E3A700',
    confetti: ['#36D6E7', '#FFD84D', '#FF5CA8', '#7B5CFF', '#FFFFFF'],
    mascot: { skin: '#F2C7A5', hair: '#C0522E', shirt: '#7B5CFF', pants: '#2A2F6B', shoes: '#36D6E7' },
    pattern: 'stars', shape: 'star', flame: ['#36A2FF', '#7FE6FF', '#FFFFFF'], night: '#0B0D2A',
  },
  ocean: {
    id: 'ocean', name: 'Under the Sea', bg: '#DFF6FA', bg2: '#BFE8F1', ink: '#14385C',
    primary: '#1E88C9', secondary: '#FF8C69', accent: '#FFB547', success: '#27B59A',
    gold: '#FFCF4A', goldDark: '#E0A21A',
    confetti: ['#1E88C9', '#FF8C69', '#FFCF4A', '#27B59A', '#7FD6F0'],
    mascot: { skin: '#7A4A32', hair: '#1A1A2E', shirt: '#FF8C69', pants: '#1E5F8C', shoes: '#FFCF4A' },
    pattern: 'bubbles', shape: 'bubble', night: '#0E2A48',
  },
  jungle: {
    id: 'jungle', name: 'Jungle Explorer', bg: '#EAF7DC', bg2: '#D2ECBA', ink: '#24361F',
    primary: '#3E9E4F', secondary: '#FF9F1C', accent: '#E5484D', success: '#2E9B57',
    gold: '#FFC83D', goldDark: '#D99A00',
    confetti: ['#3E9E4F', '#FF9F1C', '#FFC83D', '#E5484D', '#8BD06B'],
    mascot: { skin: '#E8B48F', hair: '#6B3E1F', shirt: '#FF9F1C', pants: '#3E5A2B', shoes: '#E5484D' },
    pattern: 'leaves', shape: 'leaf', night: '#152414',
  },
};

// Accepts a theme from anywhere and fills in what's missing. Understands the app's
// themes.json format directly (colors.*, fonts.display, pattern.kind/svg, reward.*),
// plus common alternative names (background, text, card).
const PARTICLES = {
  confetti: 'confetti', bubbles: 'bubble', starburst: 'star', leaves: 'leaf', sprinkles: 'sprinkle',
  petals: 'petal', pixels: 'pixel', bursts: 'star', hearts: 'heart', nuts: 'hex', snowflakes: 'snowflake', glow: 'glow',
};
function adaptTheme(src) {
  if (!src) return THEMES.sunny;
  if (typeof src === 'string') return adaptTheme(THEMES[src]);
  if (src.__adapted) return src;
  const c = src.colors || {}, rw = src.reward || {}, fonts = src.fonts || {};
  const pick = (...keys) => { for (const k of keys) { if (src[k] != null && typeof src[k] !== 'object') return src[k]; if (c[k] != null) return c[k]; } };
  const th = Object.assign({}, DEFAULT_THEME, {
    id: pick('id', 'slug') || 'custom', name: pick('name', 'label') || 'Custom',
    font: fonts.display || pick('font', 'fontFamily') || DEFAULT_THEME.font,
    bg: pick('bg', 'background') || DEFAULT_THEME.bg,
    ink: pick('ink', 'text', 'textColor', 'foreground') || DEFAULT_THEME.ink,
    surface: pick('surface', 'card', 'cardBackground') || DEFAULT_THEME.surface,
    primary: pick('primary', 'brand', 'main') || DEFAULT_THEME.primary,
    secondary: pick('secondary') || DEFAULT_THEME.secondary,
    accent: pick('accent', 'highlight') || DEFAULT_THEME.accent,
    success: pick('success', 'done', 'complete') || DEFAULT_THEME.success,
    gold: pick('gold') || DEFAULT_THEME.gold,
  });
  th.goldDark = pick('goldDark') || (th.gold === DEFAULT_THEME.gold ? DEFAULT_THEME.goldDark : mix(th.gold, '#000000', 0.18));
  th.onPrimary = c.onPrimary || '#FFFFFF';
  th.onSuccess = c.onSuccess || '#FFFFFF';
  th.onSecondary = c.onSecondary || '#FFFFFF';
  th.onAccent = c.onAccent || '#FFFFFF';
  // background texture: a colour string, or { kind, svg } from themes.json
  const pat = src.pattern;
  th.bg2 = pick('bg2', 'backgroundAlt') || (typeof c.pattern === 'string' ? c.pattern : null) || mix(th.bg, th.ink, 0.06);
  th.pattern = typeof pat === 'string' ? pat : (pat && pat.kind) || DEFAULT_THEME.pattern;
  th.patternSvg = (pat && pat.svg) || null;
  th.confetti = (Array.isArray(src.confetti) && src.confetti) || pick('palette') || [th.secondary, th.gold, th.success, th.primary, th.accent];
  th.shape = typeof src.shape === 'string' ? src.shape : PARTICLES[rw.particles] || DEFAULT_THEME.shape;
  // what kids earn in this theme (star, shell, planet, egg, ...)
  th.token = Object.assign({ kind: 'star', name: 'stars', fill: th.gold, stroke: th.goldDark },
    src.token || {}, rw.token ? { kind: rw.token, name: rw.tokenName || rw.token + 's', fill: c.reward || th.gold, stroke: c.rewardStroke || th.goldDark } : {});
  th.cheer = rw.cheer || src.cheer || null;
  th.rise = !!(rw.rise || src.rise);
  th.density = rw.count ? clamp(rw.count / 50, 0.25, 1.2) : (src.density || 1);
  th.calm = th.density < 0.5;
  const dark = src.mode === 'dark';
  th.mascot = Object.assign({}, DEFAULT_THEME.mascot,
    src.colors ? { shirt: th.primary, pants: mix(th.primary, '#000000', 0.45), shoes: th.secondary } : { shirt: th.success },
    typeof src.mascot === 'object' ? src.mascot : {});
  ['flame', 'drawMascot'].forEach(k => { if (src[k] != null) th[k] = src[k]; });
  th.night = src.night || (dark ? th.bg : mix(th.ink, '#000000', 0.25));
  th.outline = src.outline || (dark ? '#1C1A33' : th.ink); // outlines on objects (chest, jar, rocket)
  th.__adapted = true;
  loadPattern(th);
  return th;
}

// themes.json ships an SVG tile per theme; draw it as a canvas pattern once it has loaded.
const patternImages = {};
function loadPattern(th) {
  if (!th.patternSvg || typeof Image === 'undefined') return Promise.resolve();
  let e = patternImages[th.patternSvg];
  if (!e) {
    const img = new Image();
    e = patternImages[th.patternSvg] = { img, ready: new Promise(res => { img.onload = res; img.onerror = res; }) };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(th.patternSvg);
  }
  return e.ready;
}
Object.keys(THEMES).forEach(k => { THEMES[k] = adaptTheme(THEMES[k]); });

// ---------- drawing primitives ----------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function star(ctx, cx, cy, r, rot = 0, inner = 0.45, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + i * Math.PI / points;
    const rad = i % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}
function heart(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.7, cy - r * 1.3, cx, cy - r * 0.45);
  ctx.bezierCurveTo(cx + r * 0.7, cy - r * 1.3, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 0.9);
  ctx.closePath();
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function leaf(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.quadraticCurveTo(cx, cy - r * 0.9, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy + r * 0.9, cx - r, cy);
  ctx.closePath();
}
function font(th, size, weight = 600) { return `${weight} ${size}px "${th.font}", Fredoka, "Comic Sans MS", sans-serif`; }

// One themed particle (confetti piece, star, heart, bubble or leaf).
function particle(g, x, y, r, rot, color, i) {
  const { ctx, th } = g;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color;
  let shape = th.shape;
  if (shape === 'confetti') shape = ['rect', 'star', 'rect', 'circle'][i % 4];
  switch (shape) {
    case 'star': star(ctx, 0, 0, r * 1.1, 0); ctx.fill(); break;
    case 'heart': heart(ctx, 0, 0, r * 0.9); ctx.fill(); break;
    case 'circle': circle(ctx, 0, 0, r * 0.7); ctx.fill(); break;
    case 'leaf':
      leaf(ctx, 0, 0, r * 1.1); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke(); break;
    case 'bubble':
      circle(ctx, 0, 0, r * 0.8); ctx.fillStyle = alpha(color, 0.35); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(ctx, -r * 0.3, -r * 0.3, r * 0.2); ctx.fill(); break;
    case 'petal': ctx.scale(1, 0.7); leaf(ctx, 0, 0, r); ctx.fill(); break;
    case 'sprinkle': rr(ctx, -r, -r * 0.25, r * 2, r * 0.5, r * 0.25); ctx.fill(); break;
    case 'pixel': ctx.rotate(-rot); ctx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 1.2); break;
    case 'hex':
      ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(Math.cos(k * TAU / 6) * r * 0.8, Math.sin(k * TAU / 6) * r * 0.8);
      ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; circle(ctx, 0, 0, r * 0.3); ctx.fill(); break;
    case 'snowflake':
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * 0.18); ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r); ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.3, -r * 0.8); ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 0.3, -r * 0.8); ctx.stroke(); }
      break;
    case 'glow': {
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3);
      gr.addColorStop(0, color); gr.addColorStop(1, alpha(color, 0));
      ctx.fillStyle = gr; circle(ctx, 0, 0, r * 1.3); ctx.fill(); break;
    }
    default: ctx.fillRect(-r, -r * 0.5, r * 2, r); // rect
  }
  ctx.restore();
}

function background(g) {
  const { ctx, th, hw, hh, o } = g;
  if (o.transparent) {
    if (o.scrim) { ctx.fillStyle = alpha(th.ink, o.scrim); ctx.fillRect(-hw, -hh, hw * 2, hh * 2); }
    return;
  }
  ctx.fillStyle = th.bg; ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
  const svgTile = th.patternSvg && patternImages[th.patternSvg];
  if (svgTile && svgTile.img.complete && svgTile.img.naturalWidth) {
    ctx.save(); ctx.scale(1.5, 1.5);
    ctx.fillStyle = ctx.createPattern(svgTile.img, 'repeat');
    ctx.fillRect(-hw / 1.5, -hh / 1.5, hw * 2 / 1.5, hh * 2 / 1.5);
    ctx.restore();
  } else drawPattern(g);
  // soft spotlight behind the stage
  const grd = ctx.createRadialGradient(0, 0, 40, 0, 0, 460);
  grd.addColorStop(0, alpha(th.surface, 0.55)); grd.addColorStop(1, alpha(th.surface, 0));
  ctx.fillStyle = grd; ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
}

function drawPattern(g) {
  const { ctx, th, hw, hh } = g;
  ctx.fillStyle = th.bg2; ctx.strokeStyle = th.bg2; ctx.lineWidth = 4;
  let k = 0;
  for (let y = -hh - 30; y < hh + 60; y += 70) for (let x = -hw - 30 + (k++ % 2) * 35; x < hw + 60; x += 70) {
    const j = Math.round(x * 3 + y * 7);
    switch (th.pattern) {
      case 'dots': circle(ctx, x, y, 7); ctx.fill(); break;
      case 'stars': if (rand(j) < 0.55) { star(ctx, x + rand(j, 1) * 20, y, 4 + rand(j, 2) * 6, 0, 0.35, 4); ctx.fill(); } break;
      case 'bubbles': if (rand(j) < 0.5) { circle(ctx, x, y + rand(j, 1) * 20, 6 + rand(j, 2) * 10); ctx.stroke(); } break;
      case 'leaves': if (rand(j) < 0.5) { ctx.save(); ctx.translate(x, y); ctx.rotate(rand(j, 3) * TAU); leaf(ctx, 0, 0, 14); ctx.fill(); ctx.restore(); } break;
      case 'none': break;
      default: circle(ctx, x, y, 6); ctx.fill();
    }
  }
}

// Title card (same look as the how-to videos' captions).
function title(g, text, y, appear, size = 52) {
  if (!text || appear <= 0) return;
  const { ctx, th, t } = g;
  const a = easeOutBack(clamp(appear));
  ctx.save();
  ctx.translate(0, y + Math.sin(t * 2.4) * 3); ctx.scale(a, a);
  ctx.font = font(th, size);
  const bw = Math.max(ctx.measureText(text).width + size * 1.6, 260), bh = size * 1.7;
  ctx.fillStyle = alpha(th.ink, 0.15); rr(ctx, -bw / 2 + 5, -bh / 2 + 7, bw, bh, bh / 2.6); ctx.fill();
  ctx.fillStyle = th.surface; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2.6); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = th.ink; ctx.stroke();
  ctx.fillStyle = th.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
}

function pill(g, text, x, y, appear, bg, fg, size = 36) {
  if (!text || appear <= 0) return;
  const { ctx, th } = g;
  const a = easeOutBack(clamp(appear));
  ctx.save(); ctx.translate(x, y); ctx.scale(a, a);
  ctx.font = font(th, size);
  const bw = ctx.measureText(text).width + size * 1.4, bh = size * 1.8;
  ctx.fillStyle = bg; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = th.surface; ctx.stroke();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
}

function rays(g, cx, cy, r, n, rot, color, a) {
  if (a <= 0) return;
  const { ctx } = g;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grd.addColorStop(0, alpha(color, a)); grd.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = grd;
  for (let i = 0; i < n; i++) {
    const a0 = i * TAU / n, a1 = a0 + TAU / n / 2;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Ring of sparkle stars flying outward; life runs 0 -> 1.
function burst(g, cx, cy, life, n = 10, spread = 160, seed = 0) {
  if (life <= 0 || life >= 1) return;
  const { ctx, th, t } = g;
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + rand(i, seed) * 0.5;
    const r = spread * (0.5 + rand(i, seed + 1) * 0.6) * easeOut(life);
    ctx.globalAlpha = Math.sin(life * Math.PI);
    ctx.fillStyle = i % 2 ? th.gold : th.surface;
    star(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 9 + (i % 3) * 5, t * 4 + i); ctx.fill();
    ctx.strokeStyle = th.goldDark; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function twinkles(g, pts, start) {
  const { ctx, th, t } = g;
  pts.forEach(([x, y, s], i) => {
    const a = prog(t, start + i * 0.12, start + i * 0.12 + 0.3) * (0.55 + 0.45 * Math.sin(t * 5 + i * 2));
    if (a <= 0) return;
    ctx.globalAlpha = a; ctx.fillStyle = th.gold;
    star(ctx, x, y, s, 0, 0.3, 4); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// Confetti falling from the top of the whole canvas.
function confettiRain(g, start, n = 80) {
  const life = g.t - start;
  if (life < 0) return;
  const { hw, hh, th } = g;
  n = Math.round(n * th.density);
  for (let i = 0; i < n; i++) {
    const x = -hw + rand(i, 3) * hw * 2;
    let y = -hh - 40 + life * (190 + rand(i, 4) * 160) - rand(i, 5) * 260;
    if (th.rise) y = -y; // bubbles, petals and glow float up from the bottom
    if (y > hh + 60 || y < -hh - 60) continue;
    particle(g, x + Math.sin(life * 3 + i) * 22, y, 11, life * 4 + i, th.confetti[i % th.confetti.length], i);
  }
}

// Ballistic motion with air drag (y down). Deterministic in t.
function fly(x0, y0, vx, vy, age, k = 2.2, vt = 260) {
  const e = (1 - Math.exp(-k * age)) / k;
  return [x0 + vx * e, y0 + vt * age + (vy - vt) * e];
}

function flamePath(ctx, h, tip) {
  h = Math.max(h, 2);
  const w = h * 0.45;
  ctx.beginPath();
  ctx.moveTo(tip, -h);
  ctx.bezierCurveTo(w * 0.15 + tip * 0.5, -h * 0.55, w, -h * 0.45, w, -h * 0.15);
  ctx.arc(0, -h * 0.15, w, 0, Math.PI);
  ctx.bezierCurveTo(-w, -h * 0.45, -w * 0.15 + tip * 0.5, -h * 0.55, tip, -h);
  ctx.closePath();
}

function coin(g, x, y, r, spin) {
  const { ctx, th } = g;
  ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.12, Math.abs(spin)), 1);
  circle(ctx, 0, 0, r); ctx.fillStyle = th.gold; ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = th.goldDark; ctx.stroke();
  circle(ctx, 0, 0, r * 0.68); ctx.lineWidth = r * 0.08; ctx.stroke();
  star(ctx, 0, 0, r * 0.42, 0); ctx.fillStyle = th.goldDark; ctx.fill();
  ctx.restore();
}

function gem(g, x, y, r, color, rot) {
  const { ctx } = g;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(-r * 0.5, -r * 0.8); ctx.lineTo(r * 0.5, -r * 0.8);
  ctx.lineTo(r, -r * 0.3); ctx.lineTo(0, r); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.8); ctx.lineTo(0, -r * 0.3); ctx.lineTo(-r, -r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// The theme's reward token: what kids earn (star, shell, planet, egg, candy, flower,
// coin, bolt, heart, nut, snowflake, moon). Drawn centred at x, y with radius r.
function token(g, x, y, r, rot = 0, tk = g.th.token) {
  const { ctx } = g;
  const fill = tk.fill, stroke = tk.stroke;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const shine = () => { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.15, r * 0.09, -0.6, 0, TAU); ctx.fill(); };
  switch (tk.kind) {
    case 'shell':
      ctx.beginPath(); ctx.moveTo(-r * 0.28, r * 0.72); ctx.lineTo(-r * 0.95, -r * 0.05);
      ctx.quadraticCurveTo(0, -r * 1.45, r * 0.95, -r * 0.05); ctx.lineTo(r * 0.28, r * 0.72); ctx.closePath();
      ctx.fill(); ctx.stroke();
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, r * 0.68); ctx.lineTo(k * r * 0.36, -r * 0.62 + Math.abs(k) * r * 0.2); ctx.stroke(); }
      rr(ctx, -r * 0.4, r * 0.62, r * 0.8, r * 0.26, r * 0.1); ctx.fill(); ctx.stroke(); break;
    case 'planet':
      circle(ctx, 0, 0, r * 0.66); ctx.fill(); ctx.stroke(); shine();
      ctx.save(); ctx.rotate(-0.35); ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r * 0.3, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.08, r * 0.3, 0, 1.0 * Math.PI, 2.0 * Math.PI); ctx.globalAlpha = 0.6; ctx.stroke();
      ctx.restore(); break;
    case 'egg':
      ctx.beginPath(); ctx.ellipse(0, r * 0.06, r * 0.68, r * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = stroke; [[-0.25, -0.3, 0.13], [0.28, 0.05, 0.16], [-0.12, 0.45, 0.11]].forEach(([a, b, c]) => { circle(ctx, a * r, b * r, c * r); ctx.fill(); });
      break;
    case 'candy':
      ctx.beginPath(); ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 1.05, -r * 0.45); ctx.lineTo(-r * 1.05, r * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.45, 0); ctx.lineTo(r * 1.05, -r * 0.45); ctx.lineTo(r * 1.05, r * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
      circle(ctx, 0, 0, r * 0.58); ctx.fill(); ctx.stroke();
      ctx.save(); circle(ctx, 0, 0, r * 0.58); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = r * 0.14;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.35 - r, -r); ctx.lineTo(k * r * 0.35 + r, r); ctx.stroke(); }
      ctx.restore(); break;
    case 'flower':
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2; circle(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.4); ctx.fill(); ctx.stroke(); }
      circle(ctx, 0, 0, r * 0.3); ctx.fillStyle = '#FFD84D'; ctx.fill(); ctx.stroke(); break;
    case 'coin':
      circle(ctx, 0, 0, r * 0.85); ctx.fill(); ctx.stroke();
      circle(ctx, 0, 0, r * 0.6); ctx.stroke();
      star(ctx, 0, 0, r * 0.36, 0); ctx.fillStyle = stroke; ctx.fill(); break;
    case 'bolt':
      ctx.beginPath(); ctx.moveTo(r * 0.2, -r); ctx.lineTo(-r * 0.55, r * 0.12); ctx.lineTo(-r * 0.02, r * 0.12);
      ctx.lineTo(-r * 0.25, r); ctx.lineTo(r * 0.6, -r * 0.18); ctx.lineTo(r * 0.06, -r * 0.18); ctx.closePath();
      ctx.fill(); ctx.stroke(); break;
    case 'heart': heart(ctx, 0, r * 0.05, r * 0.85); ctx.fill(); ctx.stroke(); shine(); break;
    case 'nut':
      ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(Math.cos(k * TAU / 6) * r * 0.85, Math.sin(k * TAU / 6) * r * 0.85);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      circle(ctx, 0, 0, r * 0.34); ctx.fillStyle = stroke; ctx.fill(); break;
    case 'snowflake':
      for (const [col, lw] of [[stroke, r * 0.26], [fill, r * 0.14]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw;
        for (let k = 0; k < 6; k++) {
          ctx.save(); ctx.rotate(k * TAU / 6); ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.95); ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.28, -r * 0.8); ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 0.28, -r * 0.8);
          ctx.stroke(); ctx.restore();
        }
      }
      break;
    case 'moon':
      ctx.rotate(-0.35); ctx.beginPath(); ctx.moveTo(0, -r * 0.9);
      ctx.arc(0, 0, r * 0.9, -Math.PI / 2, Math.PI / 2, true);
      ctx.bezierCurveTo(-r * 0.5, r * 0.55, -r * 0.5, -r * 0.55, 0, -r * 0.9);
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    default:
      star(ctx, 0, 0, r, 0); ctx.fill(); ctx.lineWidth = Math.max(2, r * 0.09); ctx.stroke(); shine();
  }
  ctx.restore();
}

// ---------- mascot (same kid as the how-to videos, recoloured by theme) ----------
// pose: { armL, armR } angles (0 = hanging down; armR negative / armL positive raise them),
//       { jump, squash, look, mouth: 'smile' | 'open' }
function mascot(g, x, y, s, pose) {
  const { ctx, th, t } = g;
  const m = th.mascot;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const jump = pose.jump || 0, sq = pose.squash || 0;
  ctx.fillStyle = alpha('#000000', 0.15);
  ctx.beginPath(); ctx.ellipse(0, 150, 60 - jump * 0.25, 12, 0, 0, TAU); ctx.fill();
  if (th.drawMascot) { ctx.translate(0, -jump); th.drawMascot(ctx, pose, t); ctx.restore(); return; }
  ctx.translate(0, 150 - jump); ctx.scale(1 + sq * 0.12, 1 - sq * 0.12); ctx.translate(0, -150);
  ctx.strokeStyle = m.pants; ctx.lineWidth = 20; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-16, 90); ctx.lineTo(-18, 140); ctx.moveTo(16, 90); ctx.lineTo(18, 140); ctx.stroke();
  ctx.fillStyle = m.shoes;
  ctx.beginPath(); ctx.ellipse(-22, 146, 16, 9, 0, 0, TAU); ctx.ellipse(22, 146, 16, 9, 0, 0, TAU); ctx.fill();
  const arm = (sx, ang) => {
    ctx.save(); ctx.translate(sx, 22); ctx.rotate(ang);
    ctx.strokeStyle = m.skin; ctx.lineWidth = 15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 56); ctx.stroke();
    circle(ctx, 0, 60, 10); ctx.fillStyle = m.skin; ctx.fill();
    ctx.restore();
  };
  arm(34, pose.armR != null ? pose.armR : -0.35);
  arm(-34, pose.armL != null ? pose.armL : 0.35);
  rr(ctx, -42, 5, 84, 95, 28); ctx.fillStyle = m.shirt; ctx.fill();
  ctx.fillStyle = '#FFFFFF'; star(ctx, 0, 48, 18, 0); ctx.fill();
  ctx.fillStyle = m.skin; circle(ctx, 0, -40, 52); ctx.fill();
  ctx.fillStyle = m.hair;
  ctx.beginPath(); ctx.arc(0, -52, 50, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
  ctx.beginPath(); ctx.arc(-30, -82, 16, 0, TAU); ctx.arc(0, -92, 18, 0, TAU); ctx.arc(30, -82, 16, 0, TAU); ctx.fill();
  const blink = (t % 3.3) > 3.15 ? 0.15 : 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(-18, -40, 11, 13 * blink, 0, 0, TAU); ctx.ellipse(18, -40, 11, 13 * blink, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2D2A4A';
  const lk = pose.look || 0;
  ctx.beginPath(); ctx.ellipse(-18 + lk, -38, 6, 7 * blink, 0, 0, TAU); ctx.ellipse(18 + lk, -38, 6, 7 * blink, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,122,162,0.55)';
  circle(ctx, -32, -20, 8); ctx.fill(); circle(ctx, 32, -20, 8); ctx.fill();
  if (pose.mouth === 'open') {
    ctx.fillStyle = '#2D2A4A';
    ctx.beginPath(); ctx.arc(0, -22, 14, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF7A8A'; ctx.beginPath(); ctx.ellipse(0, -13, 7, 4, 0, 0, TAU); ctx.fill();
  } else {
    ctx.strokeStyle = '#2D2A4A'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -22, 14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  ctx.restore();
}

// ---------- the rewards ----------
const REWARDS = [];
const def = r => REWARDS.push(r);

def({
  id: 'check-pop', name: 'Check Pop', duration: 2.2,
  use: 'Quick confirmation when a chore is ticked off. Short enough to play every time.',
  defaults: { title: 'Done!' },
  sfx: [[0.05, 'pop'], [0.45, 'note:4'], [0.55, 'sparkle']],
  draw(g) {
    const { ctx, t, th, o } = g;
    const ring = prog(t, 0.25, 0.9);
    if (ring > 0 && ring < 1) {
      ctx.strokeStyle = alpha(th.success, 1 - ring); ctx.lineWidth = 18 * (1 - ring) + 2;
      circle(ctx, 0, -30, 135 + easeOut(ring) * 190); ctx.stroke();
    }
    const db = prog(t, 0.3, 1.0);
    if (db > 0 && db < 1) for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, r = 160 + easeOut(db) * 150;
      particle(g, Math.cos(a) * r, -30 + Math.sin(a) * r, 13 * (1 - db) + 4, a + db * 3, th.confetti[i % 5], i);
    }
    const p = easeOutBack(prog(t, 0, 0.45));
    if (p > 0) {
      ctx.save(); ctx.translate(0, -30); ctx.scale(p, p);
      ctx.fillStyle = alpha(th.ink, 0.15); circle(ctx, 6, 10, 135); ctx.fill();
      ctx.fillStyle = th.success; circle(ctx, 0, 0, 135); ctx.fill();
      ctx.lineWidth = 12; ctx.strokeStyle = th.surface; ctx.stroke();
      const pts = [[-58, 4], [-16, 46], [62, -42]];
      const L1 = Math.hypot(42, 42), L2 = Math.hypot(78, 88), c = easeInOut(prog(t, 0.28, 0.65)) * (L1 + L2);
      if (c > 0) {
        ctx.strokeStyle = th.surface; ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(...pts[0]);
        if (c <= L1) ctx.lineTo(lerp(pts[0][0], pts[1][0], c / L1), lerp(pts[0][1], pts[1][1], c / L1));
        else { ctx.lineTo(...pts[1]); const u = (c - L1) / L2; ctx.lineTo(lerp(pts[1][0], pts[2][0], u), lerp(pts[1][1], pts[2][1], u)); }
        ctx.stroke();
      }
      ctx.restore();
    }
    title(g, o.title, 215, prog(t, 0.5, 0.85), 64);
  },
});

def({
  id: 'star-shower', name: 'Star Shower', duration: 3.6,
  use: 'A single chore completed. Matches the ending of the how-to videos.',
  defaults: { title: th => th.cheer || 'Great job!', subtitle: (th, o) => `+${o.stars} ${th.token.name}`, stars: 3 },
  sfx: [[0.12, 'pop'], [0.85, 'note:0'], [1.15, 'note:2'], [1.45, 'note:4'], [1.75, 'sparkle']],
  draw(g) {
    const { ctx, t, th, o } = g;
    rays(g, 0, 50, 520, 14, t * 0.3, th.gold, 0.35 * easeOut(prog(t, 0.6, 1.4)));
    const n = clamp(Math.round(o.stars), 1, 5);
    for (let i = 0; i < n; i++) {
      const off = i - (n - 1) / 2, tx = off * 170, ty = 50 + Math.abs(off) * 34;
      const st = 0.45 + i * 0.3, p = prog(t, st, st + 0.45);
      if (p <= 0) continue;
      const e = easeOutBack(p), x = lerp(tx * 0.3, tx, easeOut(p)), y = lerp(420, ty, easeOut(p));
      const pulse = 1 + 0.06 * Math.sin((t - st) * 6) * prog(t, st + 0.5, st + 0.8);
      const big = Math.abs(off) < 0.5 ? 92 : 74;
      ctx.save(); ctx.translate(x, y); ctx.rotate((1 - easeOut(p)) * -3); ctx.scale(e * pulse, e * pulse);
      token(g, 5, 8, big, 0, { kind: th.token.kind, fill: alpha(th.ink, 0.15), stroke: alpha(th.ink, 0) });
      token(g, 0, 0, big);
      ctx.restore();
      burst(g, tx, ty, prog(t, st + 0.38, st + 1.1), 10, 150, i);
    }
    title(g, o.title, -215, prog(t, 0.08, 0.55));
    pill(g, o.subtitle, 0, 255, prog(t, 1.7, 2.1), th.success, th.onSuccess, 40);
  },
});

def({
  id: 'confetti-cannon', name: 'Party Poppers', duration: 3.8,
  use: 'Bigger celebration, e.g. finishing a tricky chore or a whole morning routine.',
  defaults: { title: 'Woo-hoo!', subtitle: 'Chore done!' },
  sfx: [[0.3, 'pop'], [0.36, 'pop'], [0.33, 'whoosh'], [0.9, 'sparkle'], [1.0, 'note:4']],
  draw(g) {
    const { ctx, t, th, o, hw, hh } = g;
    const fire = 0.3;
    [-1, 1].forEach(side => {
      // popper cone in the bottom corner, pointing up and inward
      const bx = side * (hw - 100), by = hh - 120, ang = side * -0.55;
      const recoil = Math.sin(clamp((t - fire) / 0.25) * Math.PI) * 26;
      const appear = easeOutBack(prog(t, 0, 0.25));
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); ctx.translate(0, recoil); ctx.scale(appear, appear);
      ctx.beginPath(); ctx.moveTo(-48, -70); ctx.lineTo(48, -70); ctx.lineTo(10, 70); ctx.lineTo(-10, 70); ctx.closePath();
      ctx.fillStyle = th.primary; ctx.fill(); ctx.save(); ctx.clip();
      ctx.fillStyle = th.gold;
      for (let k = -2; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-60, k * 40 - 30); ctx.lineTo(60, k * 40 - 70); ctx.lineTo(60, k * 40 - 52); ctx.lineTo(-60, k * 40 - 12); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-48, -70); ctx.lineTo(48, -70); ctx.lineTo(10, 70); ctx.lineTo(-10, 70); ctx.closePath();
      ctx.lineWidth = 5; ctx.strokeStyle = th.outline; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -70, 48, 12, 0, 0, TAU); ctx.fillStyle = th.secondary; ctx.fill(); ctx.stroke();
      ctx.restore();
      // particles
      const mx = bx + Math.sin(ang) * 70, my = by - Math.cos(ang) * 70;
      for (let i = 0; i < Math.round(75 * th.density); i++) {
        const st = fire + rand(i, side) * 0.07, age = t - st;
        if (age < 0) continue;
        const a = -Math.PI / 2 + ang + (rand(i, side + 7) - 0.5) * 0.9;
        const sp = 1000 + rand(i, side + 9) * 900;
        let [x, y] = fly(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, age, 2.4, 230);
        x += Math.sin(age * 5 + i) * 18 * clamp(age);
        if (y > hh + 40) continue;
        particle(g, x, y, 10 + rand(i, 2) * 6, age * (4 + rand(i) * 4) + i, th.confetti[i % th.confetti.length], i);
      }
      // puff
      const pf = prog(t, fire, fire + 0.5);
      if (pf > 0 && pf < 1) { ctx.fillStyle = alpha(th.surface, 0.8 * (1 - pf)); circle(ctx, mx, my, 30 + pf * 70); ctx.fill(); }
    });
    title(g, o.title, -40, prog(t, 0.5, 0.9), 70);
    pill(g, o.subtitle, 0, 80, prog(t, 0.9, 1.25), th.success, th.onSuccess, 34);
  },
});

def({
  id: 'coin-jar', name: 'Coin Jar', duration: 4.2,
  use: 'Points or allowance earned. Counts up to the number of points.',
  defaults: { title: 'Points earned!', points: 10, coins: 10 },
  sfx: null, // generated from the coin timings below
  draw(g) {
    const { ctx, t, th, o } = g;
    const N = clamp(Math.round(o.coins), 1, 20);
    const jx = 0, top = 50, bottom = 300, jw = 270;
    const landT = i => 0.35 + i * (1.6 / N) + 0.5;
    const custom = !['star', 'coin'].includes(th.token.kind);
    // jar back
    ctx.fillStyle = alpha(th.primary, 0.12);
    rr(ctx, jx - jw / 2, top, jw, bottom - top, 46); ctx.fill();
    // coins
    let landed = 0, lastLand = -9;
    ctx.save(); rr(ctx, jx - jw / 2 + 8, top - 400, jw - 16, bottom - top + 392, 40); ctx.clip();
    for (let i = 0; i < N; i++) {
      const st = landT(i) - 0.5, lt = landT(i);
      const sx = (rand(i, 1) - 0.5) * 120, ly = bottom - 40 - Math.floor(i / 3) * (custom ? 48 : 30), lx = ((i % 3) - 1) * 72 + (rand(i, 2) - 0.5) * 16;
      if (t < st) continue;
      if (t < lt) {
        const p = easeIn(prog(t, st, lt));
        if (custom) token(g, lerp(sx, lx, p), lerp(-470, ly, p), 40, t * 3 + i);
        else coin(g, lerp(sx, lx, p), lerp(-470, ly, p), 40, Math.cos(t * 9 + i));
      } else if (custom) {
        landed++; lastLand = lt;
        token(g, lx, ly - 8, 40, (rand(i, 4) - 0.5) * 0.8);
      } else {
        landed++; lastLand = lt;
        ctx.save(); ctx.translate(lx, ly); ctx.scale(1, 0.38);
        circle(ctx, 0, 0, 40); ctx.fillStyle = th.goldDark; ctx.fill();
        circle(ctx, 0, -14, 40); ctx.fillStyle = th.gold; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = th.goldDark; ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
    // jar front glass + lid
    ctx.lineWidth = 8; ctx.strokeStyle = th.outline;
    rr(ctx, jx - jw / 2, top, jw, bottom - top, 46); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(ctx, jx - jw / 2 + 22, top + 30, 22, bottom - top - 80, 11); ctx.fill();
    rr(ctx, jx - jw / 2 - 14, top - 26, jw + 28, 38, 14); ctx.fillStyle = th.secondary; ctx.fill(); ctx.stroke();
    // counter
    const val = Math.round(o.points * landed / N);
    const bump = 1 + 0.18 * Math.exp(-(t - lastLand) * 9);
    if (t > 0.6) {
      ctx.save(); ctx.translate(0, -60); ctx.scale(bump * easeOutBack(prog(t, 0.6, 0.9)), bump * easeOutBack(prog(t, 0.6, 0.9)));
      pill(g, '+' + val, 0, 0, 1, th.gold, th.outline, 46);
      ctx.restore();
    }
    const end = landT(N - 1);
    burst(g, 0, 60, prog(t, end, end + 0.8), 12, 220, 3);
    title(g, o.title, -235, prog(t, 0.05, 0.5));
  },
});

def({
  id: 'badge-unlock', name: 'Badge Unlock', duration: 4.2,
  use: 'A new badge or achievement (first week, 10 beds made, etc.).',
  defaults: { label: 'NEW BADGE!', title: 'Bed Boss', icon: 'token' },
  sfx: [[0.2, 'whoosh'], [0.49, 'thud'], [1.1, 'fanfare'], [1.35, 'shimmer']],
  draw(g) {
    const { ctx, t, th, o, hh } = g;
    rays(g, 0, 10, 560, 16, t * 0.25, th.gold, 0.4 * easeOut(prog(t, 0.8, 1.5)));
    const my = lerp(-hh - 260, 10, bounce(prog(t, 0.2, 1.0)));
    // ribbon
    [[-1, th.primary], [1, th.secondary]].forEach(([s, col]) => {
      ctx.beginPath();
      ctx.moveTo(s * 30, -hh - 20); ctx.lineTo(s * 110, -hh - 20);
      ctx.lineTo(s * 30, my - 90); ctx.lineTo(s * -40, my - 90); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = alpha(th.ink, 0.35); ctx.stroke();
    });
    ctx.save(); ctx.translate(0, my);
    ctx.rotate(Math.sin(t * 2) * 0.04 * prog(t, 1, 1.4));
    // scalloped gold rim
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU, r = 150 + Math.cos(a * 24) * 7; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = th.gold; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = th.goldDark; ctx.stroke();
    circle(ctx, 0, 0, 112); ctx.fillStyle = th.primary; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = th.surface; ctx.stroke();
    ctx.fillStyle = th.surface;
    if (o.icon === 'heart') { heart(ctx, 0, 5, 58); ctx.fill(); }
    else if (o.icon === 'check') { ctx.strokeStyle = th.surface; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-45, 2); ctx.lineTo(-12, 35); ctx.lineTo(48, -32); ctx.stroke(); }
    else if (o.icon === 'token' && th.token.kind !== 'star') token(g, 0, 4, 66);
    else { star(ctx, 0, 4, 70, 0); ctx.fill(); }
    // shine
    const sh = prog(t, 1.3, 1.9);
    if (sh > 0 && sh < 1) {
      ctx.save(); circle(ctx, 0, 0, 157); ctx.clip();
      const sx = lerp(-260, 260, sh);
      ctx.translate(sx, 0); ctx.rotate(0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-28, -300, 56, 600);
      ctx.restore();
    }
    ctx.restore();
    twinkles(g, [[-230, -90, 22], [220, -140, 18], [250, 60, 26], [-250, 110, 16], [-160, -190, 14], [170, 170, 18]], 1.5);
    pill(g, o.label, 0, -240, prog(t, 1.0, 1.35), th.accent, th.onAccent, 34);
    title(g, o.title, 250, prog(t, 1.35, 1.75), 54);
  },
});

def({
  id: 'streak-flame', name: 'Streak Flame', duration: 4.2,
  use: 'Doing chores several days in a row. Fills in today on the week tracker.',
  defaults: { streak: 5, title: null },
  sfx: [[0.2, 'whoosh'], [1.0, 'pop'], [1.65, 'pop'], [1.7, 'note:4'], [1.95, 'fanfare']],
  draw(g) {
    const { ctx, t, th, o } = g;
    const streak = Math.max(1, Math.round(o.streak));
    const p = easeOutBack(prog(t, 0.2, 1.0));
    if (p > 0) {
      const h = 270 * p, fl = th.flame;
      ctx.save(); ctx.translate(0, 70);
      const glow = ctx.createRadialGradient(0, -80, 10, 0, -80, 260);
      glow.addColorStop(0, alpha(fl[1], 0.45)); glow.addColorStop(1, alpha(fl[1], 0));
      ctx.fillStyle = glow; circle(ctx, 0, -80, 260); ctx.fill();
      [[1, fl[0], 0], [0.72, fl[1], 1.7], [0.42, fl[2], 3.1]].forEach(([k, col, ph]) => {
        const tip = Math.sin(t * 7 + ph) * 16 + Math.sin(t * 11.3 + ph) * 8;
        ctx.save(); ctx.scale(1 + Math.sin(t * 9 + ph) * 0.03, 1);
        ctx.translate(0, (1 - k) * h * 0.25);
        flamePath(ctx, h * k, tip * k); ctx.fillStyle = col; ctx.fill();
        ctx.restore();
      });
      // embers
      for (let i = 0; i < 10; i++) {
        const life = ((t * 0.9 + rand(i)) % 1);
        ctx.globalAlpha = (1 - life) * p;
        ctx.fillStyle = fl[i % 2];
        circle(ctx, (rand(i, 1) - 0.5) * 160 + Math.sin(t * 3 + i) * 12, -life * 330, 5 + rand(i, 2) * 4); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // number
    const np = easeOutBack(prog(t, 0.95, 1.3));
    if (np > 0) {
      ctx.save(); ctx.translate(0, 40); ctx.scale(np, np);
      ctx.font = font(th, 130, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 14; ctx.strokeStyle = th.ink; ctx.lineJoin = 'round'; ctx.strokeText(String(streak), 0, 0);
      ctx.fillStyle = th.surface; ctx.fillText(String(streak), 0, 0);
      ctx.restore();
    }
    // week tracker
    const filled = ((streak - 1) % 7) + 1;
    for (let d = 0; d < 7; d++) {
      const x = (d - 3) * 78, y = 235;
      const ap = easeOutBack(prog(t, 0.3 + d * 0.06, 0.6 + d * 0.06));
      if (ap <= 0) continue;
      const today = d === filled - 1, on = d < filled - 1 || (today && t > 1.65);
      const pop = today ? 1 + 0.35 * Math.sin(prog(t, 1.65, 2.0) * Math.PI) : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(ap * pop, ap * pop);
      circle(ctx, 0, 0, 28); ctx.fillStyle = on ? th.success : alpha(th.ink, 0.12); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = th.surface; ctx.stroke();
      if (on) {
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(-11, 1); ctx.lineTo(-3, 9); ctx.lineTo(12, -8); ctx.stroke();
      }
      ctx.restore();
      if (today) burst(g, x, y, prog(t, 1.65, 2.3), 8, 90, 4);
    }
    title(g, o.title || `${streak} day streak!`, -250, prog(t, 1.9, 2.3));
  },
});

def({
  id: 'trophy', name: 'Trophy', duration: 4.6,
  use: 'All of today\'s chores finished.',
  defaults: { title: 'All chores done!', subtitle: 'Champion!' },
  sfx: [[0.2, 'whoosh'], [0.95, 'fanfare'], [1.3, 'shimmer'], [1.05, 'sparkle']],
  draw(g) {
    const { ctx, t, th, o } = g;
    rays(g, 0, -40, 600, 18, t * 0.25, th.gold, 0.45 * easeOut(prog(t, 0.5, 1.3)));
    confettiRain(g, 1.0, 70);
    const ty = lerp(560, 40, easeOutBack(prog(t, 0.2, 1.0)));
    ctx.save(); ctx.translate(0, ty);
    // base
    ctx.fillStyle = th.primary; rr(ctx, -120, 150, 240, 56, 14); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = th.outline; ctx.stroke();
    ctx.fillStyle = th.gold; rr(ctx, -60, 164, 120, 28, 8); ctx.fill();
    // stem
    ctx.fillStyle = th.goldDark; rr(ctx, -26, 60, 52, 92, 10); ctx.fill();
    ctx.fillStyle = th.gold; rr(ctx, -70, 128, 140, 28, 10); ctx.fill(); ctx.stroke();
    // handles
    ctx.lineWidth = 24; ctx.strokeStyle = th.goldDark; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-128, -88, 52, Math.PI * 0.45, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(128, -88, 52, -Math.PI * 0.6, Math.PI * 0.55); ctx.stroke();
    // cup
    ctx.beginPath();
    ctx.moveTo(-140, -160); ctx.lineTo(140, -160);
    ctx.bezierCurveTo(140, -20, 80, 60, 0, 70);
    ctx.bezierCurveTo(-80, 60, -140, -20, -140, -160);
    ctx.closePath();
    ctx.fillStyle = th.gold; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = th.goldDark; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-110, -160, 34, 220);
    const sh = prog(t, 1.2, 1.8);
    if (sh > 0 && sh < 1) { ctx.save(); ctx.translate(lerp(-260, 260, sh), 0); ctx.rotate(0.45); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-30, -300, 60, 600); ctx.restore(); }
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -160, 140, 22, 0, 0, TAU); ctx.fillStyle = th.goldDark; ctx.fill();
    star(ctx, 0, -60, 46, 0); ctx.fillStyle = th.surface; ctx.fill();
    ctx.restore();
    twinkles(g, [[-230, -120, 22], [240, -170, 18], [210, 40, 24], [-220, 60, 16]], 1.3);
    title(g, o.title, -250, prog(t, 0.95, 1.35));
    pill(g, o.subtitle, 0, 290, prog(t, 1.5, 1.85), th.secondary, th.onSecondary, 32);
  },
});

def({
  id: 'treasure-chest', name: 'Treasure Chest', duration: 4.8,
  use: 'A surprise prize or unlocking a real-world reward the parent set up.',
  defaults: { title: 'Treasure!', subtitle: 'You unlocked a prize!' },
  sfx: [[0.29, 'thud'], [0.85, 'tick'], [1.0, 'tick'], [1.15, 'tick'], [1.3, 'tick'], [1.45, 'tick'], [1.7, 'creak'], [1.85, 'sparkle'], [2.2, 'fanfare']],
  draw(g) {
    const { ctx, t, th, o } = g;
    const wood = th.chest || '#B97A4B', woodDark = mix(wood, '#000000', 0.25);
    const open = easeOutBack(prog(t, 1.7, 2.05));
    const shake = t > 0.8 && t < 1.65 ? Math.sin(t * 42) * 0.06 * prog(t, 0.8, 1.6) : 0;
    const cy = lerp(-560, 130, bounce(prog(t, 0.05, 0.7)));
    rays(g, 0, cy - 40, 620, 16, t * 0.3, th.gold, 0.5 * open);
    // light beam
    if (open > 0) {
      const gr = ctx.createLinearGradient(0, cy - 20, 0, cy - 420);
      gr.addColorStop(0, alpha(th.gold, 0.75 * clamp(open))); gr.addColorStop(1, alpha(th.gold, 0));
      ctx.fillStyle = gr; ctx.beginPath();
      ctx.moveTo(-150, cy - 20); ctx.lineTo(150, cy - 20); ctx.lineTo(260, cy - 440); ctx.lineTo(-260, cy - 440); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.translate(0, cy + 160); ctx.rotate(shake); ctx.translate(0, -160);
    // inside (visible when open)
    if (open > 0) { ctx.fillStyle = mix(woodDark, '#000000', 0.35); rr(ctx, -160, -40, 320, 50, 12); ctx.fill(); }
    // body
    rr(ctx, -175, -20, 350, 180, 22); ctx.fillStyle = wood; ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = th.outline; ctx.stroke();
    ctx.fillStyle = woodDark; for (let k = 0; k < 3; k++) ctx.fillRect(-165, 30 + k * 40, 330, 5);
    ctx.fillStyle = th.gold; ctx.fillRect(-140, -20, 34, 180); ctx.fillRect(106, -20, 34, 180);
    // lid: lifts and tilts back as it opens
    const lift = clamp(open, 0, 1.2);
    ctx.save(); ctx.translate(0, -20 - lift * 70); ctx.scale(1, lerp(1, 0.5, clamp(open)));
    ctx.beginPath(); ctx.moveTo(-180, 0); ctx.lineTo(-180, -60); ctx.quadraticCurveTo(0, -150, 180, -60); ctx.lineTo(180, 0); ctx.closePath();
    ctx.fillStyle = wood; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = th.outline; ctx.stroke();
    ctx.fillStyle = th.gold; ctx.fillRect(-140, -95, 34, 95); ctx.fillRect(106, -95, 34, 95);
    ctx.restore();
    // lock
    if (open < 0.3) { ctx.fillStyle = th.gold; rr(ctx, -30, -40, 60, 66, 12); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = th.goldDark; ctx.stroke(); ctx.fillStyle = th.outline; circle(ctx, 0, -12, 8); ctx.fill(); ctx.fillRect(-4, -10, 8, 20); }
    ctx.restore();
    // loot
    for (let i = 0; i < 16; i++) {
      const st = 1.85 + i * 0.05, age = t - st;
      if (age < 0) continue;
      const vx = (rand(i, 1) - 0.5) * 620, vy = -820 - rand(i, 2) * 330;
      let x = cy * 0 + vx * age, y = cy - 30 + vy * age + 0.5 * 2400 * age * age;
      const ground = 300 + rand(i, 3) * 40;
      if (y > ground && age > 0.3) y = ground;
      x = clamp(x, -340, 340);
      const kind = i % 3;
      if (kind === 0) coin(g, x, y, 24, y >= ground ? 1 : Math.cos(age * 12 + i));
      else if (kind === 1) gem(g, x, y, 24, th.confetti[i % th.confetti.length], y >= ground ? 0 : age * 5);
      else token(g, x, y, 24, y >= ground ? 0 : age * 4);
    }
    title(g, o.title, -250, prog(t, 2.2, 2.6), 58);
    pill(g, o.subtitle, 0, -150, prog(t, 2.6, 2.95), th.primary, th.onPrimary, 30);
  },
});

def({
  id: 'balloons', name: 'Balloon Party', duration: 4.4,
  use: 'A fun, gentle celebration for younger kids.',
  defaults: { title: 'Hooray!', subtitle: 'Chore done!' },
  sfx: [[0.2, 'whoosh'], [0.9, 'note:2'], [1.1, 'note:4'], [2.5, 'pop'], [2.8, 'pop'], [3.1, 'pop'], [2.55, 'sparkle']],
  draw(g) {
    const { ctx, t, th, o, hh } = g;
    const spots = [[-235, -70], [-140, -200], [-40, -80], [70, -215], [170, -75], [255, -190], [-10, -280]];
    const pops = { 1: 2.5, 3: 2.8, 5: 3.1 };
    [...spots.keys()].sort((a, b) => spots[a][1] - spots[b][1]).forEach(i => {
      const [bx, by] = spots[i];
      const st = 0.1 + i * 0.12, p = easeOut(prog(t, st, st + 1.5));
      const pt = pops[i];
      const x = bx + Math.sin(t * 1.6 + i) * 14, y = lerp(hh + 200, by, p) + Math.sin(t * 2.1 + i * 1.3) * 8;
      if (pt && t >= pt) { burst(g, x, y, prog(t, pt, pt + 0.7), 10, 130, i); return; }
      const col = i === 6 ? th.primary : th.confetti[i % th.confetti.length];
      // string
      ctx.strokeStyle = alpha(th.ink, 0.5); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y + 72);
      ctx.bezierCurveTo(x + 18, y + 120, x - 18, y + 160, x + Math.sin(t * 2 + i) * 10, y + 220); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.6 + i) * 0.06);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, 56, 70, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9, 76); ctx.lineTo(9, 76); ctx.lineTo(0, 66); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-20, -26, 12, 20, -0.5, 0, TAU); ctx.fill();
      ctx.restore();
    });
    title(g, o.title, 185, prog(t, 0.9, 1.3), 64);
    pill(g, o.subtitle, 0, 285, prog(t, 1.25, 1.6), th.success, th.onSuccess, 32);
  },
});

def({
  id: 'rocket-level-up', name: 'Rocket Level Up', duration: 4.6,
  use: 'Reaching a new level or a big points milestone.',
  defaults: { title: 'LEVEL UP!', level: 4 },
  sfx: [[0.1, 'rumble'], [0.9, 'whoosh'], [1.75, 'fanfare'], [2.05, 'pop'], [2.15, 'sparkle']],
  draw(g) {
    const { ctx, t, th, o, hw, hh } = g;
    // speed lines
    const sl = prog(t, 0.9, 1.1) * (1 - prog(t, 1.8, 2.3));
    if (sl > 0) {
      ctx.strokeStyle = alpha(th.surface, 0.7 * sl); ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        const x = -hw + rand(i, 1) * hw * 2, y = ((rand(i, 2) * 2 * hh + t * 1600) % (2 * hh + 200)) - hh - 100;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 80); ctx.stroke();
      }
    }
    // smoke puffs
    for (let i = 0; i < 14; i++) {
      const st = 0.15 + i * 0.09, age = t - st;
      if (age < 0 || age > 1.6) continue;
      const ry = i < 8 ? 300 : lerp(300, -hh - 300, easeIn(prog(st, 0.9, 1.7)));
      const x = (rand(i, 4) - 0.5) * 120 + (rand(i, 5) - 0.5) * age * 260;
      ctx.fillStyle = alpha(th.surface, 0.85 * (1 - age / 1.6));
      circle(ctx, x, ry + age * 30, 26 + age * 50); ctx.fill();
    }
    // rocket
    const launch = easeIn(prog(t, 0.9, 1.7));
    if (launch < 1) {
      const shake = t < 0.9 ? Math.sin(t * 60) * 3 * prog(t, 0.1, 0.5) : 0;
      ctx.save(); ctx.translate(shake, lerp(130, -hh - 320, launch));
      const fl = (th.flame || DEFAULT_THEME.flame), fh = (t < 0.9 ? 60 * prog(t, 0.1, 0.8) : 150) + Math.sin(t * 30) * 10;
      ctx.save(); ctx.translate(0, 110); ctx.rotate(Math.PI);
      flamePath(ctx, fh, Math.sin(t * 25) * 6); ctx.fillStyle = fl[0]; ctx.fill();
      ctx.scale(0.6, 0.6); flamePath(ctx, fh, 0); ctx.fillStyle = fl[1]; ctx.fill();
      ctx.restore();
      // fins
      ctx.fillStyle = th.accent; ctx.lineWidth = 6; ctx.strokeStyle = th.outline;
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(s * 50, 20); ctx.lineTo(s * 95, 105); ctx.lineTo(s * 40, 95); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      // body
      ctx.beginPath(); ctx.moveTo(0, -170);
      ctx.bezierCurveTo(70, -110, 66, 40, 50, 105); ctx.lineTo(-50, 105); ctx.bezierCurveTo(-66, 40, -70, -110, 0, -170); ctx.closePath();
      ctx.fillStyle = th.surface; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip(); ctx.fillStyle = th.primary; ctx.fillRect(-80, -180, 160, 70); ctx.fillRect(-80, 70, 160, 40); ctx.restore();
      ctx.beginPath(); ctx.moveTo(0, -170); ctx.bezierCurveTo(70, -110, 66, 40, 50, 105); ctx.lineTo(-50, 105); ctx.bezierCurveTo(-66, 40, -70, -110, 0, -170); ctx.stroke();
      circle(ctx, 0, -30, 30); ctx.fillStyle = th.secondary; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = th.gold; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; circle(ctx, -9, -39, 9); ctx.fill();
      ctx.restore();
    }
    // level badge
    const bp = easeOutBack(prog(t, 2.0, 2.4));
    if (bp > 0) {
      ctx.save(); ctx.translate(0, 50); ctx.scale(bp, bp);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU + t * 0.8;
        ctx.fillStyle = th.gold; star(ctx, Math.cos(a) * 200, Math.sin(a) * 200, 20, t * 2); ctx.fill();
      }
      circle(ctx, 0, 0, 150); ctx.fillStyle = th.gold; ctx.fill();
      circle(ctx, 0, 0, 124); ctx.fillStyle = th.primary; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = th.surface; ctx.stroke();
      ctx.font = font(th, 30); ctx.fillStyle = th.surface; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL', 0, -62);
      ctx.font = font(th, 140, 700); ctx.fillText(String(o.level), 0, 22);
      ctx.restore();
    }
    burst(g, 0, 50, prog(t, 2.05, 2.8), 14, 260, 5);
    title(g, o.title, -255, prog(t, 1.75, 2.1), 58);
  },
});

def({
  id: 'fireworks', name: 'Fireworks', duration: 4.8,
  use: 'The biggest moments: a full week of chores, a month-long streak.',
  defaults: { title: 'Amazing!', subtitle: 'A whole week of chores!' },
  sfx: null, // generated from the firework timings below
  shows: [[0.15, -220, -150, 0], [0.55, 200, -210, 1], [1.0, 20, -60, 2], [1.5, -150, -240, 3], [1.9, 270, -30, 4], [2.4, -280, 10, 1], [2.8, 80, -230, 0]],
  draw(g) {
    const { ctx, t, th, o, hw, hh } = g;
    ctx.fillStyle = alpha(th.night, 0.93 * prog(t, 0, 0.35));
    ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = prog(t, 0.1, 0.5) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
      ctx.fillStyle = '#FFFFFF'; circle(ctx, -hw + rand(i, 1) * hw * 2, -hh + rand(i, 2) * hh * 1.6, 1.5 + rand(i, 3) * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.shows.forEach(([st, x, y, c], j) => {
      const col = th.confetti[c % th.confetti.length];
      const up = prog(t, st, st + 0.5);
      if (up > 0 && up < 1) {
        const lx = lerp(x * 0.6, x, easeOut(up)), ly = lerp(hh + 20, y, easeOut(up));
        ctx.strokeStyle = alpha(th.gold, 0.8); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lerp(x * 0.6, x, easeOut(Math.max(0, up - 0.12))), lerp(hh + 20, y, easeOut(Math.max(0, up - 0.12)))); ctx.stroke();
        ctx.fillStyle = '#FFFFFF'; circle(ctx, lx, ly, 5); ctx.fill();
      }
      const age = t - st - 0.5;
      if (age < 0 || age > 1.6) return;
      const fade = 1 - Math.pow(age / 1.6, 2);
      if (age < 0.12) { ctx.fillStyle = alpha('#FFFFFF', 0.9 * (1 - age / 0.12)); circle(ctx, x, y, 18 + age * 160); ctx.fill(); }
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * TAU, sp = 330 * (0.85 + rand(i, j) * 0.3);
        const [px, py] = fly(x, y, Math.cos(a) * sp, Math.sin(a) * sp, age, 2.2, 110);
        const [qx, qy] = fly(x, y, Math.cos(a) * sp, Math.sin(a) * sp, Math.max(0, age - 0.14), 2.2, 110);
        ctx.strokeStyle = alpha(i % 3 === 0 ? '#FFFFFF' : col, fade); ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
        if (age > 0.8 && (i + Math.floor(t * 12)) % 3 === 0) { ctx.fillStyle = alpha(th.gold, fade); circle(ctx, px, py, 3); ctx.fill(); }
      }
    });
    title(g, o.title, 170, prog(t, 1.0, 1.4), 66);
    pill(g, o.subtitle, 0, 275, prog(t, 1.4, 1.75), th.primary, th.onPrimary, 30);
  },
});

def({
  id: 'mascot-dance', name: 'Happy Dance', duration: 4.2,
  use: 'The app\'s buddy character cheers the kid on. Swap the character per theme.',
  defaults: { title: 'You did it!', subtitle: 'Chore done!' },
  sfx: [[0.1, 'pop'], [0.6, 'boing'], [1.3, 'boing'], [2.0, 'boing'], [2.65, 'fanfare']],
  draw(g) {
    const { ctx, t, th, o } = g;
    // hearts floating up
    for (let i = 0; i < 12; i++) {
      const st = 0.7 + i * 0.22, age = t - st;
      if (age < 0 || age > 2.2) continue;
      const x = (rand(i, 1) - 0.5) * 520 + Math.sin(age * 3 + i) * 20, y = 200 - age * 210;
      ctx.globalAlpha = Math.sin(age / 2.2 * Math.PI);
      ctx.fillStyle = th.confetti[i % th.confetti.length];
      if (th.shape === 'confetti' || th.shape === 'heart') { heart(ctx, x, y, 18 + rand(i, 2) * 10); ctx.fill(); }
      else particle(g, x, y, 16 + rand(i, 2) * 8, age, ctx.fillStyle, i);
    }
    ctx.globalAlpha = 1;
    const enter = easeOutBack(prog(t, 0, 0.4));
    let jump = 0, squash = 0;
    [0.6, 1.3, 2.0].forEach(j => {
      const p = prog(t, j, j + 0.5);
      if (p > 0 && p < 1) jump = Math.sin(p * Math.PI) * 110;
      squash += Math.max(0, 1 - Math.abs(t - j) / 0.1) * 0.8 + Math.max(0, 1 - Math.abs(t - j - 0.5) / 0.1) * 0.8;
    });
    const beat = Math.floor(t / 0.35) % 2, cheer = t > 2.55;
    const wave = Math.sin(t * 12) * 0.3;
    const pose = {
      armR: cheer ? -2.6 + wave : beat ? -2.4 + wave : -0.6,
      armL: cheer ? 2.6 - wave : beat ? 0.6 : 2.4 - wave,
      jump, squash, mouth: jump > 20 || cheer ? 'open' : 'smile', look: Math.sin(t * 3) * 3,
    };
    if (enter > 0) mascot(g, 0, -10, 1.35 * enter, pose);
    title(g, o.title, -255, prog(t, 0.4, 0.8), 58);
    pill(g, o.subtitle, 0, 285, prog(t, 2.55, 2.9), th.success, th.onSuccess, 32);
  },
});

// Sound cues for rewards whose sounds follow their own timings.
REWARDS.find(r => r.id === 'coin-jar').sfx = (() => {
  const cues = [[0.1, 'pop']];
  for (let i = 0; i < 10; i++) cues.push([0.35 + i * 0.16 + 0.5, 'coin']);
  cues.push([0.35 + 9 * 0.16 + 0.5, 'sparkle']);
  return cues;
})();
(r => { r.sfx = []; r.shows.forEach(([st]) => { r.sfx.push([st, 'whoosh'], [st + 0.5, 'boom'], [st + 0.8, 'sparkle']); }); r.sfx.push([1.0, 'fanfare']); })(REWARDS.find(r => r.id === 'fireworks'));

const byId = {};
REWARDS.forEach(r => { byId[r.id] = r; });

// ---------- public API ----------
const FADE = 0.35;
let buffer = null;

function render(ctx, id, t, opts = {}) {
  const r = byId[id];
  if (!r) throw new Error('Unknown reward: ' + id);
  const w = opts.width || ctx.canvas.width, h = opts.height || ctx.canvas.height;
  const th = adaptTheme(opts.theme);
  const o = Object.assign({}, r.defaults, opts.text || {}, { transparent: opts.transparent, scrim: opts.scrim });
  Object.keys(o).forEach(k => { if (typeof o[k] === 'function') o[k] = o[k](th, o); });
  const fade = 1 - prog(t, r.duration - FADE, r.duration);
  let target = ctx;
  if (fade < 1) {
    if (!buffer) buffer = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w, h) : document.createElement('canvas');
    if (buffer.width !== w || buffer.height !== h) { buffer.width = w; buffer.height = h; }
    target = buffer.getContext('2d');
  }
  const S = Math.min(w, h) / 720;
  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.clearRect(0, 0, w, h);
  target.translate(w / 2, h / 2); target.scale(S, S);
  const g = { ctx: target, t, th, o, S, hw: w / 2 / S, hh: h / 2 / S };
  background(g);
  r.draw(g);
  target.restore();
  if (target !== ctx) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!opts.transparent) {
      // fade toward the background colour rather than to nothing
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = fade; ctx.drawImage(buffer, 0, 0);
    ctx.restore();
  }
}

// Plays a reward on a canvas in real time. Returns a stop() function.
function play(canvas, id, opts = {}) {
  const r = byId[id], ctx = canvas.getContext('2d');
  let raf = 0, start = null, stopped = false;
  const tick = now => {
    if (stopped) return;
    if (start === null) start = now;
    let t = (now - start) / 1000;
    if (t >= r.duration) {
      if (opts.loop) { start = now; t = 0; }
      else { render(ctx, id, r.duration, opts); if (opts.onDone) opts.onDone(); return; }
    }
    render(ctx, id, t, opts);
    raf = requestAnimationFrame(tick);
  };
  const go = () => { if (!stopped) raf = requestAnimationFrame(tick); };
  Rewards.ready(opts.theme).then(go, go);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

const Rewards = {
  render, play, adaptTheme,
  // resolves once a theme's background pattern (and fonts, in a browser) are ready to draw
  ready: theme => { const th = adaptTheme(theme); const fonts = (typeof document !== 'undefined' && document.fonts) ? document.fonts.load(`600 40px "${th.font}"`).catch(() => {}) : null; return Promise.all([loadPattern(th), fonts]); },
  themes: THEMES,
  list: REWARDS.map(r => ({ id: r.id, name: r.name, use: r.use, duration: r.duration, defaults: r.defaults })),
  sfx: id => byId[id].sfx.slice().sort((a, b) => a[0] - b[0]),
  duration: id => byId[id].duration,
};
if (typeof module !== 'undefined' && module.exports) module.exports = Rewards;
root.Rewards = Rewards;
})(typeof window !== 'undefined' ? window : globalThis);
