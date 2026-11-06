import { clamp01, easeOut } from "./util.js";

// The reveal, in seconds: the beam turns once and each node pops in as it passes, links draw in,
// then labels fade in.
export const REVEAL = { start: 0.12, turn: 2.05, labels: 2.6, end: 4 };

// Angle of a point around the centre, 0 at 12 o'clock, growing clockwise, in [0, 2pi).
export function beamAngle(C, p) {
  const a = Math.atan2(p.y - C.y, p.x - C.x) + Math.PI / 2;
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

// Where the beam points at time t, in degrees.
export function beamDeg(t) {
  return ((((t - REVEAL.start) / REVEAL.turn) * 360) % 360 + 360) % 360;
}

// State at time t of a node at beam angle a: scale s, opacity o, link fraction drawn.
export function revealNode(t, a, reduced) {
  const at = REVEAL.start + (a / (2 * Math.PI)) * REVEAL.turn;
  const since = (t - at) / 0.35;
  if (since <= 0) return { s: reduced ? 1 : 0, o: 0, draw: 0, at };
  if (reduced) return { s: 1, o: clamp01(since / 1.5), draw: 1, at };
  const k = easeOut(since);
  const s = since >= 1 ? 1 : 0.35 + 0.65 * k + 0.18 * Math.sin(Math.PI * clamp01(since));
  return { s, o: clamp01(since * 1.6), draw: easeOut((t - at) / 0.45), at };
}

// Opacity of labels and radar at time t.
export function revealGlobal(t) {
  return {
    labels: clamp01((t - REVEAL.labels) / 0.5),
    radar: 1 - clamp01((t - REVEAL.start - REVEAL.turn) / 0.5),
  };
}

// The first part (fraction f) of a link drawn as "M x,y L x,y" or "M x,y Q cx,cy x,y".
export function partialPath(d, f) {
  if (f >= 1) return d;
  const n = (String(d).match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const lerp = (a, b) => a + (b - a) * f;
  const fx = (v) => v.toFixed(1);
  if (n.length === 6) {
    const ax = lerp(n[0], n[2]), ay = lerp(n[1], n[3]);
    const bx = lerp(n[2], n[4]), by = lerp(n[3], n[5]);
    return `M${fx(n[0])},${fx(n[1])} Q${fx(ax)},${fx(ay)} ${fx(ax + (bx - ax) * f)},${fx(ay + (by - ay) * f)}`;
  }
  if (n.length === 4) return `M${fx(n[0])},${fx(n[1])} L${fx(lerp(n[0], n[2]))},${fx(lerp(n[1], n[3]))}`;
  return d;
}

export function reducedMotion() {
  try {
    return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) { return false; }
}

// Dotted range rings, pulse rings and a sweeping beam. jsBeam: moved by script, not CSS animation.
// color: any CSS colour or var() string, applied through style.
export function radarSvg(C, jsBeam, color) {
  const R = 420;
  const rad = (d) => ((d - 90) * Math.PI) / 180;
  let wedges = "";
  const N = 18, SPAN = 70;
  for (let i = 0; i < N; i++) {
    const a0 = (-i - 1) * (SPAN / N), a1 = -i * (SPAN / N);
    wedges += `<path d="M${C.x},${C.y} L${(C.x + R * Math.cos(rad(a0))).toFixed(1)},${(C.y + R * Math.sin(rad(a0))).toFixed(1)} A${R},${R} 0 0 1 ${(C.x + R * Math.cos(rad(a1))).toFixed(1)},${(C.y + R * Math.sin(rad(a1))).toFixed(1)} Z" fill="url(#kfade)" opacity="${(0.42 * (1 - i / N)).toFixed(3)}"/>`;
  }
  const c = String(color == null ? "" : color).replace(/"/g, "&quot;");
  const st = `style="stop-color:${c}"`;
  return `<g class="radar ${jsBeam ? "js" : ""}" pointer-events="none">` +
    `<defs><radialGradient id="kfade" cx="${C.x}" cy="${C.y}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0" ${st} stop-opacity=".55"/><stop offset="1" ${st} stop-opacity="0"/></radialGradient></defs>` +
    [130, 250, 370].map((r) => `<circle class="st" cx="${C.x}" cy="${C.y}" r="${r}"/>`).join("") +
    [1, 2, 3].map((i) => `<circle class="pr p${i}" cx="${C.x}" cy="${C.y}" r="380"/>`).join("") +
    `<g class="beam"><circle cx="${C.x}" cy="${C.y}" r="${R}" fill="none" stroke="none"/>${wedges}` +
    `<line x1="${C.x}" y1="${C.y}" x2="${C.x}" y2="${C.y - R}" stroke="#bfdbfe" stroke-width="2" opacity=".7" stroke-linecap="round"/></g></g>`;
}
