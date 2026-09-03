---
name: scenie
description: >-
  Build interactive educational scenes (~ pure Three.js) with Scenie
  CLI + local viewer. Use to help user build, view, and manage scenes.
---

# Scenie

You are Three.js expert that teaches STEM subjects / concepts with interactive scenes. Package includes plain Three.js scene folders + `scenie` CLI + local viewer (https://github.com/igoakulov/scenie). `scene.js` is graph; host owns frame loop (see scene.js), chrome, defaults unless `host.js` flags opt out.

## Install

```bash
npm install -g scenie          # Node ≥ 20; or npm link from checkout
scenie init [path]             # omit path → cwd; creates config
# Native-like launcher: ASK user + create (see below)
```

Config: `~/.config/scenie/config.json` (macOS/Linux) / `%APPDATA%\scenie\config.json` (Windows) — workspace, optional port (default 3471).

Launcher (`.app`/`.lnk`): macOS `/Applications`, Windows Desktop/taskbar; icons `viewer/dist/`; URL `http://127.0.0.1:<port>/`; use default browser (with `--app` if Chromium); URL up → open only, else `show --no-open`, wait ready, open (keeps running).

## Workspace

```text
<ws>/scenes/<id>/          # kebab-case folder; optional leading . (see Versioning)
  metadata.json
  scene.js
  host.js
  assets/           # optional
```

Create scene folders with file tools.

## Content guidelines

Unless user states otherwise:

- Consider user, purpose, contents, composition, relevant interactions and annotation
- RH Y-up; face-on XY (+Z toward viewer). Primary content near origin, modest unit scale.
- Edu (calculus, vectors, geometry, graphs, solids): CLEAN, LIGHTWEIGHT, LOW-FI — few objects, readable annotations, insightful summaries.
- Showcases / model benchmark demos: MAX EFFORT — higher artistic freedom and fidelity (but cheap per-pixel)
- Interactivity: add object / scene params user can edit (must help purpose): length, angle, size, speed, show/hide, modes… → use host-provided cards, not fixed decoration (see host.js).

## metadata.json

```json
{
  "title": "Polyline through points",          // required
  "description": "Edit x,y pairs; host remounts polyline...",  // required; topic, scene contents, notes from user conversation; markdown + KaTeX $…$ / $$…$$ ok
  "tags": ["geometry", "graphs"],             // required
  "attribution": { "author": "…", "model": "gpt-…", "prompt": "..." }  // optional
}
```

## scene.js

```js
import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const scene = new THREE.Scene();
// polyline from host cards (points string, yaw, offset, layers)

const pts = parsePoints(params.points ?? ""); // you parse raw string card → values graph can use (lists, pairs, …); do NOT declare params
// Line from pts, rotation.y from params.lift; marker at params.off_x/off_y/off_z if layers

const el = document.createElement("div");
el.textContent = `${pts.length} pts`; // live chip
scene.add(new CSS2DObject(el));

// optional: export function update(t, dt) { el.textContent = `$t=${t.toFixed(1)}$`; }
// export { camera } — start pose first open ONLY if host.camera true
// export { scene } — ONLY if >1 Scene
// assets: new URL("./assets/tex.png", import.meta.url).href
```

- Graph = first `new THREE.Scene()`. `params` = flat cards bag (ONLY if host.js has cards; do NOT declare params).
- HOST TIME — host sole rAF; calls `update` / host `updateView`. NO private rAF / setAnimationLoop / setInterval-as-loop / GSAP ticker (Play/Pause, param remount, scene switch cannot stop you). Both hooks OK.
- `update(t, dt)` optional — sim/content on host clock; Pause freezes path (`t`/`dt` stop advancing). Closes over meshes (no scene arg). OMIT if static; PRESENT (even no-op) ⇒ NO host idle orbit.
- `dispose() - only with audio, Worker, URL.createObjectURL. Host already drops the rest.`
- `dt` = rates/integration; `t` = phase / f(time) (`update` only).
- NO OrbitControls or other navigation when host.camera is true.
- Labels = unstyled `CSS2DObject` from `three/addons` (class/pointer-events/KaTeX are host). Empty `textContent` hides. `$…$` / `$$…$$` ok. Set in scene.js and/or `el.textContent` in `update`. Do NOT build CSS2DRenderer; do NOT style div.
- NO WebGLRenderer / second WebGL canvas.

## host.js

- `bindInput(canvas, camera)` — REQUIRED when `host.camera === false`. Pose this `camera` (host cam, starts at origin).
- `updateView(dt, camera)` — every frame incl. pause; wall `dt`; input / free-fly / camera / rig. Sim stays in `update`. `camera: false` + OrbitControls damping → `controls.update()` here.

```js
// Host provides useful defaults — opt out only when needed with:
// export const host = {
//   lights: false, // no host lights (any THREE.Light in graph also hides them)
//   helpers: false, // no origin planes + helper UI
//   camera: false, // no host navigation (MUST bindInput + updateView; pose THAT camera; don't bind `/` or `R`/`r`)
//   playback: false, // no play/pause UI or idle orbit
//   view: "2d", // no perspective/orbit — ortho face-on pan/zoom
// };

export function params() {
  return [
    {
      type: "card",
      title: "Polyline",
      children: [
        { type: "note", text: "Samples as $x,y$ pairs." }, // guidance (not in params bag)
        { key: "points", type: "string", label: "Points", default: "0,0; 1,1; 2,0.5; 3,2", placeholder: "x,y; x,y; …" }, // freeform list
        { key: "lift", type: "number", label: "Yaw", min: -45, max: 45, step: 1, default: 0, unit: "°" },
        { key: "show_label", type: "boolean", label: "Count annotation", default: true },
        { key: "layers", type: "multiselect", label: "Show", options: ["curve", "marker"], default: ["curve", "marker"] },
        { type: "label", label: "Segment count", value: (q) => Math.max(0, String(q.points || "").split(";").filter((s) => s.trim()).length - 1) }, // computed
        {
          type: "card",
          title: "Offset (components)",
          children: [
            { key: "off_x", type: "number", label: "x", min: -3, max: 3, step: 0.1, default: 1, unit: "u" },
            { key: "off_y", type: "number", label: "y", min: -3, max: 3, step: 0.1, default: 0.5, unit: "u" },
            { key: "off_z", type: "number", label: "z", min: -3, max: 3, step: 0.1, default: 0, unit: "u" },
            { type: "label", label: "|offset|", value: (q) => Math.hypot(q.off_x ?? 0, q.off_y ?? 0, q.off_z ?? 0).toFixed(2) },
          ],
        },
      ],
    },
  ];
}

// optional: MUST return next bag
export function onParamsChange(params, change) {
  if (change.key === "lift" && params.lift > 30) return { ...params, lift: 30 };
  return params;
}

// optional: CLI scenie validate on defaults; [] = ok
export function validateParams(params) {
  if (String(params.points || "").split(";").filter((s) => s.trim()).length < 2) {
    return [{ key: "points", message: "need at least two points" }];
  }
  return [];
}
```

### Interactive cards

`export function params()` → array of `{ type, … }` nodes (or omit / `[]`); same shape in card `children[]`. Host shows cards; editable fields fill flat `params` in `scene.js`. Unknown `type` fails `scenie validate`.

DISPLAY types (no `key`, not in params bag):

- card — title, children[], optional id
- note — short guidance prose; text (no md, KaTeX ok)
- label — computed display; label, value string OR `(params) => string`

EDITABLE types (each has key, label, default → params bag):

- number — min, max required; optional step, unit
- boolean
- select — options[]; default ∈ options
- multiselect — options[]; default[] each ∈ options
- string — optional placeholder

LIFECYCLE

- User edits field → optional `onParamsChange(params, change)` with `change = { key, value }` MUST return next flat bag (return value authoritative) → host re-imports `scene.js` with new bag (keeps camera pose; does not re-run bindInput).
- Optional `validateParams(params)` → soft issues `[{ key?, message, cardId? }…]` or `[]` — CLI `scenie validate` on defaults only (not live UI).

RULES

- Single ordered `children` on cards — no parallel field rows
- Writable keys UNIQUE tree-wide; bag FLAT
- Do NOT invent types (vector, color, angle, text, …)
- Angles: number + unit `"rad"` or `"°"` — unit is display-only; convert in scene.js/update yourself
- Vectors: separate number keys (`v_x`, `v_y`, `v_z`)
- Freeform lists: string + parse in scene.js; format in placeholder
- Fixed multi flags: multiselect

## Agent workflow

```bash
scenie list                    # workspace /abs/path
cd /abs/path
mkdir -p scenes/my-scene
# write metadata.json + scene.js + host.js
scenie validate my-scene
scenie show my-scene           # keep running; or scenie show for library
```

Edits → refresh browser. Port busy on show → refresh viewer or free port + re-show; do not probe HTTP routes. Restart show only: switch scene or dead server.

## Versioning and backup

```bash
cp -R scenes/my-scene scenes/my-scene-backup   # or host file tools
cp -R scenes/my-scene scenes/.my-scene         # leading . hides from list UI; CLI still targets
# optional: git for anything more advanced
```
