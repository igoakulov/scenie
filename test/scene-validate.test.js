import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateScene } from "../dist/validate/scene.js";

const fixtures = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

async function copyFixture(name, workspace, id = name) {
  const dest = join(workspace, "scenes", id);
  await mkdir(join(workspace, "scenes"), { recursive: true });
  await cp(join(fixtures, name), dest, { recursive: true });
  return dest;
}

describe("validateScene", () => {
  it("accepts valid-basic", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    await copyFixture("valid-basic", workspace);
    const result = await validateScene(workspace, "valid-basic");
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  });

  it("fails invalid metadata", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    await copyFixture("invalid-metadata", workspace, "bad-meta");
    const result = await validateScene(workspace, "bad-meta");
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("title")));
  });

  it("fails when validateParams rejects defaults", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    await copyFixture("valid-params-fail", workspace, "params-fail");
    const result = await validateScene(workspace, "params-fail");
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.startsWith("params")));
  });

  it("warns when host.js is missing", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    const dir = await copyFixture("valid-basic", workspace, "no-host");
    await rm(join(dir, "host.js"));
    await writeFile(
      join(dir, "scene.js"),
      `import * as THREE from "three";\nexport const scene = new THREE.Scene();\n`,
      "utf8",
    );
    const result = await validateScene(workspace, "no-host");
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
    assert.ok(
      result.issues.some(
        (i) =>
          i.path === "host" &&
          i.level === "warning" &&
          /missing host\.js/.test(i.message),
      ),
    );
  });

  it("fails when there is no scene export and import did not construct a Scene", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    const dir = await copyFixture("valid-basic", workspace, "no-create");
    await writeFile(join(dir, "scene.js"), "export function setup() {}\n", "utf8");
    const result = await validateScene(workspace, "no-create");
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path === "scene"));
  });

  it("accepts a constructed Scene without an export", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    const dir = await copyFixture("valid-basic", workspace, "constructed");
    await writeFile(
      join(dir, "scene.js"),
      `import * as THREE from "three";\nnew THREE.Scene();\n`,
      "utf8",
    );
    const result = await validateScene(workspace, "constructed");
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  });

  it("requires bindInput on host.js when host.camera is false", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenie-val-"));
    const dir = await copyFixture("valid-basic", workspace, "cam-off");
    const hostSrc = await readFile(join(dir, "host.js"), "utf8");
    await writeFile(
      join(dir, "host.js"),
      `export const host = { camera: false };\n${hostSrc}`,
      "utf8",
    );
    const missing = await validateScene(workspace, "cam-off");
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((i) => i.path === "host.bindInput"));

    await writeFile(
      join(dir, "host.js"),
      `export const host = { camera: false };\nexport function bindInput() {}\n${hostSrc}`,
      "utf8",
    );
    const ok = await validateScene(workspace, "cam-off");
    assert.equal(ok.ok, true, JSON.stringify(ok.issues, null, 2));
  });
});
