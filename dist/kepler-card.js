(() => {
  // src/util.js
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function trunc(s, n) {
    s = String(s || "");
    return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
  }
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }
  function easeOut(x) {
    return 1 - Math.pow(1 - clamp01(x), 3);
  }
  function cssHeight(v) {
    if (typeof v === "boolean") return "900px";
    const n = Number(v);
    if (v !== "" && v != null && Number.isFinite(n)) return n > 0 ? `${n}px` : "900px";
    const s = String(v == null ? "" : v).trim();
    if (!/^[a-z0-9\s.,%()+*/-]+$/i.test(s)) return "900px";
    if (s.indexOf("/*") !== -1 || s.indexOf("*/") !== -1) return "900px";
    if (typeof CSS !== "undefined" && CSS.supports && !CSS.supports("max-height", s)) return "900px";
    return s;
  }

  // src/tree.js
  var STATUSES = ["online", "recent", "stale", "new", "unknown"];
  var FALLBACK_ICON = "mdi:lan-connect";
  function isObj(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }
  function nonEmpty(v) {
    return typeof v === "string" && v !== "";
  }
  function copyJson(v) {
    const s = JSON.stringify(v);
    if (typeof s !== "string") throw new Error("not JSON");
    return JSON.parse(s);
  }
  function snapshotNodes(value) {
    const list = [];
    const warnings = [];
    if (!Array.isArray(value)) {
      warnings.push("Kepler: nodes must be an array, drawing an empty map");
    } else {
      for (let i = 0; i < value.length; i++) {
        const e = value[i];
        if (!isObj(e)) {
          warnings.push("Kepler: node at index " + i + " is not an object, skipped");
          continue;
        }
        let c;
        try {
          c = copyJson(e);
        } catch (err) {
          warnings.push("Kepler: node at index " + i + " could not be copied, skipped");
          continue;
        }
        if (!isObj(c) || !nonEmpty(c.key)) {
          warnings.push("Kepler: node at index " + i + " has no non-empty string key, skipped");
          continue;
        }
        list.push(c);
      }
    }
    return { list, sig: JSON.stringify({ list, warnings }), warnings };
  }
  function buildTree(list, warn = console.warn) {
    const nodes = /* @__PURE__ */ Object.create(null);
    const order = [];
    const warned = /* @__PURE__ */ new Set();
    const src = Array.isArray(list) ? list : [];
    for (let i = 0; i < src.length; i++) {
      const e = src[i];
      if (!isObj(e) || !nonEmpty(e.key)) continue;
      const key = e.key;
      if (key in nodes) {
        if (!warned.has(key)) {
          warned.add(key);
          warn("Kepler: duplicate node key " + JSON.stringify(key) + ", keeping the first");
        }
        continue;
      }
      let source;
      try {
        source = copyJson(e);
      } catch (err) {
        source = Object.assign({}, e);
      }
      const status = typeof e.status === "string" && STATUSES.indexOf(e.status) >= 0 ? e.status : "unknown";
      let tags = [];
      if (Array.isArray(e.tags) && e.tags.every(function(t) {
        return typeof t === "string";
      })) {
        tags = e.tags.slice();
      }
      const node = {
        key,
        parent: nonEmpty(e.parent) ? e.parent : null,
        status,
        icon: nonEmpty(e.icon) ? e.icon : FALLBACK_ICON,
        label: nonEmpty(e.label) ? e.label : key,
        entity: nonEmpty(e.entity) ? e.entity : null,
        tags,
        kind: e.kind === "hub" ? "hub" : "device",
        children: [],
        source
      };
      if (typeof e.sort === "string") node.sort = e.sort;
      nodes[key] = node;
      order.push(key);
    }
    if (!order.length) return { root: null, nodes, order };
    let root = null;
    let firstParentless = null;
    for (let i = 0; i < order.length; i++) {
      const n = nodes[order[i]];
      if (n.parent === null) {
        if (firstParentless === null) firstParentless = n.key;
        if (n.kind === "hub") {
          root = n.key;
          break;
        }
      }
    }
    if (root === null) root = firstParentless;
    if (root === null) root = order[0];
    nodes[root].parent = null;
    for (let i = 0; i < order.length; i++) {
      const n = nodes[order[i]];
      if (n.key === root) continue;
      if (n.parent === null || !(n.parent in nodes)) n.parent = root;
    }
    const state = /* @__PURE__ */ new Map();
    const inCycle = /* @__PURE__ */ new Set();
    for (let i = 0; i < order.length; i++) {
      const path = [];
      let k = order[i];
      while (k !== null && !state.has(k)) {
        state.set(k, 1);
        path.push(k);
        k = nodes[k].parent;
      }
      if (k !== null && state.get(k) === 1) {
        const at = path.indexOf(k);
        for (let j = at; j < path.length; j++) inCycle.add(path[j]);
      }
      for (let j = 0; j < path.length; j++) state.set(path[j], 2);
    }
    inCycle.forEach(function(k) {
      nodes[k].parent = root;
    });
    for (let i = 0; i < order.length; i++) {
      const n = nodes[order[i]];
      if (n.parent !== null) nodes[n.parent].children.push(n.key);
    }
    for (let i = 0; i < order.length; i++) {
      const n = nodes[order[i]];
      if (n.key === root || n.children.length) n.kind = "hub";
    }
    return { root, nodes, order };
  }

  // src/filters.js
  var PLAIN_GROUP = "";
  function plain(tag) {
    return { tag, group: PLAIN_GROUP, value: tag };
  }
  function parseTag(tag) {
    const s = String(tag);
    const i = s.indexOf(":");
    if (i < 0) return plain(s);
    const group = s.slice(0, i);
    const value = s.slice(i + 1);
    if (group.trim() === "" || value.trim() === "") return plain(s);
    return { tag: s, group, value };
  }
  function cmp(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function buildChips(tree) {
    const groups = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    tree.order.forEach(function(key) {
      const node = tree.nodes[key];
      if (!node) return;
      node.tags.forEach(function(tag) {
        if (seen.has(tag)) return;
        seen.add(tag);
        if (tag.trim() === "") return;
        const p = parseTag(tag);
        if (!groups.has(p.group)) groups.set(p.group, []);
        groups.get(p.group).push({ tag: p.tag, value: p.value });
      });
    });
    const names = Array.from(groups.keys()).sort(function(a, b) {
      if (a === PLAIN_GROUP) return b === PLAIN_GROUP ? 0 : 1;
      if (b === PLAIN_GROUP) return -1;
      return cmp(a, b);
    });
    return names.map(function(g) {
      const chips = groups.get(g).sort(function(a, b) {
        return cmp(a.value, b.value) || cmp(a.tag, b.tag);
      });
      return { group: g, chips };
    });
  }
  function activeSelection(tree, selected) {
    const want = new Set(selected == null ? [] : Array.from(selected));
    const out = [];
    if (want.size === 0) return out;
    const seen = /* @__PURE__ */ new Set();
    tree.order.forEach(function(key) {
      const node = tree.nodes[key];
      if (!node) return;
      node.tags.forEach(function(tag) {
        if (want.has(tag) && !seen.has(tag)) {
          seen.add(tag);
          out.push(tag);
        }
      });
    });
    return out;
  }
  function matchesSelection(node, active) {
    if (!active || active.length === 0) return true;
    const act = new Set(active);
    const groups = new Set(active.map(function(t) {
      return parseTag(t).group;
    }));
    const tags = node.tags || [];
    let ok = true;
    groups.forEach(function(g) {
      if (!ok) return;
      const hit = tags.some(function(t) {
        return act.has(t) && parseTag(t).group === g;
      });
      if (!hit) ok = false;
    });
    return ok;
  }
  function visibleFor(tree, active) {
    const vis = /* @__PURE__ */ new Set();
    if (active.length === 0) {
      tree.order.forEach(function(k) {
        vis.add(k);
      });
      return vis;
    }
    if (tree.root != null) vis.add(tree.root);
    tree.order.forEach(function(key) {
      const node = tree.nodes[key];
      if (!node || !matchesSelection(node, active)) return;
      let k = key;
      while (k != null && !vis.has(k)) {
        vis.add(k);
        const n = tree.nodes[k];
        k = n ? n.parent : null;
      }
    });
    return vis;
  }
  function filterTree(tree, selected) {
    const active = activeSelection(tree, selected);
    if (active.length === 0) return tree;
    const vis = visibleFor(tree, active);
    const nodes = /* @__PURE__ */ Object.create(null);
    const order = [];
    tree.order.forEach(function(key) {
      if (!vis.has(key)) return;
      const n = tree.nodes[key];
      order.push(key);
      const kids = n.children.filter(function(c) {
        return vis.has(c);
      });
      nodes[key] = Object.assign({}, n, { tags: n.tags.slice(), children: kids });
      if (n.children.length > 0 && kids.length === 0) nodes[key].emptiedByFilter = true;
    });
    return { root: tree.root, nodes, order };
  }

  // src/layout.js
  var CX = 500;
  var CY = 500;
  var DEVICE_RING = 370;
  var ROOT_RADIUS = 32;
  var HUB_RADIUS = 25;
  var DEVICE_RADIUS = 15;
  var HUB_R1 = 110;
  var HUB_STEP = 125;
  var HUB_HALO = HUB_RADIUS + 9;
  var DEVICE_HALO = 21;
  var HUB_R_MAX = DEVICE_RING - HUB_HALO - DEVICE_HALO - 4;
  var GAP = 4;
  var MIN_HUB_DIST = 2 * HUB_RADIUS + GAP;
  function sortKey(n) {
    return String(n.sort != null ? n.sort : n.label);
  }
  function comparator(tree) {
    return function(a, b) {
      const x = sortKey(tree.nodes[a]);
      const y = sortKey(tree.nodes[b]);
      if (x !== y) return x < y ? -1 : 1;
      if (a === b) return 0;
      return a < b ? -1 : 1;
    };
  }
  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }
  function separate(pos, keys) {
    let budget = 4e6;
    for (let iter = 0; iter < 600 && (iter === 0 || budget > 0); iter++) {
      budget -= keys.length * keys.length / 2;
      let moved = false;
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const p = pos[keys[i]];
          const q = pos[keys[j]];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d >= MIN_HUB_DIST) continue;
          const lo = Math.max(1, p.r * q.r * 2);
          const c = (p.r * p.r + q.r * q.r - MIN_HUB_DIST * MIN_HUB_DIST) / lo;
          const need = Math.acos(Math.max(-1, Math.min(1, c)));
          const da = wrap(q.a - p.a);
          const have = Math.abs(da);
          if (have >= need) continue;
          const s = da > 0 ? 1 : da < 0 ? -1 : i % 2 ? -1 : 1;
          const push = (need - have) / 2 + 2e-3;
          p.a -= s * push;
          q.a += s * push;
          [p, q].forEach((z) => {
            z.x = CX + z.r * Math.cos(z.a);
            z.y = CY + z.r * Math.sin(z.a);
          });
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
  function layoutTree(tree, opts) {
    void opts;
    const center = { x: CX, y: CY };
    const pos = /* @__PURE__ */ Object.create(null);
    const depth = /* @__PURE__ */ Object.create(null);
    const finish = (slots2) => {
      const N2 = Math.max(slots2.length, 1);
      return { pos, slots: slots2, N: N2, arc: Math.PI * 2 * DEVICE_RING / N2, depth, center };
    };
    if (!tree || tree.root == null || !tree.nodes[tree.root]) return finish([]);
    const root = tree.root;
    const nodes = tree.nodes;
    const byOrder = comparator(tree);
    const slots = [];
    const range = /* @__PURE__ */ Object.create(null);
    const seen = /* @__PURE__ */ Object.create(null);
    const hubOrder = [];
    const bare = /* @__PURE__ */ Object.create(null);
    const kids = (k) => {
      const list = (nodes[k].children || []).filter((c) => nodes[c]).slice().sort(byOrder);
      return {
        dev: list.filter((c) => nodes[c].kind !== "hub"),
        hub: list.filter((c) => nodes[c].kind === "hub")
      };
    };
    const walk = (top, topDepth) => {
      const stack = [{ k: top, dep: topDepth, kids: null, i: 0, start: 0 }];
      while (stack.length) {
        const f = stack[stack.length - 1];
        if (!f.kids) {
          if (seen[f.k]) {
            stack.pop();
            continue;
          }
          seen[f.k] = true;
          depth[f.k] = f.dep;
          hubOrder.push(f.k);
          f.kids = kids(f.k);
          f.start = slots.length;
          f.kids.dev.forEach((d) => {
            if (seen[d]) return;
            seen[d] = true;
            depth[d] = f.dep + 1;
            slots.push({ type: "dev", key: d, hub: f.k });
          });
        }
        if (f.i < f.kids.hub.length) {
          const c = f.kids.hub[f.i++];
          if (!seen[c]) stack.push({ k: c, dep: f.dep + 1, kids: null, i: 0, start: 0 });
          continue;
        }
        if (slots.length === f.start && f.k !== root) {
          const isBare = nodes[f.k].emptiedByFilter === true || f.kids.dev.length === 0 && f.kids.hub.length > 0 && f.kids.hub.every((c) => bare[c]);
          if (isBare) bare[f.k] = true;
          else slots.push({ type: "gap", hub: f.k });
        }
        range[f.k] = [f.start, slots.length - 1];
        stack.pop();
      }
    };
    walk(root, 0);
    tree.order.forEach((k) => {
      if (seen[k] || !nodes[k]) return;
      if (nodes[k].kind === "hub") walk(k, 1);
      else {
        seen[k] = true;
        depth[k] = 1;
        slots.push({ type: "dev", key: k, hub: root });
      }
    });
    const N = Math.max(slots.length, 1);
    const step = Math.PI * 2 / N;
    const angle = (i) => -Math.PI / 2 + step * i + step / 2;
    const stagger = N > 64;
    pos[root] = { x: CX, y: CY, a: -Math.PI / 2, r: 0, depth: 0 };
    slots.forEach((s, i) => {
      if (s.type !== "dev") return;
      const a = angle(i);
      const r = DEVICE_RING - (stagger && i % 2 ? 36 : 0);
      pos[s.key] = { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), a, r, depth: depth[s.key], hub: s.hub };
    });
    let maxDepth = 1;
    hubOrder.forEach((h) => {
      if (h !== root && depth[h] > maxDepth) maxDepth = depth[h];
    });
    const hubStep = Math.min(HUB_STEP, (HUB_R_MAX - HUB_R1) / Math.max(1, maxDepth - 1));
    const hubKeys = [];
    hubOrder.forEach((h) => {
      if (h === root) return;
      const rg = range[h];
      const a = (angle(Math.max(0, rg[0])) + angle(Math.max(0, rg[1]))) / 2;
      const r = Math.min(HUB_R_MAX, HUB_R1 + (depth[h] - 1) * hubStep);
      pos[h] = { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), a, r, depth: depth[h] };
      hubKeys.push(h);
    });
    separate(pos, hubKeys);
    return finish(slots);
  }

  // src/theme.js
  var THEME_VARS = {
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
  var THEME_DEFAULTS = {
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
  var DISC_FILL = "#0f172a";
  var LABEL_OUTLINE = "#0b1220";
  var STATUS_KEYS = ["online", "recent", "stale", "new", "unknown"];
  var BODY_FONT = "--ha-font-family-body";
  function cssVar(key) {
    const name = THEME_VARS[key];
    const def = THEME_DEFAULTS[key];
    if (key === "font") return "var(" + name + ", var(" + BODY_FONT + ", " + def + "))";
    return "var(" + name + ", " + def + ")";
  }
  function computedReader(el) {
    return function(name) {
      let cs = null;
      try {
        cs = getComputedStyle(el);
      } catch (e) {
        cs = null;
      }
      const v = cs ? cs.getPropertyValue(name) : "";
      return typeof v === "string" ? v.trim() : "";
    };
  }
  function resolveTheme(read) {
    const get = function(name) {
      const v = read(name);
      return typeof v === "string" ? v.trim() : "";
    };
    const t = {};
    Object.keys(THEME_DEFAULTS).forEach(function(key) {
      if (key === "link" || key === "font") return;
      t[key] = get(THEME_VARS[key]) || THEME_DEFAULTS[key];
    });
    t.link = get(THEME_VARS.link) || null;
    t.font = get(THEME_VARS.font) || get(BODY_FONT) || THEME_DEFAULTS.font;
    return t;
  }
  function defaultTheme() {
    return resolveTheme(function() {
      return "";
    });
  }
  function splitTop(s) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if (c === "," && depth === 0) {
        out.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  var COLOR_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|[a-zA-Z]+)/;
  var SHAPE_RE = /^(ellipse|circle|closest|farthest|at\s)/i;
  function stopOf(part) {
    const m = COLOR_RE.exec(part);
    if (!m) return null;
    const color = m[1];
    const rest = part.slice(color.length).trim();
    const p = /^(-?[\d.]+)%/.exec(rest);
    return { color, offset: p ? Math.max(0, Math.min(1, parseFloat(p[1]) / 100)) : null };
  }
  function firstColor(s) {
    const m = /#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^)]*\)/.exec(s);
    return m ? m[0] : null;
  }
  function parseBackground(css) {
    const s = typeof css === "string" ? css.trim() : "";
    const fallback = THEME_DEFAULTS.unknown;
    if (!s) return { kind: "solid", color: fallback };
    const m = /^radial-gradient\((.*)\)$/i.exec(s);
    if (m) {
      const stops = [];
      splitTop(m[1]).forEach(function(part, i) {
        if (i === 0 && SHAPE_RE.test(part)) return;
        const st = stopOf(part);
        if (st) stops.push(st);
      });
      if (stops.length >= 2) {
        const n = stops.length;
        return {
          kind: "radial",
          stops: stops.map(function(st, i) {
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
  function statusCss(theme) {
    let out = "";
    STATUS_KEYS.forEach(function(st) {
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
  function mapCss(text, ring) {
    return [
      ".ring{fill:none;stroke:" + ring + ";stroke-width:1}.lk{fill:none;stroke-width:1.4;opacity:.45}.lk.strong{stroke-width:2.6;opacity:.75}",
      ".disc{fill:" + DISC_FILL + ";stroke-width:2.2}.halo{opacity:.13;filter:url(#kblur)}.hlab{fill:" + text + ";font-size:15px;font-weight:600;text-anchor:middle;paint-order:stroke;stroke:" + LABEL_OUTLINE + ";stroke-width:4px}.dlab{fill:" + text + "}"
    ];
  }

  // src/icons.js
  var PATHS = /* @__PURE__ */ new Map();
  var PENDING = /* @__PURE__ */ new Set();
  var FAILED = /* @__PURE__ */ new Set();
  var MAPS = /* @__PURE__ */ new Set();
  var waiting = false;
  function iconPath(name) {
    return PATHS.get(name);
  }
  function setIconPath(name, d) {
    PATHS.set(name, d);
    MAPS.forEach((svg) => {
      if (!svg.isConnected) {
        MAPS.delete(svg);
        return;
      }
      svg.querySelectorAll("g.ic").forEach((g) => {
        if (g.getAttribute("data-icon") === name && g.firstElementChild) g.firstElementChild.setAttribute("d", d);
      });
    });
  }
  function haIconDefined() {
    return typeof customElements !== "undefined" && !!customElements.get("ha-icon");
  }
  function later(fn, ms) {
    const t = setTimeout(fn, ms);
    if (t && typeof t.unref === "function") t.unref();
  }
  function lookup() {
    const names = [];
    MAPS.forEach((svg) => {
      if (!svg.isConnected) {
        MAPS.delete(svg);
        return;
      }
      svg.querySelectorAll("g.ic").forEach((g) => {
        const n = g.getAttribute("data-icon");
        if (n && names.indexOf(n) === -1) names.push(n);
      });
    });
    const missing = names.filter((n) => !PATHS.has(n) && !FAILED.has(n));
    if (!missing.length) return;
    let box = document.getElementById("kepler-iconsrc");
    if (!box) {
      box = document.createElement("div");
      box.id = "kepler-iconsrc";
      box.setAttribute("aria-hidden", "true");
      box.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
      document.body.appendChild(box);
    }
    missing.forEach((name) => {
      if (PENDING.has(name)) return;
      PENDING.add(name);
      const el = document.createElement("ha-icon");
      el.setAttribute("icon", name);
      box.appendChild(el);
      let tries = 0;
      const poll = () => {
        const inner = el.shadowRoot && el.shadowRoot.querySelector("ha-svg-icon");
        const path = inner && inner.shadowRoot && inner.shadowRoot.querySelector("path");
        const d = path && path.getAttribute("d");
        if (d) {
          PENDING.delete(name);
          el.remove();
          setIconPath(name, d);
        } else if (++tries < 50) {
          later(poll, 100);
        } else {
          PENDING.delete(name);
          FAILED.add(name);
          el.remove();
        }
      };
      poll();
    });
  }
  function resolveIcons(svg) {
    if (svg) {
      MAPS.add(svg);
      PATHS.forEach((d, name) => {
        svg.querySelectorAll("g.ic").forEach((g) => {
          if (g.getAttribute("data-icon") === name && g.firstElementChild && !g.firstElementChild.getAttribute("d")) {
            g.firstElementChild.setAttribute("d", d);
          }
        });
      });
    }
    if (typeof document === "undefined" || typeof customElements === "undefined") return;
    if (haIconDefined()) {
      lookup();
      return;
    }
    if (waiting) return;
    waiting = true;
    customElements.whenDefined("ha-icon").then(() => {
      waiting = false;
      lookup();
    });
  }

  // src/draw.js
  var f1 = (n) => n.toFixed(1);
  function statusOf(s) {
    return typeof s === "string" && STATUSES.indexOf(s) !== -1 ? s : "unknown";
  }
  function drawMap(tree, opts) {
    opts = opts || {};
    const theme = opts.theme || defaultTheme();
    const layout = layoutTree(tree, opts);
    const pos = layout.pos;
    const scene = { C: { x: CX, y: CY }, links: [], nodes: [], hubLabels: [], devLabels: [] };
    const out = { layout, pos, C: scene.C, links: "", gfx: "", labels: "", scene };
    if (!tree || tree.root == null || !pos[tree.root]) return out;
    const root = tree.root;
    const C = pos[root];
    scene.C = C;
    out.C = C;
    const nodes = tree.nodes;
    const col = (s) => theme[s] || theme.unknown;
    const fs = Math.max(9, Math.min(12.5, layout.arc * 0.42));
    const maxChars = layout.N > 60 ? 16 : 22;
    const keys = tree.order.filter((k) => nodes[k] && pos[k]);
    const hubKeys = keys.filter((k) => !pos[k].hub);
    const devKeys = keys.filter((k) => pos[k].hub);
    const curve = (p, q, bend) => {
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      const cx = mx + (C.x - mx) * bend, cy = my + (C.y - my) * bend;
      return `M${f1(p.x)},${f1(p.y)} Q${f1(cx)},${f1(cy)} ${f1(q.x)},${f1(q.y)}`;
    };
    const linkPts = [];
    const link = (k, status, strong, d) => {
      const cls = `st-${status}${status === "online" ? " live" : ""}${strong ? " strong" : ""}`;
      const color = theme.link || col(status);
      out.links += `<path class="lk ${cls}" data-k="${esc(k)}" d="${d}"/>`;
      scene.links.push({ k, cls, d, color });
      const v = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        linkPts.push({ x: u * u * v[0] + 2 * u * t * v[2] + t * t * v[4], y: u * u * v[1] + 2 * u * t * v[3] + t * t * v[5], k });
      }
    };
    hubKeys.forEach((k) => {
      if (k === root) return;
      const n = nodes[k];
      const p = pos[n.parent] && !pos[n.parent].hub ? pos[n.parent] : C;
      link(k, statusOf(n.status), true, curve(p, pos[k], 0));
    });
    devKeys.forEach((k) => {
      const p = pos[pos[k].hub];
      if (!p) return;
      link(k, statusOf(nodes[k].status), false, curve(p, pos[k], 0.18));
    });
    const iconG = (p, r, icon, st) => {
      const size = r * 1.05;
      const d = iconPath(icon);
      return `<g class="ic st-${st}" data-icon="${esc(icon)}" transform="translate(${f1(p.x - size / 2)} ${f1(p.y - size / 2)}) scale(${(size / 24).toFixed(4)})" pointer-events="none"><path d="${d ? esc(d) : ""}"/></g>`;
    };
    const interactive = opts.interactive === true;
    const nodeG = {};
    const a11y = (k, n) => interactive ? ` tabindex="0" role="button" aria-label="${esc(n.label ? String(n.label) : k)}"` : "";
    const placed = [{ x0: C.x - 45, y0: C.y + ROOT_RADIUS + 5, x1: C.x + 45, y1: C.y + ROOT_RADIUS + 30 }];
    hubKeys.forEach((k) => {
      const n = nodes[k];
      const p = pos[k];
      const st = statusOf(n.status);
      const isRoot = k === root;
      const r = isRoot ? ROOT_RADIUS : HUB_RADIUS;
      const icon = n.icon || FALLBACK_ICON;
      const shown = trunc(n.label, 26);
      const w = String(shown).length * 8.6 + 10;
      const box = (s) => {
        const x0 = s.anchor === "middle" ? s.x - w / 2 : s.anchor === "start" ? s.x : s.x - w;
        return { x0, y0: s.y1 - 16, x1: x0 + w, y1: s.y1 + 6 };
      };
      const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      const square = (q, rr) => ({ x0: q.x - rr, y0: q.y - rr, x1: q.x + rr, y1: q.y + rr });
      const discs = hubKeys.filter((o) => o !== k).map((o) => square(pos[o], (o === root ? ROOT_RADIUS : HUB_RADIUS) + 6));
      const near = devKeys.map((d) => pos[d]).filter((q) => Math.abs(q.x - p.x) < 220 && Math.abs(q.y - p.y) < 120).map((q) => square(q, 19));
      const cost = (s) => {
        const b = box(s);
        return placed.reduce((m, o) => m + 4 * overlap(b, o), 0) + discs.reduce((m, o) => m + 3 * overlap(b, o), 0) + near.reduce((m, o) => m + overlap(b, o), 0) + 400 * linkPts.reduce((m, q) => m + (q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1 ? 1 : 0), 0);
      };
      const sides = [
        { x: p.x, y1: p.y + r + 21, anchor: "middle" },
        { x: p.x, y1: p.y - r - 27, anchor: "middle" },
        { x: p.x + r + 10, y1: p.y - 2, anchor: "start" },
        { x: p.x - r - 10, y1: p.y - 2, anchor: "end" }
      ];
      if (!(isRoot || p.y >= C.y - 4)) sides.unshift(sides.splice(1, 1)[0]);
      const pick = isRoot ? sides[0] : sides.find((s) => cost(s) === 0) || sides.reduce((a, s) => cost(s) < cost(a) ? s : a);
      if (!isRoot) placed.push(box(pick));
      nodeG[k] = `<g class="node hub st-${st}${isRoot ? " root" : ""}" data-key="${esc(k)}"${a11y(k, n)}><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r + 9}" class="halo st-${st}"/><circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r}" class="disc st-${st}${st === "stale" ? " pulse" : ""}"/>` + iconG(p, r, icon, st) + `</g>`;
      scene.nodes.push({ k, x: p.x, y: p.y, r, color: col(st), icon, hub: true, root: isRoot, halo: true });
      out.labels += `<g class="hlabels" data-k="${esc(k)}" pointer-events="none"><text x="${f1(pick.x)}" y="${f1(pick.y1)}" class="hlab" style="text-anchor:${pick.anchor}">${esc(shown)}</text></g>`;
      scene.hubLabels.push({ k, x: pick.x, y: pick.y1, text: shown, anchor: pick.anchor });
    });
    devKeys.forEach((k) => {
      const n = nodes[k];
      const p = pos[k];
      const st = statusOf(n.status);
      const live = st === "online";
      const icon = n.icon || FALLBACK_ICON;
      const deg = p.a * 180 / Math.PI;
      const nd = (deg % 360 + 360) % 360;
      const flip = nd > 90 && nd < 270;
      const tr = p.r + 24;
      const tx = C.x + tr * Math.cos(p.a), ty = C.y + tr * Math.sin(p.a);
      const rot = flip ? deg + 180 : deg;
      const text = trunc(n.label, maxChars);
      nodeG[k] = `<g class="node dev st-${st}" data-key="${esc(k)}"${a11y(k, n)}>` + (live ? `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="21" class="halo st-${st}"/>` : "") + `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${DEVICE_RADIUS}" class="disc st-${st}${st === "stale" ? " pulse" : ""}"/>` + iconG(p, DEVICE_RADIUS, icon, st) + `<text x="${f1(tx)}" y="${f1(ty)}" transform="rotate(${f1(rot)} ${f1(tx)} ${f1(ty)})" text-anchor="${flip ? "end" : "start"}" dominant-baseline="middle" class="dlab" style="font-size:${f1(fs)}px">${esc(text)}</text></g>`;
      scene.nodes.push({ k, x: p.x, y: p.y, r: DEVICE_RADIUS, color: col(st), icon, halo: live });
      scene.devLabels.push({ k, x: tx, y: ty, rot, anchor: flip ? "end" : "start", size: fs, text, color: theme.text });
    });
    out.gfx = (interactive ? keys : hubKeys.concat(devKeys)).map((k) => nodeG[k]).join("");
    return out;
  }

  // src/zoom.js
  var VIEW = { x: -70, y: -40, w: 1140, h: 1090 };
  var ZOOM_MAX = 5;
  function zoomView(view, anchor, now, factor, base = VIEW, max = ZOOM_MAX) {
    const v = view || base;
    const scale = Math.min(max, Math.max(1, base.w / v.w * factor));
    const w = base.w / scale, h = base.h / scale;
    if (w >= base.w - 0.5) return null;
    const x = anchor.x - (now.x - v.x) * (w / v.w);
    const y = anchor.y - (now.y - v.y) * (h / v.h);
    return {
      x: Math.min(Math.max(x, base.x), base.x + base.w - w),
      y: Math.min(Math.max(y, base.y), base.y + base.h - h),
      w,
      h
    };
  }
  function panIntoView(view, pos, margin = 50, base = VIEW) {
    if (!view || !pos) return view;
    const axis = (p, v, size, lo, span) => {
      const m = Math.min(margin, size / 2);
      let n = v;
      if (p < v + m) n = p - m;
      else if (p > v + size - m) n = p + m - size;
      return Math.min(Math.max(n, lo), lo + span - size);
    };
    const x = axis(pos.x, view.x, view.w, base.x, base.w);
    const y = axis(pos.y, view.y, view.h, base.y, base.h);
    return x === view.x && y === view.y ? view : { x, y, w: view.w, h: view.h };
  }

  // src/reveal.js
  var REVEAL = { start: 0.12, turn: 2.05, labels: 2.6, end: 4 };
  function beamAngle(C, p) {
    const a = Math.atan2(p.y - C.y, p.x - C.x) + Math.PI / 2;
    return (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  }
  function beamDeg(t) {
    return ((t - REVEAL.start) / REVEAL.turn * 360 % 360 + 360) % 360;
  }
  function revealNode(t, a, reduced) {
    const at = REVEAL.start + a / (2 * Math.PI) * REVEAL.turn;
    const since = (t - at) / 0.35;
    if (since <= 0) return { s: reduced ? 1 : 0, o: 0, draw: 0, at };
    if (reduced) return { s: 1, o: clamp01(since / 1.5), draw: 1, at };
    const k = easeOut(since);
    const s = since >= 1 ? 1 : 0.35 + 0.65 * k + 0.18 * Math.sin(Math.PI * clamp01(since));
    return { s, o: clamp01(since * 1.6), draw: easeOut((t - at) / 0.45), at };
  }
  function revealGlobal(t) {
    return {
      labels: clamp01((t - REVEAL.labels) / 0.5),
      radar: 1 - clamp01((t - REVEAL.start - REVEAL.turn) / 0.5)
    };
  }
  function partialPath(d, f) {
    if (f >= 1) return d;
    const n = (String(d).match(/-?\d+(\.\d+)?/g) || []).map(Number);
    const lerp = (a, b) => a + (b - a) * f;
    const fx = (v) => v.toFixed(1);
    if (n.length === 6) {
      const ax = lerp(n[0], n[2]), ay = lerp(n[1], n[3]);
      const bx = lerp(n[2], n[4]), by = lerp(n[3], n[5]);
      return `M${fx(n[0])},${fx(n[1])} Q${fx(ax)},${fx(ay)} ${fx(ax + (bx - ax) * f)},${fx(ay + (by - ay) * f)}`;
    }
    if (n.length === 4) return `M${fx(n[0])},${fx(n[1])} L${fx(lerp(n[0], n[2]))},${fx(lerp(n[1], n[3]))}`;
    return d;
  }
  function reducedMotion() {
    try {
      return !!(typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }
  function radarSvg(C, jsBeam, color) {
    const R = 420;
    const rad = (d) => (d - 90) * Math.PI / 180;
    let wedges = "";
    const N = 18, SPAN = 70;
    for (let i = 0; i < N; i++) {
      const a0 = (-i - 1) * (SPAN / N), a1 = -i * (SPAN / N);
      wedges += `<path d="M${C.x},${C.y} L${(C.x + R * Math.cos(rad(a0))).toFixed(1)},${(C.y + R * Math.sin(rad(a0))).toFixed(1)} A${R},${R} 0 0 1 ${(C.x + R * Math.cos(rad(a1))).toFixed(1)},${(C.y + R * Math.sin(rad(a1))).toFixed(1)} Z" fill="url(#kfade)" opacity="${(0.42 * (1 - i / N)).toFixed(3)}"/>`;
    }
    const c = String(color == null ? "" : color).replace(/"/g, "&quot;");
    const st = `style="stop-color:${c}"`;
    return `<g class="radar ${jsBeam ? "js" : ""}" pointer-events="none"><defs><radialGradient id="kfade" cx="${C.x}" cy="${C.y}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0" ${st} stop-opacity=".55"/><stop offset="1" ${st} stop-opacity="0"/></radialGradient></defs>` + [130, 250, 370].map((r) => `<circle class="st" cx="${C.x}" cy="${C.y}" r="${r}"/>`).join("") + [1, 2, 3].map((i) => `<circle class="pr p${i}" cx="${C.x}" cy="${C.y}" r="380"/>`).join("") + `<g class="beam"><circle cx="${C.x}" cy="${C.y}" r="${R}" fill="none" stroke="none"/>${wedges}<line x1="${C.x}" y1="${C.y}" x2="${C.x}" y2="${C.y - R}" stroke="#bfdbfe" stroke-width="2" opacity=".7" stroke-linecap="round"/></g></g>`;
  }

  // src/gestures.js
  function wireZoom(o) {
    const wrap2 = o.wrap, svg = o.svg, ctl = o.ctl || null;
    const getView = o.getView, setView = o.setView;
    const enabled = o.enabled !== false;
    const noop = function() {
    };
    const onStart = o.onGestureStart || noop, onEnd = o.onGestureEnd || noop;
    const cleanups = [];
    let destroyed = false;
    const apply = () => {
      const v = getView() || null;
      const b = v || VIEW;
      svg.setAttribute("viewBox", b.x.toFixed(1) + " " + b.y.toFixed(1) + " " + b.w.toFixed(1) + " " + b.h.toFixed(1));
      if (wrap2.classList) wrap2.classList.toggle("zoomed", !!v);
      if (wrap2.style) wrap2.style.touchAction = v ? "none" : enabled ? "pan-y" : "auto";
    };
    apply();
    if (!enabled) return { apply, destroy() {
    } };
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };
    const commit = (v) => {
      setView(v);
      apply();
    };
    const toMap = (x, y, inv) => {
      if (typeof svg.createSVGPoint !== "function") return null;
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
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
      const bind = (sel, fn) => {
        const b = ctl.querySelector(sel);
        if (b) on(b, "click", fn);
      };
      bind(".zin", () => zoomBy(1.6));
      bind(".zout", () => zoomBy(1 / 1.6));
      bind(".zfit", () => commit(null));
    }
    on(svg, "wheel", (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      const inv = inverse();
      if (!inv) return;
      ev.preventDefault();
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? window.innerHeight || 800 : 1;
      const dy = ev.deltaY * unit;
      const at = toMap(ev.clientX, ev.clientY, inv);
      if (at) zoomBy(Math.exp(Math.max(-0.5, Math.min(0.5, -dy * 0.01))), at);
    }, { passive: false });
    ["gesturestart", "gesturechange"].forEach((t) => on(svg, t, (ev) => ev.preventDefault()));
    on(svg, "touchmove", (ev) => {
      if (ev.touches && ev.touches.length > 1 && ev.cancelable) ev.preventDefault();
    }, { passive: false });
    const fingers = /* @__PURE__ */ new Map();
    let g = null, lastTap = null, active = false, swallow = false;
    ["touchstart", "touchmove", "touchend", "touchcancel"].forEach((t) => on(svg, t, (ev) => {
      if (getView() || g && g.pinched) ev.stopPropagation();
    }, { passive: true }));
    const mid = () => {
      const p = Array.from(fingers.values());
      return p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) } : { x: p[0].x, y: p[0].y, d: 0 };
    };
    const begin = () => {
      const inv = inverse();
      if (!inv) {
        g = null;
        return;
      }
      const m = mid();
      const anchor = toMap(m.x, m.y, inv);
      if (!anchor) {
        g = null;
        return;
      }
      g = { view: getView() || null, inv, m, anchor, moved: !!(g && g.moved), pinched: !!(g && g.pinched) || fingers.size > 1, captured: !!(g && g.captured) };
    };
    let winOff = null;
    const unwatch = () => {
      if (winOff) {
        const f = winOff;
        winOff = null;
        f();
      }
    };
    const watch = () => {
      if (winOff) return;
      const h = (ev) => end(ev);
      window.addEventListener("pointerup", h);
      window.addEventListener("pointercancel", h);
      winOff = () => {
        window.removeEventListener("pointerup", h);
        window.removeEventListener("pointercancel", h);
      };
    };
    const finish = (acted) => {
      if (active) {
        active = false;
        onEnd(!!acted);
      }
    };
    on(svg, "pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      if (!fingers.size) {
        swallow = false;
        if (!active) {
          active = true;
          onStart();
        }
      }
      fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (ev.pointerType === "mouse") watch();
      if (fingers.size > 2) return;
      begin();
    });
    const end = (ev) => {
      if (!fingers.has(ev.pointerId)) return;
      fingers.delete(ev.pointerId);
      if (fingers.size) {
        begin();
        return;
      }
      const acted = !!(g && (g.moved || g.pinched));
      const onNode = !!(ev.target && ev.target.closest && ev.target.closest(".node"));
      const tap = !!g && !acted && ev.type === "pointerup" && !onNode;
      swallow = acted;
      g = null;
      unwatch();
      if (tap) {
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
      if (ev.pointerType === "mouse" && !(ev.buttons & 1)) {
        end(ev);
        return;
      }
      fingers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const m = mid();
      if (!g.moved && Math.hypot(m.x - g.m.x, m.y - g.m.y) < 6 && Math.abs(m.d - g.m.d) < 6) return;
      g.moved = true;
      if (!g.captured && ev.pointerType === "mouse") {
        g.captured = true;
        try {
          svg.setPointerCapture(ev.pointerId);
        } catch (e) {
        }
      }
      const factor = g.m.d && m.d ? m.d / g.m.d : 1;
      const now = toMap(m.x, m.y, g.inv);
      if (!now) return;
      commit(zoomView(g.view, g.anchor, now, factor));
    });
    on(svg, "pointerup", end);
    on(svg, "pointercancel", end);
    on(svg, "lostpointercapture", (ev) => {
      if (ev.target === svg) end(ev);
    });
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
        unwatch();
        fingers.clear();
        g = null;
        finish();
      }
    };
  }

  // src/share.js
  var SHARE = { w: 1140, h: 1220, mapY: 80 };
  var REC = { fps: 30, lead: 0.25, tail: 0.8 };
  var SHARE_TYPES = [
    ["television play|cast|chromecast", "Streamer"],
    ["cctv|doorbell|camera|webcam", "Camera"],
    ["television|tv", "TV"],
    ["soundbar", "Soundbar"],
    ["speaker", "Speaker"],
    ["gamepad|playstation|xbox|nintendo|controller", "Console"],
    ["virtual reality", "VR headset"],
    ["thermostat", "Thermostat"],
    ["laptop", "Laptop"],
    ["monitor|desktop", "Computer"],
    ["tablet|book open", "Tablet"],
    ["cellphone|phone|deskphone|iphone", "Phone"],
    ["watch", "Watch"],
    ["printer", "Printer"],
    ["server|nas", "Storage"],
    ["home assistant", "Home Assistant"],
    ["power socket|plug", "Plug"],
    ["lightbulb|lamp|lamps|light|lights|spotlight", "Light"],
    ["air purifier|fan", "Air purifier"],
    ["garage", "Door opener"],
    ["fridge", "Sensor"],
    ["sprinkler", "Sprinkler"],
    ["robot", "Vacuum"],
    ["^home", "Smart home hub"],
    ["weather", "Weather station"],
    ["smoke|alarm|bell ring", "Alarm"],
    ["chip|microchip|esp", "Smart device"],
    ["access point|router|switch", "Network device"]
  ].map(([words, type]) => {
    const start = words[0] === "^";
    return [new RegExp((start ? "^" : "(?:^| )") + "(?:" + words.replace(/^\^/, "") + ")(?= |$)"), type];
  });
  function iconWords(icon) {
    return String(icon || "").toLowerCase().replace(/^mdi:/, "").split(/[^a-z]+/).filter(Boolean).join(" ");
  }
  function shareType(icon) {
    const s = iconWords(icon);
    for (let i = 0; i < SHARE_TYPES.length; i++) if (SHARE_TYPES[i][0].test(s)) return SHARE_TYPES[i][1];
    return "Device";
  }
  var ADDRESS_RE = new RegExp(
    "(?:^|\\D)\\d{1,3}(?:[._-]\\d{1,3}){3}(?!\\d)|[0-9a-f]{2}(?:[:_-][0-9a-f]{2}){5}|(?:^|[^0-9a-z])(?:\\d{1,3}(?:\\.\\d{1,3}){3}|[0-9a-f]{2}(?:[:-][0-9a-f]{2})+|[0-9a-f]{12}|[0-9a-f]{4}(?:\\.[0-9a-f]{4}){2}|[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?|::[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*|(?:[0-9a-f]{1,4}:){3,}[0-9a-f]{1,4})(?:[^0-9a-z]|$)|[ _:.-](?=[0-9a-f]{0,5}\\d)[0-9a-f]{6}(?:[^0-9a-z]|$)",
    "i"
  );
  function safeLabel(s, fallback) {
    const v = String(s == null ? "" : s);
    return ADDRESS_RE.test(v) || !v.trim() ? fallback : v;
  }
  function emptyTree() {
    return { root: null, nodes: /* @__PURE__ */ Object.create(null), order: [] };
  }
  function shareTree(tree, opts) {
    const hide = !opts || opts.hideNames !== false;
    if (!tree || tree.root == null || !tree.nodes[tree.root]) return emptyTree();
    const src = tree.nodes;
    const sk = (k) => src[k] ? String(src[k].sort != null ? src[k].sort : src[k].label) : "";
    const cmp2 = (a, b) => {
      const x = sk(a), y = sk(b);
      if (x !== y) return x < y ? -1 : 1;
      return a === b ? 0 : a < b ? -1 : 1;
    };
    const keys = tree.order.filter((k) => src[k]);
    const others = keys.filter((k) => k !== tree.root).sort(cmp2);
    const ranked = [tree.root].concat(others);
    const keyOf = /* @__PURE__ */ Object.create(null);
    ranked.forEach((k, i) => {
      keyOf[k] = "n" + i;
    });
    const rank = /* @__PURE__ */ Object.create(null);
    others.forEach((k, i) => {
      rank[k] = String(i).padStart(5, "0");
    });
    rank[tree.root] = "-----";
    const generic = /* @__PURE__ */ Object.create(null);
    const byParent = (a, b) => {
      const pa = src[a].parent, pb = src[b].parent;
      if (pa !== pb) return cmp2(pa, pb);
      return cmp2(a, b);
    };
    const seen = /* @__PURE__ */ Object.create(null);
    const number = (list, typeOf) => {
      list.forEach((k) => {
        const type = typeOf(k);
        seen[type] = (seen[type] || 0) + 1;
        generic[k] = type + " " + seen[type];
      });
    };
    const isHubKey = (k) => k === tree.root || src[k].kind === "hub";
    number(others.filter((k) => !isHubKey(k)).sort(byParent), (k) => shareType(src[k].icon));
    number([tree.root].concat(others.filter(isHubKey).sort(byParent)), (k) => {
      const t = shareType(src[k].icon);
      return t === "Device" ? "Hub" : t;
    });
    const out = emptyTree();
    ranked.forEach((k) => {
      const n = src[k];
      const isRoot = k === tree.root;
      const fallback = generic[k];
      const label = hide ? fallback : safeLabel(n.label, fallback);
      const parent = isRoot ? null : keyOf[n.parent] || "n0";
      out.nodes[keyOf[k]] = {
        key: keyOf[k],
        parent,
        status: n.status,
        icon: n.icon,
        label,
        entity: null,
        tags: [],
        kind: n.kind,
        children: [],
        source: {},
        sort: rank[k]
      };
      if (n.emptiedByFilter === true) out.nodes[keyOf[k]].emptiedByFilter = true;
    });
    ranked.forEach((k) => {
      if (k === tree.root) return;
      const node = out.nodes[keyOf[k]];
      out.nodes[node.parent].children.push(node.key);
    });
    out.root = "n0";
    out.order = ranked.map((k) => keyOf[k]);
    return out;
  }
  function cleanValue(v) {
    return String(v == null ? "" : v).replace(/[<>{};\\\u0000-\u001f]/g, "");
  }
  function cleanTheme(theme) {
    const base = defaultTheme();
    const t = theme || base;
    const out = {};
    Object.keys(base).forEach((k) => {
      const v = k === "link" ? t.link == null ? "" : cleanValue(t.link) : cleanValue(t[k] == null ? base[k] : t[k]);
      out[k] = k === "link" ? v || null : v || base[k];
    });
    return out;
  }
  function shareCss(theme) {
    const shared = mapCss(theme.text, theme.ring);
    return statusCss(theme) + shared[0] + ".lk.live{opacity:.8}" + shared[1];
  }
  function bgDefs(bg) {
    if (bg.kind === "solid") return { defs: "", fill: esc(bg.color) };
    const stops = bg.stops.map((s) => `<stop offset="${+s.offset.toFixed(3)}" stop-color="${esc(s.color)}"/>`).join("");
    return { defs: `<radialGradient id="kbg" cx="50%" cy="48%" r="70%">${stops}</radialGradient>`, fill: "url(#kbg)" };
  }
  function shareSvg(tree, opts) {
    opts = opts || {};
    const st = shareTree(tree, opts);
    if (st.root == null) return "";
    const theme = cleanTheme(opts.theme);
    const D = drawMap(st, { theme });
    const W = SHARE.w, H = SHARE.h;
    const bg = bgDefs(parseBackground(theme.background));
    const title = esc(trunc(opts.title == null ? "" : opts.title, 40));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(theme.font)}"><defs>${bg.defs}<filter id="kblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><style>${esc(shareCss(theme))}</style></defs><rect width="${W}" height="${H}" fill="${bg.fill}"/><circle cx="42" cy="39" r="7" fill="${esc(theme.highlight)}"/><text x="62" y="49" font-size="26" font-weight="600" fill="${esc(theme.text)}">${title}</text><svg x="0" y="${SHARE.mapY}" width="1140" height="1090" viewBox="-70 -40 1140 1090"><circle class="ring" cx="${D.C.x}" cy="${D.C.y}" r="370"/>${D.links}${D.gfx}${D.labels}</svg></svg>`;
  }
  var PREPARED = /* @__PURE__ */ new WeakMap();
  function prepare(ctx, scene, theme) {
    const tk = JSON.stringify(theme), c = PREPARED.get(scene);
    if (c && c.tk === tk && c.ctx === ctx) return c;
    const roots = /* @__PURE__ */ new Set();
    scene.nodes.forEach((n) => {
      if (n.root) roots.add(n.k);
    });
    const p = { tk, ctx, roots, bg: null, beam: null, halos: /* @__PURE__ */ new Map(), links: /* @__PURE__ */ new Map(), icons: /* @__PURE__ */ new Map() };
    PREPARED.set(scene, p);
    return p;
  }
  function radial(ctx, x0, y0, r0, x1, y1, r1, stops) {
    const gr = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    stops.forEach((s) => {
      try {
        gr.addColorStop(s[0], s[1]);
      } catch (e) {
      }
    });
    return gr;
  }
  function paintFrame(ctx, scene, t, o) {
    o = o || {};
    const theme = cleanTheme(o.theme);
    const W = SHARE.w, H = SHARE.h;
    const k = ctx.canvas.width / W;
    const C = scene.C;
    const g = revealGlobal(t);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalAlpha = 1;
    const P = prepare(ctx, scene, theme);
    const bg = parseBackground(theme.background);
    if (bg.kind === "radial") {
      if (!P.bg) P.bg = radial(ctx, W / 2, H * 0.48, 0, W / 2, H * 0.48, W * 0.8, bg.stops.map((s) => [s.offset, s.color]));
      ctx.fillStyle = P.bg;
    } else {
      ctx.fillStyle = bg.color;
    }
    ctx.fillRect(0, 0, W, H);
    const font = (size, weight) => `${weight || 400} ${size}px ${theme.font}`;
    const icon = (d, x, y, size, color) => {
      if (!d) return;
      ctx.save();
      ctx.translate(x - size / 2, y - size / 2);
      ctx.scale(size / 24, size / 24);
      ctx.fillStyle = color;
      let p2 = P.icons.get(d);
      if (!p2) P.icons.set(d, p2 = new Path2D(d));
      ctx.fill(p2);
      ctx.restore();
    };
    ctx.fillStyle = theme.highlight;
    ctx.beginPath();
    ctx.arc(42, 39, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = font(26, 600);
    ctx.fillStyle = theme.text;
    ctx.fillText(trunc(o.title == null ? "" : o.title, 40), 62, 49);
    ctx.save();
    ctx.translate(70, SHARE.mapY + 40);
    if (g.radar > 0) {
      ctx.strokeStyle = theme.highlight;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      [130, 250, 370].forEach((r) => {
        ctx.globalAlpha = g.radar * 0.16;
        ctx.beginPath();
        ctx.arc(C.x, C.y, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        const ph = ((t + 10) / 3 + i / 3) % 1;
        ctx.globalAlpha = g.radar * 0.45 * (1 - ph);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(C.x, C.y, 38 + ph * 342, 0, Math.PI * 2);
        ctx.stroke();
      }
      const deg = beamDeg(t);
      const R = 420;
      for (let i = 0; i < 18; i++) {
        const a1 = (deg - i * 70 / 18 - 90) * Math.PI / 180, a0 = a1 - 70 / 18 * Math.PI / 180;
        if (!P.beam) P.beam = radial(ctx, C.x, C.y, 0, C.x, C.y, R, [[0, theme.highlight], [1, "rgba(0,0,0,0)"]]);
        ctx.globalAlpha = g.radar * 0.3 * (1 - i / 18);
        ctx.fillStyle = P.beam;
        ctx.beginPath();
        ctx.moveTo(C.x, C.y);
        ctx.arc(C.x, C.y, R, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      const ab = (deg - 90) * Math.PI / 180;
      ctx.globalAlpha = g.radar * 0.7;
      ctx.strokeStyle = theme.highlight;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(C.x, C.y);
      ctx.lineTo(C.x + R * Math.cos(ab), C.y + R * Math.sin(ab));
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.ring;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(C.x, C.y, 370, 0, Math.PI * 2);
    ctx.stroke();
    const state = {};
    scene.nodes.forEach((n) => {
      state[n.k] = n.root ? { s: 1, o: 1, draw: 1 } : revealNode(t, beamAngle(C, n), false);
    });
    scene.links.forEach((l) => {
      const s = state[l.k];
      if (!s || s.draw <= 0) return;
      const strong = / strong/.test(" " + l.cls);
      ctx.globalAlpha = strong ? 0.75 : / live/.test(" " + l.cls) ? 0.8 : 0.45;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = strong ? 2.6 : 1.4;
      ctx.setLineDash([]);
      if (s.draw >= 1) {
        let lp = P.links.get(l);
        if (!lp) P.links.set(l, lp = new Path2D(partialPath(l.d, 1)));
        ctx.stroke(lp);
      } else ctx.stroke(new Path2D(partialPath(l.d, s.draw)));
    });
    scene.nodes.forEach((n) => {
      const s = state[n.k];
      if (!s || s.o <= 0) return;
      ctx.save();
      ctx.globalAlpha = s.o;
      ctx.translate(n.x, n.y);
      ctx.scale(s.s, s.s);
      ctx.translate(-n.x, -n.y);
      if (n.halo) {
        const hr = n.r + (n.hub ? 16 : 12);
        let gr = P.halos.get(n);
        if (!gr) P.halos.set(n, gr = radial(ctx, n.x, n.y, n.r * 0.6, n.x, n.y, hr, [[0, n.color], [1, "rgba(0,0,0,0)"]]));
        ctx.globalAlpha = s.o * 0.22;
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(n.x, n.y, hr, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = s.o;
      }
      ctx.fillStyle = DISC_FILL;
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      icon(iconPath(n.icon), n.x, n.y, n.r * 1.05, n.color);
      ctx.restore();
    });
    ctx.textBaseline = "middle";
    scene.devLabels.forEach((l) => {
      if (g.labels <= 0) return;
      ctx.save();
      ctx.globalAlpha = g.labels;
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot * Math.PI / 180);
      ctx.textAlign = l.anchor === "end" ? "right" : "left";
      ctx.font = font(l.size);
      ctx.fillStyle = l.color || theme.text;
      ctx.fillText(l.text, 0, 0);
      ctx.restore();
    });
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    scene.hubLabels.forEach((l) => {
      const isRoot = P.roots.has(l.k);
      const a = isRoot ? 1 : g.labels;
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.textAlign = l.anchor === "middle" ? "center" : l.anchor === "end" ? "right" : "left";
      ctx.strokeStyle = LABEL_OUTLINE;
      ctx.lineWidth = 4;
      ctx.font = font(15, 600);
      ctx.fillStyle = theme.text;
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillText(l.text, l.x, l.y);
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function framePump(o) {
    const last = o.frames - 1;
    let i = 0, timer = null, stopped = false, t0 = 0;
    const next = () => {
      timer = null;
      if (stopped) return;
      if (i === 0) t0 = o.now();
      o.frame(Math.max(0, i - o.lead) / o.fps, i);
      if (stopped) return;
      if (i >= last) {
        stopped = true;
        o.done();
        return;
      }
      i++;
      timer = o.later(next, Math.max(0, t0 + i * 1e3 / o.fps - o.now()));
    };
    timer = o.later(next, 0);
    return { stop() {
      stopped = true;
      if (timer !== null) o.clear(timer);
      timer = null;
    } };
  }
  function videoType() {
    try {
      if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement === "undefined" || !HTMLCanvasElement.prototype.captureStream) return null;
      const want = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      for (let i = 0; i < want.length; i++) if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(want[i])) return want[i];
    } catch (e) {
    }
    return null;
  }
  function sharePng(tree, opts) {
    const svg = shareSvg(tree, opts);
    return new Promise((resolve, reject) => {
      if (!svg) {
        reject(new Error("Nothing to share"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 1.5;
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(SHARE.w * scale);
          canvas.height = Math.round(SHARE.h * scale);
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not make the image")), "image/png");
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Could not draw the map"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }
  function shareVideo(tree, opts, onTick, alive) {
    opts = opts || {};
    const type = videoType();
    if (!type) return Promise.reject(new Error("This browser can't record video"));
    const st = shareTree(tree, opts);
    if (st.root == null) return Promise.reject(new Error("Nothing to share"));
    const theme = cleanTheme(opts.theme);
    const scene = drawMap(st, { theme }).scene;
    const paint = { theme, title: opts.title };
    return new Promise((resolve, reject) => {
      let stream = null, rec = null, done = false, pump = null, canvas = null;
      const stopTracks = () => {
        try {
          if (stream) stream.getTracks().forEach((tr) => tr.stop());
        } catch (e) {
        }
      };
      const stopRec = () => {
        try {
          if (rec && rec.state !== "inactive") rec.stop();
        } catch (e) {
        }
      };
      const cleanup = () => {
        if (pump) pump.stop();
        stopTracks();
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      };
      const fail = (e) => {
        if (done) return;
        done = true;
        cleanup();
        reject(e || new Error("Recording failed"));
      };
      try {
        canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = Math.round(960 * SHARE.h / SHARE.w / 2) * 2;
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
        document.body.appendChild(canvas);
        const ctx = canvas.getContext("2d");
        paintFrame(ctx, scene, 0, paint);
        let track = null;
        stream = canvas.captureStream(0);
        track = stream.getVideoTracks && stream.getVideoTracks()[0];
        if (!track || typeof track.requestFrame !== "function") {
          stopTracks();
          track = null;
          stream = canvas.captureStream(REC.fps);
        }
        rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5e6 });
        const chunks = [];
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          if (done) return;
          done = true;
          cleanup();
          resolve(new Blob(chunks, { type: type.split(";")[0] }));
        };
        rec.onerror = (e) => {
          fail(e && e.error);
          stopRec();
        };
        const lead = Math.round(REC.lead * REC.fps);
        const frames = lead + Math.ceil((REVEAL.end + REC.tail) * REC.fps) + 1;
        let lastTick = 0;
        const frame = (t, i) => {
          try {
            if (alive && !alive()) {
              const c = new Error("Cancelled");
              c.cancelled = true;
              fail(c);
              stopRec();
              return;
            }
            paintFrame(ctx, scene, t, paint);
            if (track) track.requestFrame();
            const now = Date.now();
            if (onTick && (now - lastTick >= 250 || i === frames - 1)) {
              lastTick = now;
              onTick(i / (frames - 1));
            }
          } catch (e) {
            fail(e);
            stopRec();
          }
        };
        rec.start(250);
        if (track) track.requestFrame();
        pump = framePump({
          fps: REC.fps,
          frames,
          lead,
          frame,
          done: () => {
            pump = null;
            setTimeout(() => {
              try {
                rec.stop();
              } catch (e) {
                fail(e);
              }
            }, 120);
          },
          now: () => Date.now(),
          later: (fn, ms) => setTimeout(fn, ms),
          clear: (id) => clearTimeout(id)
        });
      } catch (e) {
        fail(e);
        stopRec();
      }
    });
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }
  function deliver(blob, name) {
    const save = () => {
      download(blob, name);
      return "saved";
    };
    let file = null;
    try {
      const f = new File([blob], name, { type: blob.type });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [f] })) file = f;
    } catch (e) {
      file = null;
    }
    if (!file) return Promise.resolve(save());
    return new Promise((res) => res(navigator.share({ files: [file] }))).then(
      () => "shared",
      (e) => e && e.name === "AbortError" ? "cancelled" : save()
    );
  }

  // src/share-panel.js
  function panelCss() {
    const text = cssVar("tooltipText"), hi = cssVar("highlight"), bg = cssVar("tooltipBackground");
    return `.sharepop{position:absolute;top:56px;right:12px;z-index:5;width:min(340px,calc(100% - 24px));box-sizing:border-box;padding:14px;border-radius:12px;background:${bg};color:${text};border:1px solid rgba(148,163,184,.25);font:13px/1.4 ${cssVar("font")};box-shadow:0 8px 28px rgba(0,0,0,.45)}.sharepop .shead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:15px}.sharepop button{font:inherit;color:inherit;cursor:pointer;border:1px solid rgba(148,163,184,.3);background:transparent;border-radius:8px;padding:6px 12px}.sharepop .x{border:0;font-size:20px;padding:0 6px}.sharepop .seg{display:flex;gap:6px;margin-bottom:10px}.sharepop .seg button.on,.sharepop .go{border:2px solid ${hi};padding:5px 11px;color:inherit;font-weight:700}.sharepop .thumb{width:100%;display:block;border-radius:8px;margin-bottom:10px}.sharepop .trow{display:flex;justify-content:space-between;align-items:center;gap:10px}.sharepop .muted{opacity:.7;font-size:12px}.sharepop .tg{width:42px;height:24px;padding:2px;border-radius:12px;text-align:left}.sharepop .tg i{display:block;width:18px;height:18px;border-radius:50%;background:currentColor;opacity:.6}.sharepop .tg.on{border:2px solid ${hi};padding:1px}.sharepop .tg.on i{margin-left:18px;background:${hi};opacity:1}.sharepop .btns{display:flex;gap:8px;margin-top:12px}.sharepop [hidden]{display:none}.sharepop .status{margin-top:8px;min-height:1.4em;font-size:12px}`;
  }
  function openSharePanel(container, api) {
    const old = container.querySelector(".sharepop");
    if (old) old.remove();
    const canCopy = !!(navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined");
    const canVideo = !!api.canVideo;
    const pop = document.createElement("div");
    pop.className = "sharepop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Share your map");
    pop.innerHTML = `<div class="shead"><b>Share your map</b><button class="x" aria-label="Close">&times;</button></div>` + (canVideo ? `<div class="seg"><button class="on" data-m="image">Image</button><button data-m="video">Animation</button></div>` : "") + `<img class="thumb" alt="Preview of the shared map"><div class="trow"><div><div>Hide names</div><div class="muted">Shows "TV 1", "Camera 2" and hub types instead.</div></div><button class="tg on" role="switch" aria-checked="true" aria-label="Hide names"><i></i></button></div><div class="muted" style="margin-top:10px">Keys, entities and tags are never included.</div><div class="btns img"><button class="go dl">Download PNG</button>` + (canCopy ? `<button class="cp">Copy</button>` : "") + `</div>` + (canVideo ? `<div class="btns vid" hidden><button class="go rec">Save video</button></div>` : "") + `<div class="status" aria-live="polite"></div>`;
    const style = document.createElement("style");
    style.textContent = panelCss();
    pop.insertBefore(style, pop.firstChild);
    container.appendChild(pop);
    let hide = true, busy = false, closed = false;
    const q = (s) => pop.querySelector(s);
    const status = (t) => {
      q(".status").textContent = t || "";
    };
    const thumb = () => {
      q(".thumb").src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(api.svg(hide));
    };
    thumb();
    const close = () => {
      if (closed) return;
      closed = true;
      pop.remove();
      if (api.onClose) api.onClose();
    };
    q(".x").addEventListener("click", close);
    q(".tg").addEventListener("click", () => {
      hide = !hide;
      q(".tg").classList.toggle("on", hide);
      q(".tg").setAttribute("aria-checked", String(hide));
      thumb();
    });
    pop.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => {
      pop.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b));
      q(".btns.img").hidden = b.dataset.m !== "image";
      q(".btns.vid").hidden = b.dataset.m !== "video";
      status(b.dataset.m === "video" ? "Records the reveal animation, about 6 seconds." : "");
    }));
    q(".dl").addEventListener("click", () => {
      new Promise((res) => res(api.png(hide))).then((b) => deliver(b, "kepler-map.png")).then(() => {
      }, (e) => status(String(e && e.message || e)));
    });
    if (q(".cp")) q(".cp").addEventListener("click", () => {
      navigator.clipboard.write([new ClipboardItem({ "image/png": api.png(hide) })]).then(() => status("Copied. Paste it anywhere."), (e) => status("Couldn't copy: " + (e && e.message || e)));
    });
    if (q(".rec")) q(".rec").addEventListener("click", () => {
      if (busy) return;
      busy = true;
      q(".rec").disabled = true;
      const reset = () => {
        busy = false;
        q(".rec").disabled = false;
      };
      new Promise((res) => res(api.video(hide, (f) => status(`Recording... ${Math.min(100, Math.round(f * 100))}%`), () => !closed && pop.isConnected))).then((b) => deliver(b, "kepler-map." + (/mp4/.test(b.type) ? "mp4" : "webm"))).then(
        (r) => {
          reset();
          status(r === "shared" ? "Shared." : r === "saved" ? "Saved." : "");
        },
        (e) => {
          reset();
          status(e && e.cancelled ? "" : "Couldn't record: " + (e && e.message || e));
        }
      );
    });
    return { close };
  }

  // src/kepler-card.js
  var DEFAULT_OPTIONS = { title: "", height: 900, zoom: true, show_share: true, more_info: false, filters: false, selected_tags: void 0 };
  var GESTURE_HOLD_MS = 15e3;
  function shellCss() {
    const text = cssVar("text"), hi = cssVar("highlight");
    const shared = mapCss(text, cssVar("ring"));
    return `
:host{display:block}
ha-card{display:block;position:relative;font-family:${cssVar("font")};overflow:hidden;background:${cssVar("background")};color:${text};border:1px solid rgba(148,163,184,.12)}
.head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:16px 18px 4px}
.title{font-size:20px;font-weight:600;margin-right:auto}
.title:empty{display:none}
.sharebtn{font:inherit;font-size:12.5px;padding:4px 12px;border-radius:999px;border:1px solid ${hi};background:transparent;color:${text};cursor:pointer}
.sharebtn[hidden]{display:none}
.sharebtn:disabled{opacity:.45;cursor:default}
.chips{display:flex;flex-wrap:wrap;gap:8px 16px;padding:6px 18px 0}
.chips[hidden]{display:none}
.chipgroup{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.glabel{font-size:11.5px;opacity:.65;margin-right:2px}
.chip{font:inherit;font-size:12.5px;color:${text};background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.14);padding:4px 10px;border-radius:999px;cursor:pointer}
.chip[aria-pressed="true"]{border-color:${hi};background:rgba(96,165,250,.18)}
.wrap{position:relative}
svg.map{font-family:${cssVar("font")};width:100%;height:auto;display:block;max-height:${cssHeight(900)};user-select:none;-webkit-user-select:none}
${shared[0]}
.lk.live{stroke-dasharray:6 10;animation:flow 1.6s linear infinite;opacity:.8}
.lk.strong.live{stroke-dasharray:10 8}
@keyframes flow{to{stroke-dashoffset:-32}}
@keyframes spin{to{transform:rotate(360deg)}}
${shared[1]}
.pulse{animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{50%{stroke-width:5}}
.node{cursor:pointer}
.node:focus{outline:none}
.node:focus-visible{outline:none}
.node:focus-visible .disc{stroke:${hi};stroke-width:3px}
.node:hover .disc{stroke-width:4}
.node:hover .dlab{font-weight:600}
${statusCss(null)}
.zoomctl{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:6px;z-index:1}
.zoomctl button{width:32px;height:32px;padding:0;border-radius:50%;border:1px solid rgba(148,163,184,.3);background:${cssVar("tooltipBackground")};color:${cssVar("tooltipText")};cursor:pointer;display:flex;align-items:center;justify-content:center;font:inherit;font-size:18px;line-height:1}
.zoomctl button:hover{border-color:${hi}}
.zoomctl .zfit{display:none}
.wrap.zoomed .zoomctl .zfit{display:flex}
.zoomctl[hidden]{display:none}
.tip{position:absolute;pointer-events:none;background:${cssVar("tooltipBackground")};border:1px solid rgba(148,163,184,.25);border-radius:10px;padding:8px 12px;font-size:12.5px;line-height:1.5;color:${cssVar("tooltipText")};max-width:280px;box-shadow:0 10px 30px rgba(0,0,0,.45);opacity:0;transition:opacity .12s;z-index:2;overflow-wrap:anywhere}
.radar .st{fill:none;stroke:${hi};stroke-width:1;opacity:.12;stroke-dasharray:2 6}
.radar .pr{fill:none;stroke:${hi};stroke-width:1.5;vector-effect:non-scaling-stroke;opacity:0}
.radar.js .beam,.radar.js .pr{animation:none;transform-box:view-box;transform-origin:0 0}
@media (prefers-reduced-motion:reduce){.lk.live,.pulse{animation:none}.radar .beam,.radar .pr{display:none}.radar .st{opacity:.22}}
`;
  }
  var SHELL = `<style>${shellCss()}</style>
<ha-card>
<div class="head"><div class="title"></div><button class="sharebtn" type="button" title="Share an image or video of the map">Share</button></div>
<div class="chips" hidden></div>
<div class="wrap">
<svg class="map" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" role="group" aria-label="Map"><defs><filter id="kblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs><g class="content"></g></svg>
<div class="tip"></div>
<div class="zoomctl"><button class="zin" type="button" title="Zoom in" aria-label="Zoom in">+</button><button class="zout" type="button" title="Zoom out" aria-label="Zoom out">&minus;</button><button class="zfit" type="button" title="Whole map" aria-label="Whole map">&#9635;</button></div>
</div>
</ha-card>`;
  var KeplerElement = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._opts = Object.assign({}, DEFAULT_OPTIONS);
      this._selected = /* @__PURE__ */ new Set();
      this._list = [];
      this._sig = snapshotNodes([]).sig;
      this._tree = buildTree([]);
      this._view = null;
      this._drawCount = 0;
      this._dirty = true;
      this._chipsDirty = true;
      this._shell = false;
      this._revealing = false;
      this._revealed = false;
      this._revealRun = 0;
      this._revealEnd = null;
      this._gesturing = false;
      this._gestureAt = -Infinity;
      this._timer = null;
      this._zoomOn = null;
      this._zoom = null;
      this._share = null;
      this._shown = null;
      ["options", "nodes"].forEach((p) => {
        if (Object.prototype.hasOwnProperty.call(this, p)) {
          const v = this[p];
          delete this[p];
          this[p] = v;
        }
      });
    }
    get nodes() {
      return copyJson(this._list);
    }
    set nodes(value) {
      const s = snapshotNodes(value);
      if (s.sig === this._sig) return;
      this._sig = s.sig;
      s.warnings.forEach((w) => console.warn(w));
      this._list = s.list;
      this._tree = buildTree(s.list);
      this._syncShare();
      this._chipsDirty = true;
      this._requestDraw();
    }
    get options() {
      const o = Object.assign({}, this._opts);
      if (Array.isArray(o.selected_tags) || this._selected.size) o.selected_tags = Array.from(this._selected);
      return o;
    }
    set options(value) {
      const v = value && typeof value === "object" ? value : {};
      const next = Object.assign({}, DEFAULT_OPTIONS, v);
      if (!Array.isArray(next.selected_tags)) next.selected_tags = void 0;
      const prev = this._opts || {};
      let changed = Object.keys(next).length !== Object.keys(prev).length || Object.keys(next).some((k) => k !== "selected_tags" && next[k] !== prev[k]);
      this._opts = next;
      let sel = null;
      if (Array.isArray(next.selected_tags)) sel = new Set(next.selected_tags.filter((t) => typeof t === "string"));
      else if (Array.isArray(prev.selected_tags)) sel = /* @__PURE__ */ new Set();
      if (sel) {
        if (sel.size !== this._selected.size || [...sel].some((t) => !this._selected.has(t))) changed = true;
        this._selected = sel;
      }
      this._chipsDirty = true;
      this._requestDraw(changed);
    }
    get selectedTags() {
      return Array.from(this._selected);
    }
    // -------------------------------------------------------------- lifecycle
    connectedCallback() {
      if (!this._shell) this._buildShell();
      if (this._shell) this._wireZoom();
      if (this._dirty) this._requestDraw();
    }
    disconnectedCallback() {
      this._endReveal();
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = null;
      }
      if (this._zoom) {
        this._zoom.destroy();
        this._zoom = null;
        this._zoomOn = null;
      }
      this._view = null;
      this._gesturing = false;
      this._gestureAt = -Infinity;
      this._hideTip();
      if (this._share) this._share.close();
    }
    _q(sel) {
      return this.shadowRoot.querySelector(sel);
    }
    _hideTip() {
      const tip = this.shadowRoot && this._q(".tip");
      if (!tip) return;
      tip.style.opacity = "0";
      tip.textContent = "";
    }
    _buildShell() {
      this._shell = true;
      const sr = this.shadowRoot;
      sr.innerHTML = SHELL;
      const svg = this._q("svg.map");
      const tip = this._q(".tip");
      const wrap2 = this._q(".wrap");
      this._q(".sharebtn").addEventListener("click", () => this._toggleShare());
      this._q(".chips").addEventListener("click", (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest("button.chip[data-tag]") : null;
        if (!b) return;
        const tag = b.dataset.tag;
        if (this._selected.has(tag)) this._selected.delete(tag);
        else this._selected.add(tag);
        b.setAttribute("aria-pressed", String(this._selected.has(tag)));
        this._endReveal();
        this._draw();
      });
      const nodeAt = (ev) => {
        const el = ev.target && ev.target.closest ? ev.target.closest(".node[data-key]") : null;
        return el ? el : null;
      };
      const tap = (el) => {
        const node = el ? this._tree.nodes[el.dataset.key] : null;
        if (!node) return;
        const ev = new CustomEvent("kepler-node-tap", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { key: node.key, node: copyJson(node.source) }
        });
        const ok = this.dispatchEvent(ev);
        if (ok && this._opts.more_info && node.entity) {
          this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: node.entity } }));
        }
      };
      svg.addEventListener("click", (ev) => tap(nodeAt(ev)));
      svg.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
        if (ev.repeat || ev.ctrlKey || ev.altKey || ev.metaKey) return;
        const el = nodeAt(ev);
        if (!el) return;
        if (ev.key !== "Enter") ev.preventDefault();
        tap(el);
      });
      const place = (ev) => {
        const r = wrap2.getBoundingClientRect();
        let x = (ev.clientX || 0) - r.left + 14, y = (ev.clientY || 0) - r.top + 14;
        if (x + 200 > r.width) x -= 224;
        tip.style.left = Math.max(4, x) + "px";
        tip.style.top = Math.max(4, y) + "px";
      };
      this._showFocusTip = (el, pan) => {
        const node = el ? this._tree.nodes[el.dataset.key] : null;
        if (!node) return;
        let kb = true;
        try {
          kb = el.matches(":focus-visible");
        } catch (e) {
          kb = true;
        }
        if (!kb) return;
        if (pan) this._panIntoView(node.key);
        tip.textContent = node.label;
        tip.style.opacity = "1";
        const d = el.querySelector(".disc") || el, b = d.getBoundingClientRect();
        place({ clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
      };
      svg.addEventListener("focusin", (ev) => this._showFocusTip(nodeAt(ev), !this._restoringFocus));
      svg.addEventListener("focusout", (ev) => {
        const to = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest(".node[data-key]") : null;
        if (!to) tip.style.opacity = "0";
      });
      svg.addEventListener("mouseover", (ev) => {
        const el = nodeAt(ev);
        const node = el ? this._tree.nodes[el.dataset.key] : null;
        if (!node) return;
        tip.textContent = node.label;
        tip.style.opacity = "1";
        place(ev);
      });
      svg.addEventListener("mousemove", (ev) => {
        if (nodeAt(ev)) place(ev);
      });
      svg.addEventListener("mouseout", (ev) => {
        const to = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest(".node[data-key]") : null;
        if (!to) tip.style.opacity = "0";
      });
    }
    /** With zoom on, pans the view the least that brings a node into it. */
    _panIntoView(key) {
      if (!this._view || !this._zoom || !this._drawn) return;
      const v = panIntoView(this._view, this._drawn.pos[key]);
      if (v === this._view) return;
      this._view = v;
      this._zoom.apply();
    }
    _wireZoom() {
      const on = this._opts.zoom !== false;
      if (this._zoom && this._zoomOn === on) return;
      if (this._zoom) this._zoom.destroy();
      if (!on) this._view = null;
      this._zoomOn = on;
      this._zoom = wireZoom({
        wrap: this._q(".wrap"),
        svg: this._q("svg.map"),
        ctl: on ? this._q(".zoomctl") : null,
        enabled: on,
        getView: () => this._view,
        setView: (v) => {
          this._view = v;
        },
        onGestureStart: () => {
          this._gesturing = true;
        },
        onGestureEnd: (acted) => {
          this._gesturing = false;
          if (acted) {
            this._gestureAt = Date.now();
            return;
          }
          if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
          }
          if (this._dirty) this._requestDraw();
        }
      });
      this._q(".zoomctl").hidden = !on;
      this._zoom.apply();
    }
    // -------------------------------------------------------------- drawing
    /** Runs fn, then makes one draw request for every change made inside it (urgent if any was). */
    _batch(fn) {
      this._batchDepth = (this._batchDepth || 0) + 1;
      try {
        fn();
      } finally {
        this._batchDepth--;
        if (this._batchDepth === 0 && this._batchWant) {
          const urgent = this._batchUrgent;
          this._batchWant = false;
          this._batchUrgent = false;
          this._requestDraw(urgent);
        }
      }
    }
    _requestDraw(urgent) {
      this._dirty = true;
      if (this._batchDepth > 0) {
        this._batchWant = true;
        if (urgent) this._batchUrgent = true;
        return;
      }
      if (!this.isConnected || !this._shell) return;
      if (urgent) {
        if (this._timer) {
          clearTimeout(this._timer);
          this._timer = null;
        }
        this._dirty = false;
        this._endReveal();
        this._dirty = true;
        this._draw();
        return;
      }
      const age = Date.now() - this._gestureAt;
      if (this._revealing) return;
      if (this._gesturing || age < GESTURE_HOLD_MS) {
        if (!this._timer) {
          const wait = this._gesturing ? GESTURE_HOLD_MS : GESTURE_HOLD_MS - age + 20;
          this._timer = setTimeout(() => {
            this._timer = null;
            if (this._dirty) this._requestDraw();
          }, wait);
          if (this._timer && typeof this._timer.unref === "function") this._timer.unref();
        }
        return;
      }
      this._draw();
    }
    _viewTree() {
      return this._opts.filters ? filterTree(this._tree, this._selected) : this._tree;
    }
    _hasRoot() {
      const t = this._tree ? this._viewTree() : null;
      return !!(t && t.root != null && t.nodes && t.nodes[t.root]);
    }
    // Button state follows the view tree; also called straight from the data setter.
    _syncShare() {
      if (!this._shell) return;
      const btn = this._q(".sharebtn");
      const empty = !this._hasRoot();
      btn.disabled = empty;
      btn.title = empty ? "Nothing to share yet" : "Share an image or video of the map";
      if (empty && this._share) this._share.close();
    }
    _applyOptions() {
      const o = this._opts;
      this._q(".title").textContent = o.title == null ? "" : String(o.title);
      this._q(".sharebtn").hidden = o.show_share === false;
      this._syncShare();
      this._q("svg.map").style.maxHeight = cssHeight(o.height);
      this._wireZoom();
      if (o.show_share === false && this._share) this._share.close();
    }
    _renderChips() {
      const box = this._q(".chips");
      const on = !!this._opts.filters;
      const key = on ? "on" : "off";
      if (this._chipsDirty || this._shown !== key) {
        this._chipsDirty = false;
        this._shown = key;
        box.textContent = "";
        if (on) {
          buildChips(this._tree).forEach((g) => {
            const grp = document.createElement("div");
            grp.className = "chipgroup";
            grp.setAttribute("data-group", g.group);
            if (g.group !== "") {
              const l = document.createElement("span");
              l.className = "glabel";
              l.textContent = g.group;
              grp.appendChild(l);
            }
            g.chips.forEach((c) => {
              const b = document.createElement("button");
              b.type = "button";
              b.className = "chip";
              b.setAttribute("data-tag", c.tag);
              b.textContent = c.value;
              grp.appendChild(b);
            });
            box.appendChild(grp);
          });
        }
      }
      box.hidden = !on || !box.firstChild;
      box.querySelectorAll("button.chip").forEach((b) => b.setAttribute("aria-pressed", String(this._selected.has(b.dataset.tag))));
    }
    /** The only redraw path. */
    _draw() {
      if (!this._shell) return;
      this._dirty = false;
      this._drawCount++;
      this._applyOptions();
      this._renderChips();
      const tree = this._viewTree();
      const D = drawMap(tree, { interactive: true });
      const svg = this._q("svg.map");
      const had = this.shadowRoot.activeElement;
      const hadNode = had && had.closest ? had.closest(".node[data-key]") : null;
      const focusKey = hadNode ? hadNode.dataset.key : void 0;
      const prevNodes = this._drawn && this._drawn.tree && this._drawn.tree.nodes || this._tree.nodes;
      this._q("g.content").innerHTML = `<circle class="ring" cx="${D.C.x}" cy="${D.C.y}" r="370"/>${D.links}${D.gfx}${D.labels}`;
      this._hideTip();
      resolveIcons(svg);
      this._drawn = { tree, pos: D.pos, C: D.C };
      this._zoom.apply();
      if (focusKey !== void 0) {
        const drawn = {};
        Array.from(svg.querySelectorAll(".node[data-key]")).forEach((n) => {
          drawn[n.dataset.key] = n;
        });
        let target = drawn[focusKey] || null;
        const seen = {};
        for (let k = prevNodes[focusKey] ? prevNodes[focusKey].parent : null; !target && k != null && !seen[k]; k = prevNodes[k] ? prevNodes[k].parent : null) {
          seen[k] = true;
          target = drawn[k] || null;
        }
        if (!target && tree.root !== null) target = drawn[tree.root] || null;
        if (target && typeof target.focus === "function") {
          this._restoringFocus = true;
          try {
            try {
              target.focus({ preventScroll: true });
            } catch (e) {
              target.focus();
            }
            this._showFocusTip(target, false);
          } finally {
            this._restoringFocus = false;
          }
        }
      }
      if (tree.root !== null && !this._revealed) this._playReveal();
    }
    // -------------------------------------------------------------- reveal
    _playReveal() {
      const svg = this._q("svg.map");
      const content = this._q("g.content");
      const { tree, pos, C } = this._drawn;
      if (!pos[tree.root]) return;
      this._revealed = true;
      const reduced = reducedMotion();
      const ring = content.querySelector(".ring");
      ring.insertAdjacentHTML("afterend", radarSvg(C, true, cssVar("highlight")));
      const nodes = Array.from(svg.querySelectorAll(".node[data-key]")).map((el) => {
        const k = el.dataset.key;
        const p = pos[k];
        return { el, k, p, a: p ? beamAngle(C, p) : 0, root: k === tree.root, lab: el.querySelector("text.dlab") };
      }).filter((n) => n.p);
      const byKey = /* @__PURE__ */ Object.create(null);
      nodes.forEach((n) => {
        byKey[n.k] = n;
      });
      const links = Array.from(svg.querySelectorAll("path.lk[data-k]")).map((p) => ({ p, d: p.getAttribute("d"), n: byKey[p.getAttribute("data-k")] }));
      const hlabels = Array.from(svg.querySelectorAll("g.hlabels[data-k]")).filter((g) => g.getAttribute("data-k") !== tree.root);
      const radar = svg.querySelector(".radar");
      const beam = radar.querySelector(".beam");
      const pulses = Array.from(radar.querySelectorAll(".pr"));
      links.forEach((l) => {
        l.p.style.animation = "none";
      });
      const frame = (t) => {
        nodes.forEach((n) => {
          if (n.root) return;
          n.st = revealNode(t, n.a, reduced);
          n.el.style.opacity = n.st.o >= 1 ? "" : n.st.o.toFixed(3);
          const s = n.st.s;
          n.el.setAttribute("transform", s === 1 ? "" : `translate(${n.p.x} ${n.p.y}) scale(${Math.max(s, 1e-3).toFixed(3)}) translate(${-n.p.x} ${-n.p.y})`);
        });
        const g = revealGlobal(t);
        links.forEach((l) => {
          const draw = l.n && !l.n.root && l.n.st ? l.n.st.draw : 1;
          l.p.setAttribute("d", partialPath(l.d, draw));
          l.p.style.visibility = draw <= 0 ? "hidden" : "";
        });
        nodes.forEach((n) => {
          if (n.lab) n.lab.style.opacity = g.labels.toFixed(3);
        });
        hlabels.forEach((h) => {
          h.style.opacity = g.labels.toFixed(3);
        });
        radar.style.opacity = g.radar.toFixed(3);
        beam.setAttribute("transform", `rotate(${beamDeg(t).toFixed(2)} ${C.x} ${C.y})`);
        pulses.forEach((c, i) => {
          const ph = ((t + 10) / 3 + i / 3) % 1;
          c.setAttribute("r", (38 + ph * 342).toFixed(1));
          c.style.opacity = (0.4 * (1 - ph)).toFixed(3);
        });
      };
      frame(0);
      const revealWrap = this._q(".wrap");
      if (revealWrap) revealWrap.setAttribute("data-reveal", "playing");
      this._revealing = true;
      const run = ++this._revealRun;
      const t0 = performance.now();
      this._revealEnd = () => {
        frame(REVEAL.end + 1);
        links.forEach((l) => {
          l.p.style.animation = "";
          l.p.setAttribute("d", l.d);
          l.p.style.visibility = "";
        });
        nodes.forEach((n) => {
          n.el.removeAttribute("transform");
          n.el.style.opacity = "";
          if (n.lab) n.lab.style.opacity = "";
        });
        hlabels.forEach((h) => {
          h.style.opacity = "";
        });
        radar.remove();
        if (revealWrap) revealWrap.removeAttribute("data-reveal");
      };
      const step = () => {
        if (!this._revealing || this._revealRun !== run) return;
        const t = (performance.now() - t0) / 1e3;
        if (t >= REVEAL.end || !this.isConnected) {
          this._endReveal();
          return;
        }
        frame(t);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    /** Finishes a reveal now and draws anything that was held back. */
    _endReveal() {
      if (!this._revealing) return;
      this._revealing = false;
      this._revealRun++;
      const fin = this._revealEnd;
      this._revealEnd = null;
      if (fin) fin();
      if (this._dirty) this._requestDraw();
    }
    // -------------------------------------------------------------- share
    _theme() {
      return resolveTheme(computedReader(this));
    }
    _shareOpts(hide) {
      const h = hide !== false;
      return { theme: this._theme(), title: h ? "My map" : this._opts.title || "Kepler", hideNames: h };
    }
    shareSvg(hideNames) {
      return shareSvg(this._viewTree(), this._shareOpts(hideNames));
    }
    sharePng(hideNames) {
      return sharePng(this._viewTree(), this._shareOpts(hideNames));
    }
    shareVideo(hideNames, onTick, alive) {
      return shareVideo(this._viewTree(), this._shareOpts(hideNames), onTick, alive);
    }
    _toggleShare() {
      if (!this._hasRoot()) return;
      if (this._share) {
        this._share.close();
        return;
      }
      const panel = openSharePanel(this._q("ha-card"), {
        svg: (h) => this.shareSvg(h),
        png: (h) => this.sharePng(h),
        video: (h, onTick, alive) => this.shareVideo(h, onTick, alive),
        canVideo: !!videoType(),
        onClose: () => {
          this._share = null;
        }
      });
      this._share = panel;
    }
  };

  // src/lovelace.js
  function readNodes(config, hass) {
    const c = config && typeof config === "object" ? config : {};
    const id = c.nodes_entity;
    if (typeof id === "string" && id !== "") {
      const states = hass && hass.states;
      const st = states ? states[id] : void 0;
      const attrs = st ? st.attributes : void 0;
      const v = attrs ? attrs[c.nodes_attribute || "nodes"] : void 0;
      return v === void 0 || v === null ? [] : v;
    }
    return c.nodes || [];
  }
  var KeplerCard = class extends KeplerElement {
    static getStubConfig() {
      return { nodes: [] };
    }
    setConfig(config) {
      const c = config && typeof config === "object" ? config : {};
      this._config = c;
      const opts = { more_info: true };
      Object.keys(DEFAULT_OPTIONS).forEach((k) => {
        if (c[k] !== void 0) opts[k] = c[k];
      });
      this._batch(() => {
        this.options = opts;
        this._rawNodes = void 0;
        this._rawSig = void 0;
        this.nodes = readNodes(c, this._hass);
      });
    }
    set hass(h) {
      this._hass = h;
      const c = this._config;
      if (!c || typeof c.nodes_entity !== "string" || c.nodes_entity === "") return;
      const raw = readNodes(c, h);
      if (this._rawNodes !== void 0 && raw === this._rawNodes && this._sig === this._rawSig) return;
      this.nodes = raw;
      this._rawNodes = raw;
      this._rawSig = this._sig;
    }
    get hass() {
      return this._hass;
    }
    getCardSize() {
      return 12;
    }
    getGridOptions() {
      return { columns: "full", rows: "auto", min_rows: 8 };
    }
  };

  // src/register.js
  var ELEMENT_NAME = "kepler-card";
  var CARD_ENTRY = {
    type: "kepler-card",
    name: "Kepler",
    description: "Orbital map of any device tree.",
    preview: false,
    documentationURL: "https://github.com/the-scott-davis/kepler-card"
  };
  function defineElement(cls, win) {
    const w = win || window;
    try {
      const reg = w.customElements;
      const held = reg.get(ELEMENT_NAME);
      if (!held) {
        reg.define(ELEMENT_NAME, cls);
      } else if (held !== cls) {
        console.warn("Kepler: " + ELEMENT_NAME + " is already defined by another element class; keeping the existing one.");
      }
      return reg.get(ELEMENT_NAME) === cls;
    } catch (e) {
      console.warn("Kepler: " + ELEMENT_NAME + " define failed", e);
      return false;
    }
  }
  function pushCardEntry(win) {
    const w = win || window;
    w.customCards = w.customCards || [];
    if (!w.customCards.find(function(c) {
      return c && c.type === CARD_ENTRY.type;
    })) {
      w.customCards.push(Object.assign({}, CARD_ENTRY));
    }
  }
  function register(cls, win) {
    const w = win || window;
    if (defineElement(cls, w)) pushCardEntry(w);
    const reg = w.customElements;
    if (reg && reg.whenDefined) {
      reg.whenDefined("home-assistant").then(function() {
        if (w.customElements === reg && reg.get(ELEMENT_NAME)) return;
        if (defineElement(cls, w)) pushCardEntry(w);
      }).catch(function(e) {
        console.warn("Kepler: " + ELEMENT_NAME + " define failed", e);
      });
    }
  }

  // src/index.js
  register(KeplerCard);
})();
