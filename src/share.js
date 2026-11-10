// Share as image and video. Built from a copy of the tree that carries no key, entity, tag or extra.
import { esc, trunc } from "./util.js";
import { drawMap } from "./draw.js";
import { defaultTheme, parseBackground, statusCss, mapCss, DISC_FILL, LABEL_OUTLINE } from "./theme.js";
import { iconPath } from "./icons.js";
import { REVEAL, beamAngle, beamDeg, revealNode, revealGlobal, partialPath } from "./reveal.js";

// Size of the share image and video frame in map units: a header band and the map (1140 x 1090).
export const SHARE = { w: 1140, h: 1220, mapY: 80 };
// The share video: frames per second, seconds the opening frame is held, seconds the finished map is held.
export const REC = { fps: 30, lead: 0.25, tail: 0.8 };

// Generic names for shared maps, from the node's icon. First match wins. Each entry lists whole icon words: the
// icon name loses its "mdi:" prefix and is split on "-" and digits, so "cellphone-android" is "cellphone android"
// and "esp32" is "esp". A two-word entry such as "television play" matches those words side by side. Whole words
// keep "headphones" from reading as a phone. A word list starting with "^" only matches the icon's first word.
const SHARE_TYPES = [
  ["television play|cast|chromecast", "Streamer"], ["cctv|doorbell|camera|webcam", "Camera"], ["television|tv", "TV"],
  ["soundbar", "Soundbar"], ["speaker", "Speaker"], ["gamepad|playstation|xbox|nintendo|controller", "Console"],
  ["virtual reality", "VR headset"], ["thermostat", "Thermostat"], ["laptop", "Laptop"], ["monitor|desktop", "Computer"],
  ["tablet|book open", "Tablet"], ["cellphone|phone|deskphone|iphone", "Phone"], ["watch", "Watch"], ["printer", "Printer"],
  ["server|nas", "Storage"], ["home assistant", "Home Assistant"], ["power socket|plug", "Plug"],
  ["lightbulb|lamp|lamps|light|lights|spotlight", "Light"], ["air purifier|fan", "Air purifier"], ["garage", "Door opener"],
  ["fridge", "Sensor"], ["sprinkler", "Sprinkler"], ["robot", "Vacuum"], ["^home", "Smart home hub"],
  ["weather", "Weather station"], ["smoke|alarm|bell ring", "Alarm"], ["chip|microchip|esp", "Smart device"],
  ["access point|router|switch", "Network device"],
].map(([words, type]) => {
  const start = words[0] === "^";
  return [new RegExp((start ? "^" : "(?:^| )") + "(?:" + words.replace(/^\^/, "") + ")(?= |$)"), type];
});

function iconWords(icon) {
  return String(icon || "").toLowerCase().replace(/^mdi:/, "").split(/[^a-z]+/).filter(Boolean).join(" ");
}

export function shareType(icon) {
  const s = iconWords(icon);
  for (let i = 0; i < SHARE_TYPES.length; i++) if (SHARE_TYPES[i][0].test(s)) return SHARE_TYPES[i][1];
  return "Device";
}

// Anything that looks like an IPv4 or IPv6 address or a MAC address, whole or in part. A match must sit between
// characters that are not letters or digits ("_" counts as a letter here). Forms: IPv4, MAC with separators,
// MAC with none, the dotted Cisco form, six hex characters after a separator with at least one digit, IPv6.
// An IPv4 may also use "-" or "_" between its parts and sit right after letters (cam-192-0-2-45, Cam192.0.2.5);
// there only digits must not touch it. A full six-part MAC is caught wherever it sits, even glued to letters.
// A false hit only costs a generic label.
const ADDRESS_RE = new RegExp(
  "(?:^|\\D)\\d{1,3}(?:[._-]\\d{1,3}){3}(?!\\d)" +
  "|[0-9a-f]{2}(?:[:_-][0-9a-f]{2}){5}" +
  "|(?:^|[^0-9a-z])(?:" +
  "\\d{1,3}(?:\\.\\d{1,3}){3}" +
  "|[0-9a-f]{2}(?:[:-][0-9a-f]{2})+" +
  "|[0-9a-f]{12}" +
  "|[0-9a-f]{4}(?:\\.[0-9a-f]{4}){2}" +
  "|[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?" +
  "|::[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*" +
  "|(?:[0-9a-f]{1,4}:){3,}[0-9a-f]{1,4}" +
  ")(?:[^0-9a-z]|$)" +
  "|[ _:.-](?=[0-9a-f]{0,5}\\d)[0-9a-f]{6}(?:[^0-9a-z]|$)",
  "i"
);

