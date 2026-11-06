import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { KeplerElement } from "../src/kepler-card.js";

customElements.define("kepler-ds-test", class extends KeplerElement {});
const SAMPLE = () => [
  { key: "r", label: "Router", status: "online" },
  { key: "d1", parent: "r", label: "Lamp", status: "online", extra: { a: 1 } },
];
function mount(nodes) {
  const el = document.createElement("kepler-ds-test");
  if (nodes) el.nodes = nodes;
  document.body.appendChild(el);
  el._endReveal();
  return el;
}
function capture(fn) {
  const calls = [];
  const orig = console.warn;
  console.warn = (...a) => calls.push(a.join(" "));
  try { fn(); } finally { console.warn = orig; }
  return calls;
}
const keys = (el) => Array.from(el.shadowRoot.querySelectorAll(".node[data-key]")).map((n) => n.dataset.key);

test("replacing nodes redraws and keeps view and selection, no reveal replay", () => {
  const el = mount(SAMPLE());
  el._endReveal();
  el.options = { filters: true, selected_tags: ["x"] };
  el._view = { x: 10, y: 10, w: 500, h: 500 };
  const before = el._drawCount;
  el.nodes = SAMPLE().concat([{ key: "d2", parent: "r", label: "Door" }]);
  assert.equal(el._drawCount, before + 1);
  assert.deepEqual(el._view, { x: 10, y: 10, w: 500, h: 500 });
  assert.deepEqual(el.selectedTags, ["x"]);
  assert.equal(el._revealing, false);
  assert.equal(el.shadowRoot.querySelector(".radar"), null);
  assert.deepEqual(keys(el).sort(), ["d1", "d2", "r"]);
  el.remove();
});

test("same content leaves _drawCount unchanged", () => {
  const el = mount(SAMPLE());
  el._endReveal();
  const n = el._drawCount;
  el.nodes = SAMPLE();
  assert.equal(el._drawCount, n);
  el.remove();
});

test("host array is not changed and getter returns a copy", () => {
  const host = SAMPLE();
  const snap = JSON.stringify(host);
  const el = mount(host);
  assert.equal(JSON.stringify(host), snap);
  host[0].label = "changed";
  assert.equal(el.nodes[0].label, "Router");
  const got = el.nodes;
  got[0].label = "x";
  got.push({});
  assert.equal(el.nodes[0].label, "Router");
  assert.equal(el.nodes.length, 2);
  assert.notEqual(el.nodes, el.nodes);
  el.remove();
});

test("a property set before upgrade works", () => {
  const el = document.createElement("kepler-ds-late");
  el.nodes = SAMPLE();
  el.options = { title: "Early" };
  customElements.define("kepler-ds-late", class extends KeplerElement {});
  document.body.appendChild(el);
  assert.equal(el.nodes.length, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(el, "nodes"), false);
  assert.equal(el.options.title, "Early");
  assert.deepEqual(keys(el).sort(), ["d1", "r"]);
  assert.equal(el.shadowRoot.querySelector(".title").textContent, "Early");
  el.remove();
});

test("non-array warns, draws the empty map, does not throw, and warns once for a repeat", () => {
  const el = mount(SAMPLE());
  const w = capture(() => { el.nodes = "nope"; });
  assert.equal(w.length, 1);
  assert.match(w[0], /^Kepler: /);
  assert.deepEqual(el.nodes, []);
  assert.deepEqual(keys(el), []);
  assert.equal(capture(() => { el.nodes = "nope"; }).length, 0);
  assert.equal(capture(() => { el.nodes = null; }).length, 0);
  el.remove();
});

test("bad entries warn and are skipped, repeat warns once", () => {
  const el = mount();
  const bad = () => [null, 5, "s", [], { label: "no key" }, { key: "" }, { key: "ok", label: "Fine" }];
  const w = capture(() => { el.nodes = bad(); });
  assert.equal(w.length, 6);
  assert.ok(w.some((m) => /index 0/.test(m)));
  assert.deepEqual(keys(el), ["ok"]);
  assert.equal(capture(() => { el.nodes = bad(); }).length, 0);
  const circ = { key: "c" };
  circ.extra = circ;
  assert.doesNotThrow(() => capture(() => { el.nodes = [circ, { key: "ok" }]; }));
  assert.deepEqual(keys(el), ["ok"]);
  el.remove();
});

test("empty array draws an empty map with no warning", () => {
  const el = mount(SAMPLE());
  const w = capture(() => { el.nodes = []; });
  assert.equal(w.length, 0);
  assert.deepEqual(keys(el), []);
  el.remove();
});

test("source files do discovery of nothing", () => {
  const dir = new URL("../src/", import.meta.url);
  const banned = [/fetch\(/, /XMLHttpRequest/, /localStorage/, /sessionStorage/, /indexedDB/, /callWS/, /callApi/, /\.states/];
  readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "lovelace.js").forEach((f) => {
    const src = readFileSync(new URL(f, dir), "utf8");
    banned.forEach((re) => assert.ok(!re.test(src), `${f} matches ${re}`));
    const stripped = src.replace(/hass-more-info/g, "");
    assert.ok(!/hass/.test(stripped), `${f} mentions hass`);
  });
});
