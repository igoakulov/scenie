/**
 * Multi-select dropdown (Grid planes + params multiselect).
 * One shared control — do not fork another checkbox dropdown.
 * Live-flush each toggle; draft while open so the menu is not re-rendered.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "../math/renderMath";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelectField({
  label,
  options,
  value,
  onChange,
  allSummary = "All",
  noneSummary = "None",
  className,
}: {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  allSummary?: string;
  noneSummary?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  const selected = open ? draft : value;
  const allOn =
    options.length > 0 && options.every((o) => value.includes(o.value));
  const summary =
    value.length === 0
      ? noneSummary
      : allOn && options.length > 1
        ? allSummary
        : options
            .filter((o) => value.includes(o.value))
            .map((o) => o.label)
            .join(", ");

  const toggle = (optValue: string, checked: boolean) => {
    const set = new Set(selected);
    if (checked) set.add(optValue);
    else set.delete(optValue);
    const next = options.map((o) => o.value).filter((v) => set.has(v));
    setDraft(next);
    onChange(next);
  };

  return (
    <Field className={cn("min-w-0 gap-1", className)}>
      <FieldLabel className="text-xs text-muted-foreground">
        <MathText as="span" text={label} />
      </FieldLabel>
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={setOpen}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("h-7 w-full min-w-0 justify-between px-2")}
            />
          }
        >
          <span className="min-w-0 truncate" title={summary}>
            {summary}
          </span>
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-44">
          {options.map((o) => (
            <DropdownMenuCheckboxItem
              key={o.value}
              checked={selected.includes(o.value)}
              onCheckedChange={(c) => toggle(o.value, c === true)}
            >
              {o.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Field>
  );
}
