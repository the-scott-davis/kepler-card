import "./helpers/dom.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { wireZoom } from "../src/gestures.js";

function setup(extra) {
  const wrap = document.createElement("div");
  wrap.innerHTML = '<svg class="map"><g class="node"><circle/></g></svg><div class="zoomctl"><button class="zin"></button><button class="zout"></button><button class="zfit"></button></div>';
  document.body.appendChild(wrap);
  const svg = wrap.querySelector("svg");
  const ctl = wrap.querySelector(".zoomctl");
  // Identity CTM: client coordinates equal map coordinates.
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } });
  svg.getScreenCTM = () => ({ inverse() { return {}; } });
  const st = { view: null, sets: 0, starts: 0, ends: 0 };
  const z = wireZoom(Object.assign({
    wrap, svg, ctl,
    getView: () => st.view,
    setView: (v) => { st.view = v; st.sets++; },
    onGestureStart: () => st.starts++,
    onGestureEnd: () => st.ends++,
  }, extra));
  return { wrap, svg, ctl, st, z };
}
function ptr(svg, type, x, y, id) {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: 1 });
  Object.defineProperty(e, "pointerId", { value: id || 1 });
  Object.defineProperty(e, "pointerType", { value: "touch" });
  svg.dispatchEvent(e);
}
function wheel(svg, init) {
  const e = new window.WheelEvent("wheel", Object.assign({ bubbles: true, cancelable: true }, init));
  svg.dispatchEvent(e);
  return e;
}

test("initial apply writes viewBox and touch-action", () => {
  const { svg, wrap } = setup();
  assert.equal(svg.getAttribute("viewBox"), "-70.0 -40.0 1140.0 1090.0");
  assert.equal(wrap.style.touchAction, "pan-y");
  assert.ok(!wrap.classList.contains("zoomed"));
});

test("buttons zoom in, out and fit through setView", () => {
  const { ctl, st, svg, wrap } = setup();
  ctl.querySelector(".zin").click();
  assert.ok(st.view && st.view.w < 1140);
  assert.ok(wrap.classList.contains("zoomed"));
  assert.equal(wrap.style.touchAction, "none");
  assert.notEqual(svg.getAttribute("viewBox"), "-70.0 -40.0 1140.0 1090.0");
  ctl.querySelector(".zout").click();
  assert.equal(st.view, null);
  ctl.querySelector(".zin").click();
  ctl.querySelector(".zfit").click();
  assert.equal(st.view, null);
});

test("ctrl wheel zooms, plain wheel does not", () => {
  const { svg, st } = setup();
  wheel(svg, { deltaY: -100 });
  assert.equal(st.view, null);
  const e = wheel(svg, { deltaY: -100, ctrlKey: true, clientX: 500, clientY: 500 });
  assert.ok(st.view);
  assert.ok(e.defaultPrevented);
});

test("pan brackets the gesture and swallows the next click once", () => {
  const { svg, st } = setup();
  st.view = { x: 100, y: 100, w: 570, h: 545 };
  ptr(svg, "pointerdown", 300, 300);
  assert.equal(st.starts, 1);
  ptr(svg, "pointermove", 340, 330);
  assert.notEqual(st.view.x, 100);
  ptr(svg, "pointerup", 340, 330);
  assert.equal(st.ends, 1);
  let seen = 0;
  svg.parentNode.addEventListener("click", () => seen++);
  const c = new MouseEvent("click", { bubbles: true, cancelable: true });
  svg.querySelector("circle").dispatchEvent(c);
  assert.equal(seen, 0);
  assert.ok(c.defaultPrevented);
  svg.querySelector("circle").dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(seen, 1);
});

test("a plain tap does not swallow the click", () => {
  const { svg } = setup();
  ptr(svg, "pointerdown", 300, 300);
  ptr(svg, "pointerup", 300, 300);
  let seen = 0;
  svg.parentNode.addEventListener("click", () => seen++);
  svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(seen, 1);
});

test("pinch zooms in and brackets once", () => {
  const { svg, st } = setup();
  ptr(svg, "pointerdown", 400, 500, 1);
  ptr(svg, "pointerdown", 600, 500, 2);
  ptr(svg, "pointermove", 300, 500, 1);
  ptr(svg, "pointermove", 700, 500, 2);
  assert.ok(st.view && st.view.w < 1140);
  ptr(svg, "pointerup", 300, 500, 1);
  ptr(svg, "pointerup", 700, 500, 2);
  assert.equal(st.starts, 1);
  assert.equal(st.ends, 1);
});

test("does not throw without createSVGPoint or getScreenCTM", () => {
  const { svg, ctl, st } = setup();
  delete svg.createSVGPoint;
  delete svg.getScreenCTM;
  ctl.querySelector(".zin").click();
  assert.ok(st.view);
  wheel(svg, { deltaY: -100, ctrlKey: true });
  ptr(svg, "pointerdown", 1, 1);
  ptr(svg, "pointermove", 50, 50);
  ptr(svg, "pointerup", 50, 50);
});

test("destroy removes listeners", () => {
  const { svg, ctl, st, z } = setup();
  z.destroy();
  ctl.querySelector(".zin").click();
  wheel(svg, { deltaY: -100, ctrlKey: true, clientX: 5, clientY: 5 });
  ptr(svg, "pointerdown", 1, 1);
  assert.equal(st.sets, 0);
  assert.equal(st.starts, 0);
});

test("enabled false wires no gestures", () => {
  const { ctl, st, wrap } = setup({ enabled: false });
  assert.equal(wrap.style.touchAction, "auto");
  ctl.querySelector(".zin").click();
  assert.equal(st.sets, 0);
});
