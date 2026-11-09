import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KeplerElement } from "../src/kepler-card.js";
import { installShareStubs } from "./helpers/share-stubs.js";

customElements.define("kepler-view-test", class extends KeplerElement {});
const NODES = () => [
  { key: "r", label: "Router", status: "online" },
  { key: "zb", parent: "r", label: "Zigbee", kind: "hub", tags: ["topology:zigbee", "floor:up"] },
  { key: "door", parent: "zb", label: "Door", tags: ["topology:zigbee", "floor:up"] },
  { key: "lamp", parent: "r", label: "Lamp", tags: ["topology:wifi", "floor:down", "outdoor"] },
  { key: "cam", parent: "r", label: "Camera" },
];
function mount(nodes, opts) {
  const el = document.createElement("kepler-view-test");
  if (nodes) el.nodes = nodes;
  if (opts) el.options = opts;
  document.body.appendChild(el);
  return el;
}
const ended = (el) => { el._endReveal(); return el; };
const keys = (el) => Array.from(el.shadowRoot.querySelectorAll(".node[data-key]")).map((n) => n.dataset.key).sort();
const chips = (el) => Array.from(el.shadowRoot.querySelectorAll("button.chip[data-tag]"));
const chip = (el, tag) => chips(el).find((b) => b.dataset.tag === tag);

test("filters are off by default: no chips, all nodes", () => {
  const el = ended(mount(NODES(), { selected_tags: ["floor:up"] }));
  assert.equal(chips(el).length, 0);
  assert.deepEqual(keys(el), ["cam", "door", "lamp", "r", "zb"]);
  el.remove();
});

test("filters on shows chips in groups", () => {
  const el = ended(mount(NODES(), { filters: true }));
  const groups = Array.from(el.shadowRoot.querySelectorAll(".chipgroup")).map((g) => g.dataset.group);
  assert.deepEqual(groups, ["floor", "topology", ""]);
  assert.equal(chips(el).length, 5);
  assert.ok(chips(el).every((b) => b.getAttribute("aria-pressed") === "false"));
  assert.deepEqual(keys(el).length, 5);
  el.remove();
});

test("selected_tags preset filters the view and marks the chip", () => {
  const el = ended(mount(NODES(), { filters: true, selected_tags: ["floor:up"] }));
  assert.deepEqual(keys(el), ["door", "r", "zb"]);
  assert.equal(chip(el, "floor:up").getAttribute("aria-pressed"), "true");
  assert.deepEqual(el.selectedTags, ["floor:up"]);
  el.remove();
});

test("chip click toggles aria-pressed and reflows", () => {
  const el = ended(mount(NODES(), { filters: true }));
  const before = el._drawCount;
  chip(el, "outdoor").click();
  assert.equal(chip(el, "outdoor").getAttribute("aria-pressed"), "true");
  assert.deepEqual(keys(el), ["lamp", "r"]);
  assert.equal(el._drawCount, before + 1);
  chip(el, "outdoor").click();
  assert.equal(chip(el, "outdoor").getAttribute("aria-pressed"), "false");
  assert.equal(keys(el).length, 5);
  el.remove();
});

test("chips from the full tree: picks across groups mean both", () => {
  const el = ended(mount(NODES(), { filters: true }));
  chip(el, "floor:up").click();
  chip(el, "topology:wifi").click();
  assert.deepEqual(keys(el), ["r"]);
  assert.equal(chips(el).length, 5);
  el.remove();
});

test("chips rebuild when nodes change", () => {
  const el = ended(mount(NODES(), { filters: true }));
  el.nodes = [{ key: "r" }, { key: "a", parent: "r", tags: ["new:tag"] }];
  assert.deepEqual(chips(el).map((b) => b.dataset.tag), ["new:tag"]);
  el.remove();
});

test("a selected tag that leaves then returns applies again", () => {
  const el = ended(mount(NODES(), { filters: true, selected_tags: ["outdoor"] }));
  assert.deepEqual(keys(el), ["lamp", "r"]);
  el.nodes = NODES().filter((n) => n.key !== "lamp");
  assert.equal(keys(el).length, 4);
  assert.equal(chip(el, "outdoor"), undefined);
  assert.deepEqual(el.selectedTags, ["outdoor"]);
  el.nodes = NODES();
  assert.deepEqual(keys(el), ["lamp", "r"]);
  assert.equal(chip(el, "outdoor").getAttribute("aria-pressed"), "true");
  el.remove();
});

