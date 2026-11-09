import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const THEME = {
  "--kepler-background": "linear-gradient(160deg, #3b0764 0%, #1e1b4b 100%)",
  "--kepler-text-color": "#fef3c7",
  "--kepler-status-online": "#22d3ee",
  "--kepler-status-recent": "#fb923c",
  "--kepler-status-stale": "#f43f5e",
  "--kepler-status-new": "#a3e635",
  "--kepler-status-unknown": "#94a3b8",
  "--kepler-link-color": "#f0abfc",
  "--kepler-highlight-color": "#facc15",
  "--kepler-tooltip-background": "#fef3c7",
  "--kepler-tooltip-text-color": "#1e1b4b",
};
let el = null;
let flip = false;
let current = "home";
let mark = null;
let cardLogged = false;
const NODES_ENTITY = "sensor.network_map";

function log(text) {
  const row = document.createElement("div");
  row.textContent = new Date().toLocaleTimeString() + " " + text;
  $("log").appendChild(row);
  $("log").scrollTop = $("log").scrollHeight;
}

function applyTheme() {
  Object.keys(THEME).forEach((k) => {
    if ($("theme").checked) el.style.setProperty(k, THEME[k]);
    else el.style.removeProperty(k);
  });
}

function applyOptions() {
  el.options = { title: $("title").value, height: Number($("height").value), filters: $("filters").checked, more_info: $("moreinfo").checked };
}

function lovelaceMode() {
  return $("host").value === "lovelace";
}

function makeHass(nodes) {
  const states = {};
  states[NODES_ENTITY] = { attributes: { nodes } };
  return { states };
}

// In lovelace mode this page plays a tiny Home Assistant: a config, and a hass object with one entity.
function applyConfig() {
  el.setConfig({ type: "custom:kepler-card", title: $("title").value, nodes_entity: NODES_ENTITY, filters: $("filters").checked });
}

function logCustomCards() {
  if (cardLogged || !Array.isArray(window.customCards)) return;
  if (window.customCards.some((c) => c && c.type === "kepler-card")) {
    cardLogged = true;
    log("customCards kepler-card");
  }
}

function mount() {
  if (el) el.remove();
  el = document.createElement("kepler-card");
  el.addEventListener("kepler-node-tap", (e) => {
    log("kepler-node-tap " + JSON.stringify(e.detail));
    if ($("prevent").checked) e.preventDefault();
  });
  el.addEventListener("hass-more-info", (e) => log("hass-more-info " + JSON.stringify(e.detail)));
  applyTheme();
  if (lovelaceMode()) {
    logCustomCards();
    applyConfig();
    el.hass = makeHass(SAMPLES[current].nodes);
  } else {
    applyOptions();
    el.nodes = SAMPLES[current].nodes;
  }
  $("stage").appendChild(el);
  flip = false;
  $("brokennote").hidden = current !== "broken";
}

function showResult(node) {
  const out = $("shareout");
  out.textContent = "";
  out.appendChild(node);
}

async function share(kind) {
  showResult(document.createTextNode("Working..."));
  try {
    const blob = kind === "png" ? await el.sharePng(true) : await el.shareVideo(true);
    const url = URL.createObjectURL(blob);
    const m = document.createElement(kind === "png" ? "img" : "video");
    m.src = url;
    if (kind === "video") {
      m.muted = true;
      // Controls stay off until the late-frame seek ends: while it runs, the native
      // controls draw a loading spinner (a dark arc) over the middle of the map.
      const showControls = () => { m.controls = true; };
      m.addEventListener("seeked", showControls, { once: true });
      m.addEventListener("error", showControls, { once: true });
      // Fallback: if the seek never completes (e.g. Infinity duration), still show controls.
      setTimeout(showControls, 2000);
      // Best effort: show a late frame, so a screenshot is not the first, empty one.
      m.addEventListener("loadedmetadata", () => {
        try { m.currentTime = isFinite(m.duration) ? Math.max(0, m.duration - 0.2) : 1e9; } catch (e) { showControls(); }
      });
    }
    showResult(m);
  } catch (e) {
    showResult(document.createTextNode("Share failed: " + (e && e.message ? e.message : e)));
  }
}

function currentView() {
  const svg = el && el.shadowRoot ? el.shadowRoot.querySelector("svg.map") : null;
  return svg ? svg.getAttribute("viewBox") : null;
}

function updateViewState() {
  $("viewstate").textContent = mark !== null && currentView() === mark ? "view same" : "view changed";
}

$("sample").addEventListener("change", () => { current = $("sample").value; mount(); });
$("host").addEventListener("change", mount);
$("replace").addEventListener("click", () => {
  flip = !flip;
  const nodes = flip ? SAMPLES[current].changed : SAMPLES[current].nodes;
  if (lovelaceMode()) {
    el.hass = makeHass(nodes);
  } else {
    el.nodes = nodes;
  }
});
$("filters").addEventListener("change", () => { if (lovelaceMode()) applyConfig(); else applyOptions(); });
$("title").addEventListener("input", () => { if (lovelaceMode()) applyConfig(); else applyOptions(); });
$("height").addEventListener("change", () => { if (lovelaceMode()) applyConfig(); else applyOptions(); });
$("moreinfo").addEventListener("change", () => { if (!lovelaceMode()) applyOptions(); });
$("markview").addEventListener("click", () => { mark = currentView(); updateViewState(); });
setInterval(updateViewState, 200);
$("theme").addEventListener("change", applyTheme);
$("sharepng").addEventListener("click", () => share("png"));
$("sharevideo").addEventListener("click", () => share("video"));
$("clearlog").addEventListener("click", () => { $("log").textContent = ""; });

customElements.whenDefined("kepler-card").then(mount);
