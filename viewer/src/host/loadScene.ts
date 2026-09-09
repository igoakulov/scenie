import * as THREE from "three";
import { defaultsFromParamsTree, type ParamValue } from "./defaults";
import { readParamsTree, type ParamsNode } from "./paramsTree";
import { resolveHostFlags, type HostFlags } from "./hostFlags";
import { installSceneCapture } from "../../../src/scene-capture";
import { parseMetadata } from "../../../src/validate/metadata";

export interface SceneMetadata {
  title: string;
  description: string;
  tags: string[];
  attribution?: Record<string, unknown>;
}

export interface LoadedScene {
  id: string;
  metadata: SceneMetadata;
  module: SceneModule;
  params: Record<string, ParamValue>;
  paramsTree: ParamsNode[];
  host: HostFlags;
  injectParams: boolean;
}

export type ParamsChange = { key: string; value: ParamValue };

export interface SceneModule {
  scene?: unknown;
  camera?: unknown;
  update?: (t: number, dt: number) => void;
  updateView?: (dt: number, camera: unknown) => void;
  bindInput?: (canvas: HTMLCanvasElement, camera: unknown) => void;
  dispose?: () => void;
  applyParams?: (
    params: Record<string, ParamValue>,
    change: ParamsChange,
  ) => void;
  onParamsChange?: (
    params: Record<string, ParamValue>,
    change: ParamsChange,
  ) => Record<string, ParamValue>;
}

export function sceneBaseUrl(id: string): string {
  return `/ws/scenes/${id.split("/").map(encodeURIComponent).join("/")}`;
}

export async function loadMetadata(id: string): Promise<SceneMetadata> {
  let res: Response;
  try {
    res = await fetch(`${sceneBaseUrl(id)}/metadata.json`, {
      cache: "no-store",
    });
  } catch {
    throw new Error("metadata.json: unreachable");
  }
  if (res.status === 404) {
    throw new Error("metadata.json: missing");
  }
  if (!res.ok) {
    throw new Error(`metadata.json: HTTP ${res.status}`);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("metadata.json: invalid JSON");
  }
  const { metadata, issues } = parseMetadata(json);
  if (!metadata || issues.length > 0) {
    throw new Error(
      issues.map((i) => `${i.path}: ${i.message}`).join("; ") ||
        "metadata.json: invalid",
    );
  }
  return {
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    attribution: metadata.attribution,
  };
}

async function importFile(
  id: string,
  file: string,
  extraQuery = "",
  optional = false,
): Promise<Record<string, unknown> | undefined> {
  const url = `${sceneBaseUrl(id)}/${file}?t=${Date.now()}-${Math.random()}${extraQuery}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new Error(`${file}: unreachable`);
  }
  if (res.status === 404) {
    if (optional) return undefined;
    throw new Error(`${file}: missing`);
  }
  if (!res.ok) {
    throw new Error(`${file}: HTTP ${res.status}`);
  }
  try {
    return (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`${file} import failed:`, err);
    throw new Error(`${file}: import failed: ${detail}`);
  }
}

export async function importSceneGraph(
  id: string,
  params: Record<string, ParamValue>,
  injectParams: boolean,
): Promise<{
  scene?: unknown;
  camera?: unknown;
  update?: SceneModule["update"];
  dispose?: SceneModule["dispose"];
  applyParams?: SceneModule["applyParams"];
  captured: unknown;
}> {
  (globalThis as { __scenieParams?: Record<string, ParamValue> }).__scenieParams =
    params;
  const extra = injectParams ? "&p=1" : "";
  const raf = globalThis.requestAnimationFrame;
  // Drop scene-private rAF during import. Restore in finally — the host
  // loop also uses this global and must restartLoop() after every import.
  globalThis.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
  const cap = installSceneCapture(THREE.Scene);
  try {
    const mod = (await importFile(id, "scene.js", extra))!;
    return {
      scene: mod.scene,
      camera: mod.camera,
      update:
        typeof mod.update === "function"
          ? (mod.update as SceneModule["update"])
          : undefined,
      dispose:
        typeof mod.dispose === "function"
          ? (mod.dispose as SceneModule["dispose"])
          : undefined,
      applyParams:
        typeof mod.applyParams === "function"
          ? (mod.applyParams as SceneModule["applyParams"])
          : undefined,
      captured: cap.get(),
    };
  } finally {
    globalThis.requestAnimationFrame = raf;
    cap.restore();
  }
}

export async function loadScene(id: string): Promise<LoadedScene> {
  const [metadata, hostMod] = await Promise.all([
    loadMetadata(id),
    importFile(id, "host.js", "", true),
  ]);

  let hostFlags: HostFlags;
  try {
    hostFlags = resolveHostFlags(hostMod?.host);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : `host: ${String(err)}`,
    );
  }

  if (!hostFlags.camera && typeof hostMod?.bindInput !== "function") {
    throw new Error(
      "host.js: bindInput want function when host.camera is false",
    );
  }

  let params: Record<string, ParamValue> = {};
  let paramsTree: ParamsNode[] = [];
  if (typeof hostMod?.params === "function") {
    try {
      const raw = (hostMod.params as () => unknown)();
      params = defaultsFromParamsTree(raw);
      paramsTree = readParamsTree(raw);
    } catch (err) {
      throw new Error(
        `params() threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const module: SceneModule = {
    bindInput:
      typeof hostMod?.bindInput === "function"
        ? (hostMod.bindInput as SceneModule["bindInput"])
        : undefined,
    updateView:
      typeof hostMod?.updateView === "function"
        ? (hostMod.updateView as SceneModule["updateView"])
        : undefined,
    onParamsChange:
      typeof hostMod?.onParamsChange === "function"
        ? (hostMod.onParamsChange as SceneModule["onParamsChange"])
        : undefined,
  };

  return {
    id,
    metadata,
    module,
    params,
    paramsTree,
    host: hostFlags,
    injectParams: Object.keys(params).length > 0,
  };
}

export type { HostFlags };
export { viewToDimensions } from "./hostFlags";
