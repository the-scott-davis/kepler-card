// The share panel: a small dialog inside the card to save the map as an image or a video.
import { cssVar } from "./theme.js";
import { deliver } from "./share.js";

function panelCss() {
  const text = cssVar("text"), hi = cssVar("highlight"), bg = cssVar("tooltipBackground");
  return `.sharepop{position:absolute;top:56px;right:12px;z-index:5;width:min(340px,calc(100% - 24px));box-sizing:border-box;padding:14px;border-radius:12px;` +
    `background:${bg};color:${text};border:1px solid rgba(148,163,184,.25);font:13px/1.4 ${cssVar("font")};box-shadow:0 8px 28px rgba(0,0,0,.45)}` +
    `.sharepop .shead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:15px}` +
    `.sharepop button{font:inherit;color:inherit;cursor:pointer;border:1px solid rgba(148,163,184,.3);background:transparent;border-radius:8px;padding:6px 12px}` +
    `.sharepop .x{border:0;font-size:20px;padding:0 6px}.sharepop .seg{display:flex;gap:6px;margin-bottom:10px}` +
    `.sharepop .seg button.on,.sharepop .go{border-color:${hi};color:${hi}}.sharepop .thumb{width:100%;display:block;border-radius:8px;margin-bottom:10px}` +
    `.sharepop .trow{display:flex;justify-content:space-between;align-items:center;gap:10px}.sharepop .muted{opacity:.7;font-size:12px}` +
    `.sharepop .tg{width:42px;height:24px;padding:2px;border-radius:12px;text-align:left}.sharepop .tg i{display:block;width:18px;height:18px;border-radius:50%;background:currentColor;opacity:.6}` +
    `.sharepop .tg.on{border-color:${hi}}.sharepop .tg.on i{margin-left:18px;background:${hi};opacity:1}` +
    `.sharepop .btns{display:flex;gap:8px;margin-top:12px}.sharepop [hidden]{display:none}.sharepop .status{margin-top:8px;min-height:1.4em;font-size:12px}`;
}

/** Opens the share panel inside container. api: { svg(hide), png(hide), video(hide, onTick, alive), canVideo, onClose }.
 * Returns { close() }. */
export function openSharePanel(container, api) {
  const old = container.querySelector(".sharepop");
  if (old) old.remove();
  const canCopy = !!(navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined");
  const canVideo = !!api.canVideo;
  const pop = document.createElement("div");
  pop.className = "sharepop";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Share your map");
  pop.innerHTML = `<div class="shead"><b>Share your map</b><button class="x" aria-label="Close">&times;</button></div>` +
    (canVideo ? `<div class="seg"><button class="on" data-m="image">Image</button><button data-m="video">Animation</button></div>` : "") +
    `<img class="thumb" alt="Preview of the shared map">` +
    `<div class="trow"><div><div>Hide names</div><div class="muted">Shows "TV 1", "Camera 2" and hub types instead.</div></div>` +
    `<button class="tg on" role="switch" aria-checked="true" aria-label="Hide names"><i></i></button></div>` +
    `<div class="muted" style="margin-top:10px">Keys, entities and tags are never included.</div>` +
    `<div class="btns img"><button class="go dl">Download PNG</button>` + (canCopy ? `<button class="cp">Copy</button>` : "") + `</div>` +
    (canVideo ? `<div class="btns vid" hidden><button class="go rec">Save video</button></div>` : "") +
    `<div class="status" aria-live="polite"></div>`;
  const style = document.createElement("style");
  style.textContent = panelCss();
  pop.insertBefore(style, pop.firstChild);
  container.appendChild(pop);
  let hide = true, busy = false, closed = false;
  const q = (s) => pop.querySelector(s);
  const status = (t) => { q(".status").textContent = t || ""; };
  const thumb = () => { q(".thumb").src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(api.svg(hide)); };
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
    new Promise((res) => res(api.png(hide))).then((b) => deliver(b, "kepler-map.png")).then(() => {}, (e) => status(String((e && e.message) || e)));
  });
  if (q(".cp")) q(".cp").addEventListener("click", () => {
    navigator.clipboard.write([new ClipboardItem({ "image/png": api.png(hide) })])
      .then(() => status("Copied. Paste it anywhere."), (e) => status("Couldn't copy: " + ((e && e.message) || e)));
  });
  if (q(".rec")) q(".rec").addEventListener("click", () => {
    if (busy) return;
    busy = true;
    q(".rec").disabled = true;
    const reset = () => { busy = false; q(".rec").disabled = false; };
    new Promise((res) => res(api.video(hide, (f) => status(`Recording... ${Math.min(100, Math.round(f * 100))}%`), () => !closed && pop.isConnected)))
      .then((b) => deliver(b, "kepler-map." + (/mp4/.test(b.type) ? "mp4" : "webm")))
      .then((r) => { reset(); status(r === "shared" ? "Shared." : r === "saved" ? "Saved." : ""); },
        (e) => { reset(); status(e && e.cancelled ? "" : "Couldn't record: " + ((e && e.message) || e)); });
  });
  return { close };
}
