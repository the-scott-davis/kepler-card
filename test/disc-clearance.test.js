import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotNodes, buildTree } from "../src/tree.js";
import { layoutTree, DEVICE_RING, CX, CY, HUB_RADIUS, ROOT_RADIUS, DEVICE_RADIUS } from "../src/layout.js";
import { SAMPLES, deep } from "../preview/samples.js";

const HUB_HALO = HUB_RADIUS + 9; // drawn halo radii, see src/draw.js
const DEVICE_HALO = 21;

function dist(L, a, b) {
  return Math.hypot(L.pos[a].x - L.pos[b].x, L.pos[a].y - L.pos[b].y);
}
function build(nodes) {
  const tree = buildTree(snapshotNodes(nodes).list, () => {});
  return { tree, L: layoutTree(tree) };
}
function pairs(tree) {
  const hubs = tree.order.filter((k) => tree.nodes[k].kind === "hub");
  const devs = tree.order.filter((k) => tree.nodes[k].kind !== "hub");
  return { hubs, devs };
}

test("deep: Door sensor keeps a visible gap from the Zigbee coordinator", () => {
  const { L } = build(deep);
  const d = dist(L, "door", "zb");
  assert.ok(d >= HUB_RADIUS + DEVICE_RADIUS + 4, "disc gap " + d);
  assert.ok(d >= HUB_HALO + DEVICE_HALO + 4, "halo gap " + d);
});

test("deep: every device clears every hub", () => {
  const { tree, L } = build(deep);
  const { hubs, devs } = pairs(tree);
  devs.forEach((a) => hubs.forEach((h) => {
    const r = h === tree.root ? ROOT_RADIUS : HUB_RADIUS;
    assert.ok(dist(L, a, h) >= r + DEVICE_RADIUS + 4, a + "/" + h);
  }));
});

test("every sample: no device disc overlaps a hub disc, hubs stay inside the ring", () => {
  Object.keys(SAMPLES).forEach((name) => [SAMPLES[name].nodes, SAMPLES[name].changed].forEach((nodes) => {
    const { tree, L } = build(nodes);
    const { hubs, devs } = pairs(tree);
    devs.forEach((a) => hubs.forEach((h) => {
      const r = h === tree.root ? ROOT_RADIUS : HUB_RADIUS;
      assert.ok(dist(L, a, h) >= r + DEVICE_RADIUS, name + " " + a + "/" + h);
    }));
    hubs.forEach((h) => {
      const r = Math.hypot(L.pos[h].x - CX, L.pos[h].y - CY);
      assert.ok(r + (h === tree.root ? ROOT_RADIUS : HUB_RADIUS) <= DEVICE_RING, name + " " + h);
    });
  }));
});
