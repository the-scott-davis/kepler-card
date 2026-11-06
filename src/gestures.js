import { VIEW, zoomView } from "./zoom.js";

// Zoom and pan for the map: buttons, Ctrl or Cmd with the wheel, one-finger or mouse pan, two-finger pinch and a
// double-tap on the background. Only the SVG viewBox changes. The view itself lives with the caller (getView and
// setView, null means the whole map). `enabled: false` keeps viewBox and touch-action in step but wires no gestures.
export function wireZoom(o) {
  const wrap = o.wrap, svg = o.svg, ctl = o.ctl || null;
  const getView = o.getView, setView = o.setView;
  const enabled = o.enabled !== false;
  const noop = function () {};
  const onStart = o.onGestureStart || noop, onEnd = o.onGestureEnd || noop;
  const cleanups = [];
  let destroyed = false;

  const apply = () => {
    const v = getView() || null;
    const b = v || VIEW;
    svg.setAttribute("viewBox", b.x.toFixed(1) + " " + b.y.toFixed(1) + " " + b.w.toFixed(1) + " " + b.h.toFixed(1));
    if (wrap.classList) wrap.classList.toggle("zoomed", !!v);
    // Zoomed in the map takes every touch. Otherwise one finger scrolls the page past it and only a pinch is the map's.
    if (wrap.style) wrap.style.touchAction = v ? "none" : enabled ? "pan-y" : "auto";
  };
  apply();
  if (!enabled) return { apply, destroy() {} };

  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const commit = (v) => { setView(v); apply(); };

  const toMap = (x, y, inv) => {
    if (typeof svg.createSVGPoint !== "function") return null;
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    return pt.matrixTransform(inv);
  };
  const inverse = () => {
    if (typeof svg.getScreenCTM !== "function" || typeof svg.createSVGPoint !== "function") return null;
    const m = svg.getScreenCTM();
    return m ? m.inverse() : null;
  };
  const zoomBy = (factor, at) => {
    const v = getView() || VIEW;
    const f = at || { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    commit(zoomView(getView() || null, f, f, factor));
  };

  if (ctl) {
    const bind = (sel, fn) => { const b = ctl.querySelector(sel); if (b) on(b, "click", fn); };
    bind(".zin", () => zoomBy(1.6));
    bind(".zout", () => zoomBy(1 / 1.6));
    bind(".zfit", () => commit(null));
  }

  on(svg, "wheel", (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return; // a plain wheel keeps scrolling the page
    const inv = inverse();
    if (!inv) return;
    ev.preventDefault();
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? (window.innerHeight || 800) : 1;
    const dy = ev.deltaY * unit;
    const at = toMap(ev.clientX, ev.clientY, inv);
    if (at) zoomBy(Math.exp(Math.max(-0.5, Math.min(0.5, -dy * 0.01))), at);
  }, { passive: false });

  // Safari: a pinch over the map must not zoom the page, and two fingers must not scroll it.
  ["gesturestart", "gesturechange"].forEach((t) => on(svg, t, (ev) => ev.preventDefault()));
  on(svg, "touchmove", (ev) => { if (ev.touches && ev.touches.length > 1 && ev.cancelable) ev.preventDefault(); }, { passive: false });

  const fingers = new Map();
  let g = null, lastTap = null, active = false, swallow = false;

  // While the map takes touches, keep page-level swipe handlers from reading a pan as a swipe.
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((t) => on(svg, t, (ev) => {
    if (getView() || (g && g.pinched)) ev.stopPropagation();
  }, { passive: true }));

  const mid = () => {
    const p = Array.from(fingers.values());
    return p.length > 1
      ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) }
      : { x: p[0].x, y: p[0].y, d: 0 };
  };
  const begin = () => {
    const inv = inverse();
    if (!inv) { g = null; return; }
    const m = mid();
    const anchor = toMap(m.x, m.y, inv);
    if (!anchor) { g = null; return; }
    g = { view: getView() || null, inv, m, anchor, moved: !!(g && g.moved), pinched: !!(g && g.pinched) || fingers.size > 1, captured: !!(g && g.captured) };
  };
  const finish = (acted) => { if (active) { active = false; onEnd(!!acted); } };

  on(svg, "pointerdown", (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    if (!fingers.size) { swallow = false; if (!active) { active = true; onStart(); } }
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (fingers.size > 2) return;
    begin();
  });

  const end = (ev) => {
    if (!fingers.has(ev.pointerId)) return;
    fingers.delete(ev.pointerId);
    if (fingers.size) { begin(); return; } // one finger left after a pinch: carry on panning from here
    const acted = !!(g && (g.moved || g.pinched));
    const onNode = !!(ev.target && ev.target.closest && ev.target.closest(".node"));
    const tap = !!g && !acted && ev.type === "pointerup" && !onNode;
    swallow = acted;
    g = null;
    if (tap) {
      // A second tap on the background within 350 ms zooms in there, or back out to the whole map.
      const ts = ev.timeStamp || 0;
      if (lastTap && ts - lastTap.t < 350 && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 30) {
        lastTap = null;
        if (getView()) commit(null);
        else {
          const inv = inverse();
          const at = inv ? toMap(ev.clientX, ev.clientY, inv) : null;
          if (at) zoomBy(2.5, at);
        }
      } else lastTap = { t: ts, x: ev.clientX, y: ev.clientY };
    }
    finish(acted);
  };

  on(svg, "pointermove", (ev) => {
    if (!g || !fingers.has(ev.pointerId)) return;
    // A mouse button released outside the map before any capture never reaches us as a pointerup.
    if (ev.pointerType === "mouse" && !(ev.buttons & 1)) { end(ev); return; }
    fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const m = mid();
    if (!g.moved && Math.hypot(m.x - g.m.x, m.y - g.m.y) < 6 && Math.abs(m.d - g.m.d) < 6) return;
    g.moved = true;
    if (!g.captured && ev.pointerType === "mouse") {
      g.captured = true;
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* pointer gone */ }
    }
    const factor = g.m.d && m.d ? m.d / g.m.d : 1;
    const now = toMap(m.x, m.y, g.inv);
    if (!now) return;
    commit(zoomView(g.view, g.anchor, now, factor));
  });
  on(svg, "pointerup", end);
  on(svg, "pointercancel", end);
  // Only the svg's own capture ending counts, not a child losing its implicit touch capture.
  on(svg, "lostpointercapture", (ev) => { if (ev.target === svg) end(ev); });
  // A pan or pinch is not a tap on whatever node the finger started on.
  on(svg, "click", (ev) => {
    if (!swallow) return;
    swallow = false;
    ev.stopPropagation();
    ev.preventDefault();
  }, true);

  return {
    apply,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cleanups.forEach((f) => f());
      cleanups.length = 0;
      fingers.clear();
      g = null;
      finish();
    },
  };
}
