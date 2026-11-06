// Theme variables, defaults and helpers shared by the live view and share output.

export const THEME_VARS = {
  background: "--kepler-background",
  text: "--kepler-text-color",
  online: "--kepler-status-online",
  recent: "--kepler-status-recent",
  stale: "--kepler-status-stale",
  new: "--kepler-status-new",
  unknown: "--kepler-status-unknown",
  font: "--kepler-font-family",
  ring: "--kepler-ring-color",
  link: "--kepler-link-color",
  highlight: "--kepler-highlight-color",
  tooltipBackground: "--kepler-tooltip-background",
  tooltipText: "--kepler-tooltip-text-color"
};

export const THEME_DEFAULTS = {
  background: "radial-gradient(ellipse at 50% 48%, #13213a 0%, #0b1220 55%, #070b14 100%)",
  text: "#e2e8f0",
  online: "#34d399",
  recent: "#fbbf24",
  stale: "#f87171",
  new: "#c084fc",
  unknown: "#64748b",
  font: "Roboto, system-ui, sans-serif",
  ring: "rgba(148,163,184,.07)",
  link: "",
  highlight: "#60a5fa",
  tooltipBackground: "rgba(15,23,42,.96)",
  tooltipText: "#e2e8f0"
};

const STATUS_KEYS = ["online", "recent", "stale", "new", "unknown"];
const BODY_FONT = "--ha-font-family-body";

export function cssVar(key) {
  const name = THEME_VARS[key];
  const def = THEME_DEFAULTS[key];
  if (key === "font") return "var(" + name + ", var(" + BODY_FONT + ", " + def + "))";
  return "var(" + name + ", " + def + ")";
}

export function computedReader(el) {
  return function (name) {
    let cs = null;
    try { cs = getComputedStyle(el); } catch (e) { cs = null; }
    const v = cs ? cs.getPropertyValue(name) : "";
    return typeof v === "string" ? v.trim() : "";
  };
}

export function resolveTheme(read) {
  const get = function (name) {
    const v = read(name);
    return typeof v === "string" ? v.trim() : "";
  };
  const t = {};
  Object.keys(THEME_DEFAULTS).forEach(function (key) {
    if (key === "link" || key === "font") return;
    t[key] = get(THEME_VARS[key]) || THEME_DEFAULTS[key];
  });
  t.link = get(THEME_VARS.link) || null;
  t.font = get(THEME_VARS.font) || get(BODY_FONT) || THEME_DEFAULTS.font;
  return t;
}

export function defaultTheme() {
  return resolveTheme(function () { return ""; });
}

// Split on top-level commas, ignoring commas inside parentheses.
function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|[a-zA-Z]+)/;
const SHAPE_RE = /^(ellipse|circle|closest|farthest|at\s)/i;

function stopOf(part) {
  const m = COLOR_RE.exec(part);
  if (!m) return null;
  const color = m[1];
  const rest = part.slice(color.length).trim();
  const p = /^(-?[\d.]+)%/.exec(rest);
  return { color: color, offset: p ? Math.max(0, Math.min(1, parseFloat(p[1]) / 100)) : null };
}

function firstColor(s) {
  const m = /#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\)/.exec(s);
  return m ? m[0] : null;
}

export function parseBackground(css) {
  const s = typeof css === "string" ? css.trim() : "";
  const fallback = THEME_DEFAULTS.unknown;
  if (!s) return { kind: "solid", color: fallback };
  const m = /^radial-gradient\((.*)\)$/i.exec(s);
  if (m) {
    const stops = [];
    splitTop(m[1]).forEach(function (part, i) {
      if (i === 0 && SHAPE_RE.test(part)) return;
      const st = stopOf(part);
      if (st) stops.push(st);
    });
    if (stops.length >= 2) {
      const n = stops.length;
      return {
        kind: "radial",
        stops: stops.map(function (st, i) {
          return { offset: st.offset === null ? i / (n - 1) : st.offset, color: st.color };
        })
      };
    }
    return { kind: "solid", color: firstColor(s) || fallback };
  }
  if (/gradient\(|url\(/i.test(s)) {
    return { kind: "solid", color: firstColor(s) || fallback };
  }
  return { kind: "solid", color: s };
}

export function statusCss(theme) {
  let out = "";
  STATUS_KEYS.forEach(function (st) {
    let col, link;
    if (theme) {
      col = theme[st];
      link = theme.link || col;
    } else {
      col = "var(" + THEME_VARS[st] + ", " + THEME_DEFAULTS[st] + ")";
      link = "var(" + THEME_VARS.link + ", " + col + ")";
    }
    out += ".lk.st-" + st + "{stroke:" + link + "}";
    out += ".disc.st-" + st + "{stroke:" + col + "}";
    out += ".halo.st-" + st + "{fill:" + col + "}";
    out += ".ic.st-" + st + "{fill:" + col + "}";
  });
  return out;
}
