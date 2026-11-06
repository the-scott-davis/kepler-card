import test from "node:test";
import assert from "node:assert/strict";
import { esc, trunc, clamp01, easeOut, cssHeight } from "../src/util.js";

test("esc escapes markup and maps null to empty", () => {
  assert.equal(esc(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
});

test("trunc shortens with an ellipsis", () => {
  assert.equal(trunc("abcdef", 6), "abcdef");
  assert.equal(trunc("abcdefg", 6), "abcde…");
  assert.equal(trunc(null, 5), "");
});

test("clamp01 and easeOut", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(5), 1);
  assert.ok(easeOut(0.5) > 0.5);
});

test("cssHeight accepts numbers and safe lengths, rejects the rest", () => {
  assert.equal(cssHeight(700), "700px");
  assert.equal(cssHeight("700"), "700px");
  assert.equal(cssHeight(0), "900px");
  assert.equal(cssHeight(-3), "900px");
  assert.equal(cssHeight(true), "900px");
  assert.equal(cssHeight(null), "900px");
  assert.equal(cssHeight(""), "900px");
  assert.equal(cssHeight("calc(100vh - 180px)"), "calc(100vh - 180px)");
  assert.equal(cssHeight("1px; } body { x: y"), "900px");
  assert.equal(cssHeight("10px /* c */"), "900px");
});
