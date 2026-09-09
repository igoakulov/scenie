import { readConfig } from "../config.js";
import {
  formatIssueLines,
  printFail,
  printHint,
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

const SHOW_HOST = "127.0.0.1";

function pageUrl(port: number, id?: string): string {
  const base = `http://${SHOW_HOST}:${port}`;
  return id ? `${base}/?scene=${encodeURIComponent(id)}` : `${base}/`;
}

async function scenieAlreadyServing(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${SHOW_HOST}:${port}/api/scenes`, {
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return false;
    return Array.isArray(await res.json());
  } catch {
    return false;
  }
}

export async function cmdShow(
  arg: string | undefined,
  opts: { noOpen?: boolean } = {},
): Promise<number> {
  const config = await readConfig();
  if (!config) {
    throw new Error("no workspace — run: scenie init");
  }
  const workspace = config.workspace;
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
      printSceneBlock(workspace, id, formatIssueLines(result.issues));
      printFail(1, 1);
      return 1;
    }
    const extra = formatIssueLines(result.issues);
    if (extra.length) {
      printSceneBlock(workspace, id, ["ok", ...extra]);
    }
  }

  const port = config.port ?? DEFAULT_SHOW_PORT;
  const url = pageUrl(port, id);

  let server;
  try {
    server = await startShowServer({ workspace, port });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EADDRINUSE") {
      if (await scenieAlreadyServing(port)) {
        printListen(url);
        printHint("already serving — open that URL (do not start another show)");
        if (!opts.noOpen) openBrowser(url);
        return 0;
      }
      console.error(`listen ERR port in use: ${port}`);
      return 1;
    }
    throw err;
  }

  printListen(url);
  if (!opts.noOpen) {
    openBrowser(url);
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

  process.exitCode = 0;
  return 0;
}
