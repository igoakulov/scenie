/**
 * Shared compact number field (Grid Size/Step + params number).
 * min/max/step → slider + input; else live-commit text (blur/Enter snap empty → default).
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
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { MathText } from "../math/renderMath";

type NumberFieldProps = {
  id?: string;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max?: number;
  step?: number;
  unit?: string;
  onCommit: (n: number) => void;
};

function sliderSpec(
  min: number,
  max: number | undefined,
  step: number | undefined,
): { min: number; max: number; step: number } | null {
  if (
    max === undefined ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max <= min ||
    step === undefined ||
    !Number.isFinite(step) ||
    step <= 0
  ) {
    return null;
  }
  return { min, max, step };
}

function stepDecimals(step: number): number {
  const s = step.toString().toLowerCase();
  const exp = /e-(\d+)$/.exec(s);
  if (exp) return Number(exp[1]);
  const i = s.indexOf(".");
  return i === -1 ? 0 : s.length - i - 1;
}

function snapToStep(n: number, min: number, max: number, step: number): number {
  const k = Math.round((n - min) / step);
  const d = Math.min(8, stepDecimals(step));
  let x = Number((min + k * step).toFixed(d));
  if (x < min) x = min;
  if (x > max) x = max;
  return x;
}

function silenceSelectOnDrag(e: { button: number }) {
  if (e.button !== 0) return;
  const block = (ev: Event) => ev.preventDefault();
  document.addEventListener("selectstart", block);
  const stop = () => {
    document.removeEventListener("selectstart", block);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("pointercancel", stop);
  };
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
}

export function NumberField({
  id: idProp,
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  unit,
  onCommit,
}: NumberFieldProps) {
  const genId = useId();
  const id = idProp ?? genId;
  const spec = sliderSpec(min, max, step);
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
      const next = clamp(defaultValue);
      setDraft(String(next));
      onCommit(next);
      return;
    }
    const next = clamp(n);
    setDraft(String(next));
    onCommit(next);
  };

  const inputClass = cn(
    "h-7 font-mono text-xs tabular-nums",
    spec && "w-[4.25rem] shrink-0",
  );

  const input = unit ? (
    <InputGroup className={spec ? "w-auto max-w-[10rem] shrink-0" : undefined}>
      <InputGroupInput
        id={id}
        type="text"
        inputMode="decimal"
        className={cn(inputClass, spec && "w-[3.5rem] flex-none")}
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
      className={inputClass}
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

  const sliderValue = spec
    ? snapToStep(Number.isFinite(value) ? value : spec.min, spec.min, spec.max, spec.step)
    : null;

  return (
    <Field className="min-w-0 gap-1">
      <FieldLabel htmlFor={id} className="text-xs text-muted-foreground">
        <MathText as="span" text={label} />
      </FieldLabel>
      {spec && sliderValue != null ? (
        <div className="flex min-w-0 items-center gap-2">
          <Slider
            className="min-w-0 flex-1 py-1"
            value={sliderValue}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            aria-label={label.replace(/\$/g, "")}
            onPointerDown={silenceSelectOnDrag}
            onValueChange={(v) => {
              const raw = Array.isArray(v) ? v[0] : v;
              if (typeof raw === "number" && Number.isFinite(raw)) {
                onCommit(snapToStep(raw, spec.min, spec.max, spec.step));
              }
            }}
          />
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  );
}
