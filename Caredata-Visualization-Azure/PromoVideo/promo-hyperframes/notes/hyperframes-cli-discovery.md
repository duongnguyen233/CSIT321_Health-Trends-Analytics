# Hyperframes CLI discovery — v0.5.3

Authoritative reference for how this codebase actually drives Hyperframes. Supersedes the
plan's assumptions where they conflict. Read before touching Tasks 4, 11, 13, 14.

## Version

`hyperframes@0.5.3` (pinned in `package.json`). `npx hyperframes --version` prints `0.5.3`.

## Subcommands (full list)

From `npx hyperframes --help`:

**Getting Started**

- `init` — scaffold a new composition project from a registry example.
- `add` — install a block or component from the registry.
- `capture` — capture a website for video production.
- `catalog` — browse and install blocks and components.
- `preview` — start the studio for previewing compositions (default port 3002).
- `publish` — upload a project and get a stable public URL.
- `render` — render a composition to MP4 / WebM / MOV.

**Project**

- `lint` — validate a composition for common mistakes.
- `inspect` — inspect rendered visual layout across the timeline (text overflow, container overflow).
- `snapshot` — capture key frames as PNG screenshots for visual verification.
- `info` — print project metadata.
- `compositions` — list all compositions in a project.
- `docs` — view inline documentation in the terminal.

**Tooling**

- `benchmark` — render with preset fps/quality/worker configs and compare.
- `browser` — manage the Chrome browser used for rendering (`npx hyperframes browser ensure`).
- `doctor` — check system dependencies (FFmpeg, FFprobe, Chrome, Node, Docker).
- `upgrade` — check for updates.

**AI & Integrations**

- `skills` — install HyperFrames and GSAP skills for AI coding tools.
- `transcribe` — whisper word-level transcription, or import an existing transcript.
- `tts` — generate speech audio (Kokoro-82M).
- `remove-background` — strip background from video/image.

**Settings**

- `telemetry` — manage anonymous usage telemetry.

## Config file: `hyperframes.json`

**Real schema** (extracted from `node_modules/hyperframes/dist/cli.js`,
`PROJECT_CONFIG_FILENAME` and `DEFAULT_PROJECT_CONFIG`):

```json
{
  "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": {
    "blocks":     "compositions",
    "components": "compositions/components",
    "assets":     "assets"
  }
}
```

That's the entire surface. Only four fields:

| Field | Meaning |
|---|---|
| `$schema` | JSON-Schema URL — purely advisory for editors. |
| `registry` | Base URL Hyperframes pulls registry blocks/components/examples from when you run `hyperframes add` or `hyperframes init -e`. |
| `paths.blocks` | Where `hyperframes add <block>` writes installed blocks. Also the default scan path the CLI uses to enumerate compositions. |
| `paths.components` | Where `hyperframes add <component>` writes installed components. |
| `paths.assets` | Where the CLI's project-management commands look for media assets. |

**`hyperframes.json` does NOT contain:** width, height, fps, audio paths, output paths,
extra stylesheets, orientation variants, render quality, encoder, codec, or anything
about the composition itself. Those are either:

