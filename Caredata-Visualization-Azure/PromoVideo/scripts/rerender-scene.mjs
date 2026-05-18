/**
 * Per-scene Hyperframes re-render helper.
 *
 * After you edit a scene's preview HTML, run:
 *   node scripts/rerender-scene.mjs 5
 *   node scripts/rerender-scene.mjs 5,7,12   # multiple at once
 *   node scripts/rerender-scene.mjs all      # all 16
 *
 * Workflow:
 *   1. Re-runs shared/refactor-compositions.mjs so the composition file
 *      stays in sync with the (just-edited) preview source.
 *   2. For each scene id passed:
 *      a. Backs up index.html if not already (index.editor.html).
 *      b. Swaps in the composition HTML for that scene (with the
 *         relative-path fixes so the project root resolves correctly).
 *      c. Runs `npx hyperframes render . -o output/scenes-30fps/NN-slug.mp4
 *         -f 60 -q high --crf 12 --no-browser-gpu`.
 *         (--crf 12 = visually-lossless H.264. Higher quality than -q high's
 *         default CRF ~18. File ~3-4× larger but website mocks render crisp.)
 *      d. Verifies output is non-blank (size > 100KB).
 *   3. After all per-scene renders complete, ALWAYS restores index.html
 *      from index.editor.html (try/finally guard).
 *   4. Master concat + music mux: ONLY runs when arg === "all". Per-scene
 *      runs (e.g. `1` or `1,4,7`) stop after step 3 so individual scenes can
 *      be reviewed without rebuilding the master prematurely.
 *      When run with "all": ffmpeg concat across all 16 per-scene mp4s, then
 *      muxes the music bed (audio/sunsides-upbeat-energetic-background-music
 *      -151501.mp3). SFX (mouse_click, typing, whoosh) baked into scene mp4s
 *      via embedded <audio>; music is master-only and ducked via amix.
 *      Output: output/master-1920x1080-60fps.mp4.
 *   5. Verifies the new master via ffprobe (duration, dims, audio).
 *
 * If you want to re-render just one scene without touching the others'
 * existing mp4s, pass the scene id and only that NN-slug.mp4 will be
 * regenerated. The master is re-stitched from whatever's currently in
 * scenes-30fps/.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "promo-hyperframes");
const requireFromPromo = createRequire(join(ROOT, "package.json"));
const ffmpegPath  = requireFromPromo("ffmpeg-static");
const ffprobePath = requireFromPromo("ffprobe-static").path;

const TIMELINE = JSON.parse(readFileSync(join(ROOT, "shared", "timeline.json"), "utf8"));
const ALL_SCENES = TIMELINE.scenes;
const TOTAL_DUR  = TIMELINE.totalDurationSec;

const SCENES_DIR  = join(ROOT, "output", "scenes-30fps");
const FINAL_MP4   = join(ROOT, "output", "master-3840x2160-60fps.mp4");
const CONCAT_TMP  = join(SCENES_DIR, "_concat-3840x2160-noaudio.mp4");
const INDEX_PATH  = join(ROOT, "index.html");
const EDITOR_PATH = join(ROOT, "index.editor.html");

if (!existsSync(SCENES_DIR)) mkdirSync(SCENES_DIR, { recursive: true });
if (!existsSync(EDITOR_PATH)) {
  console.error("✗ index.editor.html missing — can't safely swap. Snapshotting current index.html as the editor backup.");
  copyFileSync(INDEX_PATH, EDITOR_PATH);
}

/* === Parse args === */
const arg = process.argv[2];
if (!arg) {
  console.error("usage: node scripts/rerender-scene.mjs <id-or-csv-or-'all'>");
  process.exit(1);
}
/* Master concat + music mux runs ONLY when arg === "all". Per-scene re-renders
   skip the master step so the user can review each scene mp4 in isolation
   while still iterating; the master is only re-stitched once every scene is
   approved. */
const RUN_MASTER = arg === "all";
let targetIds;
if (arg === "all") {
  targetIds = ALL_SCENES.map(s => s.id);
} else {
  targetIds = arg.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}
const targets = ALL_SCENES.filter(s => targetIds.includes(s.id));
if (targets.length === 0) {
  console.error("✗ no valid scene ids in:", arg);
  process.exit(1);
}
console.log(`Re-rendering scenes: ${targets.map(s => s.id + " " + s.slug).join(", ")}`);
if (!RUN_MASTER) console.log("(per-scene mode; master concat + music mux skipped — pass 'all' to re-stitch master)");

/* === sha256 + restore guard === */
function sha256(p){ return createHash("sha256").update(readFileSync(p)).digest("hex"); }
function restoreIndex(){ copyFileSync(EDITOR_PATH, INDEX_PATH); }

