import "./helpers/dom.js";
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { installShareStubs } from "./helpers/share-stubs.js";
import { buildTree } from "../src/tree.js";
import { layoutTree } from "../src/layout.js";
import { filterTree } from "../src/filters.js";
import { defaultTheme } from "../src/theme.js";
import { drawMap } from "../src/draw.js";
import { REVEAL } from "../src/reveal.js";
import {
  SHARE, REC, shareType, shareTree, shareSvg, paintFrame, framePump, videoType, sharePng, shareVideo, deliver,
} from "../src/share.js";
import { openSharePanel } from "../src/share-panel.js";

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
  assert.ok(labels.includes("Light 1") && labels.includes("TV 1") && labels.includes("Network device"));
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
