import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAIN_GROUP, parseTag, buildChips, activeSelection, matchesSelection, visibleKeys, filterTree
} from "../src/filters.js";
import { layoutTree } from "../src/layout.js";

function mk(defs) {
  const nodes = Object.create(null);
  const order = [];
  defs.forEach(function (d) {
    nodes[d.key] = {
      key: d.key, parent: d.parent || null, status: "online", icon: "mdi:x", label: d.key,
      entity: null, tags: d.tags || [], kind: "device", children: [], source: { key: d.key }
    };
    order.push(d.key);
  });
  order.forEach(function (k) {
    const p = nodes[k].parent;
    if (p) nodes[p].children.push(k);
  });
  order.forEach(function (k) { if (nodes[k].children.length) nodes[k].kind = "hub"; });
  nodes[order[0]].kind = "hub";
  return { root: order[0], nodes: nodes, order: order };
}

const tree = mk([
  { key: "r" },
  { key: "a", parent: "r", tags: ["topology:zigbee", "floor:1"] },
  { key: "b", parent: "a", tags: ["topology:zigbee", "floor:2"] },
  { key: "c", parent: "r", tags: ["topology:wifi", "floor:1"] },
  { key: "d", parent: "c", tags: ["lamp"] },
  { key: "e", parent: "r" }
]);

test("parseTag splits on first colon", () => {
  assert.deepEqual(parseTag("topology:zigbee"), { tag: "topology:zigbee", group: "topology", value: "zigbee" });
  assert.deepEqual(parseTag("a:b:c"), { tag: "a:b:c", group: "a", value: "b:c" });
});

test("parseTag plain and empty sides", () => {
  for (const t of ["lamp", ":x", "x:", ":", " : ", "  :x", "x:  "]) {
    assert.deepEqual(parseTag(t), { tag: t, group: PLAIN_GROUP, value: t });
  }
});

test("buildChips groups, sorts, plain last", () => {
  const chips = buildChips(tree);
  assert.deepEqual(chips.map((g) => g.group), ["floor", "topology", ""]);
  assert.deepEqual(chips[1].chips, [
    { tag: "topology:wifi", value: "wifi" }, { tag: "topology:zigbee", value: "zigbee" }
  ]);
  assert.deepEqual(chips[2].chips, [{ tag: "lamp", value: "lamp" }]);
});

test("buildChips skips whitespace-only tags and follows a changed tree", () => {
  const t = mk([{ key: "r", tags: ["  "] }, { key: "x", parent: "r", tags: ["g:v"] }]);
  assert.deepEqual(buildChips(t), [{ group: "g", chips: [{ tag: "g:v", value: "v" }] }]);
  assert.deepEqual(buildChips(mk([{ key: "r" }])), []);
});

test("rule 1: no selection shows everything and returns same tree", () => {
  assert.equal(filterTree(tree, []), tree);
  assert.equal(filterTree(tree, new Set()), tree);
  assert.equal(visibleKeys(tree, []).size, tree.order.length);
});

test("rule 2 and 3: chain to root kept, untagged hidden", () => {
  const v = visibleKeys(tree, ["topology:zigbee"]);
  assert.deepEqual(Array.from(v).sort(), ["a", "b", "r"]);
  const deep = visibleKeys(tree, ["lamp"]);
  assert.deepEqual(Array.from(deep).sort(), ["c", "d", "r"]);
});

test("either within a group, both across groups", () => {
  assert.deepEqual(Array.from(visibleKeys(tree, ["topology:zigbee", "topology:wifi"])).sort(), ["a", "b", "c", "r"]);
  const both = visibleKeys(tree, ["topology:zigbee", "floor:2"]);
  assert.deepEqual(Array.from(both).sort(), ["a", "b", "r"]);
  assert.ok(matchesSelection(tree.nodes.b, ["topology:zigbee", "floor:2"]));
  assert.ok(!matchesSelection(tree.nodes.a, ["topology:zigbee", "floor:2"]));
});

test("selected tag absent from tree is dropped, then returns", () => {
  const sel = new Set(["gone:x"]);
  assert.deepEqual(activeSelection(tree, sel), []);
  assert.equal(filterTree(tree, sel), tree);
  const t2 = mk([{ key: "r" }, { key: "n", parent: "r", tags: ["gone:x"] }, { key: "o", parent: "r" }]);
  assert.deepEqual(activeSelection(t2, sel), ["gone:x"]);
  assert.deepEqual(Array.from(visibleKeys(t2, sel)).sort(), ["n", "r"]);
  assert.ok(sel.has("gone:x"));
});

test("filterTree prunes without mutating", () => {
  const before = JSON.stringify(tree);
  const f = filterTree(tree, ["floor:2"]);
  assert.equal(JSON.stringify(tree), before);
  assert.deepEqual(f.order, ["r", "a", "b"]);
  assert.deepEqual(f.nodes.r.children, ["a"]);
  assert.equal(f.nodes.a.kind, "hub");
  assert.equal(f.nodes.a.source, tree.nodes.a.source);
  assert.equal(f.nodes.c, undefined);
  assert.equal(f.root, "r");
});

test("a visible node with only hidden children keeps its hub kind", () => {
  const f = filterTree(tree, ["floor:1"]);
  assert.deepEqual(f.order, ["r", "a", "c"]);
  assert.equal(f.nodes.c.kind, "hub");
  assert.deepEqual(f.nodes.c.children, []);
});

test("filterTree marks a hub emptied by the filter", () => {
  const f = filterTree(tree, ["floor:1"]);
  assert.equal(f.nodes.c.emptiedByFilter, true);
  assert.equal(f.nodes.r.emptiedByFilter, undefined);
  assert.equal(tree.nodes.c.emptiedByFilter, undefined);
  const g = filterTree(tree, ["floor:2"]);
  assert.equal(g.nodes.a.emptiedByFilter, undefined);
  assert.equal(g.nodes.r.emptiedByFilter, undefined);
});

test("a hub childless in the source is not marked", () => {
  const t = mk([{ key: "r" }, { key: "h", parent: "r", tags: ["t:x"] }, { key: "d", parent: "r", tags: ["t:x"] }]);
  t.nodes.h.kind = "hub";
  const f = filterTree(t, ["t:x"]);
  assert.ok(f.nodes.h);
  assert.equal(f.nodes.h.emptiedByFilter, undefined);
});

test("no active filter returns the same tree", () => {
  assert.equal(filterTree(tree, []), tree);
});

test("a filter that empties a hub removes its gap slot in layout", () => {
  const t = mk([
    { key: "r" },
    { key: "H", parent: "r", tags: ["t:x"] },
    { key: "d1", parent: "H" },
    { key: "d2", parent: "H" },
    { key: "z", parent: "r", tags: ["t:x"] }
  ]);
  const f = filterTree(t, ["t:x"]);
  assert.deepEqual(f.order, ["r", "H", "z"]);
  const L = layoutTree(f);
  assert.equal(L.N, 1);
  assert.ok(!L.slots.some((s) => s.type === "gap"));
  assert.ok(Number.isFinite(L.pos.H.x) && Number.isFinite(L.pos.H.y));
  const copy = { root: f.root, order: f.order, nodes: Object.assign({}, f.nodes) };
  copy.nodes.H = Object.assign({}, f.nodes.H);
  delete copy.nodes.H.emptiedByFilter;
  assert.equal(L.N, layoutTree(copy).N - 1);
});
