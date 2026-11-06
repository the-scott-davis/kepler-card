import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawMap } from "../src/draw.js";
import { buildTree, FALLBACK_ICON } from "../src/tree.js";
import { resolveIcons, setIconPath, iconPath } from "../src/icons.js";
import { defaultTheme } from "../src/theme.js";

const quiet = () => {};
const sample = () => buildTree([
  { key: "r", label: "Router", status: "online", icon: "mdi:router" },
  { key: "h", parent: "r", label: "Hub", status: "stale" },
  { key: "d1", parent: "h", label: "Lamp", status: "online" },
  { key: "d2", parent: "h", label: "Door", status: "bogus", icon: "" },
  { key: "d3", parent: "r", label: "Phone", status: "recent" },
], quiet);

test("empty tree does not throw and gives empty output", () => {
  const out = drawMap(buildTree([], quiet), {});
  assert.equal(out.links, "");
  assert.equal(out.gfx, "");
  assert.equal(out.labels, "");
  assert.deepEqual(out.C, { x: 500, y: 500 });
  assert.deepEqual(out.scene.nodes, []);
});

test("every node and link appears", () => {
  const t = sample();
  const out = drawMap(t, {});
  t.order.forEach((k) => assert.ok(out.gfx.includes(`data-key="${k}"`), k));
  t.order.filter((k) => k !== "r").forEach((k) => assert.ok(out.links.includes(`data-k="${k}"`), k));
  assert.equal(out.scene.nodes.length, 5);
  assert.equal(out.scene.links.length, 4);
  assert.equal(out.scene.hubLabels.length, 2);
  assert.equal(out.scene.devLabels.length, 3);
  assert.ok(out.labels.includes("hlab"));
  assert.ok(out.gfx.includes("dlab"));
});

test("unknown status draws st-unknown and fallback icon reaches data-icon", () => {
  const out = drawMap(sample(), {});
  assert.match(out.gfx, /class="node dev st-unknown" data-key="d2"/);
  assert.ok(out.gfx.includes(`data-icon="${FALLBACK_ICON}"`));
  assert.ok(out.gfx.includes('class="disc st-unknown'));
  assert.ok(out.gfx.includes('class="halo st-online'));
});

test("no stroke or fill colour attributes, live class for online only", () => {
  const out = drawMap(sample(), {});
  assert.ok(!/ (stroke|fill)="/.test(out.links + out.gfx));
  assert.match(out.links, /class="lk st-online live" data-k="d1"/);
  assert.match(out.links, /class="lk st-recent" data-k="d3"/);
  assert.match(out.links, /class="lk st-stale strong" data-k="h"/);
});

test("a link takes the child's status class", () => {
  const out = drawMap(sample(), {});
  assert.match(out.links, /st-stale[^>]*data-k="h"/);
  assert.match(out.links, /st-unknown[^>]*data-k="d2"/);
});

test("scene colours follow opts.theme", () => {
  const theme = Object.assign({}, defaultTheme(), { online: "#010101", stale: "#020202", text: "#030303", link: null });
  const out = drawMap(sample(), { theme });
  const byK = (a, k) => a.find((x) => x.k === k);
  assert.equal(byK(out.scene.nodes, "r").color, "#010101");
  assert.equal(byK(out.scene.nodes, "h").color, "#020202");
  assert.equal(byK(out.scene.links, "h").color, "#020202");
  assert.equal(out.scene.devLabels[0].color, "#030303");
  const t2 = Object.assign({}, theme, { link: "#abcdef" });
  assert.equal(byK(drawMap(sample(), { theme: t2 }).scene.links, "d1").color, "#abcdef");
});

test("host strings are escaped, including markup in a label", () => {
  const t = buildTree([
    { key: 'r"><script>', label: "<img src=x onerror=alert(1)>" },
    { key: "a", parent: 'r"><script>', label: "<b>x</b>", icon: 'mdi:"><i>' },
  ], quiet);
  const out = drawMap(t, {});
  const all = out.links + out.gfx + out.labels;
  assert.ok(!all.includes("<img"));
  assert.ok(!all.includes("<script>"));
  assert.ok(!all.includes("<b>"));
  assert.ok(!all.includes("<i>"));
  assert.ok(all.includes("&lt;img"));
});

test("constructor and __proto__ keys draw", () => {
  const t = buildTree([{ key: "r", label: "R" }, { key: "constructor", parent: "r" }, { key: "__proto__", parent: "r" }], quiet);
  const out = drawMap(t, {});
  assert.equal(out.scene.nodes.length, 3);
});

test("resolveIcons fills registered maps without polling when ha-icon is undefined", () => {
  const out = drawMap(sample(), {});
  const host = document.createElement("div");
  host.innerHTML = `<svg class="map">${out.gfx}</svg>`;
  document.body.appendChild(host);
  const svg = host.querySelector("svg");
  resolveIcons(svg);
  assert.equal(document.getElementById("kepler-iconsrc"), null);
  setIconPath("mdi:router", "M1,1");
  assert.equal(iconPath("mdi:router"), "M1,1");
  const g = svg.querySelector('g.ic[data-icon="mdi:router"]');
  assert.equal(g.firstElementChild.getAttribute("d"), "M1,1");
});
