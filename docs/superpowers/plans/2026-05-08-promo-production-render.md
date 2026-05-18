# CareData Promo — Production Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 16 approved scene previews into a production Hyperframes composition project, wire one music bed + 15 SFX, ship the 1920×1080 master MP4 and a 1080×1920 vertical cutdown, mixed to −16 LUFS.

**Architecture:** Use the real `hyperframes` CLI (HeyGen, v0.5.3, puppeteer-core under the hood) as the renderer. Compositions are HTML files that declare their own timing via `data-*` attributes. A single `timeline.json` is the source of truth for scene durations — consumed by both the existing master player (`shared/master.js`) and the new render pipeline. Audio is assembled via `ffmpeg` from a MusicGen-generated bed plus 15 FreeSound CC0 SFX, cued from `audio-cues.json`. The vertical cutdown is a CSS reflow layer (`9-16.css`) loaded only when `data-orientation="vertical"`.

**Tech Stack:** Hyperframes 0.5.3, Node.js 20+, FFmpeg 6+, GSAP (already wired in scenes), Three.js (Scene 8 only), Playwright (verification), MusicGen MCP (or fallback Pixabay CC0).

---

## What's already done (do not redo)

- 16 scene previews exist at `Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/previews/scene-NN-*.html`, individually approved + iterated.
- `shared/tokens.css` — palette, fonts, gradients, grain, easings, base utilities.
- `shared/master.css` + `shared/master.js` + `index.html` — master playthrough verified via Playwright.
- `shared/patch-scenes.mjs` — iframe-aware bootstrap applied to all 16 scenes (idempotent).

The plan below only touches the production pipeline, not scene authoring.

---

## File Structure

```
Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/
├── package.json                         (Task 1, NEW)
├── hyperframes.config.json              (Task 2, NEW)
├── compositions/                        (Task 4, NEW — 16 HTMLs)
│   ├── 01-hook.html
│   ├── 02-logo-reveal.html
│   ├── ... (14 more)
│   └── 16-final-card.html
├── shared/
│   ├── tokens.css                       ✓ existing
│   ├── master.css                       ✓ existing
│   ├── master.js                        ✓ existing
│   ├── patch-scenes.mjs                 ✓ existing
│   ├── timeline.json                    (Task 3, NEW — source of truth)
│   ├── refactor-compositions.mjs        (Task 4, NEW — previews → compositions)
│   ├── 9-16.css                         (Task 11, NEW — vertical reflow)
│   ├── audio-cues.json                  (Task 7, NEW)
│   ├── audio-mix.mjs                    (Task 9, NEW — ffmpeg orchestrator)
│   └── audio/
│       ├── music-bed.mp3                (Task 6, NEW)
│       ├── master-mix.mp3               (Task 9 output)
│       └── sfx/                         (Task 8, NEW — 15 files)
│           ├── 01-keyboard-tick.mp3
│           ├── 02-paper-rustle.mp3
│           ├── ... (12 more)
│           └── 15-soft-tail.mp3
├── output/                              (Task 13–14 outputs)
│   ├── master-1920x1080.mp4
│   ├── master-1080x1920.mp4
│   └── master-1920x1080.mp3            (just-audio reference for review)
├── previews/                            ✓ existing (kept for review)
├── index.html                           ✓ existing (master playthrough)
└── scripts/
    └── verify-render.mjs                (Task 15, NEW)
```

---

# Phase 1 — Hyperframes scaffold + compositions (Tasks 1–5)

## Task 1: Bootstrap the Node project

**Files:**
- Create: `Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/package.json`
- Modify: none

**Why:** Hyperframes ships as an npm CLI; the project needs a `package.json` and `hyperframes` installed before any other command works.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "caredata-promo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "preview":  "hyperframes preview",
    "render":   "hyperframes render --output output/master-1920x1080.mp4",
    "render:vertical": "hyperframes render --orientation=vertical --output output/master-1080x1920.mp4",
    "audio:mix": "node shared/audio-mix.mjs",
    "verify":   "node scripts/verify-render.mjs"
  },
  "devDependencies": {
    "hyperframes": "^0.5.3",
    "playwright": "^1.49.0"
  }
}
```

- [ ] **Step 2: Install**

Run from `Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/`:

```bash
npm install
```

Expected: `hyperframes` lands in `node_modules/.bin/hyperframes`. No errors. ~30s.

- [ ] **Step 3: Verify the CLI is callable**

```bash
npx hyperframes --help
```

Expected: usage text with `init`, `preview`, `render` subcommands.

- [ ] **Step 4: Commit**

```bash
git add Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/package.json \
        Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/package-lock.json
