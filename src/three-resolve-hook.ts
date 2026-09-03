/**
 * Resolve bare `three` / `three/addons/` from workspace scenes to this package.
 * `?p=1` on scene.js prepends the params line (import.meta.url stays the file URL).
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LoadHook, ResolveHook } from "node:module";
import { withParamsPreamble } from "./params-preamble.js";

const require = createRequire(import.meta.url);
const threeEntry = require.resolve("three");
const threeUrl = pathToFileURL(threeEntry).href;
const threeRoot = dirname(dirname(threeEntry));
const addonsRoot = join(threeRoot, "examples", "jsm");

function addonUrl(rest: string): string {
  return pathToFileURL(join(addonsRoot, rest)).href;
}

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  if (specifier === "three") {
    return { shortCircuit: true, url: threeUrl };
  }
  if (specifier.startsWith("three/addons/")) {
    return {
      shortCircuit: true,
      url: addonUrl(specifier.slice("three/addons/".length)),
    };
  }
  if (specifier.startsWith("three/examples/jsm/")) {
    return {
      shortCircuit: true,
      url: addonUrl(specifier.slice("three/examples/jsm/".length)),
    };
  }
  return nextResolve(specifier, context);
};

function sourceText(source: unknown): string {
  if (typeof source === "string") return source;
  if (source instanceof Uint8Array) return new TextDecoder().decode(source);
  if (source instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(source));
  }
  if (ArrayBuffer.isView(source)) {
    return new TextDecoder().decode(source as Uint8Array);
  }
  return "";
}

export const load: LoadHook = async (url, context, nextLoad) => {
  const u = new URL(url);
  const sceneJs =
    u.pathname.endsWith("/scene.js") || u.pathname.endsWith("scene.js");
  if (!sceneJs || u.searchParams.get("p") !== "1") {
    return nextLoad(url, context);
  }
  const result = await nextLoad(url, context);
  if (result.source == null) return result;
  return {
    format: result.format ?? "module",
    source: withParamsPreamble(sourceText(result.source)),
    shortCircuit: true,
  };
};
