import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const url = (p) => new URL(p, import.meta.url);

test("dist/kepler-card.js exists, is non-empty and equals the root build", () => {
  assert.ok(statSync(url("../dist/kepler-card.js")).size > 0);
  assert.equal(readFileSync(url("../dist/kepler-card.js"), "utf8"), readFileSync(url("../kepler-card.js"), "utf8"));
});
