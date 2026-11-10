import "./helpers/dom.js";
import { readFileSync, writeFileSync } from "node:fs";
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { installShareStubs } from "./helpers/share-stubs.js";
import { buildTree } from "../src/tree.js";
import { layoutTree } from "../src/layout.js";
import { filterTree } from "../src/filters.js";
import { defaultTheme } from "../src/theme.js";
import { drawMap } from "../src/draw.js";
import { REVEAL } from "../src/reveal.js";
import { setIconPath } from "../src/icons.js";
import {
  SHARE, REC, shareType, shareTree, shareSvg, paintFrame, framePump, videoType, sharePng, shareVideo, deliver,
} from "../src/share.js";
import { openSharePanel } from "../src/share-panel.js";
import { KeplerElement } from "../src/kepler-card.js";

const quiet = () => {};
const S = { key: "SENTKEY", entity: "light.SENTENT", tag: "zone:SENTTAG", extra: "SENTEXTRA" };
const sample = () => buildTree([
  { key: "root", label: "Router", status: "online", icon: "mdi:router" },
  { key: S.key + "1", parent: "root", label: "Lamp", status: "online", icon: "mdi:lightbulb", entity: S.entity, tags: [S.tag], extra: { x: S.extra } },
  { key: "hub", parent: "root", label: "Zigbee", status: "recent", kind: "hub", icon: "mdi:zigbee" },
  { key: "door", parent: "hub", label: "Door", status: "stale", icon: "mdi:door", tags: [S.tag] },
  { key: "tv", parent: "hub", label: "Cam_192.0.2.7", status: "new", icon: "mdi:television" },
], quiet);
const theme = (o) => Object.assign(defaultTheme(), o);
const sentinels = (s) => ["SENTKEY", "SENTENT", "SENTTAG", "SENTEXTRA"].forEach((w) => assert.ok(!s.includes(w), w));

test("shareType maps icons", () => {
  assert.equal(shareType("mdi:television"), "TV");
  assert.equal(shareType("mdi:cctv"), "Camera");
  assert.equal(shareType(undefined), "Device");
  // Whole icon words only: no type from a word inside another word.
  assert.equal(shareType("mdi:headphones"), "Device");
  assert.equal(shareType("mdi:microphone"), "Device");
  assert.equal(shareType("mdi:tennis"), "Device");
  assert.equal(shareType("mdi:gymnastics"), "Device");
  assert.equal(shareType("mdi:podcast"), "Device");
  assert.equal(shareType("mdi:lightning-bolt"), "Device");
  // Mappings that were right before stay the same.
  const kept = {
    "mdi:television": "TV", "mdi:television-play": "Streamer", "mdi:cast": "Streamer", "mdi:cast-variant": "Streamer",
    "mdi:cellphone": "Phone", "mdi:cellphone-android": "Phone", "mdi:phone": "Phone", "mdi:deskphone": "Phone",
    "mdi:tablet-cellphone": "Tablet", "mdi:server": "Storage", "mdi:server-network": "Storage", "mdi:nas": "Storage",
    "mdi:fan": "Air purifier", "mdi:ceiling-fan": "Air purifier", "mdi:lightbulb": "Light", "mdi:floor-lamp": "Light",
    "mdi:ceiling-light": "Light", "mdi:light-switch": "Light", "mdi:spotlight-beam": "Light", "mdi:esp32": "Smart device",
    "mdi:chip": "Smart device", "mdi:printer-3d": "Printer", "mdi:power-plug": "Plug", "mdi:power-socket-eu": "Plug",
    "mdi:home": "Smart home hub", "mdi:home-automation": "Smart home hub", "mdi:home-assistant": "Home Assistant",
    "mdi:nintendo-switch": "Console", "mdi:router-wireless": "Network device", "mdi:access-point": "Network device",
    "mdi:doorbell-video": "Camera", "mdi:robot-vacuum": "Vacuum", "mdi:weather-sunny": "Weather station",
    "mdi:smoke-detector": "Alarm", "mdi:bell-ring": "Alarm", "mdi:virtual-reality": "VR headset", "mdi:speaker-wireless": "Speaker",
  };
  Object.keys(kept).forEach((icon) => assert.equal(shareType(icon), kept[icon], icon));
});

