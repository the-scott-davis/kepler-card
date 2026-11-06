import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEME_VARS, THEME_DEFAULTS, cssVar, computedReader, resolveTheme,
  defaultTheme, parseBackground, statusCss
} from "../src/theme.js";

const reader = map => name => (map[name] === undefined ? "" : map[name]);

test("defaults match the design note", () => {
  assert.equal(THEME_DEFAULTS.background, "radial-gradient(ellipse at 50% 48%, #13213a 0%, #0b1220 55%, #070b14 100%)");
  assert.equal(THEME_DEFAULTS.text, "#e2e8f0");
  assert.deepEqual(
    [THEME_DEFAULTS.online, THEME_DEFAULTS.recent, THEME_DEFAULTS.stale, THEME_DEFAULTS.new, THEME_DEFAULTS.unknown],
    ["#34d399", "#fbbf24", "#f87171", "#c084fc", "#64748b"]);
  assert.equal(THEME_DEFAULTS.font, "Roboto, system-ui, sans-serif");
  assert.equal(THEME_DEFAULTS.ring, "rgba(148,163,184,.07)");
  assert.equal(THEME_DEFAULTS.link, "");
  assert.equal(THEME_DEFAULTS.highlight, "#60a5fa");
  assert.equal(THEME_DEFAULTS.tooltipBackground, "rgba(15,23,42,.96)");
  assert.equal(THEME_DEFAULTS.tooltipText, "#e2e8f0");
  assert.equal(Object.keys(THEME_VARS).length, 13);
  assert.deepEqual(Object.keys(THEME_VARS), Object.keys(THEME_DEFAULTS));
  assert.equal(THEME_VARS.tooltipText, "--kepler-tooltip-text-color");
});

test("cssVar gives var() with default and a font chain", () => {
  assert.equal(cssVar("online"), "var(--kepler-status-online, #34d399)");
  assert.equal(cssVar("font"),
    "var(--kepler-font-family, var(--ha-font-family-body, Roboto, system-ui, sans-serif))");
});

test("resolveTheme defaults, link null, font chain", () => {
  const t = defaultTheme();
  assert.equal(t.link, null);
  assert.equal(t.font, "Roboto, system-ui, sans-serif");
  assert.equal(t.online, "#34d399");
  assert.equal(resolveTheme(reader({ "--ha-font-family-body": " Foo " })).font, "Foo");
  assert.equal(resolveTheme(reader({ "--ha-font-family-body": "Foo", "--kepler-font-family": "Bar" })).font, "Bar");
  const s = resolveTheme(reader({ "--kepler-link-color": " #123456 ", "--kepler-status-stale": "red" }));
  assert.equal(s.link, "#123456");
  assert.equal(s.stale, "red");
});

test("computedReader trims computed values", () => {
  globalThis.getComputedStyle = () => ({ getPropertyValue: n => (n === "--x" ? "  v " : "") });
  try {
    const r = computedReader({});
    assert.equal(r("--x"), "v");
    assert.equal(r("--y"), "");
  } finally { delete globalThis.getComputedStyle; }
});

test("parseBackground gradient", () => {
  const b = parseBackground(THEME_DEFAULTS.background);
  assert.equal(b.kind, "radial");
  assert.deepEqual(b.stops, [
    { offset: 0, color: "#13213a" }, { offset: 0.55, color: "#0b1220" }, { offset: 1, color: "#070b14" }]);
});

test("parseBackground solid and other images", () => {
  assert.deepEqual(parseBackground("#101010"), { kind: "solid", color: "#101010" });
  assert.deepEqual(parseBackground("linear-gradient(90deg, #111 0%, #222 100%)"), { kind: "solid", color: "#111" });
  assert.equal(parseBackground("").kind, "solid");
  const r = parseBackground("radial-gradient(rgba(1,2,3,.5), #fff)");
  assert.equal(r.kind, "radial");
  assert.deepEqual(r.stops, [{ offset: 0, color: "rgba(1,2,3,.5)" }, { offset: 1, color: "#fff" }]);
});

test("statusCss var mode: link follows status while unset", () => {
  const css = statusCss(null);
  assert.ok(css.includes(".lk.st-online{stroke:var(--kepler-link-color, var(--kepler-status-online, #34d399))}"));
  assert.ok(css.includes(".disc.st-new{stroke:var(--kepler-status-new, #c084fc)}"));
  assert.ok(css.includes(".halo.st-stale{fill:var(--kepler-status-stale, #f87171)}"));
  assert.ok(css.includes(".ic.st-unknown{fill:var(--kepler-status-unknown, #64748b)}"));
  assert.equal((css.match(/\.lk\.st-/g) || []).length, 5);
});

test("statusCss literal mode", () => {
  const t = defaultTheme();
  let css = statusCss(t);
  assert.ok(css.includes(".lk.st-recent{stroke:#fbbf24}"));
  assert.ok(!css.includes("var("));
  css = statusCss(Object.assign({}, t, { link: "#abcdef" }));
  assert.ok(css.includes(".lk.st-recent{stroke:#abcdef}"));
  assert.ok(css.includes(".disc.st-recent{stroke:#fbbf24}"));
});
