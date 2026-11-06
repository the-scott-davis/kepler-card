import test from "node:test";
import assert from "node:assert/strict";
import { snapshotNodes, buildTree, STATUSES, FALLBACK_ICON } from "../src/tree.js";

const quiet = () => {};
const build = (l, w = quiet) => buildTree(l, w);
const parents = (t) => Object.fromEntries(t.order.map((k) => [k, t.nodes[k].parent]));

test("empty list", () => {
  const t = build([]);
  assert.equal(t.root, null);
  assert.deepEqual(t.order, []);
  assert.equal(Object.keys(t.nodes).length, 0);
});

test("example tree", () => {
  const t = build([
    { key: "router", status: "online", icon: "mdi:router-wireless", label: "Router" },
    { key: "lamp", parent: "router" },
    { key: "hub-zigbee", parent: "router", status: "recent" },
    { key: "door", parent: "hub-zigbee", status: "stale", extra: { a: 1 } },
  ]);
  assert.equal(t.root, "router");
  assert.deepEqual(t.nodes.router.children, ["lamp", "hub-zigbee"]);
  assert.equal(t.nodes["hub-zigbee"].kind, "hub");
  assert.equal(t.nodes.lamp.kind, "device");
  assert.equal(t.nodes.router.kind, "hub");
  assert.deepEqual(t.nodes.door.source.extra, { a: 1 });
  assert.equal(t.nodes.lamp.parent, "router");
});

test("root choice", () => {
  assert.equal(build([{ key: "a" }, { key: "b", kind: "hub" }]).root, "b");
  assert.equal(build([{ key: "a" }, { key: "b" }]).root, "a");
  const t = build([{ key: "a" }, { key: "b" }]);
  assert.equal(t.nodes.b.parent, "a");
  assert.equal(t.nodes.a.parent, null);
});

test("unknown parent attaches to root", () => {
  const t = build([{ key: "r" }, { key: "x", parent: "nope" }]);
  assert.equal(t.nodes.x.parent, "r");
});

test("no parentless node: first is root, parent ignored", () => {
  const t = build([{ key: "a", parent: "b" }, { key: "b", parent: "a" }]);
  assert.equal(t.root, "a");
  assert.equal(t.nodes.a.parent, null);
  assert.equal(t.nodes.b.parent, "a");
});

test("self-parent and cycles attach to root", () => {
  const t = build([
    { key: "r" },
    { key: "s", parent: "s" },
    { key: "a", parent: "c" },
    { key: "b", parent: "a" },
    { key: "c", parent: "b" },
    { key: "leaf", parent: "b" },
  ]);
  assert.deepEqual(parents(t), { r: null, s: "r", a: "r", b: "r", c: "r", leaf: "b" });
  assert.deepEqual(t.nodes.b.children, ["leaf"]);
  assert.deepEqual(t.nodes.r.children, ["s", "a", "b", "c"]);
});

test("duplicate keys keep first and warn once", () => {
  const w = [];
  const t = buildTree([{ key: "a", label: "one" }, { key: "a", label: "two" }, { key: "a" }], (m) => w.push(m));
  assert.equal(t.order.length, 1);
  assert.equal(t.nodes.a.label, "one");
  assert.equal(w.length, 1);
  assert.match(w[0], /^Kepler: /);
});

test("status and icon fallback", () => {
  for (const s of STATUSES) assert.equal(build([{ key: "a", status: s }]).nodes.a.status, s);
  for (const s of ["constructor", "__proto__", "toString", "bogus", 3, null, undefined])
    assert.equal(build([{ key: "a", status: s }]).nodes.a.status, "unknown");
  assert.equal(build([{ key: "a" }]).nodes.a.icon, FALLBACK_ICON);
  assert.equal(build([{ key: "a", icon: "" }]).nodes.a.icon, "mdi:lan-connect");
  assert.equal(build([{ key: "a", icon: "mdi:x" }]).nodes.a.icon, "mdi:x");
});

