import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutTree, DEVICE_RING, HUB_RADIUS, ROOT_RADIUS, DEVICE_RADIUS } from "../src/layout.js";
import { filterTree } from "../src/filters.js";

// Build a Tree by hand: specs are [key, parent, kind?, sort?]; the first is the root.
function mk(specs) {
  const nodes = Object.create(null);
  const order = [];
  specs.forEach((s) => {
    nodes[s[0]] = { key: s[0], parent: s[1] || null, label: s[0], kind: s[2] || "device", children: [], status: "online", icon: "mdi:x", entity: null, tags: [], source: {} };
    if (s[3]) nodes[s[0]].sort = s[3];
    order.push(s[0]);
  });
  order.forEach((k) => { const p = nodes[k].parent; if (p) nodes[p].children.push(k); });
  order.forEach((k) => { if (nodes[k].children.length || !nodes[k].parent) nodes[k].kind = "hub"; });
  return { root: order[0] || null, nodes, order };
}
function chain(n, last) {
  const s = [["r", null]];
  for (let i = 1; i <= n; i++) s.push(["h" + i, i === 1 ? "r" : "h" + (i - 1), "hub"]);
  if (last) s.push(["phone", "h" + n]);
  return s;
}
function branched(n) {
  const s = chain(n);
  for (let i = 1; i <= n; i++) { s.push(["d" + i, "h" + i]); s.push(["s" + i, "h" + i, "hub"]); s.push(["sd" + i, "s" + i]); }
  return s;
}
function rad(k, tree) {
  if (tree.nodes[k].kind !== "hub") return DEVICE_RADIUS;
  return k === tree.root ? ROOT_RADIUS : HUB_RADIUS;
}
function noOverlap(tree) {
  const L = layoutTree(tree);
  const hubs = tree.order.filter((k) => tree.nodes[k].kind === "hub");
  hubs.forEach((a, i) => hubs.slice(i + 1).forEach((b) => {
    const d = Math.hypot(L.pos[a].x - L.pos[b].x, L.pos[a].y - L.pos[b].y);
    assert.ok(d >= rad(a, tree) + rad(b, tree), a + "/" + b + " " + d);
  }));
}
function rising(tree) {
  const L = layoutTree(tree);
  tree.order.forEach((k) => {
    const p = tree.nodes[k].parent;
    if (!p || tree.nodes[k].kind !== "hub") return;
    assert.ok(L.pos[k].depth > L.pos[p].depth);
    assert.ok(L.pos[k].r > L.pos[p].r, k + " " + L.pos[k].r + " vs " + L.pos[p].r);
  });
}

test("chain router, switch, access point, phone: rising tiers, phone on device ring", () => {
  const t = mk([["router", null], ["switch", "router"], ["ap", "switch"], ["phone", "ap"]]);
  const L = layoutTree(t);
  assert.deepEqual([L.pos.router.depth, L.pos.switch.depth, L.pos.ap.depth, L.pos.phone.depth], [0, 1, 2, 3]);
  assert.ok(L.pos.switch.r < L.pos.ap.r && L.pos.ap.r < L.pos.phone.r);
  assert.equal(L.pos.phone.r, DEVICE_RING);
  assert.equal(L.pos.phone.hub, "ap");
  assert.equal(t.nodes.ap.kind, "hub");
});

test("hubs inner, devices outer, hub with no children keeps a gap slot", () => {
  const t = mk([["r", null], ["a", "r", "hub"], ["x", "r"]]);
  const L = layoutTree(t);
  assert.ok(L.pos.a.r < DEVICE_RING);
  assert.equal(L.pos.x.r, DEVICE_RING);
  assert.deepEqual(L.slots.filter((s) => s.type === "gap"), [{ type: "gap", hub: "a" }]);
  assert.equal(L.N, 2);
});

test("hidden nodes absent from the Tree leave no gap", () => {
  const full = mk([["r", null], ["a", "r"], ["b", "r"], ["c", "r"]]);
  const part = mk([["r", null], ["a", "r"], ["c", "r"]]);
  assert.equal(layoutTree(full).N, 3);
  const L = layoutTree(part);
  assert.equal(L.N, 2);
  assert.equal(L.pos.b, undefined);
  assert.ok(Math.abs(L.pos.c.a - L.pos.a.a - Math.PI) < 1e-9);
});

test("empty tree", () => {
  const L = layoutTree({ root: null, nodes: Object.create(null), order: [] });
  assert.deepEqual(Object.keys(L.pos), []);
  assert.deepEqual(L.slots, []);
  assert.equal(L.N, 1);
  assert.equal(L.arc, Math.PI * 2 * DEVICE_RING);
  assert.deepEqual(L.center, { x: 500, y: 500 });
});

test("8-level chain: no hub overlap, rising tiers", () => {
  const t = mk(chain(8, true));
  noOverlap(t);
  rising(t);
});

test("8-level tree with side branches at every level", () => {
  const t = mk(branched(8));
  noOverlap(t);
  rising(t);
});

test("12-level chain", () => {
  const t = mk(chain(12, true));
  noOverlap(t);
  rising(t);
});

test("hubs stay inside the device ring", () => {
  [mk(chain(12, true)), mk(branched(8))].forEach((t) => {
    const L = layoutTree(t);
    t.order.filter((k) => t.nodes[k].kind === "hub").forEach((k) => {
      assert.ok(Math.hypot(L.pos[k].x - 500, L.pos[k].y - 500) + HUB_RADIUS <= DEVICE_RING);
    });
  });
});

