import { realpathSync, statSync } from "node:fs";
import { join, resolve, sep } from "node:path";

// Only the preview page, its helpers and the built card are served.
export function hostAllowed(host, port) {
  if (typeof host !== "string") return false;
  return host === "127.0.0.1:" + port || host === "localhost:" + port;
}

/** Returns the real file path to serve, or null. Symlinks are resolved before the containment check. */
export function resolveServable(root, path) {
  if (typeof path !== "string" || path.indexOf("\0") !== -1) return null;
  const realRoot = realpathSync(root);
  const previewDir = join(realRoot, "preview");
  const built = join(realRoot, "kepler-card.js");
  let file;
  try {
    file = realpathSync(resolve(join(realRoot, path)));
    if (statSync(file).isDirectory()) file = realpathSync(join(file, "index.html"));
    if (!statSync(file).isFile()) return null;
  } catch (e) {
    return null;
  }
  if (file === built || file.indexOf(previewDir + sep) === 0) return file;
  return null;
}
