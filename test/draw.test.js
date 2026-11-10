import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawMap } from "../src/draw.js";
import { buildTree, FALLBACK_ICON } from "../src/tree.js";
import { resolveIcons, setIconPath, iconPath, resetIconsForTest } from "../src/icons.js";
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

test("interactive nodes carry focus attributes and follow tree.order", () => {
  const long = "A very long device label over twenty-six chars";
  const t = buildTree([
    { key: "r", label: "Router", status: "online" },
    { key: "d0", parent: "r", label: long, status: "online" },
    { key: "h", parent: "r", label: long + " hub", status: "stale", kind: "hub" },
    { key: "d1", parent: "h", label: "", status: "recent" },
    { key: "d2", parent: "r", label: "Q&A <x>", status: "new" },
  ], quiet);
  const plain = drawMap(t, {});
  const out = drawMap(t, { interactive: true });
  const groups = [...out.gfx.matchAll(/<g class="node [^"]*" data-key="([^"]*)"([^>]*)>/g)];
  const drawn = t.order.filter((k) => out.pos[k]);
  assert.deepEqual(groups.map((m) => m[1]), drawn);
  assert.equal(groups.length, 5);
  groups.forEach((m) => {
    const label = t.nodes[m[1]].label || m[1];
    const esc = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    assert.ok(m[2].includes('tabindex="0"') && m[2].includes('role="button"'), m[1]);
    assert.ok(m[2].includes(`aria-label="${esc}"`), m[1] + m[2]);
  });
  assert.ok(out.gfx.includes(`aria-label="${long}"`));
  assert.equal(out.labels, plain.labels);
  assert.equal(out.links, plain.links);
  assert.deepEqual(out.scene, plain.scene);
  assert.ok(!/tabindex|role=|aria-label/.test(plain.gfx + plain.labels + plain.links));
});

// The tests below define a stub ha-icon, so they run after the "ha-icon is undefined" test above.
// The stub renders a path only for names in RESOLVABLE, the way ha-icon fills its shadow tree.
const RESOLVABLE = new Map();
function defineHaIconStub() {
  if (customElements.get("ha-icon")) return;
  customElements.define("ha-icon", class extends HTMLElement {
    connectedCallback() {
      const d = RESOLVABLE.get(this.getAttribute("icon"));
      if (!d || this.shadowRoot) return;
      const root = this.attachShadow({ mode: "open" });
      const inner = document.createElement("ha-svg-icon");
      root.appendChild(inner);
      const innerRoot = inner.attachShadow({ mode: "open" });
      innerRoot.innerHTML = `<svg><path d="${d}"></path></svg>`;
    }
  });
}

function mapWith(icons, connect = true) {
  const host = document.createElement("div");
  host.innerHTML = `<svg class="map">${icons.map((n) => `<g class="ic" data-icon="${n}"><path></path></g>`).join("")}</svg>`;
  if (connect) document.body.appendChild(host);
  return { host, svg: host.querySelector("svg") };
}

const haIcons = (name) => [...document.querySelectorAll("#kepler-iconsrc ha-icon")].filter((el) => el.getAttribute("icon") === name);

function freshIcons() {
  resetIconsForTest();
  const box = document.getElementById("kepler-iconsrc");
  if (box) box.remove();
  defineHaIconStub();
}

test("a detached map is dropped by lookup and its icons are not looked up", () => {
  freshIcons();
  setIconPath("mdi:known", "M1,1");
  const gone = mapWith(["mdi:known"]);
  resolveIcons(gone.svg);
  assert.equal(document.getElementById("kepler-iconsrc"), null);
  gone.host.remove();
  // The detached map gains an icon nobody has looked up; a lookup started by another map must skip it.
  gone.svg.insertAdjacentHTML("beforeend", '<g class="ic" data-icon="mdi:gone-one"><path></path></g>');
  RESOLVABLE.set("mdi:live-one", "M2,2");
  const live = mapWith(["mdi:live-one"]);
  resolveIcons(live.svg);
  assert.equal(haIcons("mdi:gone-one").length, 0);
  assert.equal(iconPath("mdi:live-one"), "M2,2");
  live.host.remove();
});

test("a map registered while detached starts no lookup", () => {
  freshIcons();
  const { svg } = mapWith(["mdi:never-attached"], false);
  resolveIcons(svg);
  assert.equal(haIcons("mdi:never-attached").length, 0);
  assert.equal(iconPath("mdi:never-attached"), undefined);
});

test("an icon that fails after 50 tries is not polled again and leaves no ha-icon behind", (t) => {
  freshIcons();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { host, svg } = mapWith(["mdi:no-such-icon"]);
  resolveIcons(svg);
  assert.equal(haIcons("mdi:no-such-icon").length, 1);
  for (let i = 0; i < 60; i++) t.mock.timers.tick(100);
  assert.equal(haIcons("mdi:no-such-icon").length, 0);
  resolveIcons(svg);
  resolveIcons();
  assert.equal(haIcons("mdi:no-such-icon").length, 0);
  assert.equal(document.querySelectorAll("#kepler-iconsrc ha-icon").length, 0);
  assert.equal(iconPath("mdi:no-such-icon"), undefined);
  host.remove();
});

test("a resolvable icon fills every connected map, including one registered after it resolved", () => {
  freshIcons();
  RESOLVABLE.set("mdi:lamp-ok", "M4,4");
  const a = mapWith(["mdi:lamp-ok"]);
  const b = mapWith(["mdi:lamp-ok", "mdi:lamp-ok"]);
  resolveIcons(a.svg);
  resolveIcons(b.svg);
  assert.equal(iconPath("mdi:lamp-ok"), "M4,4");
  const c = mapWith(["mdi:lamp-ok"]);
  resolveIcons(c.svg);
  [a, b, c].forEach(({ svg }) => svg.querySelectorAll("g.ic path").forEach((p) => assert.equal(p.getAttribute("d"), "M4,4")));
  assert.equal(document.querySelectorAll("#kepler-iconsrc ha-icon").length, 0);
  [a, b, c].forEach(({ host }) => host.remove());
});