test("selected_tags is kept while filters are off and applies when turned on", () => {
  const el = ended(mount(NODES(), { selected_tags: ["outdoor"] }));
  assert.equal(keys(el).length, 5);
  el.options = { filters: true };
  assert.deepEqual(keys(el), ["lamp", "r"]);
  el.remove();
});

test("reveal plays once", () => {
  const el = mount(NODES());
  assert.equal(el._revealing, true);
  assert.ok(el.shadowRoot.querySelector(".radar"));
  el._endReveal();
  assert.equal(el._revealing, false);
  assert.equal(el.shadowRoot.querySelector(".radar"), null);
  el.nodes = NODES().concat([{ key: "x", parent: "r" }]);
  assert.equal(el._revealing, false);
  el.remove();
  document.body.appendChild(el);
  assert.equal(el._revealing, false);
  el.remove();
});

test("wrap carries data-reveal only while the reveal plays", () => {
  const el = mount(NODES());
  const wrap = el.shadowRoot.querySelector(".wrap");
  assert.equal(wrap.getAttribute("data-reveal"), "playing");
  el._endReveal();
  assert.equal(wrap.hasAttribute("data-reveal"), false);
  el.remove();
});

test("empty map draws", () => {
  const el = mount();
  assert.equal(el._drawCount, 1);
  assert.equal(el._revealing, false);
  assert.deepEqual(keys(el), []);
  assert.ok(el.shadowRoot.querySelector("svg.map"));
  el.remove();
});

test("nodes held during reveal are drawn after _endReveal, and the reveal still runs for the first root", () => {
  const el = mount([{ key: "r" }]);
  assert.equal(el._revealing, true);
  const n = el._drawCount;
  el.nodes = NODES();
  assert.equal(el._drawCount, n);
  assert.deepEqual(keys(el), ["r"]);
  el._endReveal();
  assert.equal(el._drawCount, n + 1);
  assert.equal(keys(el).length, 5);
  el.remove();
});

