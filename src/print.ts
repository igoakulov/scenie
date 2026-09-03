import { relative } from "node:path";
import { sceneDir } from "./workspace.js";

/** fromConfig → `workspace (from config) <abs>`; else `workspace <abs>`. */
export function printWorkspace(workspace: string, fromConfig = false): void {
  console.log(
    fromConfig ? `workspace (from config) ${workspace}` : `workspace ${workspace}`,
  );
}

export function printWorkspaceNone(): void {
  console.log("workspace (none — run scenie init)");
}

export function printWorkspaceErr(message: string): void {
  console.log(`workspace ERR ${message}`);
}

/**
 * One scene block — same shape for list, validate, show gate.
 *   @ scenes/<id>
 *   - detail
 */
export function printSceneBlock(
  workspace: string,
  id: string,
  lines: string[],
): void {
  const rel = relative(workspace, sceneDir(workspace, id)) || `scenes/${id}`;
  console.log(`@ ${rel}`);
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

export function formatIssueLines(
  issues: { path: string; message: string; level?: "error" | "warning" }[],
): string[] {
  return issues.map((i) =>
    i.level === "warning"
      ? `warn ${i.path}: ${i.message}`
      : `${i.path}: ${i.message}`,
  );
}

export function printHint(msg: string): void {
  console.error(`hint: ${msg}`);
}

export function printFail(failed: number, total: number): void {
  console.error(`fail ${failed}/${total}`);
}

export function printListen(url: string): void {
  console.log(`listen ${url}`);
}