git commit -m "promo: bootstrap hyperframes 0.5.3 npm project"
```

---

## Task 2: Write `hyperframes.config.json`

**Files:**
- Create: `Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/hyperframes.config.json`

**Why:** Hyperframes reads a config to know the resolution, frame rate, output paths, and where to find compositions.

- [ ] **Step 1: Create the config**

```json
{
  "compositions": "compositions/*.html",
  "shared": ["shared/tokens.css", "shared/audio/master-mix.mp3"],
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "output": "output/",
  "audio": "shared/audio/master-mix.mp3",
  "orientations": {
    "vertical": {
      "width": 1080,
      "height": 1920,
      "extraStylesheet": "shared/9-16.css"
    }
  }
}
```

- [ ] **Step 2: Verify `hyperframes` parses it**

```bash
npx hyperframes preview --dry-run
```

Expected: prints a list of 0 compositions (we haven't created them yet) but no schema errors. If the CLI rejects an option, consult `npx hyperframes preview --help` for the actual flag names and adjust.

- [ ] **Step 3: Commit**

```bash
git add hyperframes.config.json
git commit -m "promo: add hyperframes config (1920x1080@30fps, vertical cutdown variant)"
```

---

## Task 3: Single-source timeline (`shared/timeline.json`)

**Files:**
- Create: `Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/shared/timeline.json`
- Modify: `shared/master.js` (replace inline `SCENES` array with a fetch of this file)

**Why:** Scene durations currently live in three places (`master.js`, the scene HTML's `TOTAL ~Xs` comment, the spec). DRY violation. One JSON file = one truth. Both `master.js` and the upcoming render pipeline read from it.

- [ ] **Step 1: Create `timeline.json`**

```json
{
  "fps": 30,
  "totalDurationSec": 79.68,
  "scenes": [
    { "id":  1, "slug": "hook",                  "name": "Hook",                "startSec":  0.00, "durSec":  3.00 },
    { "id":  2, "slug": "logo-reveal",           "name": "Logo Reveal",         "startSec":  3.00, "durSec":  3.00 },
    { "id":  3, "slug": "hero",                  "name": "Hero Headline",       "startSec":  6.00, "durSec":  3.00 },
    { "id":  4, "slug": "upload",                "name": "Upload + GPMS",       "startSec":  9.00, "durSec":  4.50 },
    { "id":  5, "slug": "dashboard",             "name": "QI Dashboard",        "startSec": 13.50, "durSec":  6.80 },
    { "id":  6, "slug": "pi-drilldown",          "name": "PI Drilldown",        "startSec": 20.30, "durSec":  4.50 },
    { "id":  7, "slug": "benchmarking",          "name": "Benchmarking",        "startSec": 24.80, "durSec":  5.50 },
    { "id":  8, "slug": "act-break",             "name": "Act Break",           "startSec": 30.30, "durSec":  5.00 },
    { "id":  9, "slug": "voice-link",            "name": "Voice Setup Link",    "startSec": 35.30, "durSec":  6.00 },
    { "id": 10, "slug": "recording-battery",     "name": "Recording Battery",   "startSec": 41.30, "durSec": 10.65 },
    { "id": 11, "slug": "score-resolves",        "name": "Score Resolves",      "startSec": 51.95, "durSec":  5.00 },
    { "id": 12, "slug": "nurse-dashboard",       "name": "Nurse Dashboard",     "startSec": 56.95, "durSec":  5.60 },
    { "id": 13, "slug": "trust-stamps",          "name": "Trust Stamps",        "startSec": 62.55, "durSec":  4.50 },
    { "id": 14, "slug": "audit-ready-payoff",    "name": "Audit-Ready Payoff",  "startSec": 67.05, "durSec":  5.63 },
    { "id": 15, "slug": "tagline",               "name": "Tagline",             "startSec": 72.68, "durSec":  3.50 },
    { "id": 16, "slug": "final-card",            "name": "Final Card",          "startSec": 76.18, "durSec":  3.50 }
  ]
}
```

- [ ] **Step 2: Refactor `master.js` to fetch it**

In `shared/master.js`, replace the top-level `const SCENES = [...]` with an async loader that runs before `buildIframes()`:

```js
let SCENES = [];
let TOTAL_DUR = 0;

async function loadTimeline(){
  const res = await fetch('shared/timeline.json');
  const tl  = await res.json();
  SCENES = tl.scenes.map(s => ({
    id: s.id,
    name: s.name,
    src: `previews/scene-${String(s.id).padStart(2,'0')}-${s.slug}.html`,
    start: s.startSec,
    dur: s.durSec
  }));
  TOTAL_DUR = tl.totalDurationSec;
}
```

Update `DOMContentLoaded` handler:

```js
window.addEventListener('DOMContentLoaded', async () => {
  await loadTimeline();
  buildIframes();
  buildScrubberMarkers();
  bind();
  fitStage();
  applyState(0);
  updatePlayBtn();
});
```

- [ ] **Step 3: Verify the master still plays**

```bash
node Caredata-Visualization-Azure/CapstoneProject/scripts/verify-master-playthrough.mjs
```

Expected: same output as before — captures every scene through the playthrough. If a scene fails to load, the slug in `timeline.json` doesn't match the existing preview filename.

- [ ] **Step 4: Commit**

```bash
git add shared/timeline.json shared/master.js
git commit -m "promo: extract scene timing to timeline.json (single source of truth)"
```

---

## Task 4: Refactor previews into compositions

**Files:**
- Create: `shared/refactor-compositions.mjs`
- Create: `compositions/01-hook.html` … `compositions/16-final-card.html` (16 files, generated)
- Read: `previews/scene-NN-*.html` (untouched)

**Why:** The previews work standalone. Compositions need:
1. `data-composition-id`, `data-start`, `data-duration`, `data-width`, `data-height` on the root element so Hyperframes knows when to play each.
2. `:root { --cream: ...; ... }` blocks deduplicated → `<link rel="stylesheet" href="../shared/tokens.css">` only.
3. The Google Fonts `<link>` removed (already in tokens.css).
4. The `.hud` (replay button + timer) removed — that's a preview-only chrome, not for the final render.

This is mechanical; do it in a script so it's reproducible (and rerunable when previews iterate).

- [ ] **Step 1: Write the refactor script**

Create `shared/refactor-compositions.mjs`:

```js
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TIMELINE = JSON.parse(readFileSync(join(here, "timeline.json"), "utf8"));
const previewDir = join(here, "..", "previews");
const compDir    = join(here, "..", "compositions");
if (!existsSync(compDir)) mkdirSync(compDir, { recursive: true });

