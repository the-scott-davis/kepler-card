import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { snapshotNodes, buildTree } from "../src/tree.js";
import { parseTag } from "../src/filters.js";
import { basic, basicChanged, deep, deepChanged, broken } from "../preview/samples.js";

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
