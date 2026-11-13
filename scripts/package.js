import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Returns a list of problems with the release asset; empty means it is fit to upload.
export function checkBundle(file) {
  if (!existsSync(file)) return [file + " does not exist"];
  if (statSync(file).size === 0) return [file + " is empty"];
  const text = readFileSync(file, "utf8");
  if (!text.includes('"kepler-card"')) return [file + " does not register the kepler-card custom element"];
  return [];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = checkBundle(join(root, "kepler-card.js"));
  if (problems.length) {
    for (const p of problems) console.error("package check failed: " + p);
    process.exit(1);
  }
  console.log("kepler-card.js is ready to upload as the release asset");
}
