import { access, cp, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { sceneDir } from "./workspace.js";

/** Walk up from this module until package.json (works from dist/ and dist/server/). */
export function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) {
      throw new Error("package root not found");
    }
    dir = parent;
  }
}

export function examplesDir(root = packageRoot()): string {
  return join(root, "examples");
}

async function isScenePackageDir(dir: string): Promise<boolean> {
  try {
    await access(join(dir, "metadata.json"));
    await access(join(dir, "scene.js"));
    await access(join(dir, "host.js"));
    return true;
  } catch {
    return false;
  }
}

/** Scene package ids under package examples/ (dirs with metadata.json, scene.js, host.js). */
export async function listExampleSceneIds(
  root = packageRoot(),
): Promise<string[]> {
  const dir = examplesDir(root);
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const ids: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".")) continue;
    const full = join(dir, ent.name);
    if (await isScenePackageDir(full)) {
      ids.push(ent.name);
    }
  }
  ids.sort();
  return ids;
}

/**
 * Copy missing example scenes into workspace/scenes/<id>/.
 * Never overwrites an existing scene folder.
 * @returns ids that were newly created
 */
export async function seedExampleScenes(
  workspace: string,
  root = packageRoot(),
): Promise<string[]> {
  const ids = await listExampleSceneIds(root);
  const created: string[] = [];
  if (ids.length === 0) return created;
  for (const id of ids) {
    const dest = sceneDir(workspace, id);
    try {
      const st = await stat(dest);
      if (st.isDirectory()) continue;
    } catch {
      // missing → copy
    }
    const src = join(examplesDir(root), id);
    await cp(src, dest, { recursive: true, force: false, errorOnExist: true });
    created.push(id);
  }
  return created;
}

