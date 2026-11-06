// Icon path cache. Node icons are drawn as SVG paths; the path data comes from hidden <ha-icon> elements
// outside the SVG, read once per icon name and copied into every registered map.
const PATHS = new Map();
const PENDING = new Set();
const MAPS = new Set();
let waiting = false;

export function iconPath(name) {
  return PATHS.get(name);
}

export function setIconPath(name, d) {
  PATHS.set(name, d);
  MAPS.forEach((svg) => {
    if (!svg.isConnected) { MAPS.delete(svg); return; }
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
    svg.querySelectorAll("g.ic").forEach((g) => {
      const n = g.getAttribute("data-icon");
      if (n && names.indexOf(n) === -1) names.push(n);
    });
  });
  const missing = names.filter((n) => !PATHS.has(n));
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
        el.remove();
      }
    };
    poll();
  });
}

/** Fill the path of every g.ic[data-icon] in svg, and in every map seen before. Starts no polling until
 * ha-icon is defined; it then waits on whenDefined. */
export function resolveIcons(svg) {
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
  if (haIconDefined()) { lookup(); return; }
  if (waiting) return;
  waiting = true;
  customElements.whenDefined("ha-icon").then(() => { waiting = false; lookup(); });
}
