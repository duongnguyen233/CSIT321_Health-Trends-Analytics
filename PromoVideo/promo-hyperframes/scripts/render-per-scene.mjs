#!/usr/bin/env node
/**
 * render-per-scene.mjs
 *
 * Render each of the 16 scene compositions individually via the Hyperframes
 * CLI by swapping it into ./index.html, then concatenate the per-scene mp4s
 * with ffmpeg and mux the master audio.
 *
 * Why per-scene: 00-master.html references all 16 sub-comps via
 * data-composition-src, but each sub-comp has its own IIFE that collides
 * with siblings when mounted into one document. Rendering each scene
 * in isolation sidesteps that.
 *
 * Hyperframes shape (from notes/hyperframes-cli-discovery.md and
 * `npx hyperframes render --help`):
 *   - `npx hyperframes render <DIR>` renders <DIR>/index.html (the project's
 *     root composition). There is no `--composition <id>` flag and no way
 *     to point at an arbitrary HTML file directly. The DIR argument is the
 *     project root containing hyperframes.json + index.html.
 *   - The cleanest "render this single sub-composition" path is therefore to
 *     copy compositions/NN-slug.html OVER ./index.html, fix up its relative
 *     paths (it references ../shared/tokens.css), and run
 *     `npx hyperframes render . -o output/scenes/NN-slug.mp4`. Restore
 *     index.html in a try/finally so the editor shell isn't left broken.
 *
 * Usage:
 *   node scripts/render-per-scene.mjs                # 1920x1080
 *   node scripts/render-per-scene.mjs --vertical     # 1080x1920
 *   node scripts/render-per-scene.mjs --skip-render  # only concat + mux
 */

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT    = path.resolve(__dirname, "..");

// CLI flags --------------------------------------------------------------------
const argv      = new Set(process.argv.slice(2));
const VERTICAL  = argv.has("--vertical");
const SKIP_RENDER = argv.has("--skip-render");

const W = VERTICAL ? 1080 : 1920;
const H = VERTICAL ? 1920 : 1080;
const DIM_TAG = `${W}x${H}`;

const SCENES_DIR = path.join(PROJECT, "output", VERTICAL ? "scenes-vertical" : "scenes");
const CHECKS_DIR = path.join(PROJECT, "output", VERTICAL ? "checks-30fps-vertical" : "checks-30fps");
const FINAL_NOAUDIO = path.join(PROJECT, "output", `_concat-${DIM_TAG}-noaudio.mp4`);
const FINAL_OUT     = path.join(PROJECT, "output", `master-${DIM_TAG}-30fps.mp4`);
const TIMELINE      = JSON.parse(await fs.readFile(path.join(PROJECT, "shared", "timeline.json"), "utf8"));

// ffmpeg + ffprobe paths from node_modules ------------------------------------
const FFMPEG  = (await import(pathToFileURL(path.join(PROJECT, "node_modules", "ffmpeg-static",  "index.js")).href)).default;
const FFPROBE = (await import(pathToFileURL(path.join(PROJECT, "node_modules", "ffprobe-static", "index.js")).href)).default.path;

// Hyperframes spawns "ffmpeg" / "ffprobe" by name from PATH. Stage them in
// .ffmpeg-bin/ and prepend to PATH so the CLI finds them on Windows where
// neither binary is system-installed.
const FFBIN_DIR = path.join(PROJECT, ".ffmpeg-bin");
{
  await fs.mkdir(FFBIN_DIR, { recursive: true });
  const stagedFfmpeg  = path.join(FFBIN_DIR, "ffmpeg.exe");
  const stagedFfprobe = path.join(FFBIN_DIR, "ffprobe.exe");
  if (!existsSync(stagedFfmpeg))  await fs.copyFile(FFMPEG,  stagedFfmpeg);
  if (!existsSync(stagedFfprobe)) await fs.copyFile(FFPROBE, stagedFfprobe);
  process.env.PATH = `${FFBIN_DIR}${path.delimiter}${process.env.PATH}`;
}

// Helpers ---------------------------------------------------------------------
const log = (...a) => console.log("[render-per-scene]", ...a);

// On Windows, "npx" / "npm" are .cmd shims that need shell:true to launch
// from spawnSync without manual extension. Native binaries (ffmpeg.exe etc)
// run fine without a shell.
const NEEDS_SHELL = process.platform === "win32";