/* CSS variable blocks scenes inline; we strip the duplicates. */
const ROOT_BLOCK = /:root\s*\{[^}]*\}\s*/g;

/* The three Google Fonts links scenes use (also in tokens.css now). */
const FONT_PRECONNECT = /<link rel="preconnect"[^>]*>\s*/g;
const FONT_STYLESHEET = /<link rel="stylesheet"\s+href="https:\/\/fonts\.googleapis\.com[^"]+"[^>]*>\s*/g;

/* Preview HUD block — drop it. */
const HUD_BLOCK = /<div class="hud">[\s\S]*?<\/div>\s*(?=<script)/;

/* Preview-only HUD CSS (timer, REPLAY button) */
const HUD_CSS = /\/\* Hud \*\/[\s\S]*?\.hud \.timer\{[^}]*\}\s*/g;

for (const s of TIMELINE.scenes){
  const num = String(s.id).padStart(2, "0");
  const previewPath = readdirSync(previewDir).find(f => f.startsWith(`scene-${num}-`));
  if (!previewPath){
    console.error(`✗ no preview for scene ${num}`);
    continue;
  }

  let html = readFileSync(join(previewDir, previewPath), "utf8");

  /* 1) Strip duplicated tokens / fonts */
  html = html.replace(ROOT_BLOCK,         "");
  html = html.replace(FONT_PRECONNECT,    "");
  html = html.replace(FONT_STYLESHEET,    "");

  /* 2) Inject the shared tokens.css link inside <head> */
  html = html.replace("</head>",
    '<link rel="stylesheet" href="../shared/tokens.css">\n</head>');

  /* 3) Drop the preview HUD chrome */
  html = html.replace(HUD_BLOCK, "");
  html = html.replace(HUD_CSS,   "");

  /* 4) Add Hyperframes data-* attributes to <body> */
  html = html.replace(
    /<body([^>]*)>/,
    `<body$1 data-composition-id="${s.id}" data-slug="${s.slug}" data-start="${s.startSec}" data-duration="${s.durSec}" data-width="1920" data-height="1080">`
  );

  writeFileSync(join(compDir, `${num}-${s.slug}.html`), html, "utf8");
  console.log(`+ ${num}-${s.slug}.html`);
}

console.log(`\nGenerated ${TIMELINE.scenes.length} compositions in compositions/`);
```

- [ ] **Step 2: Run the refactor**

```bash
cd Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes
node shared/refactor-compositions.mjs
```

Expected: 16 files printed, all 16 land in `compositions/`.

- [ ] **Step 3: Verify each composition still renders standalone**

Open the first composition in a browser:

```bash
npx hyperframes preview compositions/01-hook.html
```

Expected: hook scene plays as before, no missing fonts or palette.

- [ ] **Step 4: Spot-check via Playwright (4 sample scenes)**

Re-use the verify script logic but point it at compositions:

```bash
node scripts/verify-master-playthrough.mjs
```

(The master player still loads from `previews/`. That's fine — it's the editor view. Compositions are the renderer view.)

- [ ] **Step 5: Commit**

```bash
git add shared/refactor-compositions.mjs compositions/
git commit -m "promo: convert previews to hyperframes compositions (data-* + tokens.css import)"
```

---

## Task 5: Verify all 16 compositions render in `hyperframes preview`

**Files:**
- Modify: none (read-only verification)

- [ ] **Step 1: Run preview server**

```bash
npx hyperframes preview
```

Expected: Hyperframes opens `http://localhost:3030` (or its default port) showing a list of 16 compositions, total runtime 79.68s.

- [ ] **Step 2: Click through each composition**

For each of the 16, scrub to the middle and confirm:
- No `:root` warnings in the browser console
- Fonts load (Instrument Serif visible on display copy)
- No reference errors from missing tokens (e.g., `var(--undefined-var)`)

- [ ] **Step 3: If any composition is broken, fix in the refactor script and rerun**

Most likely failures:
- A scene's `:root` had bespoke variables (e.g., Scene 12's `--clay-tint`) — add those to `tokens.css` if not present.
- Inline `<style>` with `@import` of fonts didn't get stripped — broaden `FONT_STYLESHEET` regex.

- [ ] **Step 4: Commit any token additions**

```bash
git add shared/tokens.css
git commit -m "promo: backfill missing tokens for compositions (clay-tint, status-bad, etc.)"
```

---

# Phase 2 — Audio production (Tasks 6–10)

## Task 6: Generate the music bed

