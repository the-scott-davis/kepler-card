export const STATUSES = ["online", "recent", "stale", "new", "unknown"];
export const FALLBACK_ICON = "mdi:lan-connect";

function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function nonEmpty(v) {
  return typeof v === "string" && v !== "";
}
export function copyJson(v) {
  const s = JSON.stringify(v);
  if (typeof s !== "string") throw new Error("not JSON");
  return JSON.parse(s);
}

export function snapshotNodes(value) {
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

export function buildTree(list, warn = console.warn) {
  const nodes = Object.create(null);
  const order = [];
  const warned = new Set();
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
    if (Array.isArray(e.tags) && e.tags.every(function (t) { return typeof t === "string"; })) {
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
      source,
    };
    if (typeof e.sort === "string") node.sort = e.sort;
    nodes[key] = node;
    order.push(key);
  }
  if (!order.length) return { root: null, nodes, order };

  // Root: first parentless hub, else first parentless, else first node.
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

  // Unknown or missing parents attach to root.
  for (let i = 0; i < order.length; i++) {
    const n = nodes[order[i]];
    if (n.key === root) continue;
    if (n.parent === null || !(n.parent in nodes)) n.parent = root;
  }

  // Cycle detection: every non-root node has a parent, so a chain either
  // reaches root or loops.
  const state = new Map(); // 1 visiting, 2 done
  const inCycle = new Set();
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
  inCycle.forEach(function (k) {
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
