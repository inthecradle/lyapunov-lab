// Test-only static host. Mount under a repository path just like GitHub Pages,
// without Vite's SPA fallback, so incorrect asset paths fail visibly.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist");
const mount = "/lyapunov-lab/";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    if (!pathname.startsWith(mount)) throw new Error("Unknown mount");
    const file = resolve(root, pathname.slice(mount.length) || "index.html");
    if (!file.startsWith(root + sep)) throw new Error("Outside dist");
    const data = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(4173, "127.0.0.1");