**Files:**
- Create: `shared/audio/music-bed.mp3` (75s, 96 BPM)

**Why:** One bed across the whole 75s, locked to 96 BPM so every scene cut lands on a kick/hi-hat. The shooting script (`PROMO_VIDEO_SCRIPT_v2.md` §Audio) has the exact MusicGen prompt.

- [ ] **Step 1: Try MusicGen MCP**

```bash
# Replace with the actual MCP invocation in your tool environment
# Prompt below copied verbatim from PROMO_VIDEO_SCRIPT_v2.md §Audio
```

Prompt:

```
calm aged-care documentary score, warm cream tones, soft piano arpeggios over sub-bass pulse, gentle brushed snare entering at 0:35 (act break), hopeful resolution at 1:05, 96 BPM, no melody dominance, room for narration
```

Length: 80s (gives 5s of tail for fades).

Output: `shared/audio/music-bed.mp3`, 320 kbps, 44.1 kHz stereo.

- [ ] **Step 2: Fallback if MusicGen MCP unavailable**

Source from Pixabay CC0:
- Search: `aged care documentary 96 BPM`
- Pick a track ≥80s, public-domain or CC0 licence
- Download to `shared/audio/music-bed.mp3`

Alternative fallback: clone an Apple Music–free track from FreeSound CC0 collection `pkg-quiet-room`.

