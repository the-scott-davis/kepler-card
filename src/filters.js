export const PLAIN_GROUP = "";

function plain(tag) {
  return { tag: tag, group: PLAIN_GROUP, value: tag };
}

export function parseTag(tag) {
  const s = String(tag);
  const i = s.indexOf(":");
  if (i < 0) return plain(s);
  const group = s.slice(0, i);
  const value = s.slice(i + 1);
  if (group.trim() === "" || value.trim() === "") return plain(s);
  return { tag: s, group: group, value: value };
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function buildChips(tree) {
  const groups = new Map();
  const seen = new Set();
  tree.order.forEach(function (key) {
    const node = tree.nodes[key];
    if (!node) return;
    node.tags.forEach(function (tag) {
      if (seen.has(tag)) return;
      seen.add(tag);
      if (tag.trim() === "") return;
      const p = parseTag(tag);
      if (!groups.has(p.group)) groups.set(p.group, []);
      groups.get(p.group).push({ tag: p.tag, value: p.value });
    });
  });
  const names = Array.from(groups.keys()).sort(function (a, b) {
    if (a === PLAIN_GROUP) return b === PLAIN_GROUP ? 0 : 1;
    if (b === PLAIN_GROUP) return -1;
    return cmp(a, b);
  });
  return names.map(function (g) {
    const chips = groups.get(g).sort(function (a, b) {
      return cmp(a.value, b.value) || cmp(a.tag, b.tag);
    });
    return { group: g, chips: chips };
  });
}

export function activeSelection(tree, selected) {
  const want = new Set(selected == null ? [] : Array.from(selected));
  const out = [];
  if (want.size === 0) return out;
  const seen = new Set();
  tree.order.forEach(function (key) {
    const node = tree.nodes[key];
    if (!node) return;
    node.tags.forEach(function (tag) {
      if (want.has(tag) && !seen.has(tag)) {
        seen.add(tag);
        out.push(tag);
      }
    });
  });
  return out;
}

export function matchesSelection(node, active) {
  if (!active || active.length === 0) return true;
  const act = new Set(active);
  const groups = new Set(active.map(function (t) { return parseTag(t).group; }));
  const tags = node.tags || [];
  let ok = true;
  groups.forEach(function (g) {
    if (!ok) return;
    const hit = tags.some(function (t) {
      return act.has(t) && parseTag(t).group === g;
    });
    if (!hit) ok = false;
  });
  return ok;
}

function visibleFor(tree, active) {
  const vis = new Set();
  if (active.length === 0) {
    tree.order.forEach(function (k) { vis.add(k); });
    return vis;
  }
  if (tree.root != null) vis.add(tree.root);
  tree.order.forEach(function (key) {
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

export function visibleKeys(tree, selected) {
  return visibleFor(tree, activeSelection(tree, selected));
}

export function filterTree(tree, selected) {
  const active = activeSelection(tree, selected);
  if (active.length === 0) return tree;
  const vis = visibleFor(tree, active);
  const nodes = Object.create(null);
  const order = [];
  tree.order.forEach(function (key) {
    if (!vis.has(key)) return;
    const n = tree.nodes[key];
    order.push(key);
    nodes[key] = Object.assign({}, n, {
      tags: n.tags.slice(),
      children: n.children.filter(function (c) { return vis.has(c); })
    });
  });
  return { root: tree.root, nodes: nodes, order: order };
}
