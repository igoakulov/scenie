import katex from "katex";
import { Marked } from "marked";

const MATH_PH = (i: number) => `%%SCENIE_MATH_${i}%%`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeHref(href: string): boolean {
  const t = href.trim();
  if (!t) return false;
  if (t.startsWith("#") || t.startsWith("/") || t.startsWith("./") || t.startsWith("../")) {
    return true;
  }
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:";
  } catch {
    return false;
  }
}

type MathPart = { display: boolean; tex: string };

/** Pull $...$ / $$...$$ out so MD cannot mangle underscores/asterisks inside math. */
function extractMath(src: string): { text: string; parts: MathPart[] } {
  const parts: MathPart[] = [];
  let text = src.replace(/\\\$/g, "\0DOLLAR\0");

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    const i = parts.length;
    parts.push({ display: true, tex: tex.trim() });
    return MATH_PH(i);
  });

  text = text.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, tex: string) => {
    const i = parts.length;
    parts.push({ display: false, tex: tex.trim() });
    return MATH_PH(i);
  });

  text = text.replace(/\0DOLLAR\0/g, "$");
  return { text, parts };
}

function renderTex(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, {
    displayMode,
    throwOnError: false,
    strict: "ignore",
  });
}

function restoreMath(html: string, parts: MathPart[]): string {
  let out = html;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    out = out.split(MATH_PH(i)).join(renderTex(p.tex, p.display));
  }
  return out;
}

const descriptionMarked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    image() {
      return "";
    },
    link({ href, title, text }) {
      if (!href || !isSafeHref(href)) return text;
      const t = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(href)}"${t} rel="noopener noreferrer" target="_blank">${text}</a>`;
    },
  },
});

/**
 * Summary description: simple markdown (GFM tables) + KaTeX $...$ / $$...$$.
 * Notes/annotations use renderMathToHtml only — not this.
 */
export function renderDescriptionHtml(text: string): string {
  if (!text) return "";
  const { text: stripped, parts } = extractMath(text);
  const html = descriptionMarked.parse(stripped, { async: false }) as string;
  return restoreMath(html, parts);
}