test("shareTree strips host data and keeps arrangement", () => {
  const t = shareTree(sample(), {});
  assert.equal(t.root, "n0");
  t.order.forEach((k) => {
    const n = t.nodes[k];
    assert.match(k, /^n\d+$/);
    assert.equal(n.entity, null);
    assert.deepEqual(n.tags, []);
    assert.deepEqual(n.source, {});
  });
  sentinels(JSON.stringify(t));
  const labels = t.order.map((k) => t.nodes[k].label);
  assert.ok(labels.includes("Light 1") && labels.includes("TV 1") && labels.includes("Network device 1") && labels.includes("Hub 1"));
  assert.ok(!labels.includes("Lamp"));
  // Sorted children follow the original label order: Lamp, Zigbee under the root.
  const ch = t.nodes.n0.children.map((k) => t.nodes[k].icon);
  assert.deepEqual(ch, ["mdi:lightbulb", "mdi:zigbee"]);
});

test("shareTree with names shown keeps labels but swaps addresses", () => {
  const t = shareTree(sample(), { hideNames: false });
  const labels = t.order.map((k) => t.nodes[k].label);
  assert.ok(labels.includes("Lamp") && labels.includes("Door"));
  assert.ok(!labels.some((l) => l.includes("192.0.2.7")));
  assert.ok(labels.includes("TV 1"));
});

test("shareTree with names shown swaps addresses written with dashes or glued to letters", () => {
  const t = shareTree(buildTree([
    { key: "root", label: "Router", status: "online", icon: "mdi:router" },
    { key: "a", parent: "root", label: "cam-192-0-2-45", status: "online", icon: "mdi:cctv" },
    { key: "b", parent: "root", label: "Cam192.0.2.5", status: "online", icon: "mdi:cctv" },
    { key: "h", parent: "root", label: "hub198.51.100.2", status: "online", kind: "hub", icon: "mdi:zigbee" },
    { key: "c", parent: "h", label: "Door", status: "online", icon: "mdi:door" },
    { key: "d", parent: "h", label: "Kitchen 2", status: "online", icon: "mdi:lightbulb" },
  ], quiet), { hideNames: false });
  const labels = t.order.map((k) => t.nodes[k].label);
  assert.ok(labels.includes("Router") && labels.includes("Door") && labels.includes("Kitchen 2"), labels.join());
  assert.ok(labels.includes("Camera 1") && labels.includes("Camera 2") && labels.includes("Hub 1"), labels.join());
  assert.ok(!labels.some((l) => /192|198\.51/.test(l)), labels.join());
  const svg = shareSvg(buildTree([
    { key: "root", label: "Router", status: "online", icon: "mdi:router" },
    { key: "a", parent: "root", label: "cam-192-0-2-45", status: "online", icon: "mdi:cctv" },
    { key: "b", parent: "root", label: "Cam192.0.2.5", status: "online", icon: "mdi:cctv" },
  ], quiet), { hideNames: false, theme: defaultTheme(), title: "T" });
  assert.ok(!/192/.test(svg));
});

test("shareTree never gives a hub and a device the same label", () => {
  const t = shareTree(buildTree([
    { key: "root", label: "Router", status: "online", icon: "mdi:router" },
    { key: "s", parent: "root", label: "Living room", status: "online", kind: "hub", icon: "mdi:speaker" },
    { key: "a", parent: "s", label: "Left", status: "online", icon: "mdi:speaker" },
    { key: "b", parent: "s", label: "Right", status: "online", icon: "mdi:speaker" },
  ], quiet), {});
  const labels = t.order.map((k) => t.nodes[k].label);
  assert.equal(new Set(labels).size, labels.length, labels.join());
  ["Speaker 1", "Speaker 2", "Speaker 3"].forEach((l) => assert.ok(labels.includes(l), l));
});

test("shareTree names a node whose parent is missing without throwing", () => {
  const tr = sample();
  tr.nodes.door.parent = "gone";
  const t = shareTree(tr, {});
  assert.ok(t.order.length > 0);
});

