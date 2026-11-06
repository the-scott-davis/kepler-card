// Pure layout: positions for hubs and devices over a Tree. No DOM.
export const CX = 500;
export const CY = 500;
export const DEVICE_RING = 370;
export const ROOT_RADIUS = 32;
export const HUB_RADIUS = 25;
export const DEVICE_RADIUS = 15;

const HUB_R1 = 110; // first hub tier
const HUB_STEP = 125;
const HUB_R_MAX = DEVICE_RING - HUB_RADIUS - 20; // hub discs stay inside the device ring
const GAP = 4;
const MIN_HUB_DIST = 2 * HUB_RADIUS + GAP;

function sortKey(n) {
  return String(n.sort != null ? n.sort : n.label);
}

function comparator(tree) {
  return function (a, b) {
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

// Open angles between overlapping hubs, keeping each hub's radius (tier) fixed. Deterministic.
function separate(pos, keys) {
  let budget = 4e6; // pair checks; bounds the cost on very large trees
  for (let iter = 0; iter < 600 && (iter === 0 || budget > 0); iter++) {
    budget -= (keys.length * keys.length) / 2;
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
        const s = da > 0 ? 1 : da < 0 ? -1 : (i % 2 ? -1 : 1);
        const push = (need - have) / 2 + 0.002;
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

export function layoutTree(tree, opts) {
  void opts;
  const center = { x: CX, y: CY };
  const pos = Object.create(null);
  const depth = Object.create(null);
  const finish = (slots) => {
    const N = Math.max(slots.length, 1);
    return { pos, slots, N, arc: (Math.PI * 2 * DEVICE_RING) / N, depth, center };
  };
  if (!tree || tree.root == null || !tree.nodes[tree.root]) return finish([]);

  const root = tree.root;
  const nodes = tree.nodes;
  const byOrder = comparator(tree);
  const slots = [];
  const range = Object.create(null);
  const seen = Object.create(null);
  const hubOrder = [];

  const kids = (k) => {
    const list = (nodes[k].children || []).filter((c) => nodes[c]).slice().sort(byOrder);
    return {
      dev: list.filter((c) => nodes[c].kind !== "hub"),
      hub: list.filter((c) => nodes[c].kind === "hub"),
    };
  };

  // Iterative DFS: devices of a hub first, then its hub children.
  const walk = (top, topDepth) => {
    const stack = [{ k: top, dep: topDepth, kids: null, i: 0, start: 0 }];
    while (stack.length) {
      const f = stack[stack.length - 1];
      if (!f.kids) {
        if (seen[f.k]) { stack.pop(); continue; }
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
      if (slots.length === f.start && f.k !== root) slots.push({ type: "gap", hub: f.k });
      range[f.k] = [f.start, slots.length - 1];
      stack.pop();
    }
  };
  walk(root, 0);
  // Anything not reached hangs off the root.
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
  const step = (Math.PI * 2) / N;
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
  hubOrder.forEach((h) => { if (h !== root && depth[h] > maxDepth) maxDepth = depth[h]; });
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
