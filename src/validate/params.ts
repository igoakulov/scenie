import type {
  LabelParamNode,
  NoteParamNode,
  NumberParamField,
  BooleanParamField,
  SelectParamField,
  MultiselectParamField,
  StringParamField,
  ParamCard,
  ParamValidationIssue,
  ParamValue,
  ParamsNode,
  ValidationIssue,
  WritableParamField,
} from "../types.js";
import { PARAM_NODE_TYPES } from "../types.js";
export { resolveLabelValue } from "../label-value.js";

const ALLOWED_TYPES_MSG = `want ${PARAM_NODE_TYPES.join("|")}`;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function push(
  issues: ValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function wantNonEmptyString(
  raw: unknown,
  fieldPath: string,
  issues: ValidationIssue[],
): raw is string {
  if (typeof raw !== "string" || raw.trim() === "") {
    push(issues, fieldPath, "want non-empty string");
    return false;
  }
  return true;
}

function wantFiniteNumber(
  raw: unknown,
  fieldPath: string,
  issues: ValidationIssue[],
): raw is number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    push(issues, fieldPath, "want finite number");
    return false;
  }
  return true;
}

function wantString(
  raw: unknown,
  fieldPath: string,
  issues: ValidationIssue[],
): raw is string {
  if (typeof raw !== "string") {
    push(issues, fieldPath, "want string");
    return false;
  }
  return true;
}

function wantBoolean(
  raw: unknown,
  fieldPath: string,
  issues: ValidationIssue[],
): raw is boolean {
  if (typeof raw !== "boolean") {
    push(issues, fieldPath, "want boolean");
    return false;
  }
  return true;
}

function wantStringOptions(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): raw is string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    push(issues, `${path}.options`, "want non-empty string[]");
    return false;
  }
  let ok = true;
  raw.forEach((opt, j) => {
    if (typeof opt !== "string") {
      push(issues, `${path}.options[${j}]`, "want string");
      ok = false;
    }
  });
  return ok;
}

function rejectReadOnlyKey(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  kind: "note" | "label",
): void {
  if (raw.key !== undefined) {
    push(
      issues,
      `${path}.key`,
      `${kind} is read-only; omit key (not in the params bag)`,
    );
  }
}

export interface ValidateParamsTreeResult {
  /** Set only when the tree shape is fully valid. */
  nodes?: ParamsNode[];
  /** Writable fields in tree order (for defaults / validateParams). */
  writable?: WritableParamField[];
  issues: ValidationIssue[];
}

/**
 * Validate `params()` return value: array of nodes with single ordered
 * `children` on cards; flat unique keys on writable fields.
 */
export function validateParamsTree(
  raw: unknown,
  basePath: string,
): ValidateParamsTreeResult {
  const issues: ValidationIssue[] = [];
  const seenKeys = new Set<string>();
  const seenCardIds = new Set<string>();
  const writable: WritableParamField[] = [];

  if (!Array.isArray(raw)) {
    push(issues, basePath, "want array");
    return { issues };
  }

  const nodes: ParamsNode[] = [];
  raw.forEach((item, i) => {
    const node = validateNode(item, `${basePath}[${i}]`, issues, seenKeys, seenCardIds, writable);
    if (node) nodes.push(node);
  });

  if (issues.length > 0) return { issues };
  return { nodes, writable, issues: [] };
}

function validateNode(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  seenCardIds: Set<string>,
  writable: WritableParamField[],
): ParamsNode | undefined {
  if (!isPlainObject(raw)) {
    push(issues, path, "want object");
    return undefined;
  }

  if ("fields" in raw && raw.fields !== undefined) {
    push(
      issues,
      `${path}.fields`,
      "unsupported; use single ordered children list (not fields + children)",
    );
  }

  const type = raw.type;
  if (typeof type !== "string") {
    push(issues, `${path}.type`, "want string");
    return undefined;
  }

  switch (type) {
    case "card":
      return validateCard(raw, path, issues, seenKeys, seenCardIds, writable);
    case "note":
      return validateNote(raw, path, issues);
    case "label":
      return validateLabel(raw, path, issues);
    case "number":
      return validateNumber(raw, path, issues, seenKeys, writable);
    case "boolean":
      return validateBoolean(raw, path, issues, seenKeys, writable);
    case "select":
      return validateSelect(raw, path, issues, seenKeys, writable);
    case "multiselect":
      return validateMultiselect(raw, path, issues, seenKeys, writable);
    case "string":
      return validateString(raw, path, issues, seenKeys, writable);
    default:
      push(issues, `${path}.type`, ALLOWED_TYPES_MSG);
      return undefined;
  }
}

