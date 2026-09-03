export type { ParamValue } from "../../../src/types";
import type { ParamValue } from "../../../src/types";

/** Flat defaults from a params() tree (known writable fields only; skip unknowns). */
export function defaultsFromParamsTree(
  raw: unknown,
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  walk(raw, out);
  return out;
}

function walk(node: unknown, out: Record<string, ParamValue>): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const type = o.type;

  if (type === "card" && Array.isArray(o.children)) {
    walk(o.children, out);
    return;
  }

  if (typeof o.key !== "string" || o.key.length === 0) return;

  if (type === "number" && typeof o.default === "number") {
    out[o.key] = o.default;
    return;
  }
  if (type === "boolean" && typeof o.default === "boolean") {
    out[o.key] = o.default;
    return;
  }
  if (type === "select" && typeof o.default === "string") {
    out[o.key] = o.default;
    return;
  }
  if (type === "multiselect" && Array.isArray(o.default)) {
    out[o.key] = o.default.filter((x): x is string => typeof x === "string");
    return;
  }
  if (type === "string" && typeof o.default === "string") {
    out[o.key] = o.default;
  }
}
