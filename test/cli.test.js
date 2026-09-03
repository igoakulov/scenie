import assert from "node:assert/strict";
import {
  access,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const bin = join(root, "bin/scenie.js");
const fixtures = join(root, "test/fixtures");

function runScenie(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, ...env },
      cwd: env.SCENIE_TEST_CWD || root,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

describe("CLI", () => {
  it("fails without workspace", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const r = await runScenie(["list"], { SCENIE_CONFIG_DIR: configDir });
    assert.equal(r.code, 1);
    await rm(configDir, { recursive: true, force: true });
  });

  it("init + list (no scene.js import) + validate", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };

    let r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr);

    const config = JSON.parse(
      await readFile(join(configDir, "config.json"), "utf8"),
    );
    assert.equal(config.workspace, workspace);

    await cp(join(fixtures, "valid-basic"), join(workspace, "scenes", "demo"), {
      recursive: true,
    });
    // Hidden backup: CLI list/validate must see it; .git junk must not appear.
    await cp(
      join(fixtures, "valid-basic"),
      join(workspace, "scenes", ".demo-bak"),
      { recursive: true },
    );
    await mkdir(join(workspace, "scenes", ".git"), { recursive: true });

    // list must not import scene.js (throw would fail the process)
    const bombDir = join(workspace, "scenes", "bomb");
    await mkdir(bombDir, { recursive: true });
    await writeFile(
      join(bombDir, "metadata.json"),
      JSON.stringify({
        title: "Bomb",
        description: "list must not load scene",
        tags: [],
      }),
    );
    await writeFile(
      join(bombDir, "scene.js"),
      `throw new Error("scene.js must not be imported by list");\nexport const scene = {};\n`,
    );

    r = await runScenie(["list"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenie(["validate", "demo"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenie(["validate", ".demo-bak"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenie(["validate", "bomb"], env);
    assert.equal(r.code, 1);

    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("init defaults to cwd", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-cwd-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const r = await runScenie(["init"], {
      SCENIE_CONFIG_DIR: configDir,
      SCENIE_TEST_CWD: workspace,
    });
    assert.equal(r.code, 0, r.stderr);
    const config = JSON.parse(
      await readFile(join(configDir, "config.json"), "utf8"),
    );
    assert.equal(
      await realpath(config.workspace),
      await realpath(workspace),
    );
  });

  it("init seeds example scenes without overwriting", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-seed-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };

    let r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    const exampleId = "example-theory";
    const metaPath = join(workspace, "scenes", exampleId, "metadata.json");
    const scenePath = join(workspace, "scenes", exampleId, "scene.js");
    await access(scenePath);
    await access(metaPath);

    // non-scene dirs under examples/ (e.g. screenshots) must not be seeded
    await assert.rejects(() => access(join(workspace, "scenes", "screenshots")));
    await assert.rejects(() => access(join(workspace, "scenes", "prompts")));

    r = await runScenie(["validate", exampleId], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    // mutate + re-init must not overwrite
    const marker = '{"title":"USER EDIT","description":"keep","tags":[],"dimensions":3}';
    await writeFile(metaPath, marker);
    r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.equal(await readFile(metaPath, "utf8"), marker);

    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("bare init uses config path and can re-seed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-cfgws-"));
    const otherCwd = await mkdtemp(join(tmpdir(), "scenie-othercwd-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };

    let r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    await rm(join(workspace, "scenes", "example-theory"), {
      recursive: true,
      force: true,
    });

    r = await runScenie(["init"], {
      ...env,
      SCENIE_TEST_CWD: otherCwd,
    });
    assert.equal(r.code, 0, r.stderr + r.stdout);
    await access(join(workspace, "scenes", "example-theory", "scene.js"));

    await rm(workspace, { recursive: true, force: true });
    await rm(otherCwd, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });
});