test("shareSvg and sharePng use the filtered view only and inline --kepler values", async () => {
  const stubs = installShareStubs();
  try {
    const el = ended(mount(NODES(), { filters: true, selected_tags: ["outdoor"] }));
    el.style.setProperty("--kepler-status-online", "#123456");
    const svg = el.shareSvg();
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("#123456"));
    assert.equal((svg.match(/class="node /g) || []).length, 2);
    assert.ok(!svg.includes("Lamp"));
    const full = ended(mount(NODES(), { filters: true }));
    assert.equal((full.shareSvg().match(/class="node /g) || []).length, 5);
    assert.ok(el.shareSvg(false).includes("Lamp"));
    assert.ok(el.shareSvg(false).includes(">Kepler<"));
    const blob = await el.sharePng();
    assert.equal(blob.type, "image/png");
    assert.match(String(stubs.calls.imageSrc), /%23123456/);
    full.remove();
    el.remove();
  } finally {
    stubs.restore();
  }
});

test("shareSvg of an empty map is empty", () => {
  const el = mount();
  assert.equal(el.shareSvg(), "");
  el.remove();
});

const sr = (el, sel) => el.shadowRoot.querySelector(sel);

test("zoom buttons use the tooltip colour pair (issue #4)", () => {
  const el = ended(mount(NODES()));
  const css = sr(el, "style").textContent;
  const rule = /\.zoomctl button\{([^}]*)\}/.exec(css)[1];
  const tip = /\.tip\{([^}]*)\}/.exec(css)[1];
  const color = "color:var(--kepler-tooltip-text-color, #e2e8f0)";
  const bg = "background:var(--kepler-tooltip-background, rgba(15,23,42,.96))";
  assert.ok(rule.includes(color));
  assert.ok(rule.includes(bg));
  assert.ok(!rule.includes("--kepler-text-color"));
  assert.ok(tip.includes(color));
  assert.ok(tip.includes(bg));
  el.remove();
});
function pointer(el, type) {
  const e = new MouseEvent(type, { clientX: 5, clientY: 5, bubbles: true, cancelable: true, buttons: 1 });
  Object.defineProperty(e, "pointerId", { value: 1 });
  Object.defineProperty(e, "pointerType", { value: "touch" });
  sr(el, "svg.map").dispatchEvent(e);
}

test("turning zoom off while zoomed resets the view and touch scrolling", () => {
  const el = ended(mount(NODES(), { zoom: true }));
  sr(el, ".zin").click();
  assert.ok(el._view);
  assert.equal(sr(el, ".wrap").style.touchAction, "none");
  el.options = { zoom: false };
  assert.equal(el._view, null);
  assert.equal(sr(el, "svg.map").getAttribute("viewBox"), "-70.0 -40.0 1140.0 1090.0");
  assert.equal(sr(el, ".wrap").style.touchAction, "auto");
  el.remove();
});

test("a plain tap does not hold redraws", () => {
  const el = ended(mount(NODES(), {}));
  pointer(el, "pointerdown");
  assert.equal(el._gesturing, true);
  pointer(el, "pointerup");
  assert.equal(el._gesturing, false);
  assert.equal(el._gestureAt, -Infinity);
  const before = el._drawCount;
  el.nodes = NODES().concat([{ key: "x", parent: "r", label: "X" }]);
  assert.equal(el._drawCount, before + 1);
  el.remove();
});

test("a redraw held during a tap is released when the tap ends", () => {
  const el = ended(mount(NODES(), {}));
  pointer(el, "pointerdown");
  const before = el._drawCount;
  el.nodes = NODES().concat([{ key: "y", parent: "r", label: "Y" }]);
  assert.equal(el._drawCount, before);
  pointer(el, "pointerup");
  assert.equal(el._drawCount, before + 1);
  assert.equal(el._timer, null);
  el.remove();
});

test("an options change during a running reveal ends it and draws once", () => {
  const el = mount(NODES(), {});
  assert.equal(el._revealing, true);
  const before = el._drawCount;
  el.options = { title: "X" };
  assert.equal(sr(el, ".title").textContent, "X");
  assert.equal(el._revealing, false);
  assert.equal(el._drawCount, before + 1);
  assert.equal(el._timer, null);
  el.remove();
});

test("an options change draws at once after a gesture and keeps the view; nodes still wait", () => {
  const el = ended(mount(NODES(), {}));
  sr(el, ".zin").click();
  const view = el._view;
  assert.ok(view);
  el._gestureAt = Date.now();
  const before = el._drawCount;
  el.options = { title: "Y" };
  assert.equal(el._drawCount, before + 1);
  assert.equal(sr(el, ".title").textContent, "Y");
  assert.equal(el._view, view);
  el.nodes = NODES().concat([{ key: "w", parent: "r", label: "W" }]);
  assert.equal(el._drawCount, before + 1);
  assert.ok(el._timer);
  assert.ok(!keys(el).includes("w"));
  el.remove();
});

test("disconnect mid-gesture clears gesture state; reattach redraws and zoom works", () => {
  const el = ended(mount(NODES(), {}));
  sr(el, ".zin").click();
  pointer(el, "pointerdown");
  assert.equal(el._gesturing, true);
  el.remove();
  assert.equal(el._gesturing, false);
  assert.equal(el._gestureAt, -Infinity);
  assert.equal(el._timer, null);
  assert.equal(el._view, null);
  el.nodes = NODES().concat([{ key: "z", parent: "r", label: "Z" }]);
  document.body.appendChild(el);
  ended(el);
  assert.ok(keys(el).includes("z"));
  sr(el, ".zin").click();
  assert.ok(el._view);
  el.remove();
});

test("a mouse press released outside the map still ends, and the window listeners go", () => {
  const el = ended(mount(NODES(), {}));
  const svg = sr(el, "svg.map");
  const down = new MouseEvent("pointerdown", { clientX: 5, clientY: 5, bubbles: true, cancelable: true, buttons: 1 });
  Object.defineProperty(down, "pointerId", { value: 7 });
  Object.defineProperty(down, "pointerType", { value: "mouse" });
  svg.dispatchEvent(down);
  assert.equal(el._gesturing, true);
  const up = new MouseEvent("pointerup", { clientX: 900, clientY: 900, bubbles: true });
  Object.defineProperty(up, "pointerId", { value: 7 });
  Object.defineProperty(up, "pointerType", { value: "mouse" });
  window.dispatchEvent(up);
  assert.equal(el._gesturing, false);
  assert.equal(el._gestureAt, -Infinity);
  // listener removed: a later press on another pointer id is unaffected by a stale window handler
  svg.dispatchEvent(down);
  assert.equal(el._gesturing, true);
  el.remove();
  assert.equal(el._gesturing, false);
  window.dispatchEvent(up);
  assert.equal(el._gesturing, false);
});