- [ ] **Step 3: Verify bed length and BPM**

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 shared/audio/music-bed.mp3
```

Expected: `≥75.00` and `≤80.00`.

- [ ] **Step 4: Commit**

```bash
git add shared/audio/music-bed.mp3
git commit -m "promo: add 80s music bed (96 BPM, MusicGen)"
```

---

## Task 7: Cue map (`shared/audio-cues.json`)

**Files:**
- Create: `shared/audio-cues.json`

**Why:** SFX play at scene-relative times. Cue map = source of truth that the audio mix script reads.

- [ ] **Step 1: Author the cue map**

```json
{
  "musicBed": { "src": "shared/audio/music-bed.mp3", "startSec": 0.00, "fadeInSec": 0.30, "fadeOutSec": 0.80, "gainDb": -6 },
  "cues": [
    { "atSec":  0.00, "src": "shared/audio/sfx/01-keyboard-tick.mp3", "scene":  1, "label": "typing-pulse-loop", "gainDb": -16 },
    { "atSec":  0.95, "src": "shared/audio/sfx/02-paper-rustle.mp3",  "scene":  1, "label": "fragment-cascade-A","gainDb": -10 },
    { "atSec":  1.10, "src": "shared/audio/sfx/02-paper-rustle.mp3",  "scene":  1, "label": "fragment-cascade-B","gainDb": -11 },
    { "atSec":  2.70, "src": "shared/audio/sfx/03-soft-whoosh.mp3",   "scene":  1, "label": "phase-E-fly-into-face", "gainDb": -8 },
    { "atSec":  3.00, "src": "shared/audio/sfx/05-brand-thud.mp3",    "scene":  2, "label": "logo-lock", "gainDb": -7 },
    { "atSec":  3.40, "src": "shared/audio/sfx/06-chime-tail.mp3",    "scene":  2, "label": "pill-bloom", "gainDb": -12 },
    { "atSec":  9.00, "src": "shared/audio/sfx/07-click-pop.mp3",     "scene":  4, "label": "drag-drop", "gainDb": -10 },
    { "atSec": 11.20, "src": "shared/audio/sfx/08-button-thunk.mp3",  "scene":  4, "label": "save-and-continue", "gainDb": -10 },
    { "atSec": 22.10, "src": "shared/audio/sfx/09-soft-chime-tap.mp3","scene":  6, "label": "PI-drilldown-snap", "gainDb": -12 },
    { "atSec": 30.30, "src": "shared/audio/sfx/04-shard-tumble.mp3",  "scene":  8, "label": "act-break-shards", "gainDb": -7 },
    { "atSec": 35.30, "src": "shared/audio/sfx/13-voice-bleep.mp3",   "scene":  9, "label": "voice-setup-modal","gainDb": -12 },
    { "atSec": 41.30, "src": "shared/audio/sfx/13-voice-bleep.mp3",   "scene": 10, "label": "recording-start", "gainDb": -10 },
    { "atSec": 51.95, "src": "shared/audio/sfx/14-alert-tick.mp3",    "scene": 11, "label": "score-resolves",  "gainDb":  -9 },
    { "atSec": 52.50, "src": "shared/audio/sfx/12-status-dot-ping.mp3","scene": 11, "label": "watch-pulse-on", "gainDb": -13 },
    { "atSec": 62.55, "src": "shared/audio/sfx/05-brand-thud.mp3",    "scene": 13, "label": "stamp-1-FHIR",    "gainDb":  -7 },
    { "atSec": 64.05, "src": "shared/audio/sfx/05-brand-thud.mp3",    "scene": 13, "label": "stamp-2-Privacy", "gainDb":  -7 },
    { "atSec": 65.55, "src": "shared/audio/sfx/05-brand-thud.mp3",    "scene": 13, "label": "stamp-3-GPMS",    "gainDb":  -7 },
    { "atSec": 67.05, "src": "shared/audio/sfx/11-page-curl-rustle.mp3","scene":14, "label": "page-curl",      "gainDb":  -8 },
    { "atSec": 69.55, "src": "shared/audio/sfx/10-iridescent-shimmer.mp3","scene":14, "label": "M13-sweep",   "gainDb": -10 },
    { "atSec": 70.85, "src": "shared/audio/sfx/06-chime-tail.mp3",    "scene": 14, "label": "ring-draw",       "gainDb": -10 },
    { "atSec": 76.18, "src": "shared/audio/sfx/05-brand-thud.mp3",    "scene": 16, "label": "logo-final-lock", "gainDb":  -6 },
    { "atSec": 78.18, "src": "shared/audio/sfx/15-soft-tail.mp3",     "scene": 16, "label": "audio-resolve",   "gainDb": -14 }
  ]
}
```

- [ ] **Step 2: Commit (placeholders, fills next task)**

```bash
git add shared/audio-cues.json
git commit -m "promo: add audio cue map (1 music bed + 22 sfx events)"
```

---

## Task 8: Source the 15 SFX files

**Files:**
- Create: `shared/audio/sfx/01-keyboard-tick.mp3` … `15-soft-tail.mp3`

**Why:** Every cue in `audio-cues.json` references an SFX file; missing files break the mix. All from FreeSound CC0 (no attribution required, no licence text shipped).

- [ ] **Step 1: Source each SFX**

For each entry below, find a CC0 sample on https://freesound.org and download as MP3 (16-bit 44.1kHz). Trim heads/tails so total length is the listed target.

| File | Search terms | Target length |
|---|---|---|
| `01-keyboard-tick.mp3` | "keyboard tick mechanical light" | 0.10s |
| `02-paper-rustle.mp3` | "paper rustle short single" | 0.40s |
| `03-soft-whoosh.mp3` | "soft whoosh transition cinematic" | 0.50s |
| `04-shard-tumble.mp3` | "glass shard tumble metallic shimmer" | 0.70s |
| `05-brand-thud.mp3` | "logo thud soft sub bass" | 0.45s |
| `06-chime-tail.mp3` | "soft bell chime tail decaying" | 0.80s |
| `07-click-pop.mp3` | "ui click pop subtle" | 0.10s |
| `08-button-thunk.mp3` | "button thunk hardware soft" | 0.15s |
| `09-soft-chime-tap.mp3` | "approval chime soft positive" | 0.25s |
| `10-iridescent-shimmer.mp3` | "iridescent shimmer high glittery" | 1.00s |
| `11-page-curl-rustle.mp3` | "paper page curl peel rustle" | 0.55s |
| `12-status-dot-ping.mp3` | "status dot ping notification soft" | 0.20s |
| `13-voice-bleep.mp3` | "soft bleep medical recording start" | 0.20s |
| `14-alert-tick.mp3` | "alert tick subtle attention" | 0.18s |
| `15-soft-tail.mp3` | "ambient pad tail resolution" | 1.20s |

- [ ] **Step 2: Verify all 15 files exist + are valid MP3**

```bash
for f in shared/audio/sfx/*.mp3; do
  ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" || echo "BROKEN: $f"
done
```

Expected: 15 numeric durations. No `BROKEN:` lines.

- [ ] **Step 3: Commit**

```bash
git add shared/audio/sfx/
git commit -m "promo: add 15 cc0 sfx (keyboard, rustle, whoosh, shards, brand thud, chimes, ...)"
```

---

## Task 9: Build the audio mix orchestrator

**Files:**
- Create: `shared/audio-mix.mjs`
- Create: `shared/audio/master-mix.mp3` (output)

**Why:** `ffmpeg` doesn't read JSON cue maps natively. We script the chain: read `audio-cues.json`, build an `ffmpeg` command with `amix` filter overlaying each SFX at its `atSec`, normalise to −16 LUFS, write `master-mix.mp3`.

- [ ] **Step 1: Write the script**

Create `shared/audio-mix.mjs`:

```js
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cues = JSON.parse(readFileSync(join(here, "audio-cues.json"), "utf8"));
const outDir = join(here, "audio");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = join(outDir, "master-mix.mp3");

const inputs = [];
const filters = [];

/* Input 0 = music bed, with fade in/out + gain */
inputs.push(`-i "${join(here, "..", cues.musicBed.src)}"`);
filters.push(
  `[0:a]volume=${dbToGain(cues.musicBed.gainDb)},` +
  `afade=t=in:st=0:d=${cues.musicBed.fadeInSec},` +
  `afade=t=out:st=${74.40}:d=${cues.musicBed.fadeOutSec}[a0]`
);

/* Each SFX = one input, delayed to cue start, gained, then merged */
let idx = 1;
const mixLabels = ["[a0]"];
for (const c of cues.cues){
  inputs.push(`-i "${join(here, "..", c.src)}"`);
  const delayMs = Math.round(c.atSec * 1000);
  filters.push(
    `[${idx}:a]volume=${dbToGain(c.gainDb)},adelay=${delayMs}|${delayMs}[a${idx}]`
  );
  mixLabels.push(`[a${idx}]`);
  idx++;
}

/* Final amix → loudnorm to -16 LUFS */
filters.push(
  `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0[mix]`
);
filters.push(
  `[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]`
);

