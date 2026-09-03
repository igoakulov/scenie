/**
 * Soft-read of scene params() for Explore UI.
 * Unknown types are skipped (CLI rejects them; viewer stays resilient).
 * Types + resolveLabelValue: single source in package `src/`.
 */

export type {
  LabelValue,
  ParamValue,
  ParamsNode,
  ParamCard as CardNode,
  NoteParamNode as NoteNode,
  LabelParamNode as LabelNode,
  NumberParamField as NumberNode,
  BooleanParamField as BooleanNode,
  SelectParamField as SelectNode,
  MultiselectParamField as MultiselectNode,
  StringParamField as StringNode,
} from "../../../src/types";

export { resolveLabelValue } from "../../../src/label-value";

import type {
  BooleanParamField,
  LabelParamNode,
  LabelValue,
  MultiselectParamField,
  NumberParamField,
  NoteParamNode,
  ParamCard,
  ParamsNode,
  SelectParamField,
  StringParamField,
} from "../../../src/types";

export function readParamsTree(raw: unknown): ParamsNode[] {
  if (!Array.isArray(raw)) return [];
  const out: ParamsNode[] = [];
  for (const item of raw) {
    const n = readNode(item);
    if (n) out.push(n);
  }
  return out;
}

function readNode(raw: unknown): ParamsNode | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== "string") return undefined;

  switch (type) {
    case "card":
      return readCard(o);
    case "note":
      if (typeof o.text !== "string" || !o.text.trim()) return undefined;
      return { type: "note", text: o.text } satisfies NoteParamNode;
    case "label":
      if (typeof o.label !== "string" || !o.label.trim()) return undefined;
      if (typeof o.value !== "string" && typeof o.value !== "function") {
        return undefined;
      }
      return {
        type: "label",
        label: o.label,
        value: o.value as LabelValue,
      } satisfies LabelParamNode;
    case "number":
      return readNumber(o);
    case "boolean":
      return readBoolean(o);
    case "select":
      return readSelect(o);
    case "multiselect":
      return readMultiselect(o);
    case "string":
      return readString(o);
    default:
      return undefined;
  }
}

function readCard(o: Record<string, unknown>): ParamCard | undefined {
  if (typeof o.title !== "string" || !o.title.trim()) return undefined;
  const children: ParamsNode[] = [];
  if (Array.isArray(o.children)) {
    for (const c of o.children) {
      const n = readNode(c);
      if (n) children.push(n);
    }
  }
  const card: ParamCard = { type: "card", title: o.title, children };
  if (typeof o.id === "string" && o.id.trim()) card.id = o.id;
  return card;
}

function readNumber(o: Record<string, unknown>): NumberParamField | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.min !== "number" || !Number.isFinite(o.min)) return undefined;
  if (typeof o.max !== "number" || !Number.isFinite(o.max)) return undefined;
  if (typeof o.default !== "number" || !Number.isFinite(o.default)) {
    return undefined;
  }
  const node: NumberParamField = {
    type: "number",
    key: o.key,
    label: o.label,
    min: o.min,
    max: o.max,
    default: o.default,
  };
  if (typeof o.step === "number" && o.step > 0) node.step = o.step;
  if (typeof o.unit === "string") node.unit = o.unit;
  return node;
}

function readBoolean(
  o: Record<string, unknown>,
): BooleanParamField | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.default !== "boolean") return undefined;
  return {
    type: "boolean",
    key: o.key,
    label: o.label,
    default: o.default,
  };
}

function readSelect(o: Record<string, unknown>): SelectParamField | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (!Array.isArray(o.options) || o.options.length === 0) return undefined;
  const options = o.options.filter((x): x is string => typeof x === "string");
  if (options.length === 0) return undefined;
  if (typeof o.default !== "string") return undefined;
  return {
    type: "select",
    key: o.key,
    label: o.label,
    options,
    default: o.default,
  };
}

function readMultiselect(
  o: Record<string, unknown>,
): MultiselectParamField | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (!Array.isArray(o.options) || o.options.length === 0) return undefined;
  const options = o.options.filter((x): x is string => typeof x === "string");
  if (options.length === 0) return undefined;
  if (!Array.isArray(o.default)) return undefined;
  const def = o.default.filter((x): x is string => typeof x === "string");
  return {
    type: "multiselect",
    key: o.key,
    label: o.label,
    options,
    default: def,
  };
}

function readString(o: Record<string, unknown>): StringParamField | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.default !== "string") return undefined;
  const node: StringParamField = {
    type: "string",
    key: o.key,
    label: o.label,
    default: o.default,
  };
  if (typeof o.placeholder === "string") node.placeholder = o.placeholder;
  return node;
}
