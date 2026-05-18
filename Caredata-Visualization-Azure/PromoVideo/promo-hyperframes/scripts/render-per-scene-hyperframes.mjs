#!/usr/bin/env node
/**
 * render-per-scene-hyperframes.mjs
 *
 * Render each of the 16 scene compositions individually via the Hyperframes
 * CLI by swapping it into ./index.html at native 30fps, then concatenate
 * the per-scene mp4s with ffmpeg and mux the master audio.
 *
 * This is the "30fps from CLI" follow-up to the Playwright-recorded master
 * already at output/master-1920x1080.mp4 (which was 25fps). The new file
 * goes to output/master-1920x1080-30fps.mp4 (parallel; existing not touched).
 *
 * Safety: The render swaps each comp HTML into ./index.html. We snapshot
 * sha256(index.editor.html) at start and ALWAYS restore from the editor
 * backup in finally — even on crash. If the restore drifts, throw loudly.
 *
 * Usage:
 *   node scripts/render-per-scene-hyperframes.mjs
 *   node scripts/render-per-scene-hyperframes.mjs --vertical
 *   node scripts/render-per-scene-hyperframes.mjs --skip-render   # only concat + mux
 *   node scripts/render-per-scene-hyperframes.mjs --only=5,7      # render a subset
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, statSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// --- paths --------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");

const requireFromPromo = createRequire(join(ROOT, "package.json"));
const ffmpegPath  = requireFromPromo("ffmpeg-static");
const ffprobePath = requireFromPromo("ffprobe-static").path;

// --- CLI flags ----------------------------------------------------------------
const argv = process.argv.slice(2);
const VERTICAL = argv.includes("--vertical");
const SKIP_RENDER = argv.includes("--skip-render");
const NO_MASTER = argv.includes("--no-master");
const ONLY = (() => {
  const a = argv.find(x => x.startsWith("--only="));
  if (!a) return null;
  return new Set(a.slice("--only=".length).split(",").map(s => parseInt(s, 10)).filter(Number.isFinite));
})();

const W = VERTICAL ? 1080 : 1920;
const H = VERTICAL ? 1920 : 1080;
const DIM = `${W}x${H}`;

const TIMELINE = JSON.parse(readFileSync(join(ROOT, "shared", "timeline.json"), "utf8"));
const SCENES = TIMELINE.scenes;
const TOTAL_DUR = TIMELINE.totalDurationSec;

const SCENES_DIR = join(ROOT, "output", VERTICAL ? "scenes-30fps-vertical" : "scenes-30fps");
const CHECKS_DIR = join(ROOT, "output", VERTICAL ? "checks-30fps-vertical" : "checks-30fps");
const OUTPUT_DIR = join(ROOT, "output");
const FINAL_NOAUDIO = join(SCENES_DIR, `_concat-${DIM}-noaudio.mp4`);
const FINAL_OUT     = join(OUTPUT_DIR, `master-${DIM}-30fps.mp4`);
const LIST_FILE     = join(SCENES_DIR, `_concat-list-${DIM}.txt`);
const SCENE_AUDIO   = join(SCENES_DIR, `_concat-${DIM}-scene-audio.aac`);
const MUSIC_PATH    = join(ROOT, "audio", "sunsides-upbeat-energetic-background-music-151501.mp3");

const INDEX_PATH  = join(ROOT, "index.html");
const EDITOR_PATH = join(ROOT, "index.editor.html");

mkdirSync(SCENES_DIR, { recursive: true });
mkdirSync(CHECKS_DIR, { recursive: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

// --- ffmpeg/ffprobe staging on PATH so Hyperframes finds them -----------------
// Hyperframes spawns "ffmpeg" / "ffprobe" by name; on Windows neither is system-installed.
const FFBIN_DIR = join(ROOT, ".ffmpeg-bin");
mkdirSync(FFBIN_DIR, { recursive: true });
{
  const stagedFfmpeg  = join(FFBIN_DIR, process.platform === "win32" ? "ffmpeg.exe"  : "ffmpeg");
  const stagedFfprobe = join(FFBIN_DIR, process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
  if (!existsSync(stagedFfmpeg))  copyFileSync(ffmpegPath,  stagedFfmpeg);
  if (!existsSync(stagedFfprobe)) copyFileSync(ffprobePath, stagedFfprobe);
  process.env.PATH = `${FFBIN_DIR}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}`;
}

// --- helpers ------------------------------------------------------------------
const log = (...a) => console.log("[render-per-scene-hf]", ...a);
function sha256(p) { return createHash("sha256").update(readFileSync(p)).digest("hex"); }
function pad2(n) { return String(n).padStart(2, "0"); }
const NEEDS_SHELL = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const useShell = opts.shell ?? (NEEDS_SHELL && (cmd === "npx" || cmd === "npm"));
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, shell: useShell, ...opts });
  if (r.status !== 0) throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(" ")}`);
}
function runCapture(cmd, args, opts = {}) {
  const useShell = opts.shell ?? (NEEDS_SHELL && (cmd === "npx" || cmd === "npm"));
  return spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT, shell: useShell, ...opts });
}

// --- index.html safety guards -------------------------------------------------
if (!existsSync(EDITOR_PATH)) {
  log(`creating index.editor.html backup from index.html (first run)`);
  copyFileSync(INDEX_PATH, EDITOR_PATH);
}
const EDITOR_HASH = sha256(EDITOR_PATH);
{
  // Sanity check at start: index.html must equal editor backup
  if (sha256(INDEX_PATH) !== EDITOR_HASH) {
    log(`WARN index.html drifted from editor backup at startup — restoring`);
    copyFileSync(EDITOR_PATH, INDEX_PATH);
    if (sha256(INDEX_PATH) !== EDITOR_HASH) {
      throw new Error("Failed to restore index.html from editor backup at startup");
    }
  }
  // Also confirm the editor backup is the actual editor master, not a scene
  const editorContent = readFileSync(EDITOR_PATH, "utf8");
  if (!editorContent.includes('id="idlePlay"')) {
    throw new Error(`index.editor.html does NOT look like the editor master (no #idlePlay button). Aborting before damage.`);
  }
}

function restoreIndex() {
  copyFileSync(EDITOR_PATH, INDEX_PATH);
}

// --- composition transform ----------------------------------------------------
function transformSceneHtml(src, { vertical }) {
  let html = src;
  // Previews live in previews/scene-NN-slug.html and reference ../shared/ and ../audio/.
  // After swapping into ./index.html at the project root those paths need to drop the ../.
  html = html.replace(/\.\.\/shared\//g, "shared/");
  html = html.replace(/\.\.\/audio\//g, "audio/");

  if (vertical) {
    html = html.replace(
      /(<div[^>]*data-composition-id="[^"]+"[^>]*?)data-width="1920"([^>]*?)data-height="1080"/,
      '$1data-width="1080"$2data-height="1920"'
    );
    if (!html.includes("shared/9-16.css")) {
      html = html.replace(
        /<\/head>/i,
        '<link rel="stylesheet" href="shared/9-16.css"></head>'
      );
    }
  }
  return html;
}

// --- per-scene render ---------------------------------------------------------
async function renderOneScene(scene) {
  const id = pad2(scene.id);
  const slug = scene.slug;
  const compFile = join(ROOT, "previews", `scene-${id}-${slug}.html`);
  const sceneOut = join(SCENES_DIR, `${id}-${slug}.mp4`);

  log(`-> Scene ${id} ${slug} (${scene.durSec}s) [${DIM}]`);

  const original = readFileSync(compFile, "utf8");
  const swapped = transformSceneHtml(original, { vertical: VERTICAL });
  writeFileSync(INDEX_PATH, swapped, "utf8");

  // Render at 30fps, standard quality (matches existing master encoder profile)
  const renderArgs = [
    "hyperframes", "render", ".",
    "-o", relative(ROOT, sceneOut),
    "-f", "30",
    "-q", "high",
    "--no-browser-gpu",
  ];
  let r = runCapture("npx", renderArgs);
  if (r.status !== 0) {
    log(`   high quality failed (status ${r.status}); retrying at standard`);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.stdout) process.stdout.write(r.stdout);
    const retry = renderArgs.map(a => a === "high" ? "standard" : a);
    r = runCapture("npx", retry);
  }
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) throw new Error(`Render failed for scene ${id}-${slug}`);

  if (!existsSync(sceneOut)) throw new Error(`Render produced no file: ${sceneOut}`);
  const sz = statSync(sceneOut).size;
  log(`   wrote ${relative(ROOT, sceneOut)} (${(sz/1024).toFixed(0)} KB)`);
  if (sz < 100 * 1024) {
    log(`   WARNING: file under 100KB — likely a blank render`);
  }

  // Spot-check a frame at scene_dur/2
  const probe = join(SCENES_DIR, `${id}-${slug}.probe.png`);
  const frameTime = (scene.durSec / 2).toFixed(3);
  const pr = runCapture(ffmpegPath, ["-y", "-v", "error", "-ss", frameTime, "-i", sceneOut, "-frames:v", "1", probe]);
  if (pr.status === 0 && existsSync(probe)) {
    const psz = statSync(probe).size;
    log(`   probe png: ${(psz/1024).toFixed(0)} KB at t=${frameTime}s`);
  }

  return { id, slug, out: sceneOut, sizeBytes: sz };
}

// --- concat + mux -------------------------------------------------------------
function concatScenes(rendered) {
  const lines = rendered.map(s => `file '${relative(dirname(LIST_FILE), s.out).replace(/\\/g, "/")}'`).join("\n");
  writeFileSync(LIST_FILE, lines + "\n", "utf8");
  log(`concat list:\n${lines}`);

  // h264_nvenc encode on T2000 (Turing, 7th-gen NVENC). cq 19 ≈ libx264 crf 18.
  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", LIST_FILE,
    "-r", "30",
    "-c:v", "h264_nvenc",
    "-preset", "p7",
    "-tune", "hq",
    "-rc", "vbr",
    "-cq", "19",
    "-b:v", "0",
    "-pix_fmt", "yuv420p",
    "-an",
    FINAL_NOAUDIO,
  ];
  run(ffmpegPath, args);
  log(`concat -> ${relative(ROOT, FINAL_NOAUDIO)}`);
}

// Per-scene audio normalisation. Each scene mp4 either has SFX baked in (from
// <audio> elements captured by Hyperframes) or is silent. To concatenate audio
// alongside video, every scene needs a uniform-format audio sidecar of exactly
// scene.durSec length. Returns [{id, slug, audioPath}] in scene order.
function normalizeSceneAudio(rendered) {
  const out = [];
  for (const s of rendered) {
    const scene = SCENES.find(x => pad2(x.id) === s.id);
    if (!scene) throw new Error(`unknown scene ${s.id}`);
    const audioOut = join(SCENES_DIR, `${s.id}-${s.slug}.audio.aac`);
    const probe = runCapture(ffprobePath, [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=codec_type",
      "-of", "csv=p=0",
      s.out,
    ]);
    const hasAudio = probe.status === 0 && probe.stdout.trim() === "audio";
    if (hasAudio) {
      run(ffmpegPath, [
        "-y", "-v", "error",
        "-i", s.out,
        "-vn",
        "-t", String(scene.durSec),
        "-af", `apad=whole_dur=${scene.durSec}`,
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        audioOut,
      ]);
      log(`audio scene ${s.id} (sfx, ${scene.durSec}s) -> ${relative(ROOT, audioOut)}`);
    } else {
      run(ffmpegPath, [
        "-y", "-v", "error",
        "-f", "lavfi",
        "-i", "anullsrc=r=48000:cl=stereo",
        "-t", String(scene.durSec),
        "-c:a", "aac",
        "-b:a", "192k",
        audioOut,
      ]);
      log(`audio scene ${s.id} (silent, ${scene.durSec}s) -> ${relative(ROOT, audioOut)}`);
    }
    out.push({ id: s.id, slug: s.slug, audioPath: audioOut });
  }
  return out;
}

function buildSceneAudioTrack(audioFiles) {
  const inputs = [];
  const filterParts = [];
  audioFiles.forEach((a, i) => {
    inputs.push("-i", a.audioPath);
    filterParts.push(`[${i}:a]`);
  });
  const filter = `${filterParts.join("")}concat=n=${audioFiles.length}:v=0:a=1[aout]`;
  run(ffmpegPath, [
    "-y", "-v", "error",
    ...inputs,
    "-filter_complex", filter,
    "-map", "[aout]",
    "-c:a", "aac",
    "-b:a", "192k",
    SCENE_AUDIO,
  ]);
  log(`scene-audio -> ${relative(ROOT, SCENE_AUDIO)}`);
}

function muxAudio() {
  if (!existsSync(MUSIC_PATH)) {
    throw new Error(`music bed not found at ${MUSIC_PATH}`);
  }
  if (!existsSync(SCENE_AUDIO)) {
    throw new Error(`scene-audio track not found at ${SCENE_AUDIO}`);
  }
  // Scene SFX track at gain 1.0; music bed ducked to 0.18; normalize=0 keeps
  // those absolute (amix's default normalize divides by N, which would halve both).
  // Music fades out over the last 5s of the master (afade on music chain only,
  // so scene SFX continue at full volume through the fade).
  const musicFadeStart = (TOTAL_DUR - 5).toFixed(2);
  const filterComplex =
    `[1:a]volume=1.0[s];` +
    `[2:a]volume=0.18,afade=t=out:st=${musicFadeStart}:d=5[m];` +
    `[s][m]amix=inputs=2:duration=first:normalize=0[aout]`;
  const args = [
    "-y",
    "-i", FINAL_NOAUDIO,
    "-i", SCENE_AUDIO,
    "-i", MUSIC_PATH,
    "-t", String(TOTAL_DUR),
    "-filter_complex",
    filterComplex,
    "-map", "0:v:0",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-shortest",
    FINAL_OUT,
  ];
  run(ffmpegPath, args);
  log(`final -> ${relative(ROOT, FINAL_OUT)}`);
}

function ffprobeFinal() {
  const r = runCapture(ffprobePath, [
    "-v", "error",
    "-show_streams", "-show_format",
    "-of", "json",
    FINAL_OUT,
  ]);
  if (r.status === 0) {
    try {
      const j = JSON.parse(r.stdout);
      const v = j.streams.find(s => s.codec_type === "video");
      const a = j.streams.find(s => s.codec_type === "audio");
      log("=== ffprobe summary ===");
      if (v) log(`  video: ${v.codec_name} ${v.width}x${v.height} r=${v.r_frame_rate} avg=${v.avg_frame_rate} dur=${v.duration}`);
      if (a) log(`  audio: ${a.codec_name} ${a.channels}ch ${a.sample_rate}Hz`);
      if (j.format) log(`  format: ${j.format.format_name} dur=${j.format.duration} size=${(j.format.size/1024/1024).toFixed(2)}MB`);
    } catch (e) {
      console.log(r.stdout);
    }
  }
}

function spotChecks() {
  const stamps = [1.5, 18, 47, 78];
  for (const t of stamps) {
    const out = join(CHECKS_DIR, `check-${t}s.png`);
    const r = runCapture(ffmpegPath, ["-y", "-v", "error", "-ss", String(t), "-i", FINAL_OUT, "-frames:v", "1", out]);
    if (r.status === 0 && existsSync(out)) {
      const sz = statSync(out).size;
      log(`spot ${t}s -> ${relative(ROOT, out)} (${(sz/1024).toFixed(0)} KB)`);
    } else {
      log(`spot ${t}s extraction failed`);
    }
  }
}

// --- main ---------------------------------------------------------------------
let succeeded = [];
let renderError = null;
try {
  if (!SKIP_RENDER) {
    for (const scene of SCENES) {
      if (ONLY && !ONLY.has(scene.id)) {
        // For partial runs we still need ALL scenes for concat, so reuse prior output if present
        const id = pad2(scene.id);
        const out = join(SCENES_DIR, `${id}-${scene.slug}.mp4`);
        if (existsSync(out)) {
          log(`-- Scene ${id} ${scene.slug} skipped (--only set, prior exists)`);
          succeeded.push({ id, slug: scene.slug, out, sizeBytes: statSync(out).size });
        } else {
          log(`-- Scene ${id} ${scene.slug} skipped (--only set, no prior output yet)`);
        }
        continue;
      }
      const result = await renderOneScene(scene);
      succeeded.push(result);
    }
  } else {
    log(`--skip-render set; assuming scenes already in ${relative(ROOT, SCENES_DIR)}`);
    for (const scene of SCENES) {
      const id = pad2(scene.id);
      const out = join(SCENES_DIR, `${id}-${scene.slug}.mp4`);
      if (!existsSync(out)) throw new Error(`missing pre-rendered scene file: ${out}`);
      succeeded.push({ id, slug: scene.slug, out, sizeBytes: statSync(out).size });
    }
  }
} catch (e) {
  renderError = e;
  console.error(`[render-per-scene-hf] ERROR during render loop: ${e.message}`);
} finally {
  // ALWAYS restore index.html — no exceptions.
  try {
    restoreIndex();
    if (sha256(INDEX_PATH) !== EDITOR_HASH) {
      console.error(`[render-per-scene-hf] CRITICAL: index.html restore FAILED; manual fix needed`);
      process.exit(2);
    }
    // Final positive confirmation: editor master content is back
    const finalContent = readFileSync(INDEX_PATH, "utf8");
    if (!finalContent.includes('id="idlePlay"')) {
      console.error(`[render-per-scene-hf] CRITICAL: restored index.html lacks #idlePlay; backup may be wrong`);
      process.exit(2);
    }
    log(`✓ index.html restored to editor backup (sha256 match)`);
  } catch (restoreErr) {
    console.error(`[render-per-scene-hf] FATAL during restore:`, restoreErr);
    process.exit(2);
  }
}

if (renderError) {
  console.error(`[render-per-scene-hf] aborting due to render error`);
  process.exit(1);
}

// All scenes rendered — concat + mux
if (NO_MASTER) {
  log(`--no-master set; skipping concat + mux. Per-scene mp4s in ${relative(ROOT, SCENES_DIR)}`);
  process.exit(0);
}
if (succeeded.length !== SCENES.length) {
  // Allow partial only if --only was set AND all scenes present from prior runs
  if (!ONLY) {
    console.error(`[render-per-scene-hf] only ${succeeded.length}/${SCENES.length} scenes rendered; aborting concat`);
    process.exit(1);
  }
  // For --only, ensure full set is present from prior renders before concat
  for (const scene of SCENES) {
    const id = pad2(scene.id);
    const out = join(SCENES_DIR, `${id}-${scene.slug}.mp4`);
    if (!existsSync(out)) {
      console.error(`[render-per-scene-hf] missing scene ${id}; cannot concat. Skipping concat/mux.`);
      process.exit(0);
    }
    if (!succeeded.find(s => s.id === id)) {
      succeeded.push({ id, slug: scene.slug, out, sizeBytes: statSync(out).size });
    }
  }
  succeeded.sort((a, b) => a.id.localeCompare(b.id));
}

concatScenes(succeeded);
const sceneAudioFiles = normalizeSceneAudio(succeeded);
buildSceneAudioTrack(sceneAudioFiles);
muxAudio();
ffprobeFinal();
spotChecks();

log(`DONE. ${relative(ROOT, FINAL_OUT)}`);
