/** Host feature flags from `export const host` in host.js. Shared by CLI validate + viewer. */

export const HOST_BOOL_KEYS = [
  "lights",
  "helpers",
  "camera",
  "playback",
] as const;

export const HOST_VIEW_VALUES = ["2d", "3d"] as const;

export type HostBoolKey = (typeof HOST_BOOL_KEYS)[number];
export type HostView = (typeof HOST_VIEW_VALUES)[number];

export type HostFlags = Record<HostBoolKey, boolean> & { view: HostView };

export const DEFAULT_HOST_FLAGS: HostFlags = {
  lights: true,
  helpers: true,
  camera: true,
  playback: true,
  view: "3d",
};

const BOOL_SET = new Set<string>(HOST_BOOL_KEYS);
const VIEW_SET = new Set<string>(HOST_VIEW_VALUES);

export type HostFlagIssue = { path: string; message: string };

/**
 * Soft-check for CLI validate. Omitted export is OK; null / non-object / bad keys fail.
 * Paths use `host…` (validate dialect).
 */
export function issuesForHostExport(raw: unknown): HostFlagIssue[] {
  if (raw === undefined) return [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return [{ path: "host", message: "want plain object" }];
  }
  const issues: HostFlagIssue[] = [];
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key === "view") {
      if (!VIEW_SET.has(String(obj.view))) {
        issues.push({ path: "host.view", message: 'want "2d" or "3d"' });
      }
      continue;
    }
    if (!BOOL_SET.has(key)) {
      issues.push({ path: `host.${key}`, message: "unknown key" });
      continue;
    }
    if (typeof obj[key] !== "boolean") {
      issues.push({ path: `host.${key}`, message: "want boolean" });
    }
  }
  return issues;
}

/** Hard-resolve for the viewer load path. Invalid shapes throw (unlike soft CLI issues). */
export function resolveHostFlags(raw: unknown): HostFlags {
  const issues = issuesForHostExport(raw);
  if (issues.length > 0) {
    const first = issues[0]!;
    const msg =
      first.path === "host"
        ? `host: ${first.message}`
        : `${first.path}: ${first.message}`;
    throw new Error(msg);
  }
  if (raw === undefined) {
    return { ...DEFAULT_HOST_FLAGS };
  }
  const obj = raw as Record<string, unknown>;
  const out = { ...DEFAULT_HOST_FLAGS };
  for (const key of HOST_BOOL_KEYS) {
    if (obj[key] === undefined) continue;
    out[key] = obj[key] as boolean;
  }
  if (obj.view === "2d" || obj.view === "3d") {
    out.view = obj.view;
  }
  return out;
}

export function viewToDimensions(view: HostView): 2 | 3 {
  return view === "2d" ? 2 : 3;
}
