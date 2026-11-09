import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { win } from "./helpers/dom.js";
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

const hover = (n) => n.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, composed: true }));
const tipOf = (el) => el.shadowRoot.querySelector(".tip");
const TAGGED = () => [
  { key: "r", label: "Router" },
  { key: "lamp", parent: "r", label: "Lamp", tags: ["area:den"] },
  { key: "plain", parent: "r", label: "Plain", tags: ["area:office"] },
];

test("a nodes redraw hides the tooltip", () => {
  const el = mount();
  const tip = tipOf(el);
  hover(nodeEl(el, "lamp"));
  assert.equal(tip.style.opacity, "1");
  assert.equal(tip.textContent, "Lamp");
  el.nodes = [...NODES(), { key: "new", parent: "r", label: "New" }];
  assert.equal(tip.style.opacity, "0");
  assert.equal(tip.textContent, "");
  el.remove();
});

test("a filter chip redraw hides the tooltip", () => {
  const el = document.createElement("kepler-ev-test");
  el.nodes = TAGGED();
  el.options = { filters: true };
  document.body.appendChild(el);
  el._endReveal();
  const tip = tipOf(el);
  hover(nodeEl(el, "lamp"));
  assert.equal(tip.style.opacity, "1");
  el.shadowRoot.querySelector('button.chip[data-tag="area:den"]').dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  assert.equal(tip.style.opacity, "0");
  assert.equal(tip.textContent, "");
  el.remove();
});

test("an options redraw hides the tooltip", () => {
  const el = mount();
  const tip = tipOf(el);
  hover(nodeEl(el, "plain"));
  assert.equal(tip.style.opacity, "1");
  el.options = { title: "Changed" };
  assert.equal(tip.style.opacity, "0");
  assert.equal(tip.textContent, "");
  el.remove();
});

test("hover after a redraw shows the tooltip again", () => {
  const el = mount();
  const tip = tipOf(el);
  hover(nodeEl(el, "lamp"));
  el.nodes = [...NODES(), { key: "new", parent: "r", label: "New" }];
  assert.equal(tip.style.opacity, "0");
  hover(nodeEl(el, "lamp"));
  assert.equal(tip.style.opacity, "1");
  assert.equal(tip.textContent, "Lamp");
  el.remove();
});

test("moving between adjacent nodes shows the current label", () => {
  const el = mount();
  const tip = tipOf(el);
  const a = nodeEl(el, "lamp"), b = nodeEl(el, "plain");
  hover(a);
  a.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, composed: true, relatedTarget: b }));
  hover(b);
  assert.equal(tip.style.opacity, "1");
  assert.equal(tip.textContent, "Plain");
  el.remove();
});

test("disconnect hides the tooltip", () => {
  const el = mount();
  const tip = tipOf(el);
  hover(nodeEl(el, "lamp"));
  el.remove();
  assert.equal(tip.style.opacity, "0");
  assert.equal(tip.textContent, "");
});

// ---- keyboard
const key = (n, k) => {
  const e = new win.KeyboardEvent("keydown", { key: k, bubbles: true, composed: true, cancelable: true });
  n.dispatchEvent(e);
  return e;
};
const focusin = (n) => n.dispatchEvent(new win.FocusEvent("focusin", { bubbles: true, composed: true }));
const focusout = (n) => n.dispatchEvent(new win.FocusEvent("focusout", { bubbles: true, composed: true }));

test("Enter fires the same tap as a click", () => {
  const el = mount();
  const log = record(el);
  click(nodeEl(el, "lamp"));
  const e = key(nodeEl(el, "lamp"), "Enter");
  assert.deepEqual(log.map((l) => l[0]), ["tap", "tap"]);
  const a = log[0][1], b = log[1][1];
  assert.deepEqual(b.detail, a.detail);
  assert.ok(b.bubbles && b.composed && b.cancelable);
  assert.equal(e.defaultPrevented, false);
  el.remove();
});

test("Space fires the tap and prevents the page scroll", () => {
  const el = mount();
  const log = record(el);
  const e = key(nodeEl(el, "lamp"), " ");
  assert.equal(log.length, 1);
  assert.equal(log[0][1].detail.key, "lamp");
  assert.equal(e.defaultPrevented, true);
  el.remove();
});