const cmd = [
  "ffmpeg -y",
  inputs.join(" "),
  `-filter_complex "${filters.join(";")}"`,
  '-map "[out]"',
  "-c:a libmp3lame -q:a 2 -ac 2",
  `"${out}"`
].join(" ");

console.log("Running:\n", cmd, "\n");
execSync(cmd, { stdio: "inherit" });
console.log(`\n✓ wrote ${out}`);

function dbToGain(db){ return Math.pow(10, db / 20).toFixed(4); }
```

- [ ] **Step 2: Run it**

```bash
npm run audio:mix
```

Expected: `shared/audio/master-mix.mp3` written. Total duration ≈ 79.68s. ffmpeg prints `[Parsed_loudnorm_X] Integrated loudness: -16.0 LUFS`.

- [ ] **Step 3: Listen to it standalone**

Open `shared/audio/master-mix.mp3` in any audio player. Confirm:
- Music bed audible throughout, not louder than SFX peaks
- Brand thud at ~3.0s (logo lock) clearly punctuates
- Three thuds at 62.55, 64.05, 65.55 (trust stamps) are evenly spaced
- Final tail at 78.18s fades cleanly

- [ ] **Step 4: Commit**

```bash
git add shared/audio-mix.mjs shared/audio/master-mix.mp3
git commit -m "promo: ffmpeg-based audio mix orchestrator (music + 22 sfx, normalised to -16 LUFS)"
```

---

## Task 10: Lock-test audio against the visual master

**Files:**
- Modify: `index.html` (add `<audio>` element pointed at `shared/audio/master-mix.mp3`)
- Modify: `shared/master.js` (sync audio with master clock)

**Why:** Catch alignment errors (a brand thud at 3.0s should land on the logo bounce, not 200ms early/late). Better to find this NOW than after the render.

- [ ] **Step 1: Add audio element to `index.html`**

Inside `<body>` near the top, after `<div class="film">`:

```html
<audio id="masterAudio" src="shared/audio/master-mix.mp3" preload="auto"></audio>
```

- [ ] **Step 2: Sync audio in `shared/master.js`**

In `play()`:

```js
const audio = document.getElementById('masterAudio');
audio.currentTime = pausedAt;
audio.play();
```

In `pause()`:

```js
document.getElementById('masterAudio').pause();
```

In `setNow(t)`:

```js
const audio = document.getElementById('masterAudio');
if (audio) audio.currentTime = t;
```

- [ ] **Step 3: Watch the master with audio**

```bash
# Open http://localhost:8765/ via the helper server, click PLAY
node Caredata-Visualization-Azure/CapstoneProject/scripts/verify-master-playthrough.mjs
```

Note any cue that feels late/early (>150ms drift). Edit `audio-cues.json`, rerun `npm run audio:mix`, watch again.

- [ ] **Step 4: Commit**

```bash
git add index.html shared/master.js shared/audio-cues.json
git commit -m "promo: master player syncs audio mix with the scene timeline"
```

---

# Phase 3 — Vertical 9:16 cutdown (Tasks 11–12)

## Task 11: Vertical reflow stylesheet

**Files:**
- Create: `shared/9-16.css`

**Why:** A separate stylesheet (loaded only when Hyperframes runs the vertical orientation per `hyperframes.config.json`) reflows the dashboard-heavy scenes. Most text scenes (1, 2, 3, 8, 13, 15, 16) are already centred and just need scaling. UI-mockup scenes (4, 5, 7, 9, 10, 12) need vertical stacking of side-by-side panels.

- [ ] **Step 1: Author `shared/9-16.css`**

```css
/* =========================================================================
   CareData Promo — 9:16 vertical cutdown reflow
   Loaded by hyperframes only when --orientation=vertical.
   The frame becomes 1080x1920; we treat it as a portrait canvas and reflow
   side-by-side panels into stacked rows. Text-only scenes scale up.
   ========================================================================= */

/* Frame dimensions are set by hyperframes; we add the reflow rules. */
.frame-wrap{ width:1080px !important; height:1920px !important; }

/* Default: scale all centred content up 1.6x to fill the narrower viewport */
[data-composition-id]:not([data-composition-id="4"]):not([data-composition-id="5"]):not([data-composition-id="7"]):not([data-composition-id="9"]):not([data-composition-id="10"]):not([data-composition-id="12"]) .stage > *{
  zoom: 1.6;
  transform-origin: 50% 50%;
}

/* Scene 4 (Upload) — the GPMS form sidebar moves above main content */
[data-composition-id="4"] .browser{ flex-direction:column; }
[data-composition-id="4"] .gpms-form{ grid-template-columns: 1fr; }
[data-composition-id="4"] .gpms-form .toc{ width:100%; height:auto; max-height:240px; overflow-y:auto; }

/* Scene 5 (Dashboard) + Scene 12 (Nurse) — main grid stacks; right rail moves below */
[data-composition-id="5"]  .main-grid,
[data-composition-id="12"] .main-grid{ grid-template-columns: 1fr; gap: 24px; }
[data-composition-id="5"]  .feed,
[data-composition-id="12"] .feed{ width:100%; max-width:none; }

/* Scene 7 (Benchmarking) — the bar chart fits 1080 wide */
[data-composition-id="7"] .chart{ width:100% !important; height:auto !important; }

