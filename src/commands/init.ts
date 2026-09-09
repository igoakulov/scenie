import { resolve } from "node:path";
import { readConfig, writeConfig } from "../config.js";
import { seedExampleScenes } from "../examples.js";
import { printHint, printWorkspace } from "../print.js";
import {
  ensureWorkspaceLayout,
  resolveWorkspacePath,
} from "../workspace.js";

export async function cmdInit(
  pathArg: string | undefined,
  force: boolean,
): Promise<number> {
  let current: Awaited<ReturnType<typeof readConfig>>;
  try {
    current = await readConfig();
  } catch (err) {
    if (!force) {
      console.error(err instanceof Error ? err.message : String(err));
      printHint("fix config or: scenie init --force");
      return 1;
    }
    current = null;
  }

  const pathGiven = pathArg !== undefined && pathArg !== "";
  let fromConfig = false;
  let workspace: string;
  if (!pathGiven && !force && current) {
    workspace = resolve(current.workspace);
    fromConfig = true;
  } else {
    workspace = resolveWorkspacePath(pathArg);
  }

  if (current && !force) {
    if (resolve(current.workspace) === workspace) {
      await ensureWorkspaceLayout(workspace);
      const created = await seedExampleScenes(workspace);
      console.log("init ok (exists)");
      printWorkspace(workspace, fromConfig);
      printCreatedScenes(created);
      return 0;
    }
    console.error(`workspace set: ${current.workspace}`);
    printHint(`scenie init ${pathArg ?? "."} --force`);
    return 1;
  }

  await ensureWorkspaceLayout(workspace);
  const created = await seedExampleScenes(workspace);
  await writeConfig({
    workspace,
    ...(current?.port !== undefined ? { port: current.port } : {}),
  });

  console.log(force && current ? "init ok (reconfigured)" : "init ok");
  printWorkspace(workspace, false);
  printCreatedScenes(created);
  return 0;
}

function printCreatedScenes(ids: string[]): void {
  if (ids.length === 0) return;
  console.log(`created scenes: ${ids.join(", ")}`);
}