function validateCard(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  seenCardIds: Set<string>,
  writable: WritableParamField[],
): ParamCard | undefined {
  const before = issues.length;

  wantNonEmptyString(raw.title, `${path}.title`, issues);

  if (raw.id !== undefined) {
    if (!wantNonEmptyString(raw.id, `${path}.id`, issues)) {
      /* already recorded */
    } else if (seenCardIds.has(raw.id)) {
      push(issues, `${path}.id`, `duplicate "${raw.id}"`);
    } else {
      seenCardIds.add(raw.id);
    }
  }

  if (!Array.isArray(raw.children)) {
    push(issues, `${path}.children`, "want array");
  }

  const children: ParamsNode[] = [];
  if (Array.isArray(raw.children)) {
    raw.children.forEach((child, i) => {
      const node = validateNode(
        child,
        `${path}.children[${i}]`,
        issues,
        seenKeys,
        seenCardIds,
        writable,
      );
      if (node) children.push(node);
    });
  }

  if (issues.length > before) return undefined;
  if (typeof raw.title !== "string") return undefined;

  const card: ParamCard = {
    type: "card",
    title: raw.title,
    children,
  };
  if (typeof raw.id === "string" && raw.id.trim() !== "") {
    card.id = raw.id;
  }
  return card;
}

function validateNote(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): NoteParamNode | undefined {
  if (!wantNonEmptyString(raw.text, `${path}.text`, issues)) return undefined;
  rejectReadOnlyKey(raw, path, issues, "note");
  return { type: "note", text: raw.text };
}

function validateLabel(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): LabelParamNode | undefined {
  const before = issues.length;
  wantNonEmptyString(raw.label, `${path}.label`, issues);
  if (typeof raw.value !== "string" && typeof raw.value !== "function") {
    push(issues, `${path}.value`, "want string or (params) => string");
  }
  rejectReadOnlyKey(raw, path, issues, "label");
  if (issues.length > before) return undefined;
  return {
    type: "label",
    label: raw.label as string,
    value: raw.value as LabelParamNode["value"],
  };
}

function registerKey(
  key: unknown,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
): key is string {
  if (typeof key !== "string" || key.trim() === "") {
    push(issues, `${path}.key`, "want non-empty string");
    return false;
  }
  if (seenKeys.has(key)) {
    push(issues, `${path}.key`, `duplicate "${key}"`);
    return false;
  }
  seenKeys.add(key);
  return true;
}

function validateNumber(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): NumberParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  wantNonEmptyString(raw.label, `${path}.label`, issues);
  wantFiniteNumber(raw.min, `${path}.min`, issues);
  wantFiniteNumber(raw.max, `${path}.max`, issues);
  wantFiniteNumber(raw.default, `${path}.default`, issues);
  if (
    typeof raw.min === "number" &&
    typeof raw.max === "number" &&
    raw.min > raw.max
  ) {
    push(issues, `${path}.min`, "must be <= max");
  }
  if (
    raw.step !== undefined &&
    (typeof raw.step !== "number" ||
      !Number.isFinite(raw.step) ||
      raw.step <= 0)
  ) {
    push(issues, `${path}.step`, "want positive number");
  }
  if (raw.unit !== undefined && typeof raw.unit !== "string") {
    push(issues, `${path}.unit`, "want string");
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: NumberParamField = {
    type: "number",
    key: raw.key as string,
    label: raw.label as string,
    min: raw.min as number,
    max: raw.max as number,
    default: raw.default as number,
  };
  if (typeof raw.step === "number") field.step = raw.step;
  if (typeof raw.unit === "string") field.unit = raw.unit;
  writable.push(field);
  return field;
}