test("shareTree with names shown swaps underscore IPv4 and glued MAC addresses", () => {
  const t = shareTree(buildTree([
    { key: "root", label: "Router", status: "online", icon: "mdi:router" },
    { key: "a", parent: "root", label: "cam_192_0_2_9", status: "online", icon: "mdi:cctv" },
    { key: "b", parent: "root", label: "cam" + ["00", "00", "5e", "00", "53", "01"].join(":"), status: "online", icon: "mdi:cctv" },
  ], quiet), { hideNames: false });
  const labels = t.order.map((k) => t.nodes[k].label);
  assert.ok(!labels.some((l) => /192|00:53/.test(l)), labels.join());
});

test("shareTree numbers hubs by type when names are hidden", () => {
  const t = shareTree(buildTree([
    { key: "root", label: "Router", status: "online", icon: "mdi:router" },
    { key: "z1", parent: "root", label: "Zigbee upstairs", status: "online", kind: "hub", icon: "mdi:zigbee" },
    { key: "z2", parent: "root", label: "Zigbee downstairs", status: "online", kind: "hub", icon: "mdi:zigbee" },
    { key: "z3", parent: "z1", label: "Zigbee repeater", status: "online", kind: "hub", icon: "mdi:zigbee" },
    { key: "ap", parent: "root", label: "Spare unit", status: "online", kind: "hub", icon: "mdi:access-point" },
    { key: "d1", parent: "z1", label: "Bulb", status: "online", icon: "mdi:lightbulb" },
    { key: "d2", parent: "z2", label: "Desk lamp", status: "online", icon: "mdi:desk-lamp" },
    { key: "d3", parent: "ap", label: "Speaker", status: "online", icon: "mdi:speaker" },
  ], quiet), {});
  const hubs = t.order.filter((k) => t.nodes[k].kind === "hub").map((k) => t.nodes[k].label);
  assert.equal(new Set(hubs).size, hubs.length, hubs.join());
  ["Hub 1", "Hub 2", "Hub 3", "Network device 1", "Network device 2"].forEach((l) => assert.ok(hubs.includes(l), l + " in " + hubs.join()));
  // Device numbers are counted apart from hubs.
  const all = t.order.map((k) => t.nodes[k].label);
  ["Light 1", "Light 2", "Speaker 1"].forEach((l) => assert.ok(all.includes(l), l));
  ["upstairs", "downstairs", "repeater", "Spare", "Bulb", "Desk"].forEach((w) => assert.ok(!all.some((l) => l.includes(w)), w));
});

test("shareTree of an empty tree", () => {
  const t = shareTree(buildTree([], quiet), {});
  assert.equal(t.root, null);
  assert.deepEqual(t.order, []);
});

test("shareSvg is standalone, clean and empty without a root", () => {
  assert.equal(shareSvg(buildTree([], quiet), {}), "");
  const svg = shareSvg(sample(), { theme: defaultTheme(), title: "Kepler" });
  assert.match(svg, /^<svg xmlns=/);
  sentinels(svg);
  assert.ok(!/Lamp|Door|Zigbee/.test(svg));
  assert.ok(svg.includes(">Kepler<"));
});

test("shareSvg reads theme values", () => {
  const th = theme({ text: "#abc123", online: "#010203", ring: "rgba(1,2,3,.5)", font: "Fancy, serif", highlight: "#fedcba", background: "radial-gradient(circle, #111111 0%, #222222 100%)" });
  const svg = shareSvg(sample(), { theme: th, title: "T" });
  ["#abc123", "#010203", "rgba(1,2,3,.5)", "Fancy, serif", "#fedcba", "#111111", "#222222"].forEach((v) => assert.ok(svg.includes(v), v));
  ["#e2e8f0", "#34d399", "#13213a"].forEach((v) => assert.ok(!svg.includes(v), v));
  const solid = shareSvg(sample(), { theme: theme({ background: "#123456" }), title: "T" });
  assert.ok(solid.includes('fill="#123456"'));
});

test("shareSvg escapes theme values and titles", () => {
  const evil = '"><script>x</script>{}';
  const svg = shareSvg(sample(), { theme: theme({ text: evil, font: evil, highlight: evil, background: evil }), title: evil });
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes(evil));
  assert.ok(!/<\/?script|&lt;script/.test(svg) || !svg.includes("<script"));
  assert.ok(!/<[a-z]+[^>]*[{}]/.test(svg.replace(/<style>[\s\S]*<\/style>/, "")));
});

