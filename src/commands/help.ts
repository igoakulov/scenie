import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "../config.js";
import { packageRoot } from "../examples.js";
import {
  printWorkspace,
  printWorkspaceErr,
  printWorkspaceNone,
} from "../print.js";

function packageVersion(): string {
  try {
    const raw = readFileSync(join(packageRoot(), "package.json"), "utf8");
    const v = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof v === "string" && v ? v : "?";
  } catch {
    return "?";
  }
}

export async function cmdHelp(): Promise<number> {
  console.log(`scenie ${packageVersion()} — CLI + viewer for agent-built Three.js scenes

cmds:
  init [path] [--force]  config workspace (path | existing | cwd); seeds example scenes if missing
  list                   workspace + scene titles
  validate [id]          one or all (exit 1 if issues)
  show [id] [--no-open]  serve viewer; validate first if id; --no-open skips browser; Ctrl+C stop
  help

loop: list → write scenes/<id>/ → validate → show
  port busy on show → refresh browser or free port + re-show (do not probe HTTP)

config: ~/.config/scenie/config.json  (win: %APPDATA%\\scenie\\config.json)
  keys: workspace, optional port (default 3471)
layout: <workspace>/scenes/<id>/{metadata.json,scene.js,host.js?,assets?/}
  id: kebab-case folder; leading . = hidden from Library (CLI list/validate/show still work)
meta: title, description, tags[] required
scene: export { scene } (THREE.Scene or constructed graph)
host: optional host.js — export const host { lights, helpers, camera, playback, view:"2d"|"3d" } (omit file = 3d / all true)

output:
  workspace <abs>   or  workspace (from config) <abs>  (bare init)
  @ scenes/<id>
  - …          list: title | ERR; validate/show: ok | path: msg | warn path: msg
  listen <url>           show ready (opens browser)
`);

  try {
    const config = await readConfig();
    if (config) printWorkspace(config.workspace);
    else printWorkspaceNone();
  } catch (err) {
    printWorkspaceErr(err instanceof Error ? err.message : String(err));
  }
  return 0;
}
