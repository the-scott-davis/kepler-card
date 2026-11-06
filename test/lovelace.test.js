import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KeplerCard, readNodes } from "../src/lovelace.js";

customElements.define("kepler-ll-test", class extends KeplerCard {});
const A = () => [{ key: "r", label: "Router" }, { key: "d", parent: "r", label: "Lamp" }];
const B = () => A().concat([{ key: "e", parent: "r", label: "Door" }]);
function mount() {
  const el = document.createElement("kepler-ll-test");
  document.body.appendChild(el);
  el._endReveal();
  return el;
}
const hassWith = (entity, attrs) => ({ states: entity ? { [entity]: { attributes: attrs } } : {} });
const keys = (el) => el.nodes.map((n) => n.key);

test("static card hooks", () => {
  const el = mount();
  assert.deepEqual(KeplerCard.getStubConfig(), { nodes: [] });
  assert.equal(el.getCardSize(), 12);
  assert.deepEqual(el.getGridOptions(), { columns: "full", rows: "auto", min_rows: 8 });
});

test("nodes config and more_info default on", () => {
  const el = mount();
  el.setConfig({ nodes: A() });
  assert.deepEqual(keys(el), ["r", "d"]);
  assert.equal(el.options.more_info, true);
  el.setConfig({ nodes: A(), more_info: false, title: "T" });
  assert.equal(el.options.more_info, false);
  assert.equal(el.options.title, "T");
});

test("nodes_entity default and named attribute", () => {
  const el = mount();
  el.hass = hassWith("sensor.k", { nodes: A(), other: B() });
  el.setConfig({ nodes_entity: "sensor.k" });
  assert.deepEqual(keys(el), ["r", "d"]);
  el.setConfig({ nodes_entity: "sensor.k", nodes_attribute: "other" });
  assert.deepEqual(keys(el), ["r", "d", "e"]);
});

test("nodes_entity wins over nodes", () => {
  const el = mount();
  el.setConfig({ nodes: B(), nodes_entity: "sensor.k" });
  el.hass = hassWith("sensor.k", { nodes: A() });
  assert.deepEqual(keys(el), ["r", "d"]);
});

test("changed attribute redraws on next hass, unchanged does not", () => {
  const el = mount();
  el.setConfig({ nodes_entity: "sensor.k" });
  el.hass = hassWith("sensor.k", { nodes: A() });
  el._endReveal();
  const n = el._drawCount;
  el.hass = hassWith("sensor.k", { nodes: A() });
  assert.equal(el._drawCount, n);
  el.hass = hassWith("sensor.k", { nodes: B() });
  assert.equal(el._drawCount, n + 1);
  assert.deepEqual(keys(el), ["r", "d", "e"]);
});

test("missing entity or attribute gives empty map, no warning", () => {
  const orig = console.warn;
  const calls = [];
  console.warn = (...a) => calls.push(a);
  try {
    const el = mount();
    el.setConfig({ nodes_entity: "sensor.none" });
    el.hass = hassWith(null);
    assert.deepEqual(el.nodes, []);
    el.hass = hassWith("sensor.none", {});
    assert.deepEqual(el.nodes, []);
    el.hass = { states: { "sensor.none": {} } };
    assert.deepEqual(el.nodes, []);
    el.hass = undefined;
    el.setConfig({});
    el.setConfig(null);
    assert.deepEqual(readNodes(null, null), []);
  } finally {
    console.warn = orig;
  }
  assert.equal(calls.length, 0);
});

test("only the named entity is read", () => {
  const reads = [];
  const states = new Proxy({ "sensor.k": { attributes: { nodes: A() } }, "sensor.x": {} }, {
    get(t, k) { reads.push(String(k)); return t[k]; },
  });
  const el = mount();
  el.setConfig({ nodes_entity: "sensor.k" });
  el.hass = { states };
  el.hass = { states };
  assert.ok(reads.length > 0);
  assert.ok(reads.every((k) => k === "sensor.k"), reads.join());
});

test("bare element keeps its own nodes when hass arrives without config", () => {
  const el = mount();
  el.nodes = A();
  el.hass = hassWith("sensor.k", { nodes: B() });
  assert.deepEqual(keys(el), ["r", "d"]);
  el.setConfig({ nodes: B() });
  el.hass = hassWith("sensor.k", { nodes: A() });
  assert.deepEqual(keys(el), ["r", "d", "e"]);
});