test("filtered input draws only the filtered tree", () => {
  const t = buildTree([
    { key: "r", label: "Router", icon: "mdi:router" },
    { key: "a", parent: "r", label: "Alpha", tags: ["x"], icon: "mdi:lightbulb" },
    { key: "b", parent: "r", label: "Beta", tags: ["y"], icon: "mdi:television" },
  ], quiet);
  const svg = shareSvg(filterTree(t, ["x"]), { title: "T" });
  assert.ok(svg.includes("Light 1"));
  assert.ok(!svg.includes("TV 1"));
});

function ctxFor() {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 1028;
  return canvas.getContext("2d");
}

test("paintFrame fills with computed theme values", () => {
  const stubs = installShareStubs();
  try {
    const sceneFor = (th) => drawMap(shareTree(sample(), {}), { theme: th }).scene;
    const th = theme({ text: "#abc123", background: "#123456", highlight: "#fedcba" });
    const ctx = ctxFor();
    paintFrame(ctx, sceneFor(th), REVEAL.end, { theme: th, title: "Hi" });
    assert.ok(stubs.calls.fills.includes("#123456"));
    assert.ok(stubs.calls.fills.includes("#abc123"));
    assert.ok(stubs.calls.fills.includes("#fedcba"));
    assert.ok(stubs.calls.texts.includes("Hi"));
    assert.ok(!stubs.calls.fills.includes("#e2e8f0"));
    // Default radial background reaches the gradient.
    const before = stubs.calls.gradients.length;
    paintFrame(ctx, sceneFor(defaultTheme()), 0, { theme: defaultTheme(), title: "" });
    const g = stubs.calls.gradients[before];
    assert.deepEqual(g.stops.map((s) => s[1]), ["#13213a", "#0b1220", "#070b14"]);
    sentinels(stubs.calls.texts.join("|"));
  } finally { stubs.restore(); }
});

test("framePump steps one frame per tick with lead", () => {
  const seen = [];
  let clock = 0, pending = null, doneCalls = 0;
  framePump({
    fps: 10, frames: 5, lead: 2, frame: (t, i) => seen.push([i, t]), done: () => doneCalls++,
    now: () => clock, later: (fn, ms) => { pending = fn; clock += ms; return 1; }, clear: () => {},
  });
  while (pending) { const f = pending; pending = null; f(); }
  assert.deepEqual(seen.map((s) => s[0]), [0, 1, 2, 3, 4]);
  assert.deepEqual(seen.map((s) => s[1]), [0, 0, 0, 0.1, 0.2]);
  assert.equal(doneCalls, 1);
});

test("videoType follows MediaRecorder support", () => {
  let s = installShareStubs();
  assert.equal(videoType(), "video/webm;codecs=vp9");
  s.restore();
  s = installShareStubs({ noRecorder: true });
  assert.equal(videoType(), null);
  s.restore();
});

test("sharePng makes a png blob and no sentinel in the data URL", async () => {
  const s = installShareStubs();
  try {
    const b = await sharePng(sample(), { title: "T" });
    assert.equal(b.type, "image/png");
    sentinels(decodeURIComponent(s.calls.imageSrc));
  } finally { s.restore(); }
  const s2 = installShareStubs({ imageError: true });
  try { await assert.rejects(sharePng(sample(), {})); } finally { s2.restore(); }
});

// Runs a promise to completion on fake timers.
async function settle(p) {
  let done = false, val, err;
  p.then((v) => { done = true; val = v; }, (e) => { done = true; err = e; });
  for (let i = 0; i < 2000 && !done; i++) { mock.timers.tick(34); await Promise.resolve(); }
  if (!done) throw new Error("did not settle");
  if (err) throw err;
  return val;
}

