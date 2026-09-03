import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import * as THREE from "three";
import { issuesForHostExport, resolveHostFlags } from "../host-flags.js";
import { installSceneCapture } from "../scene-capture.js";
import type { SceneValidationResult, ValidationIssue } from "../types.js";
import { isSceneId, sceneDir } from "../workspace.js";
import { parseMetadata } from "./metadata.js";
import {
  defaultsFromWritable,
  validateParamsResult,
  validateParamsTree,
} from "./params.js";
import { installDocumentStub } from "./document-stub.js";

export async function validateScene(
  workspace: string,
  id: string,
): Promise<SceneValidationResult> {
  const issues: ValidationIssue[] = [];
  const dir = sceneDir(workspace, id);

  if (!isSceneId(id)) {
    issues.push({
      path: "id",
      message: "want kebab-case (e.g. my-scene) or hidden .my-scene",
    });
  }

  const metadataPath = join(dir, "metadata.json");
  const scenePath = join(dir, "scene.js");
  const hostPath = join(dir, "host.js");

  let metadataRaw: string | undefined;
  try {
    metadataRaw = await readFile(metadataPath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      issues.push({ path: "meta", message: "missing metadata.json" });
    } else {
      issues.push({ path: "meta", message: String(err) });
    }
  }

  if (metadataRaw !== undefined) {
    let json: unknown;
    try {
      json = JSON.parse(metadataRaw);
    } catch {
      issues.push({ path: "meta", message: "invalid JSON" });
      json = undefined;
    }
    if (json !== undefined) {
      const { issues: metaIssues } = parseMetadata(json);
      issues.push(...metaIssues);
    }
  }

  let sceneExists = true;
  try {
    await readFile(scenePath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    sceneExists = false;
    if (e.code === "ENOENT") {
      issues.push({ path: "scene", message: "missing scene.js" });
    } else {
      issues.push({ path: "scene", message: String(err) });
    }
  }

  let hostExists = true;
  try {
    await readFile(hostPath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    hostExists = false;
    if (e.code === "ENOENT") {
      issues.push({
        path: "host",
        message: "missing host.js (recommended)",
        level: "warning",
      });
    } else {
      issues.push({ path: "host", message: String(err) });
    }
  }

  let hostMod: Record<string, unknown> | undefined;
  let injectParams = false;
  let paramDefaults: Record<string, unknown> = {};

  if (hostExists) {
    const host = await importModule(hostPath, "host");
    issues.push(...host.issues);
    hostMod = host.mod;
    if (hostMod) {
      const hostIssues = await validateHostModule(hostMod);
      issues.push(...hostIssues.issues);
      injectParams = hostIssues.injectParams;
      paramDefaults = hostIssues.defaults;
    }
  }

  if (sceneExists) {
    issues.push(
      ...(await validateSceneModule(scenePath, {
        injectParams,
        paramDefaults,
      })),
    );
  }

  if (sceneExists && hostMod) {
    try {
      const flags = resolveHostFlags(hostMod.host);
      if (!flags.camera && typeof hostMod.bindInput !== "function") {
        issues.push({
          path: "host.bindInput",
          message: "want function when host.camera is false",
        });
      }
    } catch {
      // flag shape already reported from validateHostModule
    }
  }

  return {
    id,
    ok: issues.every((i) => i.level === "warning"),
    issues,
  };
}

async function importModule(
  filePath: string,
  pathLabel: string,
  query = "",
): Promise<{ mod?: Record<string, unknown>; issues: ValidationIssue[] }> {
  const url = `${pathToFileURL(filePath).href}?t=${Date.now()}-${Math.random()}${query}`;
  try {
    const mod = (await import(url)) as Record<string, unknown>;
    return { mod, issues: [] };
  } catch (err) {
    return {
      issues: [
        {
          path: pathLabel,
          message: `import failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
}

function isObject3DLike(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { isObject3D?: boolean }).isObject3D,
  );
}

async function validateSceneModule(
  scenePath: string,
  opts: { injectParams: boolean; paramDefaults: Record<string, unknown> },
): Promise<ValidationIssue[]> {
  const g = globalThis as { __scenieParams?: unknown };
  const prev = g.__scenieParams;
  g.__scenieParams = opts.injectParams ? opts.paramDefaults : {};
  const unstub = installDocumentStub();
  const cap = installSceneCapture(THREE.Scene);
  try {
    const { mod, issues } = await importModule(
      scenePath,
      "scene",
      opts.injectParams ? "&p=1" : "",
    );
    if (!mod) return issues;

    for (const name of ["update", "dispose"] as const) {
      if (mod[name] !== undefined && typeof mod[name] !== "function") {
        issues.push({ path: `scene.${name}`, message: "want function" });
      }
    }

    if (!isObject3DLike(mod.scene) && cap.get() == null) {
      issues.push({
        path: "scene",
        message: "want scene export or constructed THREE.Scene",
      });
    }

    return issues;
  } finally {
    cap.restore();
    unstub();
    if (prev === undefined) delete g.__scenieParams;
    else g.__scenieParams = prev;
  }
}

async function validateHostModule(
  mod: Record<string, unknown>,
): Promise<{
  issues: ValidationIssue[];
  injectParams: boolean;
  defaults: Record<string, unknown>;
}> {
  const issues: ValidationIssue[] = [];
  issues.push(...issuesForHostExport(mod.host));

  if (mod.onParamsChange !== undefined && typeof mod.onParamsChange !== "function") {
    issues.push({ path: "host.onParamsChange", message: "want function" });
  }
  if (mod.validateParams !== undefined && typeof mod.validateParams !== "function") {
    issues.push({ path: "host.validateParams", message: "want function" });
  }
  if (mod.bindInput !== undefined && typeof mod.bindInput !== "function") {
    issues.push({ path: "host.bindInput", message: "want function" });
  }
  if (mod.updateView !== undefined && typeof mod.updateView !== "function") {
    issues.push({ path: "host.updateView", message: "want function" });
  }

  if (mod.params === undefined) {
    return { issues, injectParams: false, defaults: {} };
  }

  if (typeof mod.params !== "function") {
    issues.push({ path: "host.params", message: "want function" });
    return { issues, injectParams: false, defaults: {} };
  }

  let fieldsRaw: unknown;
  try {
    fieldsRaw = (mod.params as () => unknown)();
  } catch (err) {
    issues.push({
      path: "host.params",
      message: `threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { issues, injectParams: false, defaults: {} };
  }

  const { writable, issues: treeIssues } = validateParamsTree(
    fieldsRaw,
    "params",
  );
  issues.push(...treeIssues);
  if (!writable) return { issues, injectParams: false, defaults: {} };

  const defaults = defaultsFromWritable(writable);
  if (typeof mod.validateParams === "function") {
    let result: unknown;
    try {
      result = (mod.validateParams as (p: unknown) => unknown)(defaults);
    } catch (err) {
      issues.push({
        path: "host.validateParams",
        message: `threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      return { issues, injectParams: writable.length > 0, defaults };
    }
    issues.push(...validateParamsResult(result, "params.check"));
  }

  return { issues, injectParams: writable.length > 0, defaults };
}
