import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { snapshotNodes, buildTree } from "../src/tree.js";
import { parseTag } from "../src/filters.js";
import { home, homeChanged, SAMPLES, basic, basicChanged, deep, deepChanged, broken } from "../preview/samples.js";

const html = readFileSync(new URL("../preview/index.html", import.meta.url), "utf8");

function depthOf(tree) {
  let max = 0;
  Object.keys(tree.nodes).forEach((k) => {
    let d = 0;
    for (let n = tree.nodes[k]; n.parent !== null; n = tree.nodes[n.parent]) d++;
    if (d > max) max = d;
  });
  return max;
}

test("index.html loads the built file, the stub first, and preview.js as a module", () => {
  assert.match(html, /<script src="\/kepler-card\.js"><\/script>/);
  assert.match(html, /<script type="module" src="\/preview\/preview\.js"><\/script>/);
  assert.ok(html.indexOf("ha-icon-stub.js") < html.indexOf("/kepler-card.js"));
});

test("good samples parse without warnings and build a tree", () => {
  [basic, basicChanged, deep, deepChanged].forEach((s) => {
    const snap = snapshotNodes(s);
    assert.deepEqual(snap.warnings, []);
    const tree = buildTree(snap.list, () => assert.fail("unexpected warning"));
    assert.ok(tree.root);
    assert.equal(tree.order.length, s.length);
  });
});

test("basic is the design note example", () => {
  const tree = buildTree(snapshotNodes(basic).list);
  assert.equal(tree.root, "router");
  assert.deepEqual(tree.order, ["router", "lamp", "hub-zigbee", "door-sensor"]);
});

test("deep reaches depth five or more", () => {
  assert.ok(depthOf(buildTree(snapshotNodes(deep).list)) >= 5);
});

test("deep has tags in two groups, on nodes with both and with one", () => {
  const tree = buildTree(snapshotNodes(deep).list);
  const groups = new Set();
  let both = 0, one = 0;
  Object.keys(tree.nodes).forEach((k) => {
    const g = new Set(tree.nodes[k].tags.map((t) => parseTag(t).group).filter((x) => x));
    g.forEach((x) => groups.add(x));
    if (g.size >= 2) both++;
    else if (g.size === 1) one++;
  });
  assert.ok(groups.has("topology") && groups.has("floor"));
  assert.ok(both > 0 && one > 0);
});

test("broken logs the duplicate warning and yields a tree", () => {
  const snap = snapshotNodes(broken);
  assert.ok(snap.warnings.length >= 1);
  const warns = [];
  const tree = buildTree(snap.list, (m) => warns.push(m));
  assert.ok(warns.some((w) => /duplicate/i.test(w)));
  assert.equal(tree.root, "root");
  assert.ok(tree.nodes.c1 && tree.nodes.c2 && tree.nodes.self && tree.nodes.orphan);
  assert.equal(tree.nodes.orphan.parent, "root");
  assert.equal(tree.nodes.orphan.status, "unknown");
});

test("home is the default sample with 41 nodes in four tiers", () => {
  assert.equal(Object.keys(SAMPLES)[0], "home");
  assert.match(html, /<select id="sample"><option value="home">/);
  assert.equal(home.length, 41);
  [home, homeChanged].forEach((s) => {
    const snap = snapshotNodes(s);
    assert.deepEqual(snap.warnings, []);
    assert.equal(buildTree(snap.list, () => assert.fail("unexpected warning")).root, "router");
  });
  const tree = buildTree(snapshotNodes(home).list);
  const leaves = Object.keys(tree.nodes).filter((k) => tree.nodes[k].children.length === 0);
  const hubs = Object.keys(tree.nodes).length - leaves.length;
  assert.equal(hubs, 7);
  const counts = {};
  leaves.forEach((k) => { counts[tree.nodes[k].source.status] = (counts[tree.nodes[k].source.status] || 0) + 1; });
  assert.deepEqual(counts, { online: 29, recent: 2, stale: 1, new: 1, possible_hub: 1 });
});

test("share video gets its controls only after the late-frame seek ends", () => {
  const src = readFileSync(new URL("../preview/preview.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function share("), src.indexOf("function currentView"));
  // The native controls draw a loading spinner over the map while the seek runs.
  assert.ok(!/m\.controls\s*=\s*true/.test(fn.replace(/const showControls = \(\) => \{[^}]*\};/, "")), "controls set outside the deferred handler");
  assert.match(fn, /addEventListener\("seeked",\s*showControls/);
  assert.match(fn, /addEventListener\("error",\s*showControls/);
  assert.match(fn, /catch \(e\) \{ showControls\(\); \}/);
  assert.match(fn, /setTimeout\(showControls,\s*2000\)/);
  assert.ok(fn.indexOf('"loadedmetadata"') > fn.indexOf("showControls = "));
});

test("every sample icon has a path in the ha-icon stub", async () => {
  const { FALLBACK_ICON } = await import("../src/tree.js");
  const stub = readFileSync(new URL("../preview/ha-icon-stub.js", import.meta.url), "utf8");
  const names = new Set([FALLBACK_ICON]);
  [home, homeChanged, basic, basicChanged, deep, deepChanged, broken].forEach((sample) => {
    sample.forEach((e) => {
      if (e && typeof e === "object" && typeof e.icon === "string" && e.icon) names.add(e.icon);
    });
  });
  assert.ok(names.size >= 39, "collected " + names.size + " icon names");
  names.forEach((name) => {
    const re = new RegExp('"' + name.replace(/[-:]/g, "\\$&") + '"\\s*:\\s*"M');
    assert.match(stub, re, name + " has no path in the stub");
  });
});

test("the event log wraps long lines", () => {
  const log = html.match(/#log\s*\{([^}]*)\}/);
  assert.ok(log, "#log rule exists");
  assert.match(log[1], /overflow-wrap:\s*anywhere/);
  assert.match(log[1], /word-break:\s*break-word/);
  assert.match(log[1], /height:\s*180px/);
  assert.match(log[1], /overflow:\s*auto/);
  assert.match(html, /fieldset\s*\{[^}]*min-width:\s*0/);
});