test("shareVideo records the expected frame count", async () => {
  const s = installShareStubs();
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    const ticks = [];
    const blob = await settle(shareVideo(sample(), { title: "T", theme: defaultTheme() }, (f) => ticks.push(f), () => true));
    assert.equal(blob.type, "video/webm");
    const lead = Math.round(REC.lead * REC.fps);
    const frames = lead + Math.ceil((REVEAL.end + REC.tail) * REC.fps) + 1;
    // One fillRect per painted frame plus the opening frame.
    assert.equal(s.calls.frames, frames + 1);
    assert.equal(s.calls.tracks[0].requested, frames + 1);
    assert.equal(ticks[ticks.length - 1], 1);
    assert.equal(document.querySelectorAll("canvas").length, 0);
    assert.ok(s.calls.tracks[0].stopped);
  } finally { mock.timers.reset(); s.restore(); }
});

test("shareVideo cancels through alive", async () => {
  const s = installShareStubs();
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  try {
    let n = 0;
    await assert.rejects(settle(shareVideo(sample(), {}, null, () => ++n < 4)), (e) => e.cancelled === true);
    assert.equal(document.querySelectorAll("canvas").length, 0);
  } finally { mock.timers.reset(); s.restore(); }
});

test("shareVideo rejects when there is no recorder", async () => {
  const s = installShareStubs({ noRecorder: true });
  try {
    await assert.rejects(shareVideo(sample(), {}), /record video/);
  } finally { s.restore(); }
});

test("deliver downloads when no share sheet exists", async () => {
  const s = installShareStubs();
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(await deliver(new Blob(["x"], { type: "image/png" }), "a.png"), "saved");
    assert.equal(s.calls.urls.length, 1);
  } finally { mock.timers.reset(); s.restore(); }
});

test("share panel renders, toggles and closes", async () => {
  const s = installShareStubs();
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const hides = [];
    let closed = 0;
    const panel = openSharePanel(host, {
      svg: (h) => { hides.push(h); return "<svg/>"; }, png: async () => new Blob(["p"], { type: "image/png" }),
      video: async () => new Blob(["v"], { type: "video/webm" }), canVideo: true, onClose: () => closed++,
    });
    const pop = host.querySelector(".sharepop");
    assert.ok(pop);
    pop.querySelector(".tg").click();
    assert.deepEqual(hides, [true, false]);
    pop.querySelector(".dl").click();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(s.calls.urls.length, 1);
    panel.close();
    panel.close();
    assert.equal(host.querySelector(".sharepop"), null);
    assert.equal(closed, 1);
    host.remove();
  } finally { mock.timers.reset(); s.restore(); }
});

test("SHARE size constants", () => {
  assert.deepEqual(SHARE, { w: 1140, h: 1220, mapY: 80 });
});

// Guard: passes on the old code too. Late filtered frames must not stroke or fill with black.
test("late frames of a filtered tree use no black stroke or fill", () => {
  const stubs = installShareStubs();
  try {
    const t = filterTree(sample(), [S.tag]);
    const th = defaultTheme();
    const scene = drawMap(shareTree(t, {}), { theme: th }).scene;
    paintFrame(ctxFor(), scene, REVEAL.end, { theme: th, title: "T" });
    const dark = (c) => /^\s*(black|transparent|#0{3,8}|rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(,\s*[\d.]+\s*)?\))\s*$/i.test(String(c));
    assert.ok(stubs.calls.strokes.length > 0);
    assert.deepEqual(stubs.calls.strokes.filter(dark), []);
    assert.deepEqual(stubs.calls.fills.filter(dark), []);
    // Gradient stops (the halo's rgba(0,0,0,0) end) are not strokes or fills.
    assert.ok(stubs.calls.gradients.some((g) => g.stops.some((s) => dark(s[1]))));
  } finally { stubs.restore(); }
});

test("shareTree keeps the emptied-by-filter mark", () => {
  const t = buildTree([
    { key: "root", label: "Router", status: "online", icon: "mdi:router" },
    { key: "lamp", parent: "root", label: "Lamp", status: "online", icon: "mdi:lightbulb" },
    { key: "hub", parent: "root", label: "Zigbee", status: "recent", kind: "hub", icon: "mdi:zigbee" },
  ], quiet);
  t.nodes.hub.emptiedByFilter = true;
  const c = shareTree(t, {});
  const marked = Object.values(c.nodes).filter((n) => n.emptiedByFilter === true);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].kind, "hub");
  assert.equal(Object.values(c.nodes).filter((n) => "emptiedByFilter" in n).length, 1);
  const a = layoutTree(t), b = layoutTree(c);
  assert.equal(b.N, a.N);
  assert.ok(!b.slots.some((s) => s.type === "gap"));
});

