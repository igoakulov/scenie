import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "./types.js";

function getConfigDir(): string {
  if (process.env.SCENIE_CONFIG_DIR) {
    return process.env.SCENIE_CONFIG_DIR;
  }
  if (process.platform === "win32") {
    const base = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(base, "scenie");
  }
  return join(homedir(), ".config", "scenie");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export async function readConfig(): Promise<AppConfig | null> {
  const path = getConfigPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    throw err;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`bad JSON: ${path}`);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`bad config object: ${path}`);
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.workspace !== "string" || obj.workspace.trim() === "") {
    throw new Error(`config.workspace missing: ${path}`);
  }

  const config: AppConfig = { workspace: obj.workspace };
  if (obj.port !== undefined) {
    if (typeof obj.port !== "number" || !Number.isFinite(obj.port)) {
      throw new Error(`config.port want number: ${path}`);
    }
    config.port = obj.port;
  }
  return config;
}

export async function writeConfig(config: AppConfig): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  const out: AppConfig = { workspace: config.workspace };
  if (config.port !== undefined) out.port = config.port;
  await writeFile(getConfigPath(), `${JSON.stringify(out, null, 2)}\n`, "utf8");
}

export async function requireWorkspace(): Promise<string> {
  const config = await readConfig();
  if (!config) {
    throw new Error("no workspace — run: scenie init");
  }
  return config.workspace;
}
