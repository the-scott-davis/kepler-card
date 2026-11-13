import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

test("dist/kepler-card.js is committed (not ignored) and hacs.json names the release asset", () => {
  const ignored = spawnSync("git", ["check-ignore", "-q", "dist/kepler-card.js"], { cwd: root }).status === 0;
  assert.equal(ignored, false);
  const hacs = JSON.parse(readFileSync(join(root, "hacs.json"), "utf8"));
  assert.equal("zip_release" in hacs, false);
  assert.equal(hacs.filename, "kepler-card.js");
});

test("hacs.json filename is the file release.yml uploads", () => {
  const hacs = JSON.parse(readFileSync(join(root, "hacs.json"), "utf8"));
  const wf = readFileSync(join(root, ".github", "workflows", "release.yml"), "utf8");
  const uploads = [...wf.matchAll(/gh release upload\s+"?\$TAG"?\s+(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(uploads, [hacs.filename]);
  assert.doesNotMatch(wf, /\bzip\b/);
});

test("package check passes a real bundle and fails missing, empty and unregistered ones", async () => {
  const { checkBundle } = await import("../scripts/package.js");
  const dir = mkdtempSync(join(tmpdir(), "kepler-pkg-"));
  try {
    const good = join(dir, "good.js");
    writeFileSync(good, 'customElements.define("kepler-card", class {});');
    assert.deepEqual(checkBundle(good), []);
    assert.equal(checkBundle(join(dir, "missing.js")).length, 1);
    const empty = join(dir, "empty.js");
    writeFileSync(empty, "");
    assert.equal(checkBundle(empty).length, 1);
    const other = join(dir, "other.js");
    writeFileSync(other, 'console.log("hello");');
    assert.equal(checkBundle(other).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