- baked into the **HTML** (the composition's root `<div data-composition-id ...>`), or
- passed as **CLI flags** to `render`.

Hyperframes is fundamentally **HTML-driven**, not JSON-config-driven.

## How a composition is defined (HTML, not JSON)

Each composition lives in its own `.html` file. The framework scans for HTML files with
a root element matching:

```html
<div data-composition-id="<id>"
     data-width="1920"  data-height="1080"
     data-start="0"     data-duration="<seconds>">
  <!-- timed children, each with class="clip" + data-start/data-duration/data-track-index -->
</div>
```

Required HTML invariants (from the scaffolded `_shared/AGENTS.md` template):

1. Every timed element has `data-start`, `data-duration`, `data-track-index`.
2. Visible timed elements **must** have `class="clip"` — used for visibility control.
3. GSAP timelines must be **paused** and registered on `window.__timelines[compositionId]`.
4. Videos use `muted` + a separate `<audio>` for the audio track.
5. Sub-compositions are referenced via `<div data-composition-src="compositions/foo.html"></div>`.
6. Deterministic only — no `Date.now()`, no `Math.random()`, no network fetches.

Project-root structure produced by `init`:

```
my-project/
  hyperframes.json   ← project config (this file)
  meta.json          ← {"id","name","createdAt"}
  package.json       ← scripts: dev/check/render/publish
  index.html         ← root composition
  compositions/      ← sub-composition HTML files (per paths.blocks)
  assets/            ← media (per paths.assets)
  AGENTS.md          ← agent guidance (also CLAUDE.md alias)
```

## `render` — actual flags

`npx hyperframes render --help`:

```
USAGE:  hyperframes render [OPTIONS] [DIR]

ARGUMENTS:
  DIR    Project directory

OPTIONS:
  -o, --output            Output path (default: renders/<name>.mp4)
  -f, --fps="30"          Frame rate: 24, 30, 60
  -q, --quality           draft | standard | high (default: standard)
  --format="mp4"          mp4 | webm | mov   (mov/webm render with transparency)
  -w, --workers           Parallel render workers (number or 'auto')
  --docker                Use Docker for deterministic render
  --hdr / --sdr           Force HDR / SDR output
  --crf                   Override encoder CRF (mutually exclusive with --video-bitrate)
  --video-bitrate         e.g. 10M (mutually exclusive with --crf)
  --gpu                   Use GPU encoding
  --browser-gpu           Host GPU for Chrome capture (on by default; --no-browser-gpu to disable)
  --quiet                 Suppress verbose output
  --strict                Fail render on lint errors
  --strict-all            Fail render on lint errors AND warnings
  --max-concurrent-renders   1-10 (default: 2)
  --variables             JSON object merged over composition defaults (window.__hyperframes.getVariables())
  --variables-file        Path to JSON file (alternative to --variables)
  --strict-variables      Fail render if --variables keys are undeclared / wrong type
```

**Default output path:** `renders/<name>.mp4` — note this is `renders/`, not `output/`.
We've been using `output/` in `package.json` scripts via explicit `-o output/...mp4`, which works.

**Output format:** mp4 (default), webm, or mov. WebM and MOV support transparency.
Audio is muxed into the container — Hyperframes handles encoding via FFmpeg
(`ffmpeg-static` in `node_modules`).

## Plan assumptions that turned out wrong

| Plan assumed | Reality |
|---|---|
| Width / height / fps / audio path live in `hyperframes.json`. | They don't. Config is registry + paths only. Dimensions are HTML attributes; fps is a CLI flag; audio is an `<audio>` element inside the composition HTML. |
| `extraStylesheet` is a config field per orientation. | No such field. Stylesheets are `<link>` tags in the composition HTML. |
| A `vertical` orientation entry can live alongside `horizontal` in one config. | **No.** `hyperframes.json` has no notion of orientations or variants. |
| `--orientation=vertical` is a `render` flag (referenced in `package.json` script). | **No such flag.** A vertical render must be a separate composition file (e.g. `index-vertical.html` with `data-width="1080" data-height="1920"`) rendered with `hyperframes render <dir-or-file> -o ...`. The `package.json` `render:vertical` script as currently written will fail and needs fixing in a later task. |
| Output dir is `output/`. | Hyperframes' default is `renders/`. We override with `-o output/...mp4` explicitly, which is fine. |

## Vertical orientation — how to actually do it

**Option A (recommended): separate composition file.**

Create `index-vertical.html` (or `compositions/master-vertical.html`) with the same
timeline structure but `data-width="1080" data-height="1920"` on the root and a
vertical-stylesheet `<link rel="stylesheet" href="shared/9-16.css">` (Task 13's job).
Render with:

```bash
npx hyperframes render . -o output/master-1080x1920.mp4
# or, if vertical lives in a sub-composition that the CLI picks up by name,
# render with the same command and target the appropriate composition id.
```

**Option B: treat the vertical cut as a second project directory** — copy
`hyperframes.json` + `index.html` + `shared/` into a sibling dir. Heavier; only do
this if the vertical version diverges substantially.

Either way, the existing `package.json` script `"render:vertical": "hyperframes render --orientation=vertical ..."` must be rewritten — `--orientation` is not a real flag.
This is in scope for whichever task wires the vertical cutdown (likely Task 13/14).

## Other useful commands for verification

- `npx hyperframes compositions` — lists composition files in the project. Currently
  prints `no compositions found` because we haven't built `compositions/*.html` yet.
- `npx hyperframes lint` — validates the root `index.html`. Currently surfaces three
  errors (`root_missing_composition_id`, `root_missing_dimensions`,
  `missing_timeline_registry`) which are expected — the existing `index.html` is the
  custom playback shell, not a Hyperframes composition. Task 11 wires this up properly.
- `npx hyperframes info` — prints project resolution, duration, element count.
- `npx hyperframes inspect` — runs the rendered composition through the layout-audit
  browser script (text overflow, container overflow). Use this in CI / verification.
- `npx hyperframes snapshot` — captures key-frame PNGs for visual verification.
- `npx hyperframes doctor` — environment check. Currently flags FFmpeg/FFprobe/Chrome
  as missing on PATH. We have `ffmpeg-static` and `ffprobe-static` in `node_modules`;
  Chrome is installed via `npx hyperframes browser ensure` (run before first render).

## Where this leaves Task 4 and beyond

- Task 4 (compositions): write `compositions/scene-XX.html` files with the
  required `data-composition-id` / `data-width="1920"` / `data-height="1080"` /
  `data-start` / `data-duration` attributes and the `window.__timelines` registry pattern.
- Task 11 (master): give the root playback shell either a real composition root or
  point Hyperframes at a different entry HTML — the current `index.html` is a custom
  scrubber UI, not a composition, and lint will keep failing until that's resolved.
- Task 13/14 (vertical): build a separate vertical composition file. Drop the
  `--orientation=vertical` script — it's vapor.
