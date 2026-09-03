import { useId, type ReactNode } from "react";
import type { ParamValue } from "../../host/defaults";
import {
  resolveLabelValue,
  type ParamsNode,
  type StringNode,
} from "../../host/paramsTree";
import { MathText } from "../../math/renderMath";
import { MultiSelectField } from "../MultiSelectField";
import { NumberField } from "../NumberField";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type ParamsPanelProps = {
  tree: ParamsNode[];
  params: Record<string, ParamValue>;
  onChange: (key: string, value: ParamValue) => void;
};

export type OnParamChange = ParamsPanelProps["onChange"];

export function nodeKey(node: ParamsNode, i: number): string {
  if (node.type === "card") return node.id ?? `card-${i}-${node.title}`;
  if ("key" in node) return node.key;
  if (node.type === "note") return `note-${i}`;
  if (node.type === "label") return `label-${i}-${node.label}`;
  return `n-${i}`;
}

export function cardValue(node: Extract<ParamsNode, { type: "card" }>, i: number): string {
  return node.id ?? `card-${i}-${node.title}`;
}

export function renderLeaf(
  node: Exclude<ParamsNode, { type: "card" }>,
  params: Record<string, ParamValue>,
  onChange: OnParamChange,
): ReactNode {
  switch (node.type) {
    case "note":
      return (
        <MathText
          text={node.text}
          className="sheet-selectable min-w-0 wrap-anywhere rounded-md border border-dashed border-muted-foreground/40 px-2 py-1.5 text-xs/relaxed text-muted-foreground [&_.katex]:text-foreground"
        />
      );
    case "label":
      // px-2: align name/value with text inside bordered inputs (not the outer border).
      // Value wraps (full text); not truncate — computed labels can be long.
      return (
        <div className="flex min-w-0 items-start justify-between gap-2 px-2 text-xs/relaxed">
          <MathText
            as="span"
            text={node.label}
            className="max-w-[40%] shrink-0 wrap-anywhere text-muted-foreground"
          />
          <MathText
            as="span"
            text={resolveLabelValue(node.value, params)}
            className="sheet-selectable min-w-0 flex-1 wrap-anywhere text-right font-mono text-foreground"
          />
        </div>
      );
    case "number": {
      const num =
        typeof params[node.key] === "number" &&
        Number.isFinite(params[node.key] as number)
          ? (params[node.key] as number)
          : node.default;
      return (
        <NumberField
          label={node.label}
          value={num}
          defaultValue={node.default}
          min={node.min}
          max={node.max}
          unit={node.unit}
          onCommit={(n) => onChange(node.key, n)}
        />
      );
    }
    case "boolean":
      return (
        <Field orientation="horizontal" className="items-center">
          <FieldLabel htmlFor={`p-${node.key}`} className="flex-1 text-xs">
            <MathText as="span" text={node.label} />
          </FieldLabel>
          <Switch
            id={`p-${node.key}`}
            size="sm"
            checked={params[node.key] === true}
            onCheckedChange={(checked) => onChange(node.key, checked === true)}
          />
        </Field>
      );
    case "select":
      return (
        <Field className="gap-1">
          <FieldLabel className="text-xs text-muted-foreground">
            <MathText as="span" text={node.label} />
          </FieldLabel>
          <Select
            value={String(params[node.key] ?? node.default)}
            onValueChange={(v) => {
              if (v != null) onChange(node.key, v);
            }}
          >
            <SelectTrigger size="sm" className="h-7 w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {node.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      );
    case "multiselect": {
      const selected = Array.isArray(params[node.key])
        ? (params[node.key] as string[]).filter((x) => typeof x === "string")
        : [...node.default];
      return (
        <MultiSelectField
          label={node.label}
          options={node.options.map((o) => ({ value: o, label: o }))}
          value={selected}
          onChange={(next) => onChange(node.key, next)}
        />
      );
    }
    case "string":
      return (
        <StringControl node={node} value={params[node.key]} onChange={onChange} />
      );
    default:
      return null;
  }
}

function StringControl({
  node,
  value,
  onChange,
}: {
  node: StringNode;
  value: ParamValue | undefined;
  onChange: OnParamChange;
}) {
  const id = useId();
  const str = typeof value === "string" ? value : node.default;
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        <MathText as="span" text={node.label} />
      </FieldLabel>
      <Input
        id={id}
        type="text"
        className="h-7 text-xs"
        placeholder={node.placeholder}
        value={str}
        onChange={(e) => onChange(node.key, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </Field>
  );
}
