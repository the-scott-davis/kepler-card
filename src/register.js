export const ELEMENT_NAME = "kepler-card";

export const CARD_ENTRY = {
  type: "kepler-card",
  name: "Kepler",
  description: "Orbital map of any device tree.",
  preview: false,
  documentationURL: "https://github.com/the-scott-davis/kepler-card",
};

// Define the element in whatever registry win.customElements is right now. The registry is read on every
// call because the host app can swap in a scoped registry after this file first runs.
export function defineElement(cls, win) {
  const w = win || window;
  try {
    const reg = w.customElements;
    const held = reg.get(ELEMENT_NAME);
    if (!held) {
      reg.define(ELEMENT_NAME, cls);
    } else if (held !== cls) {
      console.warn("Kepler: " + ELEMENT_NAME + " is already defined by another element class; keeping the existing one.");
    }
  } catch (e) {
    console.warn("Kepler: " + ELEMENT_NAME + " define failed", e);
  }
}

export function pushCardEntry(win) {
  const w = win || window;
  w.customCards = w.customCards || [];
  if (!w.customCards.find(function (c) { return c && c.type === CARD_ENTRY.type; })) {
    w.customCards.push(Object.assign({}, CARD_ENTRY));
  }
}

export function register(cls, win) {
  const w = win || window;
  defineElement(cls, w);
  const reg = w.customElements;
  if (reg && reg.whenDefined) {
    reg.whenDefined("home-assistant")
      .then(function () { defineElement(cls, w); })
      .catch(function (e) { console.warn("Kepler: " + ELEMENT_NAME + " define failed", e); });
  }
  pushCardEntry(w);
}
