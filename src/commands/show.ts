import { readConfig, requireWorkspace } from "../config.js";
import {
  formatIssueLines,
  printFail,
  printListen,
  printNotFound,
  printSceneBlock,
  printWorkspace,
} from "../print.js";
import {
  DEFAULT_SHOW_PORT,
  startShowServer,
} from "../server/http.js";
import { openBrowser } from "../server/open-browser.js";
import { validateScene } from "../validate/scene.js";
import { parseSceneArg, sceneExists } from "../workspace.js";

export async function cmdShow(
  arg: string | undefined,
  opts: { noOpen?: boolean } = {},
): Promise<number> {
  const config = await readConfig();
  if (!config) {
    throw new Error("no workspace — run: scenie init");
  }
  const workspace = await requireWorkspace();
  printWorkspace(workspace);

  let id: string | undefined;
  if (arg) {
    id = parseSceneArg(arg);
    if (!id || !(await sceneExists(workspace, id))) {
      printNotFound(workspace, arg, id);
      return 1;
    }
    const result = await validateScene(workspace, id);
    if (!result.ok) {
      // Failures still use @ block + issue lines (same dialect as validate).
      printSceneBlock(workspace, id, formatIssueLines(result.issues));
      printFail(1, 1);
      return 1;
    }
    // Success: no @ line — id is in the command and listen URL; workspace is enough.
  }

  const port = config.port ?? DEFAULT_SHOW_PORT;

  let server;
  try {
    server = await startShowServer({ workspace, port });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EADDRINUSE") {
      console.error(`listen ERR port in use: ${port}`);
      return 1;
    }
    throw err;
  }

  const pageUrl = id
    ? `${server.url.replace(/\/$/, "")}/?scene=${encodeURIComponent(id)}`
    : server.url;

  printListen(pageUrl);
  if (!opts.noOpen) {
    openBrowser(pageUrl);
  }

  await new Promise<void>((resolve) => {
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
      void server
        .close()
        .catch(() => undefined)
        .finally(() => resolve());
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

  // Clean stop (Ctrl+C / SIGTERM) is success.
  process.exitCode = 0;
  return 0;
}