function safeLabel(s, fallback) {
  const v = String(s == null ? "" : s);
  return ADDRESS_RE.test(v) || !v.trim() ? fallback : v;
}

function emptyTree() {
  return { root: null, nodes: Object.create(null), order: [] };
}

/** A copy of a tree that is safe to share: new keys (n0, n1, ...), no entity, tags or source, generic names
 * unless hideNames is false, and `sort` ranks that keep the arrangement of the original. */
export function shareTree(tree, opts) {
  const hide = !opts || opts.hideNames !== false;
  if (!tree || tree.root == null || !tree.nodes[tree.root]) return emptyTree();
  const src = tree.nodes;
  // A parent missing from the tree sorts first rather than throwing.
  const sk = (k) => (src[k] ? String(src[k].sort != null ? src[k].sort : src[k].label) : "");
  const cmp = (a, b) => {
    const x = sk(a), y = sk(b);
    if (x !== y) return x < y ? -1 : 1;
    return a === b ? 0 : a < b ? -1 : 1;
  };
  const keys = tree.order.filter((k) => src[k]);
  const others = keys.filter((k) => k !== tree.root).sort(cmp);
  const ranked = [tree.root].concat(others);
  const keyOf = Object.create(null);
  ranked.forEach((k, i) => { keyOf[k] = "n" + i; });
  const rank = Object.create(null);
  others.forEach((k, i) => { rank[k] = String(i).padStart(5, "0"); });
  rank[tree.root] = "-----";

  // Generic names: devices and hubs numbered by type, ordered by parent, then own position. Devices are numbered
  // first, as before; hubs carry on from the device count of their type (three Speakers, then a hub "Speaker 4"),
  // so device numbers stay as they were and no hub shares a label with a device. The root counts as a hub.
  const generic = Object.create(null);
  const byParent = (a, b) => {
    const pa = src[a].parent, pb = src[b].parent;
    if (pa !== pb) return cmp(pa, pb);
    return cmp(a, b);
  };
  const seen = Object.create(null);
  const number = (list, typeOf) => {
    list.forEach((k) => {
      const type = typeOf(k);
      seen[type] = (seen[type] || 0) + 1;
      generic[k] = type + " " + seen[type];
    });
  };
  const isHubKey = (k) => k === tree.root || src[k].kind === "hub";
  number(others.filter((k) => !isHubKey(k)).sort(byParent), (k) => shareType(src[k].icon));
  number([tree.root].concat(others.filter(isHubKey).sort(byParent)), (k) => {
    const t = shareType(src[k].icon);
    return t === "Device" ? "Hub" : t;
  });

  const out = emptyTree();
  ranked.forEach((k) => {
    const n = src[k];
    const isRoot = k === tree.root;
    const fallback = generic[k];
    const label = hide ? fallback : safeLabel(n.label, fallback);
    const parent = isRoot ? null : (keyOf[n.parent] || "n0");
    out.nodes[keyOf[k]] = {
      key: keyOf[k], parent, status: n.status, icon: n.icon, label, entity: null, tags: [],
      kind: n.kind, children: [], source: {}, sort: rank[k],
    };
    if (n.emptiedByFilter === true) out.nodes[keyOf[k]].emptiedByFilter = true;
  });
  ranked.forEach((k) => {
    if (k === tree.root) return;
    const node = out.nodes[keyOf[k]];
    out.nodes[node.parent].children.push(node.key);
  });
  out.root = "n0";
  out.order = ranked.map((k) => keyOf[k]);
  return out;
}