test("shareSvg output has no focus or aria attributes", () => {
  const svg = shareSvg(sample(), {});
  assert.ok(!/tabindex|role="button"|aria-label/.test(svg));
});

// --- paintFrame equivalence and per-frame work ---------------------------------------------------------------
// Golden values live in test/fixtures/paint-frame-baseline.json, generated from the code before the per-frame
// caching refactor. Regenerate only deliberately: KEPLER_WRITE_BASELINE=1 npm test.
const BASELINE = new URL("./fixtures/paint-frame-baseline.json", import.meta.url);
const bigSample = () => buildTree([
  { key: "root", label: "Router", status: "online", icon: "mdi:router" },
  { key: "l1", parent: "root", label: "Lamp", status: "online", icon: "mdi:lightbulb" },
  { key: "l2", parent: "root", label: "Desk", status: "stale", icon: "mdi:desk-lamp" },
  { key: "hubA", parent: "root", label: "Zigbee", status: "recent", kind: "hub", icon: "mdi:zigbee" },
  { key: "a1", parent: "hubA", label: "Door", status: "stale", icon: "mdi:door" },
  { key: "a2", parent: "hubA", label: "Cam", status: "new", icon: "mdi:cctv" },
  { key: "a3", parent: "hubA", label: "Plug", status: "online", icon: "mdi:power-plug" },
  { key: "hubB", parent: "root", label: "Wifi", status: "online", kind: "hub", icon: "mdi:access-point" },
  { key: "b1", parent: "hubB", label: "TV", status: "online", icon: "mdi:television" },
  { key: "b2", parent: "hubB", label: "Phone", status: "recent", icon: "mdi:cellphone" },
  { key: "b3", parent: "hubB", label: "Speaker", status: "online", icon: "mdi:speaker" },
  { key: "b4", parent: "hubB", label: "Fan", status: "new", icon: "mdi:fan" },
], quiet);
const THEMES = {
  default: () => defaultTheme(),
  themed: () => theme({ text: "#abc123", background: "radial-gradient(circle, #111111 0%, #222222 100%)", highlight: "#fedcba", online: "#010203", ring: "rgba(1,2,3,.5)", font: "Fancy, serif" }),
  solid: () => theme({ background: "#123456", highlight: "#ff00aa" }),
};
const TIMES = { t0: 0, early: 0.6, mid: 1.3, afterBeam: 2.8, labels: 3.2, end: REVEAL.end };
// paintFrame draws an icon only once its path is known, so give every icon in the sample one.
["router", "lightbulb", "desk-lamp", "zigbee", "door", "cctv", "power-plug", "access-point", "television", "cellphone", "speaker", "fan"]
  .forEach((n, i) => setIconPath("mdi:" + n, `M${i},${i}h${i + 2}v${i + 3}z`));
const sceneOf = (th) => drawMap(shareTree(bigSample(), {}), { theme: th }).scene;
// What one paintFrame call drew, with gradients compared by value (stops), never by identity.
function snap(calls, from) {
  const val = (f) => (f && typeof f === "object" && Array.isArray(f.stops) ? { stops: f.stops } : f);
  return JSON.parse(JSON.stringify({
    fills: calls.fills.slice(from.fills).map(val),
    fillAlphas: calls.fillAlphas.slice(from.fills),
    fillPaths: calls.fillPaths.slice(from.fills),
    strokes: calls.strokes.slice(from.strokes),
    strokeAlphas: calls.strokeAlphas.slice(from.strokes),
    strokePaths: calls.strokePaths.slice(from.strokes),
    texts: calls.texts.slice(from.texts),
  }));
}
const mark = (c) => ({ fills: c.fills.length, strokes: c.strokes.length, texts: c.texts.length });
function record(name) {
  const th = THEMES[name]();
  const scene = sceneOf(th);
  const stubs = installShareStubs();
  try {
    const out = {};
    Object.keys(TIMES).forEach((tn) => {
      const m = mark(stubs.calls);
      paintFrame(ctxFor(), scene, TIMES[tn], { theme: th, title: "Baseline" });
      out[tn] = snap(stubs.calls, m);
    });
    return out;
  } finally { stubs.restore(); }
}

