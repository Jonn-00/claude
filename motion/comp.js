/*  MADE IN CODE — a 15 second motion study.
 *  Everything is a pure function of time t (seconds), so any frame can be rendered
 *  in any order. 1920×1080, 60 fps, 120 BPM (one beat = 0.5 s).
 */
'use strict';

const W = 1920, H = 1080, FPS = 60, DUR = 15, TAU = Math.PI * 2;
const SHUTTER = 0.5; // 180° shutter for motion blur

const P = {
  ink: [13, 13, 18],
  cream: [244, 239, 230],
  orange: [255, 74, 28],
  blue: [43, 69, 255],
  sky: [128, 148, 255],
  lemon: [255, 210, 63],
};

// ───────────────────────────────────────────────────────────── utilities
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const E = {
  linear: x => x,
  inCubic: x => x * x * x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: x => x * x * x * x,
  outQuart: x => 1 - Math.pow(1 - x, 4),
  inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inBack: x => { const c1 = 1.70158, c3 = c1 + 1; return c3 * x * x * x - c1 * x * x; },
  outElastic: x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1,
  // critically-ish damped spring: stiffness 196, damping 12 (mass 1)
  spring: x => { const wd = Math.sqrt(196 - 36); return 1 - Math.exp(-6 * x) * (Math.cos(wd * x) + (6 / wd) * Math.sin(wd * x)); },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };

function setFont(ctx, weight, size, family = 'Inter', spacing = 0) {
  ctx.font = `${weight} ${size}px "${family}"`;
  ctx.letterSpacing = `${spacing}px`;
}

