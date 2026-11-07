// Stubs for the browser APIs share uses, which jsdom lacks. Call installShareStubs() before sharing.
// Returns { calls, restore() }. calls.fills holds the fillStyle at every fill/fillRect/fillText.
import { win } from "./dom.js";

export function installShareStubs(opts) {
  opts = opts || {};
  const calls = { fills: [], gradients: [], texts: [], recorders: [], tracks: [], urls: [], frames: 0, stops: [], strokes: [] };
  const saved = [];
  const set = (obj, name, value) => {
    saved.push([obj, name, Object.getOwnPropertyDescriptor(obj, name)]);
    Object.defineProperty(obj, name, { value, configurable: true, writable: true });
  };

  const makeCtx = (canvas) => {
    const ctx = { canvas, fillStyle: "", strokeStyle: "", font: "", globalAlpha: 1, lineWidth: 1, lineCap: "butt", lineJoin: "miter", textAlign: "left", textBaseline: "alphabetic" };
    const rec = () => calls.fills.push(ctx.fillStyle);
    ["save", "restore", "translate", "scale", "rotate", "setTransform", "beginPath", "moveTo", "lineTo", "arc", "closePath", "setLineDash", "drawImage", "rect", "roundRect"]
      .forEach((n) => { ctx[n] = () => {}; });
    ctx.stroke = () => calls.strokes.push(ctx.strokeStyle);
    ctx.fill = () => rec();
    ctx.fillRect = () => { calls.frames++; rec(); };
    ctx.strokeText = () => calls.strokes.push(ctx.strokeStyle);
    ctx.fillText = (text) => { calls.texts.push(text); rec(); };
    ctx.createRadialGradient = () => {
      const g = { stops: [], addColorStop(o, c) { g.stops.push([o, c]); } };
      calls.gradients.push(g);
      return g;
    };
    return ctx;
  };
  const P = win.HTMLCanvasElement.prototype;
  set(P, "getContext", function () { if (!this.__ctx) this.__ctx = makeCtx(this); return this.__ctx; });
  set(P, "toBlob", function (cb) { cb(new win.Blob(["png"], { type: "image/png" })); });
  set(P, "captureStream", function () {
    const track = { requested: 0, stopped: false, requestFrame() { track.requested++; }, stop() { track.stopped = true; } };
    calls.tracks.push(track);
    return { getVideoTracks: () => [track], getTracks: () => [track] };
  });

  class MediaRecorder {
    constructor(stream, o) {
      this.stream = stream; this.options = o; this.state = "inactive";
      calls.recorders.push(this);
    }
    start() { this.state = "recording"; }
    stop() {
      if (this.state === "inactive") return;
      this.state = "inactive";
      if (this.ondataavailable) this.ondataavailable({ data: new win.Blob(["vid"], { type: "video/webm" }) });
      if (this.onstop) this.onstop();
    }
  }
  MediaRecorder.isTypeSupported = (t) => opts.videoTypes ? opts.videoTypes.indexOf(t) !== -1 : /webm/.test(t);
  if (opts.noRecorder) set(globalThis, "MediaRecorder", undefined); else set(globalThis, "MediaRecorder", MediaRecorder);
  set(globalThis, "HTMLCanvasElement", win.HTMLCanvasElement);
  set(globalThis, "Blob", win.Blob);
  set(globalThis, "File", win.File);
  set(globalThis, "Path2D", class Path2D { constructor(d) { this.d = d; } });
  set(globalThis, "Image", class Image {
    set src(v) { this._src = v; calls.imageSrc = v; setTimeout(() => (opts.imageError ? this.onerror && this.onerror() : this.onload && this.onload()), 0); }
    get src() { return this._src; }
  });
  set(globalThis.URL, "createObjectURL", (b) => { calls.urls.push(b); return "blob:kepler-test"; });
  set(globalThis.URL, "revokeObjectURL", () => {});

  return {
    calls,
    restore() {
      saved.reverse().forEach(([obj, name, d]) => { if (d) Object.defineProperty(obj, name, d); else delete obj[name]; });
    },
  };
}
