import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "acorn";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir) {
  if (!existsSync(dir)) return [];
  let out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}

const banned = [
  ["??", "a ?? b"],
  ["?.", "a?.b"],
  ["?. call", "a?.()"],
  ["??=", "a ??= b"],
  ["||=", "a ||= b"],
  ["&&=", "a &&= b"],
  ["private field", "class A { #x = 1; }"],
  ["private method", "class A { #m() {} }"],
  ["static block", "class A { static { } }"],
  ["public class field", "class A { x = 1; }"],
];

for (const [name, code] of banned) {
  test(`acorn at ES2019 rejects ${name}`, () => {
    assert.throws(() => parse(code, { ecmaVersion: 2019, sourceType: "module" }), SyntaxError);
  });
}

test("acorn at ES2019 does not flag a?.5:b", () => {
  parse("var x = a?.5:b;", { ecmaVersion: 2019, sourceType: "module" });
});

test("every src/**/*.js parses as ES2019 module", () => {
  for (const file of walk(join(root, "src"))) {
    const rel = relative(root, file);
    try {
      parse(readFileSync(file, "utf8"), { ecmaVersion: 2019, sourceType: "module" });
    } catch (e) {
      assert.fail(`${rel} is not ES2019: ${e.message}`);
    }
  }
});

test("built kepler-card.js parses as an ES2019 script", () => {
  const file = join(root, "kepler-card.js");
  assert.ok(existsSync(file), "kepler-card.js is missing: run `npm run build` (npm test does this in pretest)");
  try {
    parse(readFileSync(file, "utf8"), { ecmaVersion: 2019, sourceType: "script" });
  } catch (e) {
    assert.fail(`kepler-card.js is not ES2019: ${e.message}`);
  }
});
