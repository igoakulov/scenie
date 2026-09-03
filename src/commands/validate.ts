import { requireWorkspace } from "../config.js";
import {
  formatIssueLines,
  printFail,
  printHint,
  printSceneBlock,
  printWorkspace,
} from "../print.js";
import { validateScene } from "../validate/scene.js";
import { hasScenesDir, listSceneIds, sceneExists } from "../workspace.js";

export async function cmdValidate(id: string | undefined): Promise<number> {
  const workspace = await requireWorkspace();
  printWorkspace(workspace);

  let ids: string[];
  if (id) {
    if (!(await sceneExists(workspace, id))) {
      printSceneBlock(workspace, id, ["ERR not found"]);
      return 1;
    }
    ids = [id];
  } else {
    if (!(await hasScenesDir(workspace))) {
      printHint("no scenes/ under workspace — check path or: scenie init");
      return 0;
    }
    ids = await listSceneIds(workspace);
    if (ids.length === 0) {
      return 0;
    }
  }

  let failed = 0;
  for (const sceneId of ids) {
    const result = await validateScene(workspace, sceneId);
    if (result.ok) {
      const extra = formatIssueLines(result.issues);
      printSceneBlock(
        workspace,
        sceneId,
        extra.length ? ["ok", ...extra] : ["ok"],
      );
    } else {
      failed += 1;
      printSceneBlock(workspace, sceneId, formatIssueLines(result.issues));
    }
  }

  if (failed > 0) {
    printFail(failed, ids.length);
    return 1;
  }
  return 0;
}