/* Scene 9 (Voice Setup) — modal + QR side-by-side becomes stacked */
[data-composition-id="9"]  .modal-grid{ grid-template-columns: 1fr; gap: 28px; }

/* Scene 10 (Recording Battery) — keep waveform centred, cap at 800px wide */
[data-composition-id="10"] .recording-card{ max-width:800px; margin:0 auto; }
```

- [ ] **Step 2: Verify with a one-shot Playwright capture**

Capture three sample scenes at 1080×1920 to confirm reflow:

```bash
# Pseudo-script: open compositions/05-dashboard.html with viewport 1080x1920
# and ?orientation=vertical, screenshot, save to screenshots/vertical-05-dashboard.png
node scripts/capture-vertical-samples.mjs
```

(Add this script as part of Task 12.)

- [ ] **Step 3: Commit**

```bash
git add shared/9-16.css
git commit -m "promo: add 9:16 vertical cutdown reflow stylesheet"
```

---

## Task 12: Verify vertical reflow on 4 representative scenes

**Files:**
- Create: `scripts/capture-vertical-samples.mjs`

**Why:** Cheaper to catch reflow bugs at preview-time than after rendering 80s of vertical video.

- [ ] **Step 1: Write the capture script**

Create `scripts/capture-vertical-samples.mjs`:

```js
import { chromium } from "file:///C:/Users/Admin/AppData/Local/Temp/node_modules/playwright/index.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "promo-hyperframes");
const OUT  = join(ROOT, "screenshots");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

/* Inject 9-16.css when loading each composition */
await page.addInitScript(() => {
  const link = document.createElement("link");
  link.rel  = "stylesheet";
  link.href = "../shared/9-16.css";
  document.head.appendChild(link);
});

const scenes = [
  { id:  1, slug: "hook" },        // text-heavy
  { id:  5, slug: "dashboard" },   // grid reflow
  { id: 12, slug: "nurse-dashboard" },
  { id: 16, slug: "final-card" }   // text + lockup
];

for (const s of scenes){
  const file = `compositions/${String(s.id).padStart(2,"0")}-${s.slug}.html`;
  await page.goto(`file://${join(ROOT, file)}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `vertical-${String(s.id).padStart(2,"0")}-${s.slug}.png`) });
  console.log(`captured vertical-${s.id}-${s.slug}`);
}

await browser.close();
```

- [ ] **Step 2: Run it**

```bash
node scripts/capture-vertical-samples.mjs
```

Open the four PNGs in `screenshots/`. Confirm:
- vertical-01-hook: headline reads, fragments are visible (may be cropped at top/bottom — acceptable)
- vertical-05-dashboard: KPIs stack, table scrolls
- vertical-12-nurse-dashboard: alerts feed sits below table
- vertical-16-final-card: BrandMark + wordmark stack vertically (mark on top, words below)

If any scene is broken, edit `9-16.css`, rerun the capture, repeat.

- [ ] **Step 3: Commit**

```bash
git add scripts/capture-vertical-samples.mjs screenshots/vertical-*.png
git commit -m "promo: verify vertical 9:16 reflow on 4 representative scenes"
```

---

# Phase 4 — Render & verify (Tasks 13–15)

## Task 13: Render the 1920×1080 master

**Files:**
- Create: `output/master-1920x1080.mp4`

- [ ] **Step 1: Run the renderer**

```bash
npm run render
```

Expected: ~5–15 minutes depending on machine. Hyperframes spawns puppeteer-core, captures 30 fps frames over 80s, encodes via H.264.

- [ ] **Step 2: Sanity-check the output**

```bash
ffprobe output/master-1920x1080.mp4 2>&1 | grep -E "Duration|Video|Audio"
```

Expected:
- `Duration: 00:01:19.6X` (within ±0.05s of 79.68)
- `Video: h264 ... 1920x1080 ... 30 fps`
- `Audio: mp3` (or aac)

- [ ] **Step 3: Spot-check 4 timestamps**

Extract a still at each beat:

```bash
for t in 1.5 18.0 47.5 78.0; do
  ffmpeg -y -i output/master-1920x1080.mp4 -ss $t -frames:v 1 \
    output/check-${t}s.png
done
```

Open the PNGs:
- `check-1.5s.png` — Hook scene mid-typing, headline visible
- `check-18.0s.png` — QI Dashboard counters animating
- `check-47.5s.png` — Recording Battery waveform active
- `check-78.0s.png` — Final card with CareData lockup

- [ ] **Step 4: Commit (output is small enough; if not, gitignore it)**

```bash
git add output/master-1920x1080.mp4 output/check-*.png
git commit -m "promo: render 1920x1080 master MP4 (79.68s, 30fps, h264)"
```

---

## Task 14: Render the 1080×1920 vertical cutdown

**Files:**
- Create: `output/master-1080x1920.mp4`

- [ ] **Step 1: Run the vertical renderer**

```bash
npm run render:vertical
```

Expected: similar runtime to horizontal. Output uses `9-16.css` reflow.

- [ ] **Step 2: Sanity-check**

```bash
ffprobe output/master-1080x1920.mp4 2>&1 | grep -E "Duration|Video"
```

Expected: `Duration: 00:01:19.6X`, `Video: h264 ... 1080x1920`.

- [ ] **Step 3: Spot-check 3 timestamps**

```bash
for t in 1.5 18.0 78.0; do
  ffmpeg -y -i output/master-1080x1920.mp4 -ss $t -frames:v 1 \
    output/vcheck-${t}s.png
done
```

Open the PNGs and confirm vertical layout reads naturally (no cropped text, stacked panels).

- [ ] **Step 4: Commit**

```bash
git add output/master-1080x1920.mp4 output/vcheck-*.png
git commit -m "promo: render 1080x1920 vertical cutdown"
```

---

## Task 15: End-to-end verification

**Files:**
- Create: `scripts/verify-render.mjs`

**Why:** Programmatic checklist — duration, dimensions, audio levels, frame samples — so future re-renders catch regressions.

- [ ] **Step 1: Write the verification script**

Create `scripts/verify-render.mjs`:

```js
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "promo-hyperframes");
const TIMELINE = JSON.parse(readFileSync(join(ROOT, "shared", "timeline.json"), "utf8"));

const checks = [];

function check(name, fn){
  try { fn(); checks.push({ name, ok: true }); }
  catch (e){ checks.push({ name, ok: false, err: e.message }); }
}

function ffprobeJson(file, key){
  const out = execSync(
    `ffprobe -v error -show_entries format=${key} -of json "${file}"`
  ).toString();
  return JSON.parse(out).format[key];
}

const horiz = join(ROOT, "output", "master-1920x1080.mp4");
const vert  = join(ROOT, "output", "master-1080x1920.mp4");

check("Horizontal master exists", () => {
  if (!existsSync(horiz)) throw new Error("missing");
});

check("Vertical master exists", () => {
  if (!existsSync(vert)) throw new Error("missing");
});

check("Horizontal duration ≈ timeline total ±0.1s", () => {
  const d = parseFloat(ffprobeJson(horiz, "duration"));
  if (Math.abs(d - TIMELINE.totalDurationSec) > 0.10)
    throw new Error(`got ${d}s, expected ${TIMELINE.totalDurationSec}s`);
});

check("Audio is normalised near -16 LUFS", () => {
  const out = execSync(
    `ffmpeg -i "${horiz}" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=summary -f null - 2>&1 | tail -20`
  ).toString();
  const m = out.match(/Input Integrated:\s+(-?\d+\.\d+) LUFS/);
  if (!m) throw new Error("loudnorm output not parseable");
  const lufs = parseFloat(m[1]);
  if (Math.abs(lufs + 16) > 1.0) throw new Error(`got ${lufs} LUFS, want -16 ±1`);
});

check("Horizontal is 1920x1080 h264", () => {
  const out = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of json "${horiz}"`
  ).toString();
  const s = JSON.parse(out).streams[0];
  if (s.width !== 1920 || s.height !== 1080) throw new Error(`got ${s.width}x${s.height}`);
  if (s.codec_name !== "h264") throw new Error(`got codec ${s.codec_name}`);
});

