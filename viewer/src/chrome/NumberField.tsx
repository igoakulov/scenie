/**
 * Shared compact number field (Grid Size/Step + params number).
 * Live-commit parseable values; blur/Enter snap empty → default.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { MathText } from "../math/renderMath";

export function NumberField({
  id: idProp,
  label,
  value,
  defaultValue,
  min,
  max,
  unit,
  onCommit,
}: {
  id?: string;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max?: number;
  unit?: string;
  onCommit: (n: number) => void;
}) {
  const genId = useId();
  const id = idProp ?? genId;
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const clamp = (n: number) => {
    let x = Math.max(min, n);
    if (max !== undefined) x = Math.min(max, x);
    return x;
  };

  const live = (raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n)) onCommit(clamp(n));
  };

  const commit = () => {
    focused.current = false;
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) {
      setDraft(String(defaultValue));
      onCommit(clamp(defaultValue));
      return;
    }
    const next = clamp(n);
    setDraft(String(next));
    onCommit(next);
  };

  const input = unit ? (
    <InputGroup>
      <InputGroupInput
        id={id}
        type="text"
        inputMode="decimal"
        className="h-7 font-mono text-xs tabular-nums"
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          live(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{unit}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  ) : (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="h-7 font-mono text-xs tabular-nums"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        live(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );

  return (
    <Field className="min-w-0 gap-1">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        <MathText as="span" text={label} />
      </FieldLabel>
      {input}
    </Field>
  );
}
