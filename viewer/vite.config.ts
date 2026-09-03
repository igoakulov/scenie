import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/** Tailwind v4 @theme / @custom-variant — not valid CSS; injected so the language service does not flag index.css. */
const TAILWIND_TOKENS = `@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-heading: var(--font-sans);
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif,
    "Apple Color Emoji", "Segoe UI Emoji";
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}
`;

function injectTailwindTokens(): Plugin {
  return {
    name: "scenie-tailwind-tokens",
    enforce: "pre",
    transform(code, id) {
      const path = id.replace(/\\/g, "/");
      if (!/\/viewer\/src\/index\.css(?:\?|$)/.test(path)) return null;
      if (code.includes("@theme inline")) return null;
      return { code: `${TAILWIND_TOKENS}\n${code}`, map: null };
    },
  };
}

/**
 * KaTeX fonts: woff2 only; drop rarely used alphabets (Fraktur, SansSerif, Typewriter).
 * Keep: Main, Math, AMS, Size*, Caligraphic, Script.
 */
function katexFontsTrim(): Plugin {
  const dropFamily =
    /KaTeX_(?:Fraktur|SansSerif|Typewriter)[^/]*\.(?:ttf|woff2?|woff)$/;
  return {
    name: "katex-fonts-trim",
    transform(code, id) {
      if (!id.includes("katex") || !id.endsWith(".css")) return null;
      // Drop url(...) format("truetype"|"woff") entries; keep woff2.
      let next = code.replace(
        /url\(([^)]+)\)\s*format\(["'](?:truetype|woff)["']\)\s*,?\s*/g,
        "",
      );
      // Drop @font-face blocks for unused families (woff2 urls too).
      next = next.replace(
        /@font-face\s*\{[^}]*KaTeX_(?:Fraktur|SansSerif|Typewriter)[^}]*\}/g,
        "",
      );
      next = next.replace(/,\s*}/g, "}");
      next = next.replace(/,\s*,/g, ",");
      return next;
    },
    generateBundle(_opts, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/KaTeX_.*\.(ttf|woff)$/.test(fileName) || dropFamily.test(fileName)) {
          delete bundle[fileName];
        }
      }
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), injectTailwindTokens(), tailwindcss(), katexFontsTrim()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  base: "/",
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      // Served at runtime via import map + /vendor/three (see server).
      external: ["three", /^three\//],
      output: {
        paths: {
          three: "/vendor/three/build/three.module.js",
        },
      },
    },
  },
  server: {
    port: 5173,
    // Shared `src/host-flags.ts` lives one level above viewer root.
    fs: {
      allow: [resolve(__dirname, "..")],
    },
  },
});
