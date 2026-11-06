import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { home, homeChanged } from "../../preview/samples.js";

// Loads the built kepler-card.js into a page and drives it the way Home Assistant would.
const code = readFileSync(new URL("../../kepler-card.js", import.meta.url), "utf8");
const ENTITY = "sensor.network_map";

const errors = [];
const win = new JSDOM("<!doctype html><body></body>", {
  runScripts: "outside-only",
  pretendToBeVisual: true,
  url: "http://localhost/",
}).window;
win.console.error = (...a) => errors.push(a.join(" "));
win.eval(code);

// Copy the samples into the page's own realm, as Home Assistant state would be.
const inPage = (nodes) => win.eval("(" + JSON.stringify(nodes) + ")");
const hassWith = (nodes) => ({ states: { [ENTITY]: { attributes: { nodes: inPage(nodes) } } } });

const card = win.document.createElement("kepler-card");
win.document.body.appendChild(card);
const events = [];
card.addEventListener("kepler-node-tap", (e) => events.push("kepler-node-tap:" + e.detail.key));
card.addEventListener("hass-more-info", (e) => events.push("hass-more-info:" + e.detail.entityId));
const q = (sel) => Array.from(card.shadowRoot.querySelectorAll(sel));

test("window.customCards holds one kepler-card entry", () => {
  assert.equal(win.customCards.filter((c) => c.type === "kepler-card").length, 1);
});

test("setConfig then hass draws all 41 nodes", () => {
  card.setConfig({ type: "custom:kepler-card", title: "Home", nodes_entity: ENTITY });
  card.hass = hassWith(home);
  card._endReveal();
  assert.equal(q("g.node[data-key]").length, 41);
});

test("seven hubs and 34 devices", () => {
  assert.equal(q("g.node.hub").length, 7);
  assert.equal(q("g.node.dev").length, 34);
});

test("every node's parent matches the sample", () => {
  home.forEach((n) => {
    const got = card._tree.nodes[n.key];
    assert.ok(got, n.key);
    assert.equal(got.parent, n.parent === undefined ? null : n.parent, n.key);
  });
});

test("a changed attribute redraws on the next hass and an unchanged one does not", () => {
  const n = card._drawCount;
  card.hass = hassWith(home);
  assert.equal(card._drawCount, n);
  card.hass = hassWith(homeChanged);
  assert.equal(card._drawCount, n + 1);
  assert.equal(q("g.node[data-key]").length, 42);
  assert.equal(card._tree.nodes.laptop.parent, "den-ap");
});

test("tapping a node with an entity fires kepler-node-tap then hass-more-info", () => {
  events.length = 0;
  const g = card.shadowRoot.querySelector('g.node[data-key="nas"]');
  g.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.deepEqual(events, ["kepler-node-tap:nas", "hass-more-info:sensor.nas"]);
});

test("nothing was logged at console.error", () => {
  assert.deepEqual(errors, []);
  card.remove();
});