function run(cmd, args, opts = {}) {
  const useShell = opts.shell ?? (NEEDS_SHELL && (cmd === "npx" || cmd === "npm"));
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: PROJECT, shell: useShell, ...opts });
  if (r.status !== 0) {
    throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(" ")}`);
  }
}

function runCapture(cmd, args, opts = {}) {
  const useShell = opts.shell ?? (NEEDS_SHELL && (cmd === "npx" || cmd === "npm"));
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: PROJECT, shell: useShell, ...opts });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function pad2(n) { return String(n).padStart(2, "0"); }

/**
 * Transform a preview HTML to live at the project root as index.html.
 *  - rewrite ../shared/ -> shared/
 *  - rewrite ../audio/  -> audio/   (previews use ../ relative; root does not)
 *  - if VERTICAL: flip data-width/data-height on the composition root,
 *    and inject <link rel="stylesheet" href="shared/9-16.css"> into <head>.
 */
function transformSceneHtml(src, { vertical }) {
  let html = src;
  html = html.replace(/\.\.\/shared\//g, "shared/");
  html = html.replace(/\.\.\/audio\//g, "audio/");

  if (vertical) {
    // Flip data-width="1920" data-height="1080" -> 1080 / 1920 on the
    // composition root only (placeholder hack: Hyperframes reads these
    // from the root <div data-composition-id ...>). We replace the FIRST
    // matching pair on the same element.
    html = html.replace(
      /(<div[^>]*data-composition-id="[^"]+"[^>]*?)data-width="1920"([^>]*?)data-height="1080"/,
      '$1data-width="1080"$2data-height="1920"'
    );
    // Inject the 9:16 stylesheet right before </head>. tokens.css is
    // already linked via shared/tokens.css after our path rewrite, so
    // 9-16.css just adds the vertical reflow.
    if (!html.includes("shared/9-16.css")) {
      html = html.replace(
        /<\/head>/i,
        '<link rel="stylesheet" href="shared/9-16.css"></head>'
      );
    }
  }
  return html;
}

async function renderOneScene(scene) {
  const id = await pad2(scene.id);
  const slug = scene.slug;
  const src = path.join(PROJECT, "previews", `scene-${id}-${slug}.html`);
  const out = path.join(SCENES_DIR, `${id}-${slug}.mp4`);

  log(`-> Scene ${id} ${slug} (${scene.durSec}s) [${DIM_TAG}]`);

  const original = await fs.readFile(src, "utf8");
  const swapped  = transformSceneHtml(original, { vertical: VERTICAL });
  await fs.writeFile(path.join(PROJECT, "index.html"), swapped, "utf8");

  // Render
  const renderArgs = [
    "hyperframes", "render", ".",
    "-o", path.relative(PROJECT, out),
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

  // Verify non-empty + non-blank
  if (!existsSync(out)) throw new Error(`Render produced no file: ${out}`);
  const sz = statSync(out).size;
  log(`   wrote ${path.relative(PROJECT, out)} (${(sz/1024).toFixed(0)} KB)`);
  if (sz < 100 * 1024) {
    log(`   WARNING: file under 100KB — likely a blank render`);
  }

  // Spot-check a frame at scene_dur/2
  const probe = path.join(SCENES_DIR, `${id}-${slug}.probe.png`);
  const frameTime = (scene.durSec / 2).toFixed(3);
  const probeArgs = ["-y", "-ss", frameTime, "-i", out, "-frames:v", "1", probe];
  const pr = runCapture(FFMPEG, probeArgs);
  if (pr.status === 0 && existsSync(probe)) {
    const psz = statSync(probe).size;
    log(`   probe png: ${(psz/1024).toFixed(0)} KB at t=${frameTime}s`);
    if (psz < 30 * 1024) log(`   WARNING: probe png suspiciously small (likely blank)`);
  } else {
    log(`   probe extraction failed (non-fatal)`);
  }

  return { id, slug, out, sizeBytes: sz };
}

async function concatScenes(scenes) {
  const listFile = path.join(PROJECT, "output", `_concat-list-${DIM_TAG}.txt`);
  const lines = scenes.map(s => `file '${path.relative(path.dirname(listFile), s.out).replace(/\\/g, "/")}'`).join("\n");
  await fs.writeFile(listFile, lines + "\n", "utf8");
  log(`concat list:\n${lines}`);

  // Use concat demuxer; re-encode if needed for clean stream. We'll re-encode
  // to ensure timing is solid (constant 30fps, same codec params).
  const args = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listFile,
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-an",
    FINAL_NOAUDIO,
  ];
  run(FFMPEG, args);
  log(`concat -> ${path.relative(PROJECT, FINAL_NOAUDIO)}`);
}

async function muxAudio() {
  const audio = path.join(PROJECT, "audio", "sunsides-upbeat-energetic-background-music-151501.mp3");
  const args = [
    "-y",
    "-i", FINAL_NOAUDIO,
    "-i", audio,
    "-t", "79.68",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    FINAL_OUT,
  ];
  run(FFMPEG, args);
  log(`final -> ${path.relative(PROJECT, FINAL_OUT)}`);
}

async function ffprobeFinal() {
  const args = [
    "-v", "error",
    "-show_streams",
    "-show_format",
    "-of", "json",
    FINAL_OUT,
  ];
  const r = runCapture(FFPROBE, args);
  if (r.status === 0) {
    try {
      const j = JSON.parse(r.stdout);
      const v = j.streams.find(s => s.codec_type === "video");
      const a = j.streams.find(s => s.codec_type === "audio");
      log("=== ffprobe summary ===");
      if (v) log(`  video: ${v.codec_name} ${v.width}x${v.height} @ ${v.r_frame_rate} (${v.avg_frame_rate}) duration=${v.duration}`);
      if (a) log(`  audio: ${a.codec_name} ${a.channels}ch ${a.sample_rate}Hz`);
      if (j.format) log(`  format: ${j.format.format_name} duration=${j.format.duration} size=${(j.format.size/1024/1024).toFixed(2)}MB`);
    } catch (e) {
      console.log(r.stdout);
    }
  }
}

async function spotChecks() {
  // Same 4 timestamps as the original verifier
  const stamps = [1.5, 18, 47, 78];
  for (const t of stamps) {
    const out = path.join(CHECKS_DIR, `check-${t}s.png`);
    const args = ["-y", "-ss", String(t), "-i", FINAL_OUT, "-frames:v", "1", out];
    const r = runCapture(FFMPEG, args);
    if (r.status === 0 && existsSync(out)) {
      const sz = statSync(out).size;
      log(`spot ${t}s -> ${path.relative(PROJECT, out)} (${(sz/1024).toFixed(0)} KB)`);
    } else {
      log(`spot ${t}s extraction failed`);
    }
  }
}

async function restoreEditor() {
  const editor = path.join(PROJECT, "index.editor.html");
  const idx    = path.join(PROJECT, "index.html");
  if (existsSync(editor)) {
    const e = await fs.readFile(editor, "utf8");
    await fs.writeFile(idx, e, "utf8");
    log(`restored index.html from index.editor.html`);
  } else {
    log(`WARNING: no index.editor.html backup found; index.html left as last-rendered scene`);
  }
}

// Main ------------------------------------------------------------------------
(async () => {
  await ensureDir(SCENES_DIR);
  await ensureDir(CHECKS_DIR);
  await ensureDir(path.join(PROJECT, "output"));

  const editor = path.join(PROJECT, "index.editor.html");
  const idx    = path.join(PROJECT, "index.html");
  if (!existsSync(editor)) {
    log(`creating index.editor.html backup from index.html`);
    await fs.copyFile(idx, editor);
  }

  let succeeded = [];
  try {
    if (!SKIP_RENDER) {
      for (const scene of TIMELINE.scenes) {
        const r = await renderOneScene(scene);
        succeeded.push(r);
      }
    } else {
      log(`--skip-render set; assuming output/scenes/*.mp4 already exists`);
      for (const scene of TIMELINE.scenes) {
        const id = await pad2(scene.id);
        const out = path.join(SCENES_DIR, `${id}-${scene.slug}.mp4`);
        if (!existsSync(out)) throw new Error(`missing pre-rendered scene file: ${out}`);
        succeeded.push({ id, slug: scene.slug, out, sizeBytes: statSync(out).size });
      }
    }
  } finally {
    await restoreEditor();
  }

  await concatScenes(succeeded);
  await muxAudio();
  await ffprobeFinal();
  await spotChecks();

  log(`DONE. ${path.relative(PROJECT, FINAL_OUT)}`);
})().catch(async (err) => {
  console.error("[render-per-scene] FATAL:", err);
  // restore editor on fatal
  try {
    const editor = path.join(PROJECT, "index.editor.html");
    if (existsSync(editor)) {
      await fs.copyFile(editor, path.join(PROJECT, "index.html"));
      console.error("[render-per-scene] restored index.html");
    }
  } catch {}
  process.exit(1);
});
