// The whole map in SVG units. Zooming shows a part of it with the same aspect ratio.
export const VIEW = { x: -70, y: -40, w: 1140, h: 1090 };
export const ZOOM_MAX = 5;

// The view after a zoom or pan gesture. `view` is the view the gesture started from (null = whole map),
// `anchor` the map point under the finger when it started, `now` the map point under it now in that same
// starting view, `factor` how much to zoom in (above 1) or out (below 1). Result stays inside the map and
// is null once zoomed all the way out.
export function zoomView(view, anchor, now, factor, base = VIEW, max = ZOOM_MAX) {
  const v = view || base;
  const scale = Math.min(max, Math.max(1, (base.w / v.w) * factor));
  const w = base.w / scale, h = base.h / scale;
  if (w >= base.w - 0.5) return null;
  const x = anchor.x - (now.x - v.x) * (w / v.w);
  const y = anchor.y - (now.y - v.y) * (h / v.h);
  return {
    x: Math.min(Math.max(x, base.x), base.x + base.w - w),
    y: Math.min(Math.max(y, base.y), base.y + base.h - h),
    w, h,
  };
}
