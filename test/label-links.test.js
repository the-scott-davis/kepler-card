import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawMap } from "../src/draw.js";
import { buildTree, snapshotNodes } from "../src/tree.js";
import { home, homeChanged } from "../preview/samples.js";

const quiet = () => {};

const inBox = (links, b) => {
  let n = 0;
  links.forEach((l) => {
    const v = l.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    for (let i = 0; i <= 48; i++) {
      const t = i / 48, u = 1 - t;
      const x = u * u * v[0] + 2 * u * t * v[2] + t * t * v[4];
      const y = u * u * v[1] + 2 * u * t * v[3] + t * t * v[5];
      if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) n++;
    }
  });
  return n;
};

// Per non-root hub: crossings of the chosen label and the minimum over all four sides.
function crossings(nodes) {
  const out = drawMap(buildTree(snapshotNodes(nodes).list, quiet), {});
  const res = [];
  out.scene.hubLabels.forEach((h) => {
    const nd = out.scene.nodes.find((q) => q.k === h.k);
    if (nd.root) return;
    const w = String(h.text).length * 8.6 + 10;
    const boxOf = (x, y1, anchor) => {
      const x0 = anchor === "middle" ? x - w / 2 : anchor === "start" ? x : x - w;
      return { x0, y0: y1 - 16, x1: x0 + w, y1: y1 + 6 };
    };
    const r = nd.r;
    const sides = [
      [nd.x, nd.y + r + 21, "middle"], [nd.x, nd.y - r - 27, "middle"],
      [nd.x + r + 10, nd.y - 2, "start"], [nd.x - r - 10, nd.y - 2, "end"],
    ];
    const min = Math.min(...sides.map((s) => inBox(out.scene.links, boxOf(...s))));
    res.push({ k: h.k, n: inBox(out.scene.links, boxOf(h.x, h.y, h.anchor)), min });
  });
  return res;
}

for (const [name, nodes] of [["home", home], ["home changed", homeChanged]]) {
  test(`${name}: no link passes through a hub label`, () => {
    const res = crossings(nodes);
    assert.ok(res.length > 0);
    assert.deepEqual(res.filter((r) => r.n > r.min), []);
    ["den-ap", "hallway-ap"].forEach((k) => {
      const r = res.find((q) => q.k === k);
      if (r) assert.equal(r.n, r.min, k);
    });
  });
}

test("home: hub labels are deterministic", () => {
  assert.deepEqual(drawMap(buildTree(snapshotNodes(home).list, quiet), {}).scene.hubLabels, drawMap(buildTree(snapshotNodes(home).list, quiet), {}).scene.hubLabels);
});
