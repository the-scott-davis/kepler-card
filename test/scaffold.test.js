import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("package.json has the build, pretest, test and preview scripts", () => {
  for (const name of ["build", "pretest", "test", "preview"]) {
    assert.equal(typeof pkg.scripts[name], "string", `missing script ${name}`);
  }
  assert.equal(pkg.type, "module");
  assert.equal(pkg.private, true);
});

test(".gitignore ignores the built file but not src/kepler-card.js", () => {
  const rules = readFileSync(join(root, ".gitignore"), "utf8").split("\n").map((l) => l.trim());
  assert.ok(rules.includes("/kepler-card.js"), "root-anchored rule missing");
  assert.ok(!rules.includes("kepler-card.js"), "unanchored rule would hide src/kepler-card.js");
  const ignored = (p) => spawnSync("git", ["check-ignore", "-q", p], { cwd: root }).status === 0;
  assert.equal(ignored("kepler-card.js"), true);
  assert.equal(ignored("src/kepler-card.js"), false);
  assert.equal(ignored("node_modules/x.js"), true);
  assert.ok(execFileSync("git", ["--version"]).length > 0);
});

test("dist/kepler-card.js is committed (not ignored) and hacs.json names kepler-card.js", () => {
  const ignored = spawnSync("git", ["check-ignore", "-q", "dist/kepler-card.js"], { cwd: root }).status === 0;
  assert.equal(ignored, false);
  const hacs = JSON.parse(readFileSync(join(root, "hacs.json"), "utf8"));
  assert.equal(hacs.filename, "kepler-card.js");
});

test("README images are relative docs/ paths that exist", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const paths = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(paths.length >= 1, "README has at least one image");
  for (const p of paths) {
    assert.match(p, /^docs\/[\w.-]+\.png$/);
    assert.ok(existsSync(new URL("../" + p, import.meta.url)), p + " exists");
  }
});