test("normalisation defaults", () => {
  const n = build([{ key: "a", label: "", entity: "", kind: "weird", tags: ["x", 1] }]).nodes.a;
  assert.equal(n.label, "a");
  assert.equal(n.entity, null);
  assert.equal(n.kind, "hub"); // root
  assert.deepEqual(n.tags, []);
  const m = build([{ key: "r" }, { key: "d", kind: "weird", tags: ["x", "y:z"], entity: "light.a", sort: "1" }]).nodes.d;
  assert.equal(m.kind, "device");
  assert.deepEqual(m.tags, ["x", "y:z"]);
  assert.equal(m.entity, "light.a");
  assert.equal(m.sort, "1");
  const h = build([{ key: "r" }, { key: "h", parent: "r", kind: "hub" }]).nodes.h;
  assert.equal(h.kind, "hub");
  assert.equal(h.children.length, 0);
});

test("keys and parents named constructor and __proto__", () => {
  const t = build([
    { key: "r" },
    { key: "constructor", parent: "r" },
    { key: "__proto__", parent: "constructor" },
    { key: "x", parent: "toString" },
    { key: "y", parent: "__proto__" },
  ]);
  assert.equal(t.root, "r");
  assert.equal(Object.getPrototypeOf(t.nodes), null);
  assert.equal(t.nodes["__proto__"].parent, "constructor");
  assert.equal(t.nodes.x.parent, "r");
  assert.deepEqual(t.nodes["__proto__"].children, ["y"]);
  assert.equal(t.nodes.constructor.kind, "hub");
  const u = build([{ key: "r" }, { key: "a", parent: "constructor" }]);
  assert.equal(u.nodes.a.parent, "r");
  assert.equal(build([{ key: "constructor" }]).root, "constructor");
});

test("buildTree does not mutate the input", () => {
  const input = [{ key: "r", extra: { z: [1] } }, { key: "a", parent: "r", tags: ["t"] }];
  const before = JSON.stringify(input);
  const t = build(input);
  t.nodes.a.source.extra = 1;
  t.nodes.a.tags.push("q");
  assert.equal(JSON.stringify(input), before);
});

test("snapshotNodes copies and validates", () => {
  const input = [{ key: "a", extra: { n: 1 } }, 5, null, [], { label: "x" }, { key: "" }, { key: 4 }];
  const before = JSON.stringify(input);
  const s = snapshotNodes(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(s.list.length, 1);
  assert.notEqual(s.list[0], input[0]);
  assert.notEqual(s.list[0].extra, input[0].extra);
  assert.equal(s.warnings.length, 6);
  for (const i of [1, 2, 3, 4, 5, 6]) assert.ok(s.warnings.some((w) => w.includes("index " + i)));
  assert.ok(s.warnings.every((w) => w.startsWith("Kepler: ")));
});

test("snapshotNodes never throws or logs", () => {
  const orig = console.warn;
  let logged = 0;
  console.warn = () => logged++;
  try {
    const circ = { key: "c" };
    circ.extra = circ;
    const s = snapshotNodes([circ, { key: "ok" }, { key: "big", n: 10n }]);
    assert.deepEqual(s.list.map((e) => e.key), ["ok"]);
    assert.equal(s.warnings.length, 2);
    for (const v of [undefined, null, 1, "x", {}, { length: 1 }]) {
      const r = snapshotNodes(v);
      assert.deepEqual(r.list, []);
      assert.equal(r.warnings.length, 1);
    }
    snapshotNodes([{ key: "t", toJSON: () => undefined }]);
  } finally {
    console.warn = orig;
  }
  assert.equal(logged, 0);
});

test("snapshotNodes sig", () => {
  const a = snapshotNodes([{ key: "a" }]).sig;
  assert.equal(a, snapshotNodes([{ key: "a" }]).sig);
  assert.notEqual(a, snapshotNodes([{ key: "b" }]).sig);
  assert.notEqual(snapshotNodes([]).sig, snapshotNodes("x").sig);
  assert.notEqual(snapshotNodes([{ key: "a" }]).sig, snapshotNodes([{ key: "a" }, 1]).sig);
});