// Theme values land in CSS and in SVG text. Drop the characters that could end a rule or a tag.
function cleanValue(v) {
  return String(v == null ? "" : v).replace(/[<>{};\\\u0000-\u001f]/g, "");
}

function cleanTheme(theme) {
  const base = defaultTheme();
  const t = theme || base;
  const out = {};
  Object.keys(base).forEach((k) => {
    const v = k === "link" ? (t.link == null ? "" : cleanValue(t.link)) : cleanValue(t[k] == null ? base[k] : t[k]);
    out[k] = k === "link" ? (v || null) : v || base[k];
  });
  return out;
}

function shareCss(theme) {
  const shared = mapCss(theme.text, theme.ring);
  return statusCss(theme) + shared[0] + ".lk.live{opacity:.8}" + shared[1];
}

function bgDefs(bg) {
  if (bg.kind === "solid") return { defs: "", fill: esc(bg.color) };
  const stops = bg.stops.map((s) => `<stop offset="${+s.offset.toFixed(3)}" stop-color="${esc(s.color)}"/>`).join("");
  return { defs: `<radialGradient id="kbg" cx="50%" cy="48%" r="70%">${stops}</radialGradient>`, fill: "url(#kbg)" };
}

/** The share image as a standalone SVG document, or "" when the tree has no root. */
export function shareSvg(tree, opts) {
  opts = opts || {};
  const st = shareTree(tree, opts);
  if (st.root == null) return "";
  const theme = cleanTheme(opts.theme);
  const D = drawMap(st, { theme });
  const W = SHARE.w, H = SHARE.h;
  const bg = bgDefs(parseBackground(theme.background));
  const title = esc(trunc(opts.title == null ? "" : opts.title, 40));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(theme.font)}">` +
    `<defs>${bg.defs}<filter id="kblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><style>${esc(shareCss(theme))}</style></defs>` +
    `<rect width="${W}" height="${H}" fill="${bg.fill}"/>` +
    `<circle cx="42" cy="39" r="7" fill="${esc(theme.highlight)}"/>` +
    `<text x="62" y="49" font-size="26" font-weight="600" fill="${esc(theme.text)}">${title}</text>` +
    `<svg x="0" y="${SHARE.mapY}" width="1140" height="1090" viewBox="-70 -40 1140 1090">` +
    `<circle class="ring" cx="${D.C.x}" cy="${D.C.y}" r="370"/>${D.links}${D.gfx}${D.labels}</svg></svg>`;
}

const PREPARED = new WeakMap();

/** What paintFrame reuses between frames: gradients (per ctx), Path2D objects and the root lookup. Built lazily,
 * once per scene + theme + ctx; a different theme or canvas gets a fresh one, so nothing leaks between recordings. */
function prepare(ctx, scene, theme) {
  const tk = JSON.stringify(theme), c = PREPARED.get(scene);
  if (c && c.tk === tk && c.ctx === ctx) return c;
  const roots = new Set();
  scene.nodes.forEach((n) => { if (n.root) roots.add(n.k); });
  const p = { tk, ctx, roots, bg: null, beam: null, halos: new Map(), links: new Map(), icons: new Map() };
  PREPARED.set(scene, p);
  return p;
}

function radial(ctx, x0, y0, r0, x1, y1, r1, stops) {
  const gr = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  stops.forEach((s) => { try { gr.addColorStop(s[0], s[1]); } catch (e) { /* bad colour */ } });
  return gr;
}