if (process.env.KEPLER_WRITE_BASELINE) {
  const all = {};
  Object.keys(THEMES).forEach((n) => { all[n] = record(n); });
  writeFileSync(BASELINE, JSON.stringify(all, null, 1) + "\n");
}

test("paintFrame output matches the recorded baseline for several themes and times", () => {
  const golden = JSON.parse(readFileSync(BASELINE, "utf8"));
  Object.keys(THEMES).forEach((n) => {
    const got = record(n);
    Object.keys(TIMES).forEach((tn) => assert.deepEqual(got[tn], golden[n][tn], n + " " + tn));
  });
  // The baseline is not vacuous: gradients, icons, hub labels and beam alphas are in it.
  const e = golden.default.mid;
  assert.ok(e.fills.some((f) => f && f.stops), "gradient fills");
  assert.ok(e.fillPaths.some((d) => typeof d === "string"), "icon paths");
  assert.ok(e.texts.length > 0);
  assert.ok(new Set(e.fillAlphas).size > 5, "distinct alphas");
  assert.ok(golden.default.end.texts.includes("Baseline"));
});

test("paintFrame draws the same twice in a row on one scene", () => {
  const th = THEMES.default();
  const scene = sceneOf(th);
  const stubs = installShareStubs();
  try {
    const ctx = ctxFor();
    const m1 = mark(stubs.calls);
    paintFrame(ctx, scene, TIMES.mid, { theme: th, title: "X" });
    const a = snap(stubs.calls, m1);
    const m2 = mark(stubs.calls);
    paintFrame(ctx, scene, TIMES.mid, { theme: th, title: "X" });
    assert.deepEqual(snap(stubs.calls, m2), a);
  } finally { stubs.restore(); }
});

test("paintFrame after the first call builds fewer gradients and paths", () => {
  const th = THEMES.default();
  const scene = sceneOf(th);
  const stubs = installShareStubs();
  try {
    const ctx = ctxFor();
    const c = stubs.calls;
    paintFrame(ctx, scene, TIMES.mid, { theme: th, title: "X" });
    const firstGrad = c.radials, firstPath = c.path2d;
    // Measured on the code before the caching refactor, for this scene at TIMES.mid: every call built these.
    const BASE_GRADIENTS = 23, BASE_PATH2D = 13;
    assert.ok(firstGrad <= BASE_GRADIENTS, "first call radial gradients " + firstGrad);
    assert.ok(firstPath <= BASE_PATH2D, "first call Path2D " + firstPath);
    const g0 = c.radials, p0 = c.path2d;
    paintFrame(ctx, scene, TIMES.mid, { theme: th, title: "X" });
    const secondGrad = c.radials - g0, secondPath = c.path2d - p0;
    assert.ok(secondGrad <= 2, "second call radial gradients " + secondGrad);
    assert.ok(secondPath < BASE_PATH2D, "second call Path2D " + secondPath + " vs base " + BASE_PATH2D);
  } finally { stubs.restore(); }
});

test("paintFrame does not leak cached colours across themes or scenes", () => {
  const stubs = installShareStubs();
  try {
    const ctx = ctxFor();
    const c = stubs.calls;
    const a = THEMES.default(), b = THEMES.themed();
    const scene = sceneOf(a);
    paintFrame(ctx, scene, TIMES.mid, { theme: a, title: "Baseline" });
    const m = mark(c);
    paintFrame(ctx, scene, TIMES.mid, { theme: b, title: "Baseline" });
    const got = snap(c, m);
    const fresh = record("themed").mid;
    // Same scene geometry, new theme: theme-derived fills (background, beam, header, text) follow the new theme.
    const stopsOf = (s) => s.fills.filter((f) => f && f.stops).map((f) => f.stops.map((x) => x[1]));
    assert.deepEqual(stopsOf(got)[0], ["#111111", "#222222"]);
    assert.ok(stopsOf(got).some((s) => s[0] === "#fedcba"), "beam uses the new highlight");
    assert.ok(!JSON.stringify(got.fills).includes("#13213a"));
    assert.ok(got.fills.includes("#abc123") && got.fills.includes("#fedcba"));
    assert.ok(!got.fills.includes("#e2e8f0"));
    assert.deepEqual(got.fills.slice(0, 1), fresh.fills.slice(0, 1));
    assert.deepEqual(got.texts, fresh.texts);
    // And back again.
    const m2 = mark(c);
    paintFrame(ctx, scene, TIMES.mid, { theme: a, title: "Baseline" });
    assert.deepEqual(stopsOf(snap(c, m2))[0], ["#13213a", "#0b1220", "#070b14"]);
    // A fresh scene object paints exactly what a first-ever paint of it does.
    const scene2 = sceneOf(a);
    const m3 = mark(c);
    paintFrame(ctx, scene2, TIMES.end, { theme: a, title: "Baseline" });
    assert.deepEqual(snap(c, m3), record("default").end);
  } finally { stubs.restore(); }
});

