import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import http from "node:http";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const bin = join(root, "bin/scenie.js");
const fixtures = join(root, "test/fixtures");

function runScenie(args, env, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, ...env },
      cwd: env.SCENIE_TEST_CWD || root,
    });
    let stdout = "";
    let stderr = "";
    const timer =
      opts.timeoutMs != null
        ? setTimeout(() => {
            child.kill("SIGTERM");
          }, opts.timeoutMs)
        : null;
    child.stdout.on("data", (d) => {
      stdout += d;
      if (opts.onStdout) opts.onStdout(stdout, stderr, child);
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? (signal ? 0 : 1), signal, stdout, stderr });
    });
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body }),
        );
      })
      .on("error", reject);
  });
}

describe("show", () => {
  it("fails when scene not found", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };
    await runScenie(["init", workspace], env);
    const r = await runScenie(["show", "missing-scene"], env);
    assert.equal(r.code, 1);
    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("fails validate gate on bad scene", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };
    await runScenie(["init", workspace], env);
    await cp(
      join(fixtures, "invalid-metadata"),
      join(workspace, "scenes", "bad"),
      { recursive: true },
    );
    const r = await runScenie(["show", "bad"], env);
    assert.equal(r.code, 1);
    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("listens and serves viewer + scene file + /api/scenes", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const port = 19000 + Math.floor(Math.random() * 1000);
    const env = { SCENIE_CONFIG_DIR: configDir };
    await runScenie(["init", workspace], env);
    const cfgPath = join(configDir, "config.json");
    const cfg = JSON.parse(await readFile(cfgPath, "utf8"));
    cfg.port = port;
    await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

    await cp(join(fixtures, "valid-basic"), join(workspace, "scenes", "demo"), {
      recursive: true,
    });
    await cp(
      join(fixtures, "valid-basic"),
      join(workspace, "scenes", ".hidden-bak"),
      { recursive: true },
    );
    await cp(
      join(fixtures, "invalid-metadata"),
      join(workspace, "scenes", "bad-meta"),
      { recursive: true },
    );

    let listenUrl = "";
    const rPromise = runScenie(["show", "demo"], env, {
      timeoutMs: 15000,
      onStdout(stdout, _stderr, child) {
        const m = stdout.match(/^listen (\S+)/m);
        if (m && !listenUrl) {
          listenUrl = m[1];
          assert.match(listenUrl, /[?&]scene=demo(?:&|$)/);
          void (async () => {
            try {
              const page = await httpGet(listenUrl);
              assert.equal(page.status, 200);
              assert.match(page.body, /root|Scenie/i);

              const sceneJs = await httpGet(
                `http://127.0.0.1:${port}/ws/scenes/demo/scene.js`,
              );
              assert.equal(sceneJs.status, 200);
              assert.match(sceneJs.body, /export \{ scene \}/);

              const catalog = await httpGet(
                `http://127.0.0.1:${port}/api/scenes`,
              );
              assert.equal(catalog.status, 200);
              const entries = JSON.parse(catalog.body);
              assert.ok(Array.isArray(entries));
              const byId = Object.fromEntries(
                entries.map((e) => [e.id, e]),
              );
              assert.equal(byId.demo?.title, "Valid basic");
              assert.equal(byId["bad-meta"]?.id, "bad-meta");
              assert.equal(byId["bad-meta"]?.title, undefined);
              assert.equal(byId[".hidden-bak"], undefined);
            } finally {
              child.kill("SIGTERM");
            }
          })();
        }
      },
    });

    const r = await rPromise;
    assert.ok(listenUrl, r.stderr + r.stdout);

    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("show without id serves", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const port = 20000 + Math.floor(Math.random() * 1000);
    const env = { SCENIE_CONFIG_DIR: configDir };
    await runScenie(["init", workspace], env);
    const cfgPath = join(configDir, "config.json");
    const cfg = JSON.parse(await readFile(cfgPath, "utf8"));
    cfg.port = port;
    await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + "\n");

    let gotListen = false;
    const rPromise = runScenie(["show"], env, {
      timeoutMs: 12000,
      onStdout(stdout, _stderr, child) {
        const m = stdout.match(/^listen (\S+)/m);
        if (m && !gotListen) {
          gotListen = true;
          void (async () => {
            try {
              const page = await httpGet(m[1]);
              assert.equal(page.status, 200);
            } finally {
              child.kill("SIGTERM");
            }
          })();
        }
      },
    });
    await rPromise;
    assert.ok(gotListen);
    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });
});
