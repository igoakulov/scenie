import { mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Path segment: optional leading `.` then kebab-case (hidden from Library). */
const SCENE_ID = /^\.?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names that are never scene folders (OS / VCS junk under `scenes/`).
 * Compared case-insensitively. Files like `.DS_Store` are already skipped
 * (we only list directories); listed here if they ever appear as dirs.
 */
const IGNORED_SCENE_ENTRIES = new Set(
  [
    ".ds_store",
    ".git",
    ".svn",
    ".hg",
    ".bzr",
    "__macosx",
    "thumbs.db",
    "desktop.ini",
    "node_modules",
    ".spotlight-v100",
    ".trashes",
    ".fseventsd",
    ".temporaryitems",
    ".apdisk",
    ".appledouble",
    ".lsoverride",
    "lost+found",
  ].map((s) => s.toLowerCase()),
);

/** Posix id relative to scenes/ — kebab-case segments, optional leading `.` per segment. */
export function isSceneId(id: string): boolean {
  if (!id || id.includes("\\")) return false;
  return id.split("/").every((seg) => SCENE_ID.test(seg));
}

function isIgnoredSceneEntry(name: string): boolean {
  return IGNORED_SCENE_ENTRIES.has(name.toLowerCase());
}

export function scenesDir(workspace: string): string {
  return join(workspace, "scenes");
}

export function sceneDir(workspace: string, id: string): string {
  return join(scenesDir(workspace), ...id.split("/"));
}

/**
 * CLI arg → id relative to scenes/.
 * Workspace-relative `scenes/<id>` only (posix or `\\`); no `..` / absolute.
 */
export function parseSceneArg(arg: string): string | undefined {
  const n = arg.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!n || n.includes("..") || n.startsWith("/") || /^[a-zA-Z]:/.test(n)) {
    return undefined;
  }
  if (!n.startsWith("scenes/")) return undefined;
  const id = n.slice("scenes/".length);
  if (!isSceneId(id)) return undefined;
  return id;
}

export async function ensureWorkspaceLayout(workspace: string): Promise<void> {
  await mkdir(scenesDir(workspace), { recursive: true });
}

export async function hasScenesDir(workspace: string): Promise<boolean> {
  try {
    const s = await stat(scenesDir(workspace));
    return s.isDirectory();
  } catch {
    return false;
  }
}

export type ListSceneIdsOptions = {
  /**
   * Viewer Library only: omit every `.*` directory (any path segment).
   * CLI list / validate-all leave this unset so agents discover hidden backups.
   */
  library?: boolean;
};

async function isSceneLeaf(dir: string): Promise<boolean> {
  for (const name of ["metadata.json", "scene.js"] as const) {
    try {
      const s = await stat(join(dir, name));
      if (s.isFile()) return true;
    } catch {
      /* missing */
    }
  }
  return false;
}

/**
 * Scene folders under scenes/ (posix ids, nested ok).
 * Missing scenes/ → [] (callers that care about layout use hasScenesDir).
 *
 * A scene is a kebab-case directory that contains metadata.json or scene.js;
 * do not recurse into it. Other kebab-case dirs are organizers and are walked.
 * Skips OS/VCS junk and directory symlinks. Dot-prefixed dirs are included
 * unless `library: true`.
 */
export async function listSceneIds(
  workspace: string,
  options?: ListSceneIdsOptions,
): Promise<string[]> {
  const root = scenesDir(workspace);
  const library = options?.library === true;
  const ids: string[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT" && prefix === "") return;
      throw err;
    }

    for (const ent of entries) {
      if (!ent.isDirectory() || ent.isSymbolicLink()) continue;
      if (isIgnoredSceneEntry(ent.name)) continue;
      if (library && ent.name.startsWith(".")) continue;
      if (!SCENE_ID.test(ent.name)) continue;
      const id = prefix ? `${prefix}/${ent.name}` : ent.name;
      const full = join(dir, ent.name);
      if (await isSceneLeaf(full)) {
        ids.push(id);
      } else {
        await walk(full, id);
      }
    }
  }

  await walk(root, "");
  ids.sort();
  return ids;
}

export async function sceneExists(
  workspace: string,
  id: string,
): Promise<boolean> {
  if (!isSceneId(id)) return false;
  try {
    const s = await stat(sceneDir(workspace, id));
    return s.isDirectory();
  } catch {
    return false;
  }
}

export function resolveWorkspacePath(pathArg?: string): string {
  if (pathArg === undefined || pathArg === "") {
    return resolve(process.cwd());
  }
  return resolve(pathArg);
}