// x-offset of every character (kerning-aware, via prefix measurement)
const charCache = new Map();
function charXs(ctx, str) {
  const key = ctx.font + '|' + ctx.letterSpacing + '|' + str;
  let r = charCache.get(key);
  if (!r) {
    const xs = [];
    for (let i = 0; i <= str.length; i++) xs.push(ctx.measureText(str.slice(0, i)).width);
    r = { xs, w: xs[str.length] };
    charCache.set(key, r);
  }
  return r;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/*+=<>%&';
// Draws `str` with a decode/scramble reveal. p: 0 = hidden, 1 = fully resolved.
function drawScramble(ctx, str, x, y, p, t, align = 'left', seed = 0) {
  if (p <= 0) return;
  const { xs, w } = charXs(ctx, str);
  const ox = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  const n = str.length, tick = Math.floor(t * 30);
  ctx.textAlign = 'left';
  for (let i = 0; i < n; i++) {
    const ch = str[i];
    if (ch === ' ') continue;
    const at = (i / n) * 0.65;
    if (p < at) continue;
    let c = ch;
    if (p < at + 0.35) c = GLYPHS[Math.floor(hash(i * 7.31 + tick * 1.17 + seed) * GLYPHS.length)];
    ctx.fillText(c, ox + xs[i], y);
  }
}

// Per-character masked reveal (letters rise out of a slot).
function drawSlotLine(ctx, str, x, baseline, size, tIn, tOut, t, opt = {}) {
  const stagger = opt.stagger ?? 0.03, dur = opt.dur ?? 0.55;
  const oStagger = opt.oStagger ?? 0.015, oDur = opt.oDur ?? 0.35;
  const { xs } = charXs(ctx, str);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - size, baseline - size * (opt.top ?? 0.86), xs[str.length] + size * 2, size * ((opt.top ?? 0.86) + (opt.bottom ?? 0.08)));
  ctx.clip();
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ' ') continue;
    const pin = E.outExpo(prog(t, tIn + i * stagger, tIn + i * stagger + dur));
    if (pin <= 0) continue;
    const pout = tOut == null ? 0 : E.inExpo(prog(t, tOut + i * oStagger, tOut + i * oStagger + oDur));
    const dir = opt.exitDown ? 1 : -1;
    const dy = (1 - pin) * size * 1.0 + pout * size * 1.4 * dir;
    ctx.fillText(ch, x + xs[i], baseline + dy);
  }
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── global timing
const BEATS = []; for (let b = 0; b < 30; b++) BEATS.push(b * 0.5);

function baseBg(t) {
  if (t < 4.0) return P.ink;
  if (t < 5.85) return P.orange;
  if (t < 13.0) return P.ink;
  return P.cream;
}

const SHAKES = [[2.5, 7], [3.0, 5], [3.5, 3], [4.0, 16], [4.5, 6], [5.0, 6], [5.5, 12], [8.0, 28],
  [9.0, 4], [9.5, 4], [10.0, 5], [10.5, 4], [13.0, 9]];
function shake(t) {
  let x = 0, y = 0, r = 0;
  SHAKES.forEach(([ti, a], i) => {
    if (t < ti) return;
    const d = t - ti, env = a * Math.exp(-d * 9);
    if (env < 0.05) return;
    x += env * vnoise(d * 38 + i * 13.7);
    y += env * vnoise(d * 38 + i * 29.1 + 100);
    r += env * 0.0009 * vnoise(d * 30 + i * 3.3 + 200);
  });
  return { x, y, r };
}

// ───────────────────────────────────────────────────────────── 01 SPARK  (0 – 2)
function sceneSpark(ctx, t) {
  if (t >= 2.0) return;
  const cx = W / 2, cy = H / 2;
  const gi = E.outExpo(prog(t, 0.3, 1.15)), go = E.inExpo(prog(t, 1.3, 1.7));
  const g = gi * (1 - go);
  if (g > 0.001) {
    ctx.save();
    const ex = (W / 2) * g, ey = (H / 2) * g;
    ctx.strokeStyle = rgba(P.cream, 0.16); ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - ex, cy); ctx.lineTo(cx + ex, cy);
    ctx.moveTo(cx, cy - ey); ctx.lineTo(cx, cy + ey);
    ctx.stroke();
    ctx.strokeStyle = rgba(P.cream, 0.3);
    ctx.beginPath();
    for (let k = -24; k <= 24; k++) {
      const d = k * 40; if (!k || Math.abs(d) > ex) continue;
      const L = k % 5 === 0 ? 14 : 6; ctx.moveTo(cx + d, cy - L); ctx.lineTo(cx + d, cy + L);
    }
    for (let k = -13; k <= 13; k++) {
      const d = k * 40; if (!k || Math.abs(d) > ey) continue;
      const L = k % 5 === 0 ? 14 : 6; ctx.moveTo(cx - L, cy + d); ctx.lineTo(cx + L, cy + d);
    }
    ctx.stroke();
    const ca = E.inOutCubic(prog(t, 0.45, 1.2));
    ctx.setLineDash([3, 9]);
    ctx.strokeStyle = rgba(P.cream, 0.35 * (1 - go)); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 200, -Math.PI / 2, -Math.PI / 2 + ca * TAU); ctx.stroke();
    ctx.setLineDash([]);
    setFont(ctx, 500, 15, 'Inter', 3);
    ctx.fillStyle = rgba(P.cream, 0.6 * (1 - go));
    drawScramble(ctx, 'X 960   Y 540', cx + 30, cy - 26, prog(t, 0.55, 1.0), t);
    ctx.fillStyle = rgba(P.orange, 0.9 * (1 - go));
    drawScramble(ctx, 'ORIGIN', cx + 30, cy + 40, prog(t, 0.7, 1.1), t, 'left', 3);
    ctx.restore();
  }
  // the dot
  let r = 18 * E.outElastic(prog(t, 0.18, 1.0));
  for (const b of [0.5, 1.0]) if (t >= b) r *= 1 + 0.2 * Math.exp(-(t - b) * 10);
  for (const b of [0.5, 1.0]) {
    const p = prog(t, b, b + 1.0);
    if (p <= 0 || p >= 1) continue;
    ctx.strokeStyle = rgba(P.cream, Math.pow(1 - p, 2) * 0.85);
    ctx.lineWidth = 0.6 + 3 * (1 - p);
    ctx.beginPath(); ctx.arc(cx, cy, r + 380 * E.outCubic(p), 0, TAU); ctx.stroke();
  }
  if (r <= 0.01) return;
  const a = E.inOutCubic(prog(t, 1.45, 1.75));
  const s = E.outExpo(prog(t, 1.75, 2.0));
  let hw = r * (1 - 0.42 * a), hh = r * (1 + 0.55 * a);
  if (s > 0) { hw = lerp(hw, W / 2 + 60, s); hh = lerp(hh, 2, s); }
  ctx.fillStyle = rgba(P.cream);
  ctx.beginPath(); ctx.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, Math.min(hw, hh)); ctx.fill();
}

// ───────────────────────────────────────────────────────────── 02 PHYSICS (2 – 4)
const FY = 820, BR = 44, GROUND = FY - BR;
const IMPACTS = [{ t: 2.5, a: 15 }, { t: 3.0, a: 11 }, { t: 3.5, a: 9 }];
const LABELS = [
  { t: 2.5, n: '01', s: 'SQUASH & STRETCH' },
  { t: 3.0, n: '02', s: 'TIMING & SPACING' },
  { t: 3.5, n: '03', s: 'ANTICIPATION' },
];
function ballX(t) { return t < 3.5 ? lerp(380, 1540, (t - 2.0) / 1.5) : 1540 + 26 * E.outCubic(prog(t, 3.5, 3.62)); }
function ballY(t) {
  if (t < 2.5) { const s = prog(t, 2.0, 2.5); return lerp(-170, GROUND, s * s); }
  if (t < 3.0) { const s = (t - 2.5) / 0.5; return GROUND - 400 * 4 * s * (1 - s); }
  if (t < 3.5) { const s = (t - 3.0) / 0.5; return GROUND - 240 * 4 * s * (1 - s); }
  return GROUND;
}
function floorY(t) { return lerp(H / 2, FY, E.outExpo(prog(t, 2.0, 2.45))); }

function sceneBounce(ctx, t) {
  if (t < 2.0 || t >= 4.05) return;
  const fade = 1 - E.inCubic(prog(t, 3.62, 3.9));
  const fy = floorY(t);
  // floor with travelling ripples
  if (fade > 0) {
    ctx.strokeStyle = rgba(P.cream, fade); ctx.lineWidth = 4; ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let x = -20; x <= W + 20; x += 8) {
      let d = 0;
      for (const im of IMPACTS) {
        if (t < im.t) continue;
        const dt = t - im.t, xi = ballX(im.t), dx = Math.abs(x - xi);
        const front = clamp((dt * 900 - dx) / 120);
        d += im.a * Math.exp(-dt * 4.5) * Math.sin(dt * 30 - dx * 0.03) * Math.exp(-dx / 420) * front;
      }
      x === -20 ? ctx.moveTo(x, fy + d) : ctx.lineTo(x, fy + d);
    }
    ctx.stroke();
  }
  // spacing chart (24 fps samples) + onion skins
  if (t < 3.62 && fade > 0) {
    ctx.fillStyle = rgba(P.cream, 0.4 * fade);
    for (let k = 0; ; k++) {
      const tk = 2.0 + k / 24;
      if (tk > Math.min(t - 0.02, 3.5)) break;
      const y = ballY(tk); if (y < -10) continue;
      ctx.beginPath(); ctx.arc(ballX(tk), y, 3, 0, TAU); ctx.fill();
    }
    ctx.lineWidth = 1.5;
    for (let k = 1; k <= 4; k++) {
      const tk = t - k * 0.05;
      if (tk < 2.0 || tk > 3.5) continue;
      ctx.strokeStyle = rgba(P.cream, 0.28 * (1 - k / 5) * fade);
      ctx.beginPath(); ctx.arc(ballX(tk), ballY(tk), BR, 0, TAU); ctx.stroke();
    }
  }
  // principle labels
  for (const L of LABELS) {
    if (t < L.t || fade <= 0) continue;
    const x = ballX(L.t) + 2, tk = E.outExpo(prog(t, L.t, L.t + 0.3));
    ctx.strokeStyle = rgba(P.cream, 0.55 * fade); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, FY + 16); ctx.lineTo(x, FY + 16 + 62 * tk); ctx.stroke();
    setFont(ctx, 700, 14, 'Inter', 3);
    ctx.fillStyle = rgba(P.orange, fade);
    drawScramble(ctx, L.n, x + 16, FY + 52, prog(t, L.t + 0.04, L.t + 0.25), t);
    setFont(ctx, 600, 16, 'Inter', 3.5);
    ctx.fillStyle = rgba(P.cream, 0.92 * fade);
    drawScramble(ctx, L.s, x + 16, FY + 78, prog(t, L.t + 0.08, L.t + 0.42), t, 'left', 9);
  }
  // the ball
  let x, y, r = BR, q = 0, st = 1, ang = 0, anchorY;
  if (t < 3.62) {
    x = ballX(t); y = ballY(t);
    const e = 0.004, vx = (ballX(t + e) - ballX(t - e)) / (2 * e), vy = (ballY(t + e) - ballY(t - e)) / (2 * e);
    let contact = 0;
    for (const im of IMPACTS) contact = Math.max(contact, Math.exp(-Math.pow((t - im.t) / 0.05, 2)));
    st = 1 + clamp(Math.hypot(vx, vy) / 4200, 0, 0.42) * (1 - contact);
    ang = Math.atan2(vy, vx);
    for (const [ti, A] of [[2.5, 0.46], [3.0, 0.34]]) {
      const d = t - ti;
      if (d >= 0 && d < 0.4) q += A * Math.exp(-d * 16) * Math.cos(d * 34);
    }
    if (t >= 3.5) q += 0.5 * E.outCubic(prog(t, 3.5, 3.62));
    anchorY = y + BR;
  } else {
    // launch toward camera
    const p = prog(t, 3.62, 4.0), d = t - 3.62;
    const x0 = ballX(3.62), y0 = GROUND, x2 = W / 2, y2 = H / 2, cxp = 1500, cyp = 260;
    const u = E.inOutCubic(p);
    x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cxp + u * u * x2;
    y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cyp + u * u * y2;
    r = lerp(BR, 1250, E.inExpo(p));
    q = 0.5 * Math.exp(-d * 14) * Math.cos(d * 26);
    anchorY = y + r;
  }
  ctx.save();
  ctx.translate(x, anchorY); ctx.scale(1 + q, 1 - q); ctx.translate(-x, -anchorY);
  ctx.translate(x, y); ctx.rotate(ang); ctx.scale(st, 1 / st);
  ctx.fillStyle = rgba(P.orange);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── 03 TYPE (4 – 6.3)
const WORDS = [{ s: 'EVERY', t: 4.0 }, { s: 'FRAME', t: 4.5 }, { s: 'IS A', t: 5.0 }, { s: 'CHOICE.', t: 5.5 }];
const TS = 250, LEAD = 222, TX = 150, TY0 = 302;
function drawWords(ctx, t, cols) {
  setFont(ctx, 900, TS, 'Inter Display', -11);
  ctx.textAlign = 'left';
  WORDS.forEach((w, i) => {
    ctx.fillStyle = rgba(cols[i]);
    drawSlotLine(ctx, w.s, TX, TY0 + i * LEAD, TS, w.t, 5.92 + i * 0.045, t, { stagger: 0.028, dur: 0.6, oStagger: 0.014, oDur: 0.32 });
  });
}
function sceneType(ctx, t) {
  if (t < 3.98 || t >= 6.4) return;
  ctx.save();
  let sc = 1 + 0.035 * E.inOutCubic(prog(t, 4.0, 6.0));
  for (const w of WORDS) if (t >= w.t) sc += 0.012 * Math.exp(-(t - w.t) * 12);
  ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);

  // small editorial details
  setFont(ctx, 600, 15, 'Inter', 3.5);
  const wv = E.inOutCubic(prog(t, 5.4, 5.85));
  const detailCol = wv < 0.5 ? P.ink : P.cream;
  ctx.fillStyle = rgba(detailCol, 0.85);
  WORDS.forEach((w, i) => {
    const out = prog(t, 5.9, 6.1);
    drawScramble(ctx, `(0${i + 1})`, 1720, TY0 + i * LEAD - 160, prog(t, w.t + 0.05, w.t + 0.3) * (1 - out), t, 'left', i);
  });

  if (wv < 1) drawWords(ctx, t, [P.ink, P.ink, P.ink, P.ink]);
  if (wv > 0) {
    const S = 460, e = lerp(-S - 120, W + 120, wv);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-1200, -50); ctx.lineTo(e + S, -50); ctx.lineTo(e, H + 50); ctx.lineTo(-1200, H + 50); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = rgba(P.ink); ctx.fillRect(-200, -200, W + 400, H + 400);
    drawWords(ctx, t, [P.cream, P.cream, P.cream, P.orange]);
    ctx.restore();
    if (wv < 1) {
      ctx.fillStyle = rgba(P.lemon);
      ctx.beginPath();
      ctx.moveTo(e + S, -50); ctx.lineTo(e + S + 110, -50); ctx.lineTo(e + 110, H + 50); ctx.lineTo(e, H + 50); ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── 04 EASING (6 – 8)
const ROWS = [
  { name: 'LINEAR', note: 'f(t) = t', f: E.linear, col: P.cream },
  { name: 'EASE IN-OUT', note: 'cubic-bezier(.65, 0, .35, 1)', f: E.inOutCubic, col: P.lemon },
  { name: 'SPRING', note: 'stiffness 196 · damping 12', f: E.spring, col: P.orange },
];
const RY = [318, 540, 762], GX = 210, GW = 380, GH = 150, TR0 = 760, TR1 = 1560;
const gyMap = (v, ry) => ry + GH / 2 - ((v + 0.1) / 1.4) * GH;

function drawTabular(ctx, str, x, y, slot) {
  ctx.textAlign = 'center';
  let cx = x;
  for (const ch of str) {
    const w = ch === '.' || ch === '-' ? slot * 0.55 : slot;
    ctx.fillText(ch, cx + w / 2, y); cx += w;
  }
  ctx.textAlign = 'left';
}

function sceneEasing(ctx, t) {
  if (t < 5.98 || t >= 8.05) return;
  const p = prog(t, 6.5, 7.5);
  const conv = prog(t, 7.5, 7.85);
  ROWS.forEach((R, i) => {
    const d = i * 0.08, ry = RY[i];
    const out = E.inExpo(prog(t, 7.42 + d * 0.5, 7.78 + d * 0.5));
    const ax = E.outExpo(prog(t, 6.0 + d, 6.55 + d)) * (1 - out);
    if (ax > 0.001) {
      // graph frame
      ctx.strokeStyle = rgba(P.cream, 0.35); ctx.lineWidth = 1.5;
      const ox = GX, oy = gyMap(0, ry);
      ctx.beginPath();
      ctx.moveTo(ox, oy); ctx.lineTo(ox + GW * ax, oy);
      ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - (GH - 12) * ax);
      ctx.stroke();
      ctx.setLineDash([2, 6]); ctx.strokeStyle = rgba(P.cream, 0.25);
      ctx.beginPath(); ctx.moveTo(ox, gyMap(1, ry)); ctx.lineTo(ox + GW * ax, gyMap(1, ry)); ctx.stroke();
      ctx.setLineDash([]);
      // plotted curve
      if (p > 0) {
        ctx.strokeStyle = rgba(R.col, 1 - out); ctx.lineWidth = 3; ctx.lineJoin = 'round';
        ctx.beginPath();
        const n = Math.max(2, Math.ceil(90 * p));
        for (let k = 0; k <= n; k++) {
          const u = (k / n) * p, X = ox + u * GW, Y = gyMap(R.f(u), ry);
          k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.stroke();
        ctx.fillStyle = rgba(R.col, 1 - out);
        ctx.beginPath(); ctx.arc(ox + p * GW, gyMap(R.f(p), ry), 6, 0, TAU); ctx.fill();
      }
    }
    // labels
    const lp = prog(t, 6.05 + d, 6.45 + d) * (1 - prog(t, 7.4 + d * 0.5, 7.65 + d * 0.5));
    setFont(ctx, 700, 15, 'Inter', 3.5);
    ctx.fillStyle = rgba(R.col);
    drawScramble(ctx, R.name, GX, ry - GH / 2 - 22, lp, t, 'left', i * 5);
    setFont(ctx, 500, 13, 'Inter', 1);
    ctx.fillStyle = rgba(P.cream, 0.5);
    drawScramble(ctx, R.note, GX + GW, ry - GH / 2 - 22, lp, t, 'right', i * 9);
    // track
    const tg = E.outExpo(prog(t, 6.08 + d, 6.6 + d));
    const tl = lerp(TR0, TR1, E.inExpo(prog(t, 7.42 + d * 0.5, 7.75 + d * 0.5)));
    const tr = lerp(TR0, TR1, tg);
    if (tr - tl > 0.5) {
      ctx.strokeStyle = rgba(P.cream, 0.22); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tl, ry); ctx.lineTo(tr, ry); ctx.stroke();
      ctx.strokeStyle = rgba(P.cream, 0.35); ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const X = lerp(TR0, TR1, k / 10); if (X > tr + 0.5 || X < tl - 0.5) continue;
        const L = k % 5 === 0 ? 12 : 6; ctx.moveTo(X, ry - L); ctx.lineTo(X, ry + L);
      }
      ctx.stroke();
    }
    // value readout
    if (lp > 0) {
      setFont(ctx, 500, 18, 'Inter', 0);
      ctx.fillStyle = rgba(P.cream, 0.75 * lp);
      drawTabular(ctx, R.f(p).toFixed(3), TR0, ry - 34, 11.5);
    }
    // dot + progress trail
    if (conv < 1) {
      const v = R.f(p), dx = lerp(TR0, TR1, v);
      let X = dx, Y = ry;
      if (conv > 0) {
        const u = E.inOutCubic(conv);
        X = lerp(TR1, W / 2, u) + Math.sin(u * Math.PI) * 0;
        Y = lerp(ry, H / 2, u) - Math.sin(u * Math.PI) * 90 * (1 - i);
        X = lerp(dx, X, Math.min(1, conv * 4));
      }
      if (p > 0 && conv <= 0) {
        ctx.strokeStyle = rgba(R.col, 0.9); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(Math.max(TR0, tl), ry); ctx.lineTo(Math.max(TR0, tl, dx), ry); ctx.stroke();
      }
      const rr = 22 * E.outBack(prog(t, 6.2 + d, 6.55 + d)) * lerp(1, 1.25, conv);
      ctx.fillStyle = rgba(R.col);
      ctx.beginPath(); ctx.arc(X, Y, Math.max(0, rr), 0, TAU); ctx.fill();
    }
  });
  if (conv >= 1) {
    const a = E.inOutCubic(prog(t, 7.86, 8.0));
    const r = 26 * (1 - 0.6 * a) * (1 + 0.25 * Math.exp(-(t - 7.85) * 16));
    ctx.strokeStyle = rgba(P.orange, 0.5 * a); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r + 60 * (1 - a), 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba(P.orange);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, TAU); ctx.fill();
  }
}

// ───────────────────────────────────────────────────────────── 05 PARTICLES (8 – 11.35)
const GC = 64, GRr = 36, CELL = 30, N = GC * GRr;
const PT = (() => {
  const rnd = mulberry32(7);
  const o = {
    sx: new Float32Array(N), sy: new Float32Array(N), sz: new Float32Array(N),
    kx: new Float32Array(N), ky: new Float32Array(N), kz: new Float32Array(N),
    gx: new Float32Array(N), gy: new Float32Array(N),
    r1: new Float32Array(N), r2: new Float32Array(N), r3: new Float32Array(N), r4: new Float32Array(N),
    col: new Uint8Array(N),
  };
  const R = 330, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y), ph = i * ga;
    o.sx[i] = Math.cos(ph) * rr * R; o.sy[i] = y * R; o.sz[i] = Math.sin(ph) * rr * R;
    // trefoil-ish (2,3) torus knot with a fuzzy tube
    const u = (i / N) * TAU, q = Math.cos(3 * u) + 2.2;
    const th = rnd() * TAU, rad = 24 * Math.sqrt(rnd());
    o.kx[i] = (q * Math.cos(2 * u)) * 118 + Math.cos(th) * rad;
    o.ky[i] = (q * Math.sin(2 * u)) * 118 + Math.sin(th) * rad;
    o.kz[i] = -Math.sin(3 * u) * 150 + (rnd() - 0.5) * rad * 2;
    const c = i % GC, r = Math.floor(i / GC);
    o.gx[i] = (c + 0.5) * CELL - W / 2; o.gy[i] = (r + 0.5) * CELL - H / 2;
    o.r1[i] = rnd(); o.r2[i] = rnd(); o.r3[i] = rnd(); o.r4[i] = rnd();
    o.col[i] = o.r4[i] < 0.12 ? 1 : o.r4[i] < 0.34 ? 2 : 0;
  }
  return o;
})();
const PCOLS = [P.cream, P.orange, P.sky];
const FOC = 1600;
const camD = t => t < 10.4 ? lerp(2050, 1450, E.inOutCubic(prog(t, 8.0, 10.4))) : lerp(1450, FOC, E.inOutCubic(prog(t, 10.4, 11.2)));
const rotA = t => 0.55 * (t - 8) + 1.1 * E.inOutCubic(prog(t, 9.4, 10.5));
const rotB = t => 0.38 + 0.22 * Math.sin((t - 8) * 0.9);

function project(x, y, z, ca, sa, cb, sb, D) {
  const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
  const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
  const s = FOC / (D + z2);
  return [x1, y2, z2, s];
}

function sceneParticles(ctx, t) {
  if (t < 7.98 || t >= 11.36) return;
  const D = camD(t), a = rotA(t), b = rotB(t), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // ambient glow
  const gl = prog(t, 8.0, 8.25) * (1 - prog(t, 10.7, 11.3));
  if (gl > 0) {
    let pulse = 0; for (const bt of [8.0, 8.5, 9.0, 9.5, 10.0, 10.5]) if (t >= bt) pulse += Math.exp(-(t - bt) * 6);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 760);
    g.addColorStop(0, rgba(P.blue, (0.28 + 0.12 * pulse) * gl)); g.addColorStop(1, rgba(P.blue, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // shockwave
  const sw = prog(t, 8.0, 8.7);
  if (sw > 0 && sw < 1) {
    ctx.strokeStyle = rgba(P.cream, 0.9 * (1 - sw)); ctx.lineWidth = 10 * (1 - sw) + 0.5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 40 + 1300 * E.outExpo(sw), 0, TAU); ctx.stroke();
  }
  // orbit rings
  const ringIn = E.outExpo(prog(t, 8.25, 9.2)), ringOut = 1 - prog(t, 10.3, 10.75);
  if (ringIn > 0 && ringOut > 0) {
    for (const [tilt, roll, rad, spd] of [[1.15, 0.35, 470, 2.2], [-0.95, -0.7, 540, -1.6]]) {
      const ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
      const pt = th => {
        let x = Math.cos(th) * rad, y = 0, z = Math.sin(th) * rad;
        let y1 = y * ct - z * st, z1 = y * st + z * ct; // tilt about X
        let x2 = x * cr - y1 * sr, y2 = x * sr + y1 * cr; // roll about Z
        return project(x2, y2, z1, ca, sa, cb, sb, D);
      };
      const segs = 140, th0 = spd * (t - 8);
      ctx.lineWidth = 1.5;
      let prev = pt(th0);
      for (let k = 1; k <= segs * ringIn; k++) {
        const cur = pt(th0 + (k / segs) * TAU);
        const al = clamp(0.15 + 0.6 * (1 - (cur[2] + rad) / (2 * rad))) * ringOut;
        ctx.strokeStyle = rgba(P.cream, al * 0.7);
        ctx.beginPath();
        ctx.moveTo(W / 2 + prev[0] * prev[3], H / 2 + prev[1] * prev[3]);
        ctx.lineTo(W / 2 + cur[0] * cur[3], H / 2 + cur[1] * cur[3]);
        ctx.stroke();
        prev = cur;
      }
      const s = pt(th0 + ringIn * TAU);
      ctx.fillStyle = rgba(P.orange, ringOut);
      ctx.beginPath(); ctx.arc(W / 2 + s[0] * s[3], H / 2 + s[1] * s[3], 7 * s[3], 0, TAU); ctx.fill();
    }
  }
  // particles
  let pulse = 1;
  for (const bt of [9.0, 9.5, 10.0, 10.5]) if (t >= bt) pulse += 0.075 * Math.exp(-(t - bt) * 7);
  ctx.globalCompositeOperation = 'lighter';
  const X = PT;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < N; i++) {
      const pe = prog(t, 8.0 + X.r1[i] * 0.06, 8.95 + X.r1[i] * 0.06);
      if (pe <= 0) continue;
      const g = E.inOutExpo(prog(t, 10.62 + X.r1[i] * 0.14, 11.2 + X.r1[i] * 0.14));
      const colId = g > 0.6 ? 0 : X.col[i];
      if (colId !== pass) continue;
      const burst = E.outExpo(pe) * (1 + (0.4 + X.r2[i] * 1.3) * (1 - E.inOutCubic(pe)));
      const sk = (i / N) * 0.22 + X.r3[i] * 0.22;
      const k = E.inOutCubic(prog(t, 9.45 + sk, 10.1 + sk));
      const wob = 5 * Math.sin(t * 3 + X.r4[i] * TAU);
      const m = burst * pulse;
      const x = lerp(X.sx[i], X.kx[i], k) * m + wob, y = lerp(X.sy[i], X.ky[i], k) * m + wob * 0.7, z = lerp(X.sz[i], X.kz[i], k) * m;
      let [px, py, pz, s] = project(x, y, z, ca, sa, cb, sb, D);
      // into the flat grid (camera space, z = 0 → scale 1 at D = FOC)
      px = lerp(px * s, X.gx[i], g); py = lerp(py * s, X.gy[i], g);
      const depthA = clamp(lerp(1.0, 0.22, (pz + 380) / 760));
      const al = lerp(depthA, 1, g);
      const sz = lerp(3.8 * s, 4, g);
      ctx.globalAlpha = al;
      ctx.fillStyle = rgba(g > 0.6 ? P.cream : PCOLS[pass]);
      ctx.fillRect(W / 2 + px - sz / 2, H / 2 + py - sz / 2, sz, sz);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // flash
  const fl = t >= 8.0 ? Math.exp(-(t - 8.0) * 22) : 0;
  if (fl > 0.01) { ctx.fillStyle = rgba(P.orange, 0.35 * fl); ctx.fillRect(-100, -100, W + 200, H + 200); }
}

// ───────────────────────────────────────────────────────────── 06 SYSTEMS (11.35 – 13)
function sceneGrid(ctx, t) {
  if (t < 11.34 || t >= 13.02) return;
  const ta = t - 11.35, Rw = Math.max(0, ta) * 1500, Rb = Math.max(0, t - 12.3) * 1750;
  let pulse = 1;
  for (const bt of [11.5, 12.0]) if (t >= bt) pulse += 0.18 * Math.exp(-(t - bt) * 8);
  const paths = [new Path2D(), new Path2D(), new Path2D()];
  for (let i = 0; i < N; i++) {
    const cx = PT.gx[i] + W / 2, cy = PT.gy[i] + H / 2;
    const dx = cx - W / 2, dy = cy - H / 2, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const a = E.outCubic(clamp((Rw - d) / 260));
    const m = 0.5 + 0.5 * Math.sin(d * 0.021 - ta * 9);
    let size = lerp(4, (6 + 22 * m) * pulse, a);
    let rot = (1 - a) * (Math.PI / 2);
    let c = 0;
    const arm = Math.sin(3 * th + d * 0.011 - ta * 3.2);
    if (a > 0.5) c = arm > 0.55 ? 1 : arm < -0.88 ? 2 : 0;
    const b = E.inOutCubic(clamp((Rb - d) / 320));
    if (b > 0) { size = lerp(size, 31.5, b); rot += b * (Math.PI / 2); if (b > 0.45) c = 0; }
    const h = size / 2, co = Math.cos(rot) * h, si = Math.sin(rot) * h, pth = paths[c];
    pth.moveTo(cx + co - si, cy + si + co); pth.lineTo(cx - co - si, cy - si + co);
    pth.lineTo(cx - co + si, cy - si - co); pth.lineTo(cx + co + si, cy + si - co); pth.closePath();
  }
  ctx.fillStyle = rgba(P.cream); ctx.fill(paths[0]);
  ctx.fillStyle = rgba(P.orange); ctx.fill(paths[1]);
  ctx.fillStyle = rgba(P.lemon); ctx.fill(paths[2]);
  if (t > 12.96) { ctx.fillStyle = rgba(P.cream); ctx.fillRect(-100, -100, W + 200, H + 200); }
}

// ───────────────────────────────────────────────────────────── 07 FIN (13 – 15)
const TITLE = 'Made in code', TFS = 184, TBASE = 600;
function sceneTitle(ctx, t) {
  if (t < 12.99) return;
  setFont(ctx, 700, TFS, 'Inter Display', -7.5);
  const { xs, w } = charXs(ctx, TITLE);
  const DR = 21, gap = 12, total = w + gap + DR * 2, x0 = (W - total) / 2;
  ctx.fillStyle = rgba(P.ink);
  drawSlotLine(ctx, TITLE, x0, TBASE, TFS, 13.05, 14.24, t, { stagger: 0.024, dur: 0.65, oStagger: 0.012, oDur: 0.3, top: 0.95, bottom: 0.3, exitDown: true });

  const outP = prog(t, 14.2, 14.42);
  setFont(ctx, 700, 17, 'Inter', 5);
  ctx.fillStyle = rgba(P.orange);
  drawScramble(ctx, 'A MOTION STUDY BY CLAUDE', x0 + 6, TBASE - TFS * 0.73 - 50, prog(t, 13.15, 13.5) - outP, t, 'left', 4);
  setFont(ctx, 500, 19, 'Inter', 4.5);
  ctx.fillStyle = rgba(P.ink, 0.7);
  drawScramble(ctx, '15 SECONDS  ·  900 FRAMES  ·  100% CODE', x0 + 6, TBASE + 92, prog(t, 13.3, 13.72) - outP, t, 'left', 8);
  const ln = E.outExpo(prog(t, 13.3, 13.9)) * (1 - E.inExpo(prog(t, 14.18, 14.45)));
  if (ln > 0) {
    ctx.fillStyle = rgba(P.ink, 0.22);
    const lx = lerp(x0 + 6, x0 + 6 + w, E.inExpo(prog(t, 14.18, 14.45)));
    ctx.fillRect(lx, TBASE + 44, (x0 + 6 + w - lx) * ln, 2);
  }
  // the dot — the same dot that opened the piece
  const dx0 = x0 + w + gap + DR, dy0 = TBASE - DR;
  const mv = E.inOutCubic(prog(t, 14.38, 14.68));
  const X = lerp(dx0, W / 2, mv), Y = lerp(dy0, H / 2, mv);
  let r = DR * E.outElastic(prog(t, 13.6, 14.25));
  r = lerp(r, 26, mv);
  if (t >= 14.68) r *= 1 + 0.3 * Math.exp(-(t - 14.68) * 12);
  r *= 1 - E.inBack(prog(t, 14.72, 14.94));
  const pr = prog(t, 14.68, 15.0);
  if (pr > 0 && pr < 1) {
    ctx.strokeStyle = rgba(P.orange, Math.pow(1 - pr, 2)); ctx.lineWidth = 0.6 + 3 * (1 - pr);
    ctx.beginPath(); ctx.arc(X, Y, 26 + 300 * E.outCubic(pr), 0, TAU); ctx.stroke();
  }
  if (r > 0.05) {
    ctx.fillStyle = rgba(P.orange);
    ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill();
  }
}

// ───────────────────────────────────────────────────────────── HUD
const SCENES = [[0, '01', 'SPARK'], [2, '02', 'PHYSICS'], [4, '03', 'TYPE'], [6, '04', 'EASING'],
  [8, '05', 'PARTICLES'], [11.35, '06', 'SYSTEMS'], [13, '07', 'FIN']];
function hudColor(t) {
  if (t < 4.0) return [P.cream, 0.6];
  if (t < 5.66) return [P.ink, 0.78];
  if (t < 12.9) return [P.cream, 0.6];
  return [P.ink, 0.62];
}
function drawHUD(ctx, t) {
  const vis = E.outCubic(prog(t, 0.35, 0.9)) * (1 - E.inCubic(prog(t, 14.35, 14.65)));
  if (vis <= 0) return;
  const [c, a] = hudColor(t), M = 64;
  ctx.save();
  ctx.globalAlpha = vis;
  ctx.fillStyle = rgba(c, a); ctx.strokeStyle = rgba(c, a * 0.8); ctx.lineWidth = 1.5;
  // crop marks
  const I = 32, L = 18 * E.outExpo(prog(t, 0.3, 1.0));
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[I, I, 1, 1], [W - I, I, -1, 1], [I, H - I, 1, -1], [W - I, H - I, -1, -1]]) {
    ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L);
  }
  ctx.stroke();
  // top-left
  setFont(ctx, 800, 14, 'Inter', 4);
  ctx.textAlign = 'left';
  drawScramble(ctx, 'CLAUDE', M, M + 8, prog(t, 0.35, 0.9), t);
  const cw = charXs(ctx, 'CLAUDE').w;
  setFont(ctx, 500, 14, 'Inter', 4);
  drawScramble(ctx, '/  MOTION STUDY Nº 01', M + cw + 14, M + 8, prog(t, 0.45, 1.05), t, 'left', 2);
  // top-right scene label with slot roll
  setFont(ctx, 600, 14, 'Inter', 4);
  let k = 0; for (let i = 0; i < SCENES.length; i++) if (t >= SCENES[i][0]) k = i;
  const roll = k > 0 ? E.inOutCubic(prog(t, SCENES[k][0], SCENES[k][0] + 0.4)) : 1;
  ctx.save();
  ctx.beginPath(); ctx.rect(W - 600, M - 14, 600 - M + 10, 30); ctx.clip();
  const lab = i => `${SCENES[i][1]}  —  ${SCENES[i][2]}`;
  if (roll < 1 && k > 0) drawScramble(ctx, lab(k - 1), W - M, M + 8 - roll * 26, 1, t, 'right');
  drawScramble(ctx, lab(k), W - M, M + 8 + (1 - roll) * 26, k === 0 ? prog(t, 0.4, 1.0) : 1, t, 'right');
  ctx.restore();
  // bottom: timecode, progress, specs
  const f = Math.floor(t * FPS + 1e-6), ss = Math.floor(f / FPS), ff = f % FPS;
  const tc = `00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  setFont(ctx, 600, 14, 'Inter', 0);
  drawTabular(ctx, tc, M, H - M + 4, 10.5);
  setFont(ctx, 500, 14, 'Inter', 4);
  const spec = '1920 × 1080  ·  60 FPS  ·  120 BPM';
  drawScramble(ctx, spec, W - M, H - M + 4, prog(t, 0.5, 1.1), t, 'right', 5);
  const sw = charXs(ctx, spec).w;
  const lx0 = M + 100, lx1 = W - M - sw - 36, ly = H - M - 1;
  const lg = E.outExpo(prog(t, 0.4, 1.2));
  ctx.fillStyle = rgba(c, a * 0.3);
  ctx.fillRect(lx0, ly, (lx1 - lx0) * lg, 1.5);
  ctx.fillStyle = rgba(c, a);
  ctx.fillRect(lx0, ly - 0.5, (lx1 - lx0) * lg * clamp(t / DUR), 2.5);
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── compositor
const canvas = document.getElementById('c');
const main = canvas.getContext('2d');
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const [work, wctx] = mk(W, H);
const [acc, actx] = mk(W, H);
const [tmp, tctx] = mk(W, H);
const [blur, bctx] = mk(480, 270);

function drawWorld(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rgba(baseBg(t)); ctx.fillRect(0, 0, W, H);
  const s = shake(t);
  ctx.translate(W / 2 + s.x, H / 2 + s.y); ctx.rotate(s.r); ctx.translate(-W / 2, -H / 2);
  sceneSpark(ctx, t);
  sceneBounce(ctx, t);
  sceneType(ctx, t);
  sceneEasing(ctx, t);
  sceneParticles(ctx, t);
  sceneGrid(ctx, t);
  sceneTitle(ctx, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function bloomAmt(t) {
  if (t < 3.9) return 0.45;
  if (t < 5.9) return 0;
  if (t < 8.0) return lerp(0, 0.45, prog(t, 6.25, 6.6));
  if (t < 11.3) return 0.85;
  if (t < 13.0) return lerp(0.85, 0.3, prog(t, 11.3, 11.8)) * (1 - prog(t, 12.4, 12.9));
  return 0;
}
const CA_HITS = [[4.0, 14], [5.5, 9], [8.0, 26], [13.0, 10], [2.5, 4], [3.0, 3]];
function caAmt(t) { let a = 0; for (const [ti, A] of CA_HITS) if (t >= ti) a += A * Math.exp(-(t - ti) * 10); return a; }

function post(t) {
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalAlpha = 1; main.globalCompositeOperation = 'source-over';
  const ca = caAmt(t);
  if (ca > 0.6) {
    main.fillStyle = '#000'; main.fillRect(0, 0, W, H);
    const chans = [['#ff0000', ca * 2], ['#00ff00', ca], ['#0000ff', 0]];
    for (const [col, px] of chans) {
      tctx.globalCompositeOperation = 'copy'; tctx.drawImage(acc, 0, 0);
      tctx.globalCompositeOperation = 'multiply'; tctx.fillStyle = col; tctx.fillRect(0, 0, W, H);
      main.globalCompositeOperation = 'lighter';
      const k = px / W;
      main.drawImage(tmp, -W * k, -H * k, W * (1 + 2 * k), H * (1 + 2 * k));
    }
    main.globalCompositeOperation = 'source-over';
  } else {
    main.drawImage(acc, 0, 0);
  }
  const bl = bloomAmt(t);
  if (bl > 0.01) {
    bctx.filter = 'blur(9px)';
    bctx.clearRect(0, 0, 480, 270);
    bctx.drawImage(acc, 0, 0, 480, 270);
    main.globalCompositeOperation = 'screen'; main.globalAlpha = bl;
    main.drawImage(blur, 0, 0, W, H);
    main.globalCompositeOperation = 'source-over'; main.globalAlpha = 1;
  }
  // vignette
  const va = t >= 13.0 ? 0.12 : 0.38;
  const g = main.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${va})`);
  main.fillStyle = g; main.fillRect(0, 0, W, H);
  drawHUD(main, t);
}

// fast moments get extra temporal samples so the motion blur stays smooth
const FAST = [[3.8, 4.05], [5.4, 5.9], [7.97, 8.25], [10.6, 11.3]];
function renderFrame(frame, sub = 6) {
  const t0 = frame / FPS;
  if (sub > 1 && FAST.some(([a, b]) => t0 >= a && t0 <= b)) sub = Math.max(sub, 16);
  actx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < sub; k++) {
    const t = sub === 1 ? t0 : t0 + ((k + 0.5) / sub - 0.5) * (SHUTTER / FPS);
    drawWorld(wctx, Math.max(0, t));
    actx.globalAlpha = 1 / (k + 1);
    actx.drawImage(work, 0, 0);
  }
  actx.globalAlpha = 1;
  post(t0);
}

// ───────────────────────────────────────────────────────────── modes
const params = new URLSearchParams(location.search);
window.__render = renderFrame;
window.__ready = (async () => {
  await Promise.all([
    document.fonts.load('900 250px "Inter Display"'), document.fonts.load('700 184px "Inter Display"'),
    document.fonts.load('500 16px "Inter"'), document.fonts.load('600 16px "Inter"'),
    document.fonts.load('700 16px "Inter"'), document.fonts.load('800 16px "Inter"'),
  ]);
  return true;
})();

if (!params.has('render')) {
  // live preview: space = play/pause, ←/→ = step a frame, drag the bar to scrub
  const audio = new Audio('out/soundtrack.wav');
  const bar = document.getElementById('scrub');
  let playing = true, frame = 0, last = performance.now(), acc0 = 0;
  const sub = Number(params.get('sub') || 1);
  bar.max = DUR * FPS - 1;
  bar.oninput = () => { frame = Number(bar.value); audio.currentTime = frame / FPS; };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { playing = !playing; playing ? audio.play().catch(() => {}) : audio.pause(); audio.currentTime = frame / FPS; }
    if (e.code === 'ArrowRight') frame = Math.min(frame + 1, DUR * FPS - 1);
    if (e.code === 'ArrowLeft') frame = Math.max(frame - 1, 0);
  });
  addEventListener('click', () => { if (audio.paused && playing) { audio.currentTime = frame / FPS; audio.play().catch(() => {}); } }, { once: true });
  window.__ready.then(() => {
    const loop = now => {
      if (playing) {
        if (!audio.paused && audio.readyState > 2) frame = Math.floor(audio.currentTime * FPS);
        else { acc0 += now - last; frame = Math.floor(frame + acc0 / (1000 / FPS)); acc0 %= 1000 / FPS; }
        if (frame >= DUR * FPS) { frame = 0; audio.currentTime = 0; }
      }
      last = now;
      renderFrame(frame, sub);
      bar.value = frame;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
