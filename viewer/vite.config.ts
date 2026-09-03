import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

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
  plugins: [react(), tailwindcss(), katexFontsTrim()],
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