test("a parent with many children", () => {
  const s = [["r", null], ["sw", "r"]];
  for (let i = 0; i < 40; i++) s.push(["d" + i, "sw"]);
  const L = layoutTree(mk(s));
  assert.equal(L.N, 40);
  assert.ok(L.pos.sw.r < DEVICE_RING);
  for (let i = 0; i < 40; i++) assert.equal(L.pos["d" + i].hub, "sw");
});

test("staggers devices when N > 64", () => {
  const s = [["r", null]];
  for (let i = 0; i < 70; i++) s.push(["d" + String(i).padStart(2, "0"), "r"]);
  const L = layoutTree(mk(s));
  const rs = new Set(Object.keys(L.pos).filter((k) => k !== "r").map((k) => L.pos[k].r));
  assert.deepEqual([...rs].sort(), [DEVICE_RING - 36, DEVICE_RING].sort());
});

test("deterministic, and sorts by sort then label then key", () => {
  const t = mk(branched(8));
  assert.equal(JSON.stringify(layoutTree(t)), JSON.stringify(layoutTree(t)));
  const u = mk([["r", null], ["b", "r", "device", "1"], ["a", "r", "device", "2"]]);
  assert.deepEqual(layoutTree(u).slots.map((s) => s.key), ["b", "a"]);
});

test("a chain of several thousand nodes does not blow the stack", () => {
  const s = [["r", null]];
  for (let i = 1; i <= 4000; i++) s.push(["h" + i, i === 1 ? "r" : "h" + (i - 1)]);
  const L = layoutTree(mk(s));
  assert.equal(L.pos.h4000.depth, 4000);
});

const flag = (t, ...ks) => { ks.forEach((k) => { t.nodes[k].emptiedByFilter = true; }); return t; };
const gaps = (L) => L.slots.filter((s) => s.type === "gap");

test("a hub emptied by a filter gets no gap slot but keeps a position", () => {
  const L = layoutTree(flag(mk([["r", null], ["a", "r", "hub"], ["x", "r"]]), "a"));
  assert.equal(gaps(L).length, 0);
  assert.equal(L.N, 1);
  const p = L.pos.a;
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.a));
  assert.ok(p.r < DEVICE_RING);
});

test("an emptied hub that is the only entry still gets a finite position", () => {
  const L = layoutTree(flag(mk([["r", null], ["a", "r", "hub"]]), "a"));
  assert.deepEqual(L.slots, []);
  assert.equal(L.N, 1);
  assert.ok(Number.isFinite(L.pos.a.a));
});

test("an emptied hub last in the slot list gets a finite position", () => {
  const L = layoutTree(flag(mk([["r", null], ["x", "r", "device", "a"], ["y", "r", "device", "b"], ["z", "r", "hub", "z"]]), "z"));
  assert.equal(L.N, 2);
  assert.ok(Number.isFinite(L.pos.z.x) && Number.isFinite(L.pos.z.y));
});

test("a parent holding only emptied hubs gets no gap slot", () => {
  const L = layoutTree(flag(mk([["r", null], ["p", "r", "hub"], ["h", "p", "hub"], ["x", "r"]]), "h"));
  assert.equal(gaps(L).length, 0);
  assert.equal(L.N, 1);
  assert.ok(L.pos.p && L.pos.h);
});

test("a parent with a visible child keeps no gap", () => {
  const L = layoutTree(flag(mk([["r", null], ["p", "r", "hub"], ["h", "p", "hub"], ["d", "p"]]), "h"));
  assert.deepEqual(L.slots, [{ type: "dev", key: "d", hub: "p" }]);
});

test("a childless kind hub keeps one gap slot when filtered", () => {
  const t = mk([["r", null], ["a", "r", "hub"], ["x", "r"]]);
  t.nodes.a.tags = ["t:x"];
  const L = layoutTree(filterTree(t, ["t:x"]));
  assert.deepEqual(gaps(L), [{ type: "gap", hub: "a" }]);
});

const MIN_HUB_DIST = 2 * HUB_RADIUS + 4;
function spread(L, keys) {
  keys.forEach((k) => {
    const p = L.pos[k];
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.a), k);
  });
  keys.forEach((a, i) => keys.slice(i + 1).forEach((b) => {
    const d = Math.hypot(L.pos[a].x - L.pos[b].x, L.pos[a].y - L.pos[b].y);
    assert.ok(d >= MIN_HUB_DIST - 1e-6, a + "/" + b + " " + d);
  }));
}

test("adjacent emptied sibling hubs at one depth are kept apart", () => {
  const t = flag(mk([
    ["r", null], ["a", "r", "hub", "a"], ["ad", "a"], ["b1", "r", "hub", "b1"], ["b2", "r", "hub", "b2"], ["b3", "r", "hub", "b3"],
    ["c", "r", "hub", "c"], ["cd", "c"], ["cd2", "c"],
  ]), "b1", "b2", "b3");
  const L = layoutTree(t);
  assert.equal(gaps(L).length, 0);
  spread(L, ["a", "b1", "b2", "b3", "c"]);
});

test("emptied sibling hubs first in slot order are kept apart", () => {
  const t = flag(mk([
    ["r", null], ["a1", "r", "hub", "a1"], ["a2", "r", "hub", "a2"], ["a3", "r", "hub", "a3"],
    ["z", "r", "hub", "z"], ["zd", "z"], ["zd2", "z"],
  ]), "a1", "a2", "a3");
  const L = layoutTree(t);
  assert.equal(gaps(L).length, 0);
  spread(L, ["a1", "a2", "a3", "z"]);
});
