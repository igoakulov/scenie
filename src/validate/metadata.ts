import type { SceneMetadata, ValidationIssue } from "../types.js";

export function parseMetadata(
  raw: unknown,
  filePath = "meta",
): { metadata?: SceneMetadata; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const p = filePath === "metadata.json" ? "meta" : filePath;

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({ path: p, message: "want object" });
    return { issues };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    issues.push({ path: `${p}.title`, message: "want non-empty string" });
  }

  if (typeof obj.description !== "string") {
    issues.push({ path: `${p}.description`, message: "want string" });
  }

  if (!Array.isArray(obj.tags)) {
    issues.push({ path: `${p}.tags`, message: "want string[]" });
  } else {
    obj.tags.forEach((t, i) => {
      if (typeof t !== "string") {
        issues.push({ path: `${p}.tags[${i}]`, message: "want string" });
      }
    });
  }

  if (obj.attribution !== undefined) {
    if (
      obj.attribution === null ||
      typeof obj.attribution !== "object" ||
      Array.isArray(obj.attribution)
    ) {
      issues.push({ path: `${p}.attribution`, message: "want object" });
    }
  }

  if (issues.length > 0) return { issues };

  const metadata: SceneMetadata = {
    ...(obj as SceneMetadata),
    title: obj.title as string,
    description: obj.description as string,
    tags: obj.tags as string[],
  };
  return { metadata, issues: [] };
}
