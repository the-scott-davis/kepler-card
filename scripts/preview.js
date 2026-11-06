import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hostAllowed, resolveServable } from "./preview-guard.js";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const port = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer((req, res) => {
  if (!hostAllowed(req.headers.host, port)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
  } catch (e) {
    res.writeHead(400).end("Bad request");
    return;
  }
  if (path.indexOf("\0") !== -1) {
    res.writeHead(400).end("Bad request");
    return;
  }
  const file = resolveServable(root, path);
  if (!file) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Kepler preview: http://127.0.0.1:${port}/preview/index.html`);
});
