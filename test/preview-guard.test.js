import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hostAllowed, resolveServable } from "../scripts/preview-guard.js";

test("only the local host and port are accepted", () => {
  assert.ok(hostAllowed("127.0.0.1:4173", 4173));
  assert.ok(hostAllowed("localhost:4173", 4173));
  assert.ok(!hostAllowed("evil.example:4173", 4173));
  assert.ok(!hostAllowed("127.0.0.1:9", 4173));
  assert.ok(!hostAllowed(undefined, 4173));
});

test("serves preview/ and the built card only, and does not follow symlinks out", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "kp-")));
  mkdirSync(join(root, "preview"));
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, "preview", "index.html"), "x");
  writeFileSync(join(root, "kepler-card.js"), "x");
  writeFileSync(join(root, ".env"), "secret");
  writeFileSync(join(root, ".git", "config"), "x");
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "kp-out-")));
  writeFileSync(join(outside, "s.txt"), "s");
  symlinkSync(join(outside, "s.txt"), join(root, "preview", "link.txt"));
  symlinkSync(join(root, ".env"), join(root, "preview", "env.txt"));
  assert.equal(resolveServable(root, "/preview/index.html"), join(root, "preview", "index.html"));
  assert.equal(resolveServable(root, "/preview/"), join(root, "preview", "index.html"));
  assert.equal(resolveServable(root, "/kepler-card.js"), join(root, "kepler-card.js"));
  assert.equal(resolveServable(root, "/.env"), null);
  assert.equal(resolveServable(root, "/.git/config"), null);
  assert.equal(resolveServable(root, "/preview/link.txt"), null);
  assert.equal(resolveServable(root, "/preview/env.txt"), null);
  assert.equal(resolveServable(root, "/preview/../.env"), null);
  assert.equal(resolveServable(root, "/nope"), null);
});
