import test from "node:test";
import assert from "node:assert/strict";
import { VIEW, ZOOM_MAX, zoomView } from "../src/zoom.js";

const mid = { x: 500, y: 500 };
test("zoom in shrinks the view and keeps the anchor under the pointer", () => {
  const v = zoomView(null, mid, mid, 2);
  assert.ok(Math.abs(v.w - VIEW.w / 2) < 1e-9);
  assert.ok(Math.abs(v.h - VIEW.h / 2) < 1e-9);
  const fx = (mid.x - v.x) / v.w, ofx = (mid.x - VIEW.x) / VIEW.w;
  assert.ok(Math.abs(fx - ofx) < 1e-9);
});
test("zoom clamps to ZOOM_MAX", () => {
  const v = zoomView(null, mid, mid, 100);
  assert.ok(Math.abs(v.w - VIEW.w / ZOOM_MAX) < 1e-9);
});
test("null at full view", () => {
  assert.equal(zoomView(null, mid, mid, 1), null);
  assert.equal(zoomView(null, mid, mid, 0.5), null);
  const v = zoomView(null, mid, mid, 2);
  assert.equal(zoomView(v, mid, mid, 0.1), null);
});
test("pan stays inside the map", () => {
  const v = zoomView(null, mid, mid, 2);
  const p = zoomView(v, { x: 5000, y: 5000 }, { x: 0, y: 0 }, 1);
  assert.ok(p.x + p.w <= VIEW.x + VIEW.w + 1e-9 && p.y + p.h <= VIEW.y + VIEW.h + 1e-9);
  const q = zoomView(v, { x: -5000, y: -5000 }, { x: 0, y: 0 }, 1);
  assert.ok(q.x >= VIEW.x && q.y >= VIEW.y);
});
