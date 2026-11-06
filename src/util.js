/** HTML-escape a host string. null and undefined give "". */
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Shorten to at most n characters, ending in an ellipsis. */
export function trunc(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function easeOut(x) {
  return 1 - Math.pow(1 - clamp01(x), 3);
}

/** The map's max height: pixels, or a CSS length like "calc(100vh - 180px)". Anything else is 900px.
 * It lands in a <style> block, so only characters a length needs get through (no ; : { } < > or quotes). */
export function cssHeight(v) {
  if (typeof v === "boolean") return "900px";
  const n = Number(v);
  if (v !== "" && v != null && Number.isFinite(n)) return n > 0 ? `${n}px` : "900px";
  const s = String(v == null ? "" : v).trim();
  if (!/^[a-z0-9\s.,%()+*/-]+$/i.test(s)) return "900px";
  if (s.indexOf("/*") !== -1 || s.indexOf("*/") !== -1) return "900px";
  if (typeof CSS !== "undefined" && CSS.supports && !CSS.supports("max-height", s)) return "900px";
  return s;
}
