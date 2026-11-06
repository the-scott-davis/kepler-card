import { esc, trunc } from "./util.js";
import { layoutTree, CX, CY, ROOT_RADIUS, HUB_RADIUS, DEVICE_RADIUS } from "./layout.js";
import { STATUSES, FALLBACK_ICON } from "./tree.js";
import { defaultTheme } from "./theme.js";
import { iconPath } from "./icons.js";

const f1 = (n) => n.toFixed(1);

function statusOf(s) {
  return typeof s === "string" && STATUSES.indexOf(s) !== -1 ? s : "unknown";
}

/** Draws a Tree to SVG markup strings plus a plain scene description. No DOM. */
export function drawMap(tree, opts) {
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
  const link = (k, status, strong, d) => {
    const cls = `st-${status}${status === "online" ? " live" : ""}${strong ? " strong" : ""}`;
    const color = theme.link || col(status);
    out.links += `<path class="lk ${cls}" data-k="${esc(k)}" d="${d}"/>`;
    scene.links.push({ k, cls, d, color });
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
      return placed.reduce((m, o) => m + 4 * overlap(b, o), 0)
        + discs.reduce((m, o) => m + 3 * overlap(b, o), 0)
        + near.reduce((m, o) => m + overlap(b, o), 0);
    };
    const sides = [
      { x: p.x, y1: p.y + r + 21, anchor: "middle" },
      { x: p.x, y1: p.y - r - 27, anchor: "middle" },
      { x: p.x + r + 10, y1: p.y - 2, anchor: "start" },
      { x: p.x - r - 10, y1: p.y - 2, anchor: "end" },
    ];
    if (!(isRoot || p.y >= C.y - 4)) sides.unshift(sides.splice(1, 1)[0]);
    const pick = isRoot ? sides[0] : (sides.find((s) => cost(s) === 0) || sides.reduce((a, s) => (cost(s) < cost(a) ? s : a)));
    if (!isRoot) placed.push(box(pick));
    out.gfx += `<g class="node hub st-${st}${isRoot ? " root" : ""}" data-key="${esc(k)}">` +
      `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r + 9}" class="halo st-${st}"/>` +
      `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${r}" class="disc st-${st}${st === "stale" ? " pulse" : ""}"/>` +
      iconG(p, r, icon, st) + `</g>`;
    scene.nodes.push({ k, x: p.x, y: p.y, r, color: col(st), icon, hub: true, root: isRoot, halo: true });
    out.labels += `<g class="hlabels" data-k="${esc(k)}" pointer-events="none">` +
      `<text x="${f1(pick.x)}" y="${f1(pick.y1)}" class="hlab" style="text-anchor:${pick.anchor}">${esc(shown)}</text></g>`;
    scene.hubLabels.push({ k, x: pick.x, y: pick.y1, text: shown, anchor: pick.anchor });
  });

  devKeys.forEach((k) => {
    const n = nodes[k];
    const p = pos[k];
    const st = statusOf(n.status);
    const live = st === "online";
    const icon = n.icon || FALLBACK_ICON;
    const deg = (p.a * 180) / Math.PI;
    const nd = ((deg % 360) + 360) % 360;
    const flip = nd > 90 && nd < 270;
    const tr = p.r + 24;
    const tx = C.x + tr * Math.cos(p.a), ty = C.y + tr * Math.sin(p.a);
    const rot = flip ? deg + 180 : deg;
    const text = trunc(n.label, maxChars);
    out.gfx += `<g class="node dev st-${st}" data-key="${esc(k)}">` +
      (live ? `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="21" class="halo st-${st}"/>` : "") +
      `<circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${DEVICE_RADIUS}" class="disc st-${st}${st === "stale" ? " pulse" : ""}"/>` +
      iconG(p, DEVICE_RADIUS, icon, st) +
      `<text x="${f1(tx)}" y="${f1(ty)}" transform="rotate(${f1(rot)} ${f1(tx)} ${f1(ty)})" text-anchor="${flip ? "end" : "start"}" dominant-baseline="middle" class="dlab" style="font-size:${f1(fs)}px">${esc(text)}</text></g>`;
    scene.nodes.push({ k, x: p.x, y: p.y, r: DEVICE_RADIUS, color: col(st), icon, halo: live });
    scene.devLabels.push({ k, x: tx, y: ty, rot, anchor: flip ? "end" : "start", size: fs, text, color: theme.text });
  });
  return out;
}
