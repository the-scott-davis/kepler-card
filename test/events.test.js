import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { KeplerElement } from "../src/kepler-card.js";

customElements.define("kepler-ev-test", class extends KeplerElement {});
const NODES = () => [
  { key: "r", label: "Router", status: "online" },
  { key: "lamp", parent: "r", label: "Lamp", entity: "light.lamp", extra: { deep: { n: [1, 2] } } },
  { key: "plain", parent: "r", label: "Plain" },
];
function mount(opts) {
  const el = document.createElement("kepler-ev-test");
  el.nodes = NODES();
  if (opts) el.options = opts;
  document.body.appendChild(el);
  el._endReveal();
  return el;
}
const nodeEl = (el, k) => el.shadowRoot.querySelector(`.node[data-key="${k}"]`);
const click = (n) => n.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
function record(el) {
  const log = [];
  el.addEventListener("kepler-node-tap", (e) => log.push(["tap", e]));
  el.addEventListener("hass-more-info", (e) => log.push(["info", e]));
  return log;
}

test("tap event flags, detail and order", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  click(nodeEl(el, "lamp"));
  assert.deepEqual(log.map((l) => l[0]), ["tap", "info"]);
  const t = log[0][1], i = log[1][1];
  assert.ok(t.bubbles && t.composed && t.cancelable);
  assert.ok(i.bubbles && i.composed);
  assert.equal(t.detail.key, "lamp");
  assert.equal(i.detail.entityId, "light.lamp");
  el.remove();
});

test("node is a copy and extra is intact", () => {
  const el = mount();
  const log = record(el);
  click(nodeEl(el, "lamp"));
  const d = log[0][1].detail;
  assert.deepEqual(d.node.extra, { deep: { n: [1, 2] } });
  d.node.extra.deep.n.push(3);
  d.node.label = "mutated";
  click(nodeEl(el, "lamp"));
  assert.deepEqual(log[1][1].detail.node.extra, { deep: { n: [1, 2] } });
  assert.equal(log[1][1].detail.node.label, "Lamp");
  assert.equal(el.nodes[1].label, "Lamp");
  el.remove();
});

test("bubbles out of the shadow root to the document", () => {
  const el = mount();
  let got = null;
  document.addEventListener("kepler-node-tap", (e) => { got = e; }, { once: true });
  click(nodeEl(el, "plain"));
  assert.equal(got.detail.key, "plain");
  el.remove();
});

test("preventDefault suppresses hass-more-info", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  el.addEventListener("kepler-node-tap", (e) => e.preventDefault());
  click(nodeEl(el, "lamp"));
  assert.deepEqual(log.map((l) => l[0]), ["tap"]);
  el.remove();
});

test("more_info off fires only the tap", () => {
  const el = mount({ more_info: false });
  const log = record(el);
  click(nodeEl(el, "lamp"));
  assert.deepEqual(log.map((l) => l[0]), ["tap"]);
  el.remove();
});

test("no entity fires only the tap", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  click(nodeEl(el, "plain"));
  assert.deepEqual(log.map((l) => l[0]), ["tap"]);
  el.remove();
});

test("click on the background fires nothing", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  click(el.shadowRoot.querySelector("svg.map"));
  assert.equal(log.length, 0);
  el.remove();
});

test("a tap opens no popup in the shadow DOM", () => {
  const el = mount({ more_info: true });
  const before = el.shadowRoot.querySelectorAll("*").length;
  click(nodeEl(el, "lamp"));
  assert.equal(el.shadowRoot.querySelectorAll("*").length, before);
  assert.equal(el.shadowRoot.querySelector(".sharepop, .pop, dialog"), null);
  el.remove();
});

test("hover shows the label only and fires no event", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  let other = 0;
  el.addEventListener("hass-more-info", () => other++);
  const tip = el.shadowRoot.querySelector(".tip");
  nodeEl(el, "lamp").dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));
  assert.equal(tip.textContent, "Lamp");
  assert.equal(tip.children.length, 0);
  assert.equal(tip.style.opacity, "1");
  nodeEl(el, "lamp").dispatchEvent(new MouseEvent("mouseout", { bubbles: true, composed: true }));
  assert.equal(tip.style.opacity, "0");
  assert.equal(log.length, 0);
  el.remove();
});
