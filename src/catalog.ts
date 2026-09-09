import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMetadata } from "./validate/metadata.js";
import { listSceneIds, sceneDir } from "./workspace.js";

export interface SceneListEntry {
  id: string;
  title?: string;
}

export async function listSceneEntries(
  workspace: string,
): Promise<SceneListEntry[]> {
  const ids = await listSceneIds(workspace, { library: true });

  const entries: SceneListEntry[] = [];
  for (const id of ids) {
    const metaPath = join(sceneDir(workspace, id), "metadata.json");
    try {
      const raw = await readFile(metaPath, "utf8");
      const json = JSON.parse(raw) as unknown;
      const { metadata, issues } = parseMetadata(json);
      if (metadata && issues.length === 0) {
        entries.push({ id, title: metadata.title });
      } else {
        entries.push({ id });
      }
    } catch {
      entries.push({ id });
    }
  }
  return entries;
}
