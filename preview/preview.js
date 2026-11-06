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
let current = "basic";

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
  el.options = { title: "Preview", height: 700, filters: $("filters").checked, more_info: $("moreinfo").checked };
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
  applyOptions();
  el.nodes = SAMPLES[current].nodes;
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
    if (kind === "video") { m.controls = true; m.muted = true; }
    showResult(m);
  } catch (e) {
    showResult(document.createTextNode("Share failed: " + (e && e.message ? e.message : e)));
  }
}

$("sample").addEventListener("change", () => { current = $("sample").value; mount(); });
$("replace").addEventListener("click", () => {
  flip = !flip;
  el.nodes = flip ? SAMPLES[current].changed : SAMPLES[current].nodes;
});
$("filters").addEventListener("change", applyOptions);
$("moreinfo").addEventListener("change", applyOptions);
$("theme").addEventListener("change", applyTheme);
$("sharepng").addEventListener("click", () => share("png"));
$("sharevideo").addEventListener("click", () => share("video"));
$("clearlog").addEventListener("click", () => { $("log").textContent = ""; });

customElements.whenDefined("kepler-card").then(mount);