// Empty-map share behaviour on the real card element.
customElements.define("kepler-share-empty-test", class extends KeplerElement {});
const NODES = () => [
  { key: "r", label: "Router", status: "online" },
  { key: "lamp", parent: "r", label: "Lamp", tags: ["floor:down"] },
  { key: "cam", parent: "r", label: "Camera", tags: ["floor:up"] },
];
function mountCard(nodes, opts) {
  const el = document.createElement("kepler-share-empty-test");
  if (nodes) el.nodes = nodes;
  if (opts) el.options = opts;
  document.body.appendChild(el);
  return el;
}
const shareBtn = (el) => el.shadowRoot.querySelector(".sharebtn");
const sharePop = (el) => el.shadowRoot.querySelector(".sharepop");
const EMPTY_TITLE = "Nothing to share yet";
const FULL_TITLE = "Share an image or video of the map";

test("empty map: share button disabled and click opens no panel", () => {
  const s = installShareStubs();
  try {
    const el = mountCard([]);
    const b = shareBtn(el);
    assert.equal(b.disabled, true);
    assert.equal(b.title, EMPTY_TITLE);
    b.click();
    assert.equal(sharePop(el), null);
    el.remove();
  } finally { s.restore(); }
});

test("emptying the data closes an open panel and disables the button, then recovers", () => {
  const s = installShareStubs();
  try {
    const el = mountCard(NODES());
    const b = shareBtn(el);
    assert.equal(b.disabled, false);
    b.click();
    assert.ok(sharePop(el));
    el.nodes = [];
    assert.equal(sharePop(el), null);
    assert.equal(b.disabled, true);
    assert.equal(b.title, EMPTY_TITLE);
    el.nodes = NODES();
    assert.equal(b.disabled, false);
    assert.equal(b.title, FULL_TITLE);
    b.click();
    const pop = sharePop(el);
    assert.ok(pop);
    assert.ok(pop.querySelector(".thumb").src.startsWith("data:image/svg+xml"));
    el.remove();
  } finally { s.restore(); }
});

test("filters keep the root, so a non-matching selection leaves the button enabled", () => {
  const s = installShareStubs();
  try {
    const el = mountCard(NODES(), { filters: true, selected_tags: ["no:such-tag"] });
    const t = el._viewTree();
    assert.ok(t.root, "filterTree keeps the root");
    assert.ok(t.nodes[t.root]);
    assert.equal(shareBtn(el).disabled, false);
    shareBtn(el).click();
    assert.ok(sharePop(el));
    el.remove();
  } finally { s.restore(); }
});

test("show_share false keeps the button hidden, with or without data", () => {
  const s = installShareStubs();
  try {
    const el = mountCard(NODES(), { show_share: false });
    assert.equal(shareBtn(el).hidden, true);
    el.nodes = [];
    el._draw();
    assert.equal(shareBtn(el).hidden, true);
    el.nodes = NODES();
    el._draw();
    assert.equal(shareBtn(el).hidden, true);
    el.remove();
  } finally { s.restore(); }
});

test("_toggleShare on an empty map opens nothing", () => {
  const s = installShareStubs();
  try {
    const el = mountCard([]);
    el._toggleShare();
    assert.equal(sharePop(el), null);
    assert.equal(el._share, null);
    el.remove();
  } finally { s.restore(); }
});
