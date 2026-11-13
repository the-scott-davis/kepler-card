import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "src", "index.js");
const outfile = join(root, "kepler-card.js");
// HACS looks in dist/ only until a release exists; installs then use the release asset kepler-card.js.
// The same bundle is also written to dist/ and committed for that period.
const distFile = join(root, "dist", "kepler-card.js");

if (existsSync(entry)) {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    target: "es2019",
    minify: false,
    legalComments: "none",
    outfile,
    logLevel: "warning",
  });
  console.log("Built kepler-card.js");
} else {
  // Before src/index.js exists, keep `npm test` working with a comment-only file.
  writeFileSync(outfile, "/* Kepler: src/index.js is not present yet, so this build is empty. */\n");
  console.log("Wrote placeholder kepler-card.js (no src/index.js)");
}

mkdirSync(dirname(distFile), { recursive: true });
copyFileSync(outfile, distFile);