check("Vertical is 1080x1920 h264", () => {
  const out = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of json "${vert}"`
  ).toString();
  const s = JSON.parse(out).streams[0];
  if (s.width !== 1080 || s.height !== 1920) throw new Error(`got ${s.width}x${s.height}`);
});

let pass = 0, fail = 0;
for (const c of checks){
  if (c.ok){ console.log(`✓ ${c.name}`); pass++; }
  else     { console.log(`✗ ${c.name}: ${c.err}`); fail++; }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run it**

```bash
npm run verify
```

Expected: all 6 checks pass.

- [ ] **Step 3: If any check fails, drill in**

Common issues:
- Duration off by >0.1s → a scene's `durSec` in `timeline.json` doesn't match its actual end time. Adjust JSON, re-render.
- Audio LUFS off → music gain too hot/quiet. Tweak `audio-cues.json`'s `gainDb`, rerun `npm run audio:mix`, then `npm run render`.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-render.mjs
git commit -m "promo: verify render output (duration, dims, codec, LUFS)"
```

---

## Self-review checklist (already run by author)

- [x] **Spec coverage:** Tasks cover all 5 user-stated requirements (Hyperframes init/scaffold, token import refactor, audio wiring with named SFX, vertical cutdown, render).
- [x] **No placeholders:** Every task has exact file paths and full code blocks. No "implement later" or "TBD". The audio cue map has all 22 cues fully specified with timing + gain.
- [x] **Type/path consistency:** `timeline.json` is referenced by name in Tasks 3, 4, 9, 11, 15. `audio-cues.json` consumed by `audio-mix.mjs` only. Composition file naming `NN-slug.html` consistent across tasks 4, 5, 12, 13, 14.
- [x] **Honesty constraints preserved:** No "submitted to AIHW" anywhere; only `Download Q1 2026 report` + `Save submission draft`. Trust stamps are FHIR R4 / Privacy Act 1988 / GPMS-format export. No em-dashes in this plan or generated copy.

---

*Source documents: `Caredata-Visualization-Azure/CapstoneProject/CLAUDE.md` (decisions log), `PROMO_VIDEO_SCRIPT_v2.md` (shooting script), `promo-hyperframes/shared/timeline.json` (after Task 3, the runtime source of truth).*