function validateBoolean(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): BooleanParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  wantNonEmptyString(raw.label, `${path}.label`, issues);
  wantBoolean(raw.default, `${path}.default`, issues);

  if (issues.length > before || !keyOk) return undefined;

  const field: BooleanParamField = {
    type: "boolean",
    key: raw.key as string,
    label: raw.label as string,
    default: raw.default as boolean,
  };
  writable.push(field);
  return field;
}

function validateSelect(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): SelectParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  wantNonEmptyString(raw.label, `${path}.label`, issues);
  wantStringOptions(raw.options, path, issues);
  if (!wantString(raw.default, `${path}.default`, issues)) {
    /* recorded */
  } else if (
    Array.isArray(raw.options) &&
    raw.options.every((o) => typeof o === "string") &&
    !raw.options.includes(raw.default)
  ) {
    push(issues, `${path}.default`, "must be in options");
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: SelectParamField = {
    type: "select",
    key: raw.key as string,
    label: raw.label as string,
    options: raw.options as string[],
    default: raw.default as string,
  };
  writable.push(field);
  return field;
}

function validateMultiselect(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): MultiselectParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  wantNonEmptyString(raw.label, `${path}.label`, issues);
  wantStringOptions(raw.options, path, issues);
  if (!Array.isArray(raw.default)) {
    push(issues, `${path}.default`, "want string[]");
  } else {
    const opts =
      Array.isArray(raw.options) && raw.options.every((o) => typeof o === "string")
        ? (raw.options as string[])
        : null;
    raw.default.forEach((d, j) => {
      if (typeof d !== "string") {
        push(issues, `${path}.default[${j}]`, "want string");
      } else if (opts && !opts.includes(d)) {
        push(issues, `${path}.default[${j}]`, "must be in options");
      }
    });
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: MultiselectParamField = {
    type: "multiselect",
    key: raw.key as string,
    label: raw.label as string,
    options: raw.options as string[],
    default: raw.default as string[],
  };
  writable.push(field);
  return field;
}

function validateString(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): StringParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  wantNonEmptyString(raw.label, `${path}.label`, issues);
  wantString(raw.default, `${path}.default`, issues);
  if (raw.placeholder !== undefined && typeof raw.placeholder !== "string") {
    push(issues, `${path}.placeholder`, "want string");
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: StringParamField = {
    type: "string",
    key: raw.key as string,
    label: raw.label as string,
    default: raw.default as string,
  };
  if (typeof raw.placeholder === "string") {
    field.placeholder = raw.placeholder;
  }
  writable.push(field);
  return field;
}

export function defaultsFromWritable(
  writable: WritableParamField[],
): Record<string, ParamValue> {
  const defaults: Record<string, ParamValue> = {};
  for (const f of writable) {
    // Copy multiselect arrays so callers cannot mutate the field default.
    defaults[f.key] =
      f.type === "multiselect" ? [...f.default] : f.default;
  }
  return defaults;
}

export function validateParamsResult(
  result: unknown,
  basePath: string,
): ValidationIssue[] {
  if (!Array.isArray(result)) {
    return [{ path: basePath, message: "want array" }];
  }

  const shapeIssues: ValidationIssue[] = [];
  result.forEach((item, i) => {
    const p = `${basePath}[${i}]`;
    if (!isPlainObject(item)) {
      shapeIssues.push({ path: p, message: "want object" });
      return;
    }
    if (typeof item.message !== "string" || item.message.trim() === "") {
      shapeIssues.push({ path: `${p}.message`, message: "want non-empty string" });
    }
    if (item.key !== undefined && typeof item.key !== "string") {
      shapeIssues.push({ path: `${p}.key`, message: "want string" });
    }
    if (item.cardId !== undefined && typeof item.cardId !== "string") {
      shapeIssues.push({ path: `${p}.cardId`, message: "want string" });
    }
    if (item.groupId !== undefined) {
      shapeIssues.push({
        path: `${p}.groupId`,
        message: "unsupported; use cardId",
      });
    }
  });

  if (shapeIssues.length > 0) return shapeIssues;

  const out: ValidationIssue[] = [];
  for (const item of result as ParamValidationIssue[]) {
    const path = item.key ? `${basePath}.${item.key}` : basePath;
    out.push({ path, message: item.message });
  }
  return out;
}
