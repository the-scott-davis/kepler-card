import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
const win = dom.window;

const names = [
  "window", "document", "HTMLElement", "SVGElement", "Node", "customElements", "CustomEvent",
  "Event", "MouseEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "navigator",
];
for (const name of names) {
  const value = name === "window" ? win : win[name];
  Object.defineProperty(globalThis, name, {
    value: typeof value === "function" && name !== "customElements" && !/^[A-Z]/.test(name) ? value.bind(win) : value,
    configurable: true,
    writable: true,
  });
}

export { dom, win };
