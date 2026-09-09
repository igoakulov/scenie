import katex from "katex";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Render text with $...$ (inline) and $$...$$ (display) math via KaTeX.
 * Escaped \$ is left as literal $.
 */
export function renderMathToHtml(text: string): string {
  if (!text) return "";

  // Display math first
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) =>
    katex.renderToString(tex.trim(), {
      displayMode: true,
      throwOnError: false,
      strict: "ignore",
    }),
  );

  out = out.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, tex: string) =>
    katex.renderToString(tex.trim(), {
      displayMode: false,
      throwOnError: false,
      strict: "ignore",
    }),
  );

  out = out.replace(/\\\$/g, "$");
  return out;
}

export function MathText({
  text,
  className,
  as: Tag = "div",
}: {
  text: string;
  className?: string;
  as?: "div" | "span";
}): ReactNode {
  return (
    <Tag
      className={cn(
        "min-w-0 wrap-anywhere [&_.katex]:text-inherit",
        Tag === "span" && "inline",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: renderMathToHtml(text) }}
    />
  );
}

export function fillMathElement(el: HTMLElement, text: string): void {
  el.innerHTML = renderMathToHtml(text);
}
