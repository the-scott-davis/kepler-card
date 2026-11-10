import { test } from "node:test";
import assert from "node:assert/strict";
import { ELEMENT_NAME, CARD_ENTRY, defineElement, pushCardEntry, register } from "../src/register.js";

function fakeReg() {
  const m = new Map();
  let resolve;
  const p = new Promise((r) => { resolve = r; });
  return {
    resolve,
    get: (n) => m.get(n),
    define(n, c) { m.set(n, c); },
    whenDefined: () => p,
  };
}
function capture() {
  const calls = [];
  const orig = console.warn;
  console.warn = (...a) => calls.push(a);
  return { calls, restore: () => { console.warn = orig; } };
}

test("defines when free, silent for same class", () => {
  const win = { customElements: fakeReg() };
  class A {}
  const c = capture();
  try { defineElement(A, win); defineElement(A, win); } finally { c.restore(); }
  assert.equal(win.customElements.get(ELEMENT_NAME), A);
  assert.equal(c.calls.length, 0);
});

test("different class warns naming kepler-card and keeps existing", () => {
  const win = { customElements: fakeReg() };
  class A {}
  class B {}
  defineElement(A, win);
  const c = capture();
  try { defineElement(B, win); } finally { c.restore(); }
  assert.equal(win.customElements.get(ELEMENT_NAME), A);
  assert.equal(c.calls.length, 1);
  assert.match(String(c.calls[0][0]), /^Kepler: .*kepler-card/);
});

test("reads win.customElements on each call", () => {
  const win = { customElements: fakeReg() };
  class A {}
  defineElement(A, win);
  const second = fakeReg();
  win.customElements = second;
  defineElement(A, win);
  assert.equal(second.get(ELEMENT_NAME), A);
});

test("define errors are caught and warned", () => {
  const reg = fakeReg();
  reg.define = () => { throw new Error("boom"); };
  const c = capture();
  try { defineElement(class {}, { customElements: reg }); } finally { c.restore(); }
  assert.equal(c.calls.length, 1);
  assert.match(String(c.calls[0][0]), /^Kepler: /);
});

test("pushCardEntry adds once and skips an existing type", () => {
  const win = {};
  pushCardEntry(win);
  pushCardEntry(win);
  assert.equal(win.customCards.length, 1);
  assert.deepEqual(win.customCards[0], CARD_ENTRY);
  const mine = { type: "kepler-card", name: "Mine" };
  const w2 = { customCards: [mine] };
  pushCardEntry(w2);
  assert.deepEqual(w2.customCards, [mine]);
});

test("register defines again in the swapped registry after whenDefined(home-assistant)", async () => {
  const orig = fakeReg();
  const swapped = fakeReg();
  const win = { customElements: orig };
  class A {}
  register(A, win);
  assert.equal(orig.get(ELEMENT_NAME), A);
  win.customElements = swapped;
  orig.resolve();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(swapped.get(ELEMENT_NAME), A);
  assert.equal(win.customCards.length, 1);
});

test("register warns once on a name collision, not again after whenDefined", async () => {
  const reg = fakeReg();
  const win = { customElements: reg };
  class A {}
  class B {}
  reg.define(ELEMENT_NAME, A);
  const c = capture();
  try {
    register(B, win);
    reg.resolve();
    await new Promise((r) => setTimeout(r, 0));
  } finally { c.restore(); }
  assert.equal(c.calls.length, 1);
  assert.equal(reg.get(ELEMENT_NAME), A);
});
