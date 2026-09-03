import { createReadStream, existsSync, statSync } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { withParamsPreamble } from "../params-preamble.js";
import { pipeline } from "node:stream/promises";
import { listSceneEntries } from "../catalog.js";
import { packageRoot } from "../examples.js";

const require = createRequire(import.meta.url);

export { packageRoot };

export function viewerDistDir(root = packageRoot()): string {
  return join(root, "viewer", "dist");
}

export function threePackageRoot(): string {
  // three does not export package.json; resolve main entry → package root.
  // e.g. …/node_modules/three/build/three.cjs → …/node_modules/three
  return resolve(dirname(require.resolve("three")), "..");
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
};

function contentType(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

function setCommonHeaders(res: http.ServerResponse): void {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
}

function sendText(
  res: http.ServerResponse,
  status: number,
  body: string,
  type = "text/plain; charset=utf-8",
): void {
  setCommonHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(body);
}

function isInside(root: string, candidate: string): boolean {
  const rootAbs = resolve(root);
  const candAbs = resolve(candidate);
  const rel = relative(rootAbs, candAbs);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith(".."));
}

/**
 * Resolve a request path under root without leaving it.
 * Returns absolute path or null if unsafe / missing.
 */
function safeJoin(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath);
  const cleaned = decoded.replace(/^\/+/, "");
  const abs = normalize(join(root, cleaned));
  if (!isInside(root, abs)) return null;
  return abs;
}

async function sendFile(
  res: http.ServerResponse,
  filePath: string,
): Promise<void> {
  let st;
  try {
    st = await stat(filePath);
  } catch {
    sendText(res, 404, "not found");
    return;
  }
  if (!st.isFile()) {
    sendText(res, 404, "not found");
    return;
  }
  setCommonHeaders(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType(filePath));
  res.setHeader("Content-Length", String(st.size));
  await pipeline(createReadStream(filePath), res);
}

function injectImportMap(html: string): string {
  const importMap = {
    imports: {
      three: "/vendor/three/build/three.module.js",
      "three/addons/": "/vendor/three/examples/jsm/",
      "three/examples/jsm/": "/vendor/three/examples/jsm/",
    },
  };
  const tag = `<script type="importmap">${JSON.stringify(importMap)}</script>`;
  if (html.includes('type="importmap"') || html.includes("type='importmap'")) {
    return html;
  }
  // Import maps must appear before any module scripts.
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>\n    ${tag}`);
  }
  if (html.includes("<head ")) {
    return html.replace(/<head[^>]*>/, (m) => `${m}\n    ${tag}`);
  }
  return `${tag}\n${html}`;
}

export interface ShowServerOptions {
  workspace: string;
  port: number;
  host?: string;
}

export interface ShowServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export async function startShowServer(
  options: ShowServerOptions,
): Promise<ShowServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port;
  const workspace = resolve(options.workspace);
  const viewerRoot = viewerDistDir();
  const threeRoot = threePackageRoot();

  if (!existsSync(join(viewerRoot, "index.html"))) {
    throw new Error(
      `viewer assets missing: ${viewerRoot}\nrun: npm run build:viewer`,
    );
  }

  const server = http.createServer((req, res) => {
    void handleRequest(req, res, { workspace, viewerRoot, threeRoot });
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });

  const url = `http://${host}:${port}/`;

  return {
    url,
    port,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((err) => (err ? reject(err) : resolveClose()));
      }),
  };
}

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  roots: { workspace: string; viewerRoot: string; threeRoot: string },
): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "method not allowed");
      return;
    }

    const httpHost = req.headers.host ?? "127.0.0.1";
    const u = new URL(req.url ?? "/", `http://${httpHost}`);
    let pathname = u.pathname;
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    // Library catalog for the viewer (metadata titles only; no scene.js).
    if (pathname === "/api/scenes") {
      const entries = await listSceneEntries(roots.workspace);
      const body = JSON.stringify(entries);
      setCommonHeaders(res);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      if (req.method === "HEAD") {
        res.setHeader("Content-Length", String(Buffer.byteLength(body)));
        res.end();
        return;
      }
      res.end(body);
      return;
    }

    if (pathname === "/ws" || pathname.startsWith("/ws/")) {
      const rest = pathname === "/ws" ? "" : pathname.slice("/ws/".length);
      if (!rest.startsWith("scenes/")) {
        sendText(res, 404, "not found");
        return;
      }
      const filePath = safeJoin(roots.workspace, rest);
      if (!filePath) {
        sendText(res, 403, "forbidden");
        return;
      }
      // Only serve under scenes/
      const scenesRoot = join(roots.workspace, "scenes");
      if (!isInside(scenesRoot, filePath) && filePath !== scenesRoot) {
        sendText(res, 403, "forbidden");
        return;
      }
      if (basename(filePath) === "scene.js" && u.searchParams.get("p") === "1") {
        let raw: string;
        try {
          raw = await readFile(filePath, "utf8");
        } catch {
          sendText(res, 404, "not found");
          return;
        }
        const body = withParamsPreamble(raw);
        setCommonHeaders(res);
        res.statusCode = 200;
        res.setHeader("Content-Type", contentType(filePath));
        res.setHeader("Content-Length", String(Buffer.byteLength(body)));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        res.end(body);
        return;
      }
      if (req.method === "HEAD") {
        try {
          const st = await stat(filePath);
          if (!st.isFile()) {
            sendText(res, 404, "not found");
            return;
          }
          setCommonHeaders(res);
          res.statusCode = 200;
          res.setHeader("Content-Type", contentType(filePath));
          res.setHeader("Content-Length", String(st.size));
          res.end();
        } catch {
          sendText(res, 404, "not found");
        }
        return;
      }
      await sendFile(res, filePath);
      return;
    }

    if (pathname === "/vendor/three" || pathname.startsWith("/vendor/three/")) {
      const rest =
        pathname === "/vendor/three"
          ? ""
          : pathname.slice("/vendor/three/".length);
      const filePath = safeJoin(roots.threeRoot, rest || "package.json");
      if (!filePath) {
        sendText(res, 403, "forbidden");
        return;
      }
      await sendFile(res, filePath);
      return;
    }

    if (pathname === "/" || pathname === "/index.html") {
      const indexPath = join(roots.viewerRoot, "index.html");
      const html = injectImportMap(await readFile(indexPath, "utf8"));
      setCommonHeaders(res);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.end(html);
      return;
    }

    const assetPath = safeJoin(roots.viewerRoot, pathname.slice(1));
    if (assetPath && existsSync(assetPath) && statSync(assetPath).isFile()) {
      await sendFile(res, assetPath);
      return;
    }

    // SPA fallback for client routes
    if (!extname(pathname)) {
      const indexPath = join(roots.viewerRoot, "index.html");
      const html = injectImportMap(await readFile(indexPath, "utf8"));
      setCommonHeaders(res);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }

    sendText(res, 404, "not found");
  } catch (err) {
    if (!res.headersSent) {
      sendText(
        res,
        500,
        err instanceof Error ? err.message : String(err),
      );
    } else {
      res.end();
    }
  }
}

export const DEFAULT_SHOW_PORT = 3471;

export async function assertViewerBuilt(): Promise<void> {
  const indexPath = join(viewerDistDir(), "index.html");
  try {
    await access(indexPath);
  } catch {
    throw new Error(
      `viewer assets missing: ${indexPath}\nrun: npm run build:viewer`,
    );
  }
}