/** Paints one frame of the reveal on a 2D canvas context, scaled to the canvas width. Everything is computed
 * here, with no CSS animation, so recording doesn't depend on the page. */
export function paintFrame(ctx, scene, t, o) {
  o = o || {};
  const theme = cleanTheme(o.theme);
  const W = SHARE.w, H = SHARE.h;
  const k = ctx.canvas.width / W;
  const C = scene.C;
  const g = revealGlobal(t);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = 1;
  const P = prepare(ctx, scene, theme);
  const bg = parseBackground(theme.background);
  if (bg.kind === "radial") {
    if (!P.bg) P.bg = radial(ctx, W / 2, H * 0.48, 0, W / 2, H * 0.48, W * 0.8, bg.stops.map((s) => [s.offset, s.color]));
    ctx.fillStyle = P.bg;
  } else {
    ctx.fillStyle = bg.color;
  }
  ctx.fillRect(0, 0, W, H);
  const font = (size, weight) => `${weight || 400} ${size}px ${theme.font}`;
  const icon = (d, x, y, size, color) => {
    if (!d) return;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    let p2 = P.icons.get(d);
    if (!p2) P.icons.set(d, (p2 = new Path2D(d)));
    ctx.fill(p2);
    ctx.restore();
  };

  // Header.
  ctx.fillStyle = theme.highlight;
  ctx.beginPath(); ctx.arc(42, 39, 7, 0, Math.PI * 2); ctx.fill();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = font(26, 600);
  ctx.fillStyle = theme.text;
  ctx.fillText(trunc(o.title == null ? "" : o.title, 40), 62, 49);

  // Map, in its own coordinates.
  ctx.save();
  ctx.translate(70, SHARE.mapY + 40);
  if (g.radar > 0) {
    ctx.strokeStyle = theme.highlight;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    [130, 250, 370].forEach((r) => { ctx.globalAlpha = g.radar * 0.16; ctx.beginPath(); ctx.arc(C.x, C.y, r, 0, Math.PI * 2); ctx.stroke(); });
    ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const ph = ((t + 10) / 3 + i / 3) % 1;
      ctx.globalAlpha = g.radar * 0.45 * (1 - ph);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(C.x, C.y, 38 + ph * 342, 0, Math.PI * 2); ctx.stroke();
    }
    const deg = beamDeg(t);
    const R = 420;
    for (let i = 0; i < 18; i++) {
      const a1 = ((deg - (i * 70) / 18 - 90) * Math.PI) / 180, a0 = a1 - ((70 / 18) * Math.PI) / 180;
      if (!P.beam) P.beam = radial(ctx, C.x, C.y, 0, C.x, C.y, R, [[0, theme.highlight], [1, "rgba(0,0,0,0)"]]);
      ctx.globalAlpha = g.radar * 0.3 * (1 - i / 18);
      ctx.fillStyle = P.beam;
      ctx.beginPath(); ctx.moveTo(C.x, C.y); ctx.arc(C.x, C.y, R, a0, a1); ctx.closePath(); ctx.fill();
    }
    const ab = ((deg - 90) * Math.PI) / 180;
    ctx.globalAlpha = g.radar * 0.7;
    ctx.strokeStyle = theme.highlight; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(C.x, C.y); ctx.lineTo(C.x + R * Math.cos(ab), C.y + R * Math.sin(ab)); ctx.stroke();
    ctx.lineCap = "butt";
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = theme.ring; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(C.x, C.y, 370, 0, Math.PI * 2); ctx.stroke();

  const state = {};
  scene.nodes.forEach((n) => {
    state[n.k] = n.root ? { s: 1, o: 1, draw: 1 } : revealNode(t, beamAngle(C, n), false);
  });
  scene.links.forEach((l) => {
    const s = state[l.k];
    if (!s || s.draw <= 0) return;
    const strong = / strong/.test(" " + l.cls);
    ctx.globalAlpha = strong ? 0.75 : / live/.test(" " + l.cls) ? 0.8 : 0.45;
    ctx.strokeStyle = l.color;
    ctx.lineWidth = strong ? 2.6 : 1.4;
    ctx.setLineDash([]);
    if (s.draw >= 1) {
      let lp = P.links.get(l);
      if (!lp) P.links.set(l, (lp = new Path2D(partialPath(l.d, 1))));
      ctx.stroke(lp);
    } else ctx.stroke(new Path2D(partialPath(l.d, s.draw)));
  });
  scene.nodes.forEach((n) => {
    const s = state[n.k];
    if (!s || s.o <= 0) return;
    ctx.save();
    ctx.globalAlpha = s.o;
    ctx.translate(n.x, n.y); ctx.scale(s.s, s.s); ctx.translate(-n.x, -n.y);
    if (n.halo) {
      const hr = n.r + (n.hub ? 16 : 12);
      let gr = P.halos.get(n);
      if (!gr) P.halos.set(n, (gr = radial(ctx, n.x, n.y, n.r * 0.6, n.x, n.y, hr, [[0, n.color], [1, "rgba(0,0,0,0)"]])));
      ctx.globalAlpha = s.o * 0.22;
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(n.x, n.y, hr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = s.o;
    }
    ctx.fillStyle = DISC_FILL; ctx.strokeStyle = n.color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    icon(iconPath(n.icon), n.x, n.y, n.r * 1.05, n.color);
    ctx.restore();
  });
  // Labels: the root's from the start, the rest once the beam has passed.
  ctx.textBaseline = "middle";
  scene.devLabels.forEach((l) => {
    if (g.labels <= 0) return;
    ctx.save();
    ctx.globalAlpha = g.labels;
    ctx.translate(l.x, l.y); ctx.rotate((l.rot * Math.PI) / 180);
    ctx.textAlign = l.anchor === "end" ? "right" : "left";
    ctx.font = font(l.size);
    ctx.fillStyle = l.color || theme.text;
    ctx.fillText(l.text, 0, 0);
    ctx.restore();
  });
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  scene.hubLabels.forEach((l) => {
    const isRoot = P.roots.has(l.k);
    const a = isRoot ? 1 : g.labels;
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.textAlign = l.anchor === "middle" ? "center" : l.anchor === "end" ? "right" : "left";
    ctx.strokeStyle = LABEL_OUTLINE; ctx.lineWidth = 4;
    ctx.font = font(15, 600);
    ctx.fillStyle = theme.text;
    ctx.strokeText(l.text, l.x, l.y); ctx.fillText(l.text, l.x, l.y);
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Steps a recording one frame at a time. Animation time comes from the frame number only (t = frame / fps), never
 *  from the clock. The first `lead` frames repeat t = 0. o: { fps, frames, lead, frame(t, i), done(), now(),
 *  later(fn, ms), clear(id) }. Returns { stop() }. */
export function framePump(o) {
  const last = o.frames - 1;
  let i = 0, timer = null, stopped = false, t0 = 0;
  const next = () => {
    timer = null;
    if (stopped) return;
    if (i === 0) t0 = o.now();
    o.frame(Math.max(0, i - o.lead) / o.fps, i);
    if (stopped) return;
    if (i >= last) { stopped = true; o.done(); return; }
    i++;
    timer = o.later(next, Math.max(0, t0 + (i * 1000) / o.fps - o.now()));
  };
  timer = o.later(next, 0);
  return { stop() { stopped = true; if (timer !== null) o.clear(timer); timer = null; } };
}

/** The best video type this browser can record a canvas to, or null. */
export function videoType() {
  try {
    if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) return null;
    const want = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (let i = 0; i < want.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(want[i])) return want[i];
  } catch (e) { /* not supported */ }
  return null;
}

/** The share image as a PNG blob, drawn from the SVG on an offscreen canvas. */
export function sharePng(tree, opts) {
  const svg = shareSvg(tree, opts);
  return new Promise((resolve, reject) => {
    if (!svg) { reject(new Error("Nothing to share")); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = 1.5;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(SHARE.w * scale);
        canvas.height = Math.round(SHARE.h * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the image"))), "image/png");
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("Could not draw the map"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}

/** Records the reveal of the share map to a video blob. `alive` says whether the share panel is still open: once
 * it is not, the recording stops and the promise rejects with an error marked `cancelled`. Every failure rejects. */
export function shareVideo(tree, opts, onTick, alive) {
  opts = opts || {};
  const type = videoType();
  if (!type) return Promise.reject(new Error("This browser can't record video"));
  const st = shareTree(tree, opts);
  if (st.root == null) return Promise.reject(new Error("Nothing to share"));
  const theme = cleanTheme(opts.theme);
  const scene = drawMap(st, { theme }).scene;
  const paint = { theme, title: opts.title };
  return new Promise((resolve, reject) => {
    let stream = null, rec = null, done = false, pump = null, canvas = null;
    const stopTracks = () => { try { if (stream) stream.getTracks().forEach((tr) => tr.stop()); } catch (e) { /* already stopped */ } };
    const stopRec = () => { try { if (rec && rec.state !== "inactive") rec.stop(); } catch (e) { /* already stopped */ } };
    const cleanup = () => {
      if (pump) pump.stop();
      stopTracks();
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
    const fail = (e) => {
      if (done) return;
      done = true;
      cleanup();
      reject(e || new Error("Recording failed"));
    };
    try {
      canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = Math.round((960 * SHARE.h) / SHARE.w / 2) * 2; // even, for H.264
      // Attached but invisible: a canvas that is not in the page can be throttled and stop feeding the stream.
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      paintFrame(ctx, scene, 0, paint);
      let track = null;
      stream = canvas.captureStream(0);
      track = stream.getVideoTracks && stream.getVideoTracks()[0];
      if (!track || typeof track.requestFrame !== "function") {
        stopTracks();
        track = null;
        stream = canvas.captureStream(REC.fps);
      }
      rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5000000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve(new Blob(chunks, { type: type.split(";")[0] }));
      };
      rec.onerror = (e) => { fail(e && e.error); stopRec(); };
      const lead = Math.round(REC.lead * REC.fps);
      const frames = lead + Math.ceil((REVEAL.end + REC.tail) * REC.fps) + 1;
      let lastTick = 0;
      const frame = (t, i) => {
        try {
          if (alive && !alive()) {
            const c = new Error("Cancelled");
            c.cancelled = true;
            fail(c);
            stopRec();
            return;
          }
          paintFrame(ctx, scene, t, paint);
          if (track) track.requestFrame();
          const now = Date.now();
          if (onTick && (now - lastTick >= 250 || i === frames - 1)) { lastTick = now; onTick(i / (frames - 1)); }
        } catch (e) { fail(e); stopRec(); }
      };
      rec.start(250);
      if (track) track.requestFrame();
      pump = framePump({
        fps: REC.fps, frames, lead, frame,
        done: () => { pump = null; setTimeout(() => { try { rec.stop(); } catch (e) { fail(e); } }, 120); },
        now: () => Date.now(), later: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id),
      });
    } catch (e) { fail(e); stopRec(); }
  });
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Hands a finished image or video to the system share sheet when the browser has one for files, and downloads
 * it otherwise. Resolves "shared", "cancelled" (the sheet was closed) or "saved". */
export function deliver(blob, name) {
  const save = () => { download(blob, name); return "saved"; };
  let file = null;
  try {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [f] })) file = f;
  } catch (e) { file = null; }
  if (!file) return Promise.resolve(save());
  return new Promise((res) => res(navigator.share({ files: [file] }))).then(
    () => "shared",
    (e) => (e && e.name === "AbortError" ? "cancelled" : save())
  );
}
