import assert from "node:assert/strict";
import {
  access,
  cp,
  mkdtemp,
  mkdir,
  readFile,
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
  it("init + list (no scene.js import) + validate", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };

    let r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr);

    await cp(join(fixtures, "valid-basic"), join(workspace, "scenes", "demo"), {
      recursive: true,
    });
    await cp(
      join(fixtures, "valid-basic"),
      join(workspace, "scenes", ".demo-bak"),
      { recursive: true },
    );
    await mkdir(join(workspace, "scenes", ".git"), { recursive: true });

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

    await mkdir(join(workspace, "scenes", "physics"), { recursive: true });
    await cp(
      join(fixtures, "valid-basic"),
      join(workspace, "scenes", "physics", "gravity"),
      { recursive: true },
    );

    r = await runScenie(["list"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /@ scenes\/demo\b/);
    assert.match(r.stdout, /@ scenes\/physics\/gravity\b/);
    assert.doesNotMatch(r.stdout, /@ scenes\/physics\n/);

    r = await runScenie(["validate", "scenes/demo"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenie(["validate", "scenes/.demo-bak"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenie(["validate", "scenes/physics/gravity"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenie(["validate", "scenes/physics"], env);
    assert.equal(r.code, 1);
    assert.match(r.stdout, /ERR not found/);

    r = await runScenie(["validate", "scenes/bomb"], env);
    assert.equal(r.code, 1);

    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("init seeds example scenes without overwriting", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-seed-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenie-cfg-"));
    const env = { SCENIE_CONFIG_DIR: configDir };

    let r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    const exampleId = "examples/example-theory";
    const metaPath = join(workspace, "scenes", exampleId, "metadata.json");
    const scenePath = join(workspace, "scenes", exampleId, "scene.js");
    await access(scenePath);
    await access(metaPath);

    await assert.rejects(() => access(join(workspace, "scenes", "screenshots")));

    r = await runScenie(["validate", `scenes/${exampleId}`], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    const marker = '{"title":"USER EDIT","description":"keep","tags":[]}';
    await writeFile(metaPath, marker);
    r = await runScenie(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.equal(await readFile(metaPath, "utf8"), marker);

    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });
});