const editorHash = sha256(EDITOR_PATH);
if (sha256(INDEX_PATH) !== editorHash) {
  console.warn("⚠ index.html drifted from editor backup at script start — restoring before work");
  restoreIndex();
}

/* === Step 1: regenerate compositions from previews so any source edits propagate === */
console.log("\n▸ regenerating compositions from previews ...");
spawnSync(`node`, [join(ROOT, "shared", "refactor-compositions.mjs")], { cwd: ROOT, stdio: "inherit" });

/* === Step 2: per-scene render === */
function rerenderOne(scene){
  const num = String(scene.id).padStart(2, "0");
  const compFile = join(ROOT, "compositions", `${num}-${scene.slug}.html`);
  const sceneOut = join(SCENES_DIR, `${num}-${scene.slug}.mp4`);
  if (!existsSync(compFile)) throw new Error(`Composition missing: ${compFile}`);

  /* Read composition + fix relative paths so they resolve from project root */
  let html = readFileSync(compFile, "utf8");
  html = html.replace(/href="\.\.\/shared\//g, 'href="shared/');
  html = html.replace(/src="\.\.\/shared\//g,  'src="shared/');
  html = html.replace(/href="\.\.\/previews\//g, 'href="previews/');
  html = html.replace(/src="\.\.\/previews\//g,  'src="previews/');
  html = html.replace(/src="\.\.\/audio\//g,    'src="audio/');

  writeFileSync(INDEX_PATH, html, "utf8");

  console.log(`\n▸ rendering scene ${num} (${scene.slug}) [${scene.durSec}s] @ --crf 12 ...`);
  const cmd = [
    "npx hyperframes render .",
    `-o "${sceneOut}"`,
    "-f 60",
    "-q high",
    "--crf 12",
    "--no-browser-gpu"
  ].join(" ");
  /* Hyperframes needs ffmpeg on PATH. The winget install dir isn't picked up
     in fresh bash shells, so prepend it explicitly. Windows-style path + ; sep. */
  const FFMPEG_DIR = "C:\\Users\\Admin\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin";
  const env = {
    ...process.env,
    Path: `${FFMPEG_DIR};${process.env.Path || process.env.PATH}`,
    PATH: `${FFMPEG_DIR};${process.env.PATH || process.env.Path}`,
  };
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: "inherit", env });
  if (r.status !== 0) throw new Error(`scene ${num} render failed (exit ${r.status})`);

  const sz = statSync(sceneOut).size;
  if (sz < 100_000) throw new Error(`scene ${num} output too small (${sz} bytes); render likely produced blank frames`);
  console.log(`✓ scene ${num} → ${(sz/1024/1024).toFixed(2)} MB`);
}

let renderError = null;
try {
  for (const s of targets) rerenderOne(s);
} catch (e) {
  renderError = e;
} finally {
  restoreIndex();
  if (sha256(INDEX_PATH) !== editorHash) {
    console.error("✗ index.html restore FAILED — manual intervention needed");
    process.exit(2);
  }
  console.log("\n✓ index.html restored to editor backup");
}
if (renderError) {
  console.error("\n✗ Per-scene render failed:", renderError.message);
  process.exit(3);
}

if (!RUN_MASTER) {
  const renderedNames = targets.map(t => `${String(t.id).padStart(2,"0")}-${t.slug}.mp4`).join(", ");
  console.log(`\n✓ Per-scene render complete: ${renderedNames}`);
  console.log(`  Open output/scenes-30fps/<scene>.mp4 to review individually.`);
  console.log(`  Master concat + music mux skipped. Run \`node scripts/rerender-scene.mjs all\` once every scene is approved.`);
  process.exit(0);
}

/* === Step 3: re-concat all 16 scenes + audio mux (master mode only) === */
console.log("\n▸ re-concatenating all 16 scenes ...");

/* Normalise each scene mp4 to have an audio track. Hyperframes only emits
   audio when a composition embeds <audio>; concat demuxer requires
   homogeneous streams. Pad any video-only scene with a silent AAC track via
   anullsrc + -c:v copy (no video re-encode, so no quality loss). */
function ensureSceneHasAudio(sceneMp4){
  const probe = execSync(`"${ffprobePath}" -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "${sceneMp4}"`).toString().trim();
  if (probe.length > 0) return;  // already has audio
  console.log(`  ▸ adding silent audio track to ${sceneMp4.split(/[\\/]/).pop()}`);
  const tmp = sceneMp4 + ".tmp.mp4";
  execSync(
    `"${ffmpegPath}" -y -loglevel error -i "${sceneMp4}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v copy -c:a aac -b:a 128k -shortest -movflags +faststart "${tmp}"`,
    { stdio: "inherit" }
  );
  renameSync(tmp, sceneMp4);
}
for (const s of ALL_SCENES) {
  const num = String(s.id).padStart(2, "0");
  const p = join(SCENES_DIR, `${num}-${s.slug}.mp4`);
  if (!existsSync(p)) throw new Error(`Missing scene mp4: ${p} — render scene ${s.id} first`);
  ensureSceneHasAudio(p);
}

const listFile = join(SCENES_DIR, "_concat-list.txt");
const concatList = ALL_SCENES.map(s => {
  const num = String(s.id).padStart(2, "0");
  const p = join(SCENES_DIR, `${num}-${s.slug}.mp4`);
  return `file '${p.replace(/\\/g, "/")}'`;
}).join("\n");
writeFileSync(listFile, concatList, "utf8");

/* Concat all 16 per-scene mp4s. Scene mp4s may carry baked-in SFX
   (click/whoosh/typing-tick) embedded as <audio> in each scene's HTML and
   triggered from the scene's GSAP timeline; the concat preserves audio
   when present. */
execSync(
  `"${ffmpegPath}" -y -loglevel error -f concat -safe 0 -i "${listFile}" -c copy "${CONCAT_TMP}"`,
  { stdio: "inherit" }
);

/* Detect whether the concat has an audio track (i.e. any scene has baked-in
   SFX yet). If yes, amix the music bed underneath the SFX. If no, plain mux
   the music as the sole audio stream. The music is always master-only —
   scenes never reference it. */
const musicPath = join(ROOT, "audio", "sunsides-upbeat-energetic-background-music-151501.mp3");
const concatHasAudio = (() => {
  const r = execSync(`"${ffprobePath}" -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "${CONCAT_TMP}"`).toString().trim();
  return r.length > 0;
})();
if (concatHasAudio) {
  console.log("▸ amix: scene SFX + music bed (music ducked to 0.18) ...");
  execSync(
    [
      `"${ffmpegPath}" -y -loglevel error`,
      `-i "${CONCAT_TMP}"`,
      `-i "${musicPath}"`,
      `-t ${TOTAL_DUR}`,
      `-filter_complex "[0:a:0]volume=1.0[sfx];[1:a:0]volume=0.18[mus];[sfx][mus]amix=inputs=2:duration=longest:dropout_transition=0[a]"`,
      `-map 0:v:0 -map "[a]"`,
      `-c:v copy -c:a aac -b:a 192k -movflags +faststart`,
      `"${FINAL_MP4}"`
    ].join(" "),
    { stdio: "inherit" }
  );
} else {
  console.log("▸ muxing music bed (no scene SFX present yet) ...");
  execSync(
    `"${ffmpegPath}" -y -loglevel error -i "${CONCAT_TMP}" -i "${musicPath}" -t ${TOTAL_DUR} -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart "${FINAL_MP4}"`,
    { stdio: "inherit" }
  );
}

const finalSz = statSync(FINAL_MP4).size;
console.log(`\n✓ master rebuilt: ${FINAL_MP4}`);
console.log(`  ${(finalSz/1024/1024).toFixed(2)} MB`);

/* ffprobe confirmation */
function ffprobeJson(file, args){
  return JSON.parse(execSync(`"${ffprobePath}" -v error ${args} -of json "${file}"`).toString());
}
const v = ffprobeJson(FINAL_MP4, "-select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,duration").streams[0];
const aStreams = ffprobeJson(FINAL_MP4, "-select_streams a:0 -show_entries stream=codec_name").streams;
const a = aStreams && aStreams[0];
const dur = parseFloat(execSync(`"${ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${FINAL_MP4}"`).toString().trim());
console.log(`  Video: ${v.codec_name} ${v.width}x${v.height} @ ${v.r_frame_rate} (≈${(eval(v.r_frame_rate)).toFixed(1)} fps)`);
console.log(`  Audio: ${a ? a.codec_name : "(none — video-only master)"}`);
console.log(`  Duration: ${dur.toFixed(3)}s`);

/* Spot-check stills */
console.log("\n▸ extracting spot-check stills ...");
const STILLS = join(ROOT, "output", "checks-30fps");
if (!existsSync(STILLS)) mkdirSync(STILLS, { recursive: true });
for (const t of [1.5, 18, 47, 78]) {
  const out = join(STILLS, `check-${t}s.png`);
  execSync(`"${ffmpegPath}" -y -loglevel error -ss ${t} -i "${FINAL_MP4}" -frames:v 1 -update 1 "${out}"`, { stdio: "inherit" });
  console.log(`  ✓ ${out}`);
}

console.log(`\nDone. Open ${FINAL_MP4} to review.`);