test("other keys dispatch nothing", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  ["a", "Tab", "Escape", "ArrowDown"].forEach((k) => key(nodeEl(el, "lamp"), k));
  assert.equal(log.length, 0);
  el.remove();
});

test("Enter with more_info fires hass-more-info; preventDefault suppresses it", () => {
  const el = mount({ more_info: true });
  const log = record(el);
  key(nodeEl(el, "lamp"), "Enter");
  assert.deepEqual(log.map((l) => l[0]), ["tap", "info"]);
  assert.equal(log[1][1].detail.entityId, "light.lamp");
  el.addEventListener("kepler-node-tap", (e) => e.preventDefault());
  key(nodeEl(el, "lamp"), "Enter");
  assert.deepEqual(log.map((l) => l[0]), ["tap", "info", "tap"]);
  el.remove();
});

test("focusin shows the label tooltip, focusout hides it", () => {
  const el = mount();
  nodeEl(el, "lamp").matches = () => true; // jsdom has no keyboard-focus heuristic
  focusin(nodeEl(el, "lamp"));
  assert.equal(tipOf(el).textContent, "Lamp");
  assert.equal(tipOf(el).style.opacity, "1");
  focusout(nodeEl(el, "lamp"));
  assert.equal(tipOf(el).style.opacity, "0");
  el.remove();
});

test("a redraw refocuses the focused node when it still exists", () => {
  const el = mount();
  const first = nodeEl(el, "lamp");
  first.setAttribute("tabindex", "0"); // draw.js does this for every node
  first.focus();
  assert.equal(el.shadowRoot.activeElement, first);
  el.nodes = NODES().concat([{ key: "extra", parent: "r", label: "Extra" }]);
  const again = nodeEl(el, "lamp");
  assert.notEqual(again, first);
  assert.equal(el.shadowRoot.activeElement, again);
  el.remove();
});

test("a redraw after the focused node is gone throws nothing", () => {
  const el = mount();
  const first = nodeEl(el, "lamp");
  first.setAttribute("tabindex", "0");
  first.focus();
  assert.doesNotThrow(() => { el.nodes = NODES().filter((n) => n.key !== "lamp"); });
  assert.equal(nodeEl(el, "lamp"), null);
  el.remove();
});

test("held key and modifier combos dispatch nothing", () => {
  const el = mount();
  const log = record(el);
  const n = nodeEl(el, "lamp");
  n.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, composed: true }));
  n.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, composed: true }));
  n.dispatchEvent(new win.KeyboardEvent("keydown", { key: " ", metaKey: true, bubbles: true, composed: true }));
  assert.equal(log.length, 0);
  el.remove();
});

test("mouse-originated focus shows no tooltip", () => {
  const el = mount();
  const n = nodeEl(el, "lamp");
  n.matches = () => false;
  focusin(n);
  assert.notEqual(tipOf(el).style.opacity, "1");
  el.remove();
});

test("a redraw keeps the label tip for a keyboard-focused node", () => {
  const el = mount();
  const n = nodeEl(el, "lamp");
  n.setAttribute("tabindex", "0");
  n.focus();
  el.nodes = NODES().concat([{ key: "extra", parent: "r", label: "Extra" }]);
  const again = nodeEl(el, "lamp");
  again.matches = () => true;
  el._showFocusTip(again, false);
  assert.equal(tipOf(el).textContent, "Lamp");
  assert.equal(tipOf(el).style.opacity, "1");
  el.remove();
});

test("focus moves to the nearest drawn ancestor, then the root, when the node is gone", () => {
  const nodes = () => [
    { key: "r", label: "Router", status: "online" },
    { key: "hub", parent: "r", label: "Hub", kind: "hub" },
    { key: "leaf", parent: "hub", label: "Leaf" },
  ];
  const el = document.createElement("kepler-ev-test");
  el.nodes = nodes();
  document.body.appendChild(el);
  el._endReveal();
  nodeEl(el, "leaf").setAttribute("tabindex", "0");
  nodeEl(el, "leaf").focus();
  el.nodes = nodes().filter((n) => n.key !== "leaf");
  assert.equal(el.shadowRoot.activeElement, nodeEl(el, "hub"));
  el.shadowRoot.activeElement.setAttribute("tabindex", "0");
  el.nodes = nodes().filter((n) => n.key === "r");
  assert.equal(el.shadowRoot.activeElement, nodeEl(el, "r"));
  el.remove();
});
