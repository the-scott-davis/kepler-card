import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const code = readFileSync(new URL("../kepler-card.js", import.meta.url), "utf8");

function load(win) {
  win.eval(code);
}
function fresh() {
  return new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only", url: "http://localhost/" }).window;
}

test("single source builds to one real file that registers once", () => {
  assert.ok(!/src\/index\.js is not present/.test(code), "stub was built");
  assert.ok(code.length > 5000);
  const win = fresh();
  load(win);
  const cls = win.customElements.get("kepler-card");
  assert.equal(typeof cls, "function");
  const entries = win.customCards.filter((c) => c.type === "kepler-card");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "Kepler");

  // loading again: new bundle holds a different class, so the old one stays and the entry is not repeated
  const warns = [];
  win.console.warn = (...a) => warns.push(a.join(" "));
  load(win);
  assert.equal(win.customElements.get("kepler-card"), cls);
  assert.equal(win.customCards.filter((c) => c.type === "kepler-card").length, 1);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /kepler-card/);
});

test("a held foreign class is kept with a warning", () => {
  const win = fresh();
  class Other extends win.HTMLElement {}
  win.customElements.define("kepler-card", Other);
  const warns = [];
  win.console.warn = (...a) => warns.push(a.join(" "));
  load(win);
  assert.equal(win.customElements.get("kepler-card"), Other);
  assert.equal((win.customCards || []).filter((c) => c.type === "kepler-card").length, 0);
  assert.ok(warns.some((w) => /kepler-card/.test(w)));
});
