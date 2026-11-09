import { cssHeight } from "./util.js";
import { snapshotNodes, buildTree } from "./tree.js";
import { buildChips, filterTree, activeSelection } from "./filters.js";
import { drawMap } from "./draw.js";
import { cssVar, statusCss, resolveTheme, computedReader } from "./theme.js";
import { VIEW, panIntoView } from "./zoom.js";
import { REVEAL, beamAngle, beamDeg, revealNode, revealGlobal, partialPath, reducedMotion, radarSvg } from "./reveal.js";
import { resolveIcons } from "./icons.js";
import { wireZoom } from "./gestures.js";
import { shareSvg, sharePng, shareVideo, videoType } from "./share.js";
import { openSharePanel } from "./share-panel.js";

export const DEFAULT_OPTIONS = { title: "", height: 900, zoom: true, show_share: true, more_info: false, filters: false, selected_tags: undefined };

const GESTURE_HOLD_MS = 15000;
const DISC_FILL = "#0f172a";
const LABEL_OUTLINE = "#0b1220";

function copy(v) {
  return JSON.parse(JSON.stringify(v));
}

function shellCss() {
  const text = cssVar("text"), hi = cssVar("highlight");
  return `
:host{display:block}
ha-card{display:block;position:relative;font-family:${cssVar("font")};overflow:hidden;background:${cssVar("background")};color:${text};border:1px solid rgba(148,163,184,.12)}
.head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:16px 18px 4px}
.title{font-size:20px;font-weight:600;margin-right:auto}
.title:empty{display:none}
.sharebtn{font:inherit;font-size:12.5px;padding:4px 12px;border-radius:999px;border:1px solid ${hi};background:transparent;color:${text};cursor:pointer}
.sharebtn[hidden]{display:none}
.chips{display:flex;flex-wrap:wrap;gap:8px 16px;padding:6px 18px 0}
.chips[hidden]{display:none}
.chipgroup{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.glabel{font-size:11.5px;opacity:.65;margin-right:2px}
.chip{font:inherit;font-size:12.5px;color:${text};background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.14);padding:4px 10px;border-radius:999px;cursor:pointer}
.chip[aria-pressed="true"]{border-color:${hi};background:rgba(96,165,250,.18)}
.wrap{position:relative}
svg.map{font-family:${cssVar("font")};width:100%;height:auto;display:block;max-height:${cssHeight(900)};user-select:none;-webkit-user-select:none}
.ring{fill:none;stroke:${cssVar("ring")};stroke-width:1}
.lk{fill:none;stroke-width:1.4;opacity:.45}
.lk.strong{stroke-width:2.6;opacity:.75}
.lk.live{stroke-dasharray:6 10;animation:flow 1.6s linear infinite;opacity:.8}
.lk.strong.live{stroke-dasharray:10 8}
@keyframes flow{to{stroke-dashoffset:-32}}
@keyframes spin{to{transform:rotate(360deg)}}
.disc{fill:${DISC_FILL};stroke-width:2.2}
.halo{opacity:.13;filter:url(#kblur)}
.pulse{animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{50%{stroke-width:5}}
.hlab{fill:${text};font-size:15px;font-weight:600;text-anchor:middle;paint-order:stroke;stroke:${LABEL_OUTLINE};stroke-width:4px}
.dlab{fill:${text}}
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

const SHELL = `<style>${shellCss()}</style>
<ha-card>
<div class="head"><div class="title"></div><button class="sharebtn" type="button" title="Share an image or video of the map">Share</button></div>
<div class="chips" hidden></div>
<div class="wrap">
<svg class="map" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" role="group" aria-label="Map"><defs><filter id="kblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs><g class="content"></g></svg>
<div class="tip"></div>
<div class="zoomctl"><button class="zin" type="button" title="Zoom in" aria-label="Zoom in">+</button><button class="zout" type="button" title="Zoom out" aria-label="Zoom out">&minus;</button><button class="zfit" type="button" title="Whole map" aria-label="Whole map">&#9635;</button></div>
</div>
</ha-card>`;

export class KeplerElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._opts = Object.assign({}, DEFAULT_OPTIONS);
    this._selected = new Set();
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
    // A property set on the element before it was upgraded shadows the accessor. Take it back through the setter.
    ["options", "nodes"].forEach((p) => {
      if (Object.prototype.hasOwnProperty.call(this, p)) {
        const v = this[p];
        delete this[p];
        this[p] = v;
      }
    });
  }

  get nodes() {
    return copy(this._list);
  }

  set nodes(value) {
    const s = snapshotNodes(value);
    if (s.sig === this._sig) return;
    this._sig = s.sig;
    s.warnings.forEach((w) => console.warn(w));
    this._list = s.list;
    this._tree = buildTree(s.list);
    this._chipsDirty = true;
    this._requestDraw();
  }

  get options() {
    const o = Object.assign({}, this._opts);
    // Chip clicks change the selection, so read it back live rather than as the last preset.
    if (Array.isArray(o.selected_tags) || this._selected.size) o.selected_tags = Array.from(this._selected);
    return o;
  }

  set options(value) {
    const v = value && typeof value === "object" ? value : {};
    const next = Object.assign({}, DEFAULT_OPTIONS, v);
    if (!Array.isArray(next.selected_tags)) next.selected_tags = undefined;
    const prev = this._opts || {};
    let changed = Object.keys(next).length !== Object.keys(prev).length ||
      Object.keys(next).some((k) => k !== "selected_tags" && next[k] !== prev[k]);
    this._opts = next;
    // An array sets the selection. Dropping a preset the last options had clears it.
    // With no preset before or now, chip picks stay.
    let sel = null;
    if (Array.isArray(next.selected_tags)) sel = new Set(next.selected_tags.filter((t) => typeof t === "string"));
    else if (Array.isArray(prev.selected_tags)) sel = new Set();
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
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._zoom) { this._zoom.destroy(); this._zoom = null; this._zoomOn = null; }
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
    const wrap = this._q(".wrap");

    this._q(".sharebtn").addEventListener("click", () => this._toggleShare());
    this._q(".chips").addEventListener("click", (ev) => {
      const b = ev.target && ev.target.closest ? ev.target.closest("button.chip[data-tag]") : null;
      if (!b) return;
      const tag = b.dataset.tag;
      if (this._selected.has(tag)) this._selected.delete(tag); else this._selected.add(tag);
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
        bubbles: true, composed: true, cancelable: true,
        detail: { key: node.key, node: copy(node.source) },
      });
      const ok = this.dispatchEvent(ev);
      if (ok && this._opts.more_info && node.entity) {
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: node.entity } }));
      }
    };
    svg.addEventListener("click", (ev) => tap(nodeAt(ev)));
    svg.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
      const el = nodeAt(ev);
      if (!el) return;
      if (ev.key !== "Enter") ev.preventDefault(); // Space must not scroll the page
      tap(el);
    });
    svg.addEventListener("focusin", (ev) => {
      const el = nodeAt(ev);
      const node = el ? this._tree.nodes[el.dataset.key] : null;
      if (!node) return;
      this._panIntoView(node.key);
      tip.textContent = node.label;
      tip.style.opacity = "1";
      const r = wrap.getBoundingClientRect(), b = el.getBoundingClientRect();
      let x = b.left - r.left + b.width + 8, y = b.top - r.top;
      if (x + 200 > r.width) x = b.left - r.left - 224;
      tip.style.left = Math.max(4, x) + "px";
      tip.style.top = Math.max(4, y) + "px";
    });
    svg.addEventListener("focusout", (ev) => {
      const to = ev.relatedTarget && ev.relatedTarget.closest ? ev.relatedTarget.closest(".node[data-key]") : null;
      if (!to) tip.style.opacity = "0";
    });
    const place = (ev) => {
      const r = wrap.getBoundingClientRect();
      let x = (ev.clientX || 0) - r.left + 14, y = (ev.clientY || 0) - r.top + 14;
      if (x + 200 > r.width) x -= 224;
      tip.style.left = Math.max(4, x) + "px";
      tip.style.top = Math.max(4, y) + "px";
    };
    svg.addEventListener("mouseover", (ev) => {
      const el = nodeAt(ev);
      const node = el ? this._tree.nodes[el.dataset.key] : null;
      if (!node) return;
      tip.textContent = node.label;
      tip.style.opacity = "1";
      place(ev);
    });
    svg.addEventListener("mousemove", (ev) => { if (nodeAt(ev)) place(ev); });
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
      wrap: this._q(".wrap"), svg: this._q("svg.map"), ctl: on ? this._q(".zoomctl") : null,
      enabled: on,
      getView: () => this._view,
      setView: (v) => { this._view = v; },
      onGestureStart: () => { this._gesturing = true; },
      onGestureEnd: (acted) => {
        this._gesturing = false;
        if (acted) { this._gestureAt = Date.now(); return; }
        // A plain tap holds nothing back: release any redraw that was waiting on it.
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        if (this._dirty) this._requestDraw();
      },
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
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
      // Ending the reveal must not redraw on its own: the draw below covers it.
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
        this._timer = setTimeout(() => { this._timer = null; if (this._dirty) this._requestDraw(); }, wait);
        if (this._timer && typeof this._timer.unref === "function") this._timer.unref();
      }
      return;
    }
    this._draw();
  }

  _viewTree() {
    return this._opts.filters ? filterTree(this._tree, this._selected) : this._tree;
  }

  _applyOptions() {
    const o = this._opts;
    this._q(".title").textContent = o.title == null ? "" : String(o.title);
    this._q(".sharebtn").hidden = o.show_share === false;
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
    const focusKey = had && had.closest ? (had.closest(".node[data-key]") || {}).dataset?.key : undefined;
    this._q("g.content").innerHTML = `<circle class="ring" cx="${D.C.x}" cy="${D.C.y}" r="370"/>${D.links}${D.gfx}${D.labels}`;
    this._hideTip();
    resolveIcons(svg);
    this._drawn = { tree, pos: D.pos, C: D.C };
    this._zoom.apply();
    if (focusKey !== undefined) {
      const again = Array.from(svg.querySelectorAll(".node[data-key]")).find((n) => n.dataset.key === focusKey);
      if (again && typeof again.focus === "function") {
        try { again.focus({ preventScroll: true }); } catch (e) { again.focus(); }
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
    const byKey = Object.create(null);
    nodes.forEach((n) => { byKey[n.k] = n; });
    const links = Array.from(svg.querySelectorAll("path.lk[data-k]")).map((p) => ({ p, d: p.getAttribute("d"), n: byKey[p.getAttribute("data-k")] }));
    const hlabels = Array.from(svg.querySelectorAll("g.hlabels[data-k]")).filter((g) => g.getAttribute("data-k") !== tree.root);
    const radar = svg.querySelector(".radar");
    const beam = radar.querySelector(".beam");
    const pulses = Array.from(radar.querySelectorAll(".pr"));
    links.forEach((l) => { l.p.style.animation = "none"; });
    const frame = (t) => {
      nodes.forEach((n) => {
        if (n.root) return;
        n.st = revealNode(t, n.a, reduced);
        n.el.style.opacity = n.st.o >= 1 ? "" : n.st.o.toFixed(3);
        const s = n.st.s;
        n.el.setAttribute("transform", s === 1 ? "" : `translate(${n.p.x} ${n.p.y}) scale(${Math.max(s, 0.001).toFixed(3)}) translate(${-n.p.x} ${-n.p.y})`);
      });
      const g = revealGlobal(t);
      links.forEach((l) => {
        const draw = l.n && !l.n.root && l.n.st ? l.n.st.draw : 1;
        l.p.setAttribute("d", partialPath(l.d, draw));
        l.p.style.visibility = draw <= 0 ? "hidden" : "";
      });
      nodes.forEach((n) => { if (n.lab) n.lab.style.opacity = g.labels.toFixed(3); });
      hlabels.forEach((h) => { h.style.opacity = g.labels.toFixed(3); });
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
      links.forEach((l) => { l.p.style.animation = ""; l.p.setAttribute("d", l.d); l.p.style.visibility = ""; });
      nodes.forEach((n) => { n.el.removeAttribute("transform"); n.el.style.opacity = ""; if (n.lab) n.lab.style.opacity = ""; });
      hlabels.forEach((h) => { h.style.opacity = ""; });
      radar.remove();
      if (revealWrap) revealWrap.removeAttribute("data-reveal");
    };
    const step = () => {
      if (!this._revealing || this._revealRun !== run) return;
      const t = (performance.now() - t0) / 1000;
      if (t >= REVEAL.end || !this.isConnected) { this._endReveal(); return; }
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
    return { theme: this._theme(), title: h ? "My map" : (this._opts.title || "Kepler"), hideNames: h };
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
    if (this._share) { this._share.close(); return; }
    const panel = openSharePanel(this._q("ha-card"), {
      svg: (h) => this.shareSvg(h),
      png: (h) => this.sharePng(h),
      video: (h, onTick, alive) => this.shareVideo(h, onTick, alive),
      canVideo: !!videoType(),
      onClose: () => { this._share = null; },
    });
    this._share = panel;
  }
}
