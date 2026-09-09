import { useCallback, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function useCopy(text: string) {
  const [ok, setOk] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      window.setTimeout(() => setOk(false), 1500);
    } catch {
      /* ignore */
    }
  }, [text]);
  return { ok, copy, label: ok ? "Copied" : ("Copy" as const) };
}

export function CopyIconButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const { ok, copy, label } = useCopy(text);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-2.5",
        ok
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        className,
      )}
    >
      {ok ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

export function CopyHitbox({
  text,
  children,
  contentClassName,
}: {
  text: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  const { ok, copy, label } = useCopy(text);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => void copy()}
      className="group flex w-full min-w-0 items-start gap-1 rounded-md border border-dashed border-muted-foreground/40 px-2 py-1.5 text-left text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "m-0 min-w-0 flex-1 wrap-anywhere text-xs/relaxed",
          contentClassName,
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-2.5",
          ok
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
        aria-hidden
      >
        {ok ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  );
}
