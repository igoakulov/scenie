# Scenie

Talk to your AI — it builds interactive 2D/3D scenes for class / homework / demos, and shows them to you in the browser. Scenie stores them as files on your device and does not collect your data.

## Examples

Three example scenes from real prompts. Come included in the package your AI agent installs (see Install section).

1. Theory: linear algebra - [see prompt](https://github.com/igoakulov/scenie/blob/main/examples/example-theory/metadata.json)

![Example theory: linear algebra](https://raw.githubusercontent.com/igoakulov/scenie/main/examples/screenshots/example-theory.png)

2. Homework: pendulum physics - [see prompt](https://github.com/igoakulov/scenie/blob/main/examples/example-homework/metadata.json)

![Example homework: pendulum physics](https://raw.githubusercontent.com/igoakulov/scenie/main/examples/screenshots/example-homework.png)

3. Showcase: solar system - [see prompt](https://github.com/igoakulov/scenie/blob/main/examples/example-showcase/metadata.json)

![Example showcase: solar system](https://raw.githubusercontent.com/igoakulov/scenie/main/examples/screenshots/example-showcase.png)

## Who Scenie is for

**Teachers and students** — explore STEM subjects and concepts with interactive scenes instead of static slides.

**Also useful for AI demos** — same tools for non-education showcases and side‑by‑side tests of AI models (not education-only).

## Features

- Learn by seeing and doing — turn ideas from a chat with your agent into 3D or 2D scenes you can open in the browser
- Built for class and self-study — clear summaries (including math), labels in the scene, and controls that match what you’re studying
- Hands-on, alive — drag the view, play animation, and change numbers and options to watch objects respond
- Personal local library — scenes live as files on your device so you can reopen them later; Scenie collects zero data
- Example scenes included — try them out, ask agent to tweak them
- Your AI agent does all the work — just tell what you need, the agent builds, manages and shows you scenes
- Works with your existing AI agent (with terminal access) — ChatGPT Work / Codex, Claude Cowork / Code, and similar

## Why Scenie?

| | Scenie + your agent | Agent w/o Scenie | ChatGPT (Math/Science) | Textbooks |
|--|---------------------|---------------------|------------------------|-----------|
| **Creative / topic freedom** | **Any topic** you ask | Any topic, uneven quality | ~70 pre-built topics | Fixed curriculum |
| **Build / customize** | Natural language + built-in agent tools / assistance | No help — lots of prompting, easy throwaways | Little / none | Hand-written notes |
| **Presentation** | **2D/3D**, labels / annotations, class-ready viewer app | Ad-hoc style / UI each time | Basic 2D graphs | Static diagrams |
| **Interactivity** | Free camera, play/pause, **side-panel scene controls** | Ad-hoc each time | 1-2 parameters | Passive |
| **AI** | **Your agent** — no in-app AI | Your agent | Vendor-locked | N/A |
| **Storage** | Local scene library **you own** | Chat + scattered files | Limited | N/A |

## How to use

1. **Describe** — explore the subject with your AI agent, then ask it to build or show a scene with the [Scenie skill](https://github.com/igoakulov/scenie/blob/main/skills/scenie/SKILL.md) (a short guide your AI agent saves and follows to improve his skills in building scenes). Your questions and discussion can be written into the scene summary — not only the 3D/2D view.
2. **Open** — the agent opens the scene in your **browser**: a library of your scenes, fullscreen scene view + topic summary side by side that you can read and **come back to later**.
3. **Play** — drag the view, use **Play/Pause**, and use the **side-panel scene controls** (Explore cards with numbers, toggles, options) to watch the scene update.

## Install

What you need: desktop computer + your AI agent with terminal access (ChatGPT Work / Codex, Claude Cowork / Code, and similar)

Ask your AI agent to run this command to install the [Scenie skill](https://github.com/igoakulov/scenie/blob/main/skills/scenie/SKILL.md):

```bash
npx skills add igoakulov/scenie --skill scenie -g -y
```

The agent installs the skill and finishes setup for you (local tools + workspace folder for scenes).

### Manual / advanced

**npm package** (Node ≥ 20) — CLI only; still install the skill as above:

```bash
npm install -g scenie
scenie init
```

**From this repo**:

```bash
git clone https://github.com/igoakulov/scenie.git
cd scenie
npm install          # builds CLI + viewer (prepare)
npm link             # optional: put `scenie` on your PATH
scenie init          # or without link: node bin/scenie.js init
```

## Under the hood

Agent skill (**<200 lines**) + lightweight npm package (CLI + prebuilt viewer, **<0.5 MB**, **~6k LOC**). Requires Node ≥ 20.

- Portable scene folders: `metadata.json` + `scene.js` + optional `host.js` (+ optional assets); no proprietary geometry DSL
- Local viewer: library, summary (markdown + KaTeX), Explore cards, orbit (3D) / pan-zoom (2D), grid, play/pause, in-scene annotations
- Interactive params: numbers, booleans, selects, multiselect, strings, notes, computed labels
- Agent skill: authoring contract, list → write → validate → show loop
- CLI: `init`, `list`, `validate`, `show` over a config workspace; structured stdout for multi-surface context
- Host-provided: lights, helpers, camera, playback defaults with opt-outs; `scene.js` is a Three.js module (graph + optional `update`); `host.js` is flags/cards/canvas opt-out; validate before show

**Stack**

| Layer | Tech |
|-------|------|
| CLI / server | Node (ESM), TypeScript → `dist/`; local `http` serve of viewer + `/ws/scenes/*` + vendored Three |
| Scene content | Three.js (runtime dependency; import map in the viewer) |
| Viewer | React 19, Vite build → `viewer/dist` (prebuilt for users) |
| Chrome | Tailwind v4, shadcn (Base UI), lucide |
| Math / prose | KaTeX (descriptions + annotations), marked (summary markdown) |

## Acknowledgements

- [Three.js](https://threejs.org/) — scene runtime and content model
- [KaTeX](https://katex.org/) — math
- [shadcn/ui](https://ui.shadcn.com/) — viewer chrome

## License

[MIT](./LICENSE)
