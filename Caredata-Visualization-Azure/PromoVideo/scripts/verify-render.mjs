/**
 * verify-render.mjs - Programmatic checklist for the CareData promo MP4 outputs.
 *
 * Runs against both 1920x1080 and 1080x1920 masters. Reports pass/fail
 * per check and exits 1 on any failure. Used as a regression gate so
 * future re-renders catch dimension / duration / codec / loudness drift.
 *
 * Run:  node scripts/verify-render.mjs
 *       (from CapstoneProject/)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT_PROMO = join(here, "..", "promo-hyperframes");
const TIMELINE = JSON.parse(readFileSync(join(ROOT_PROMO, "shared", "timeline.json"), "utf8"));

/* Resolve ffprobe + ffmpeg via the promo project's node_modules */
const require = createRequire(join(ROOT_PROMO, "package.json"));
const ffprobePath = require("ffprobe-static").path;
const ffmpegPath  = require("ffmpeg-static");

const horiz = join(ROOT_PROMO, "output", "master-1920x1080.mp4");
const vert  = join(ROOT_PROMO, "output", "master-1080x1920.mp4");

const checks = [];
function check(name, fn){
  try { fn(); checks.push({ name, ok: true }); }
  catch (e){ checks.push({ name, ok: false, err: e.message }); }
}

function ffprobeFormatDuration(file){
  const out = execSync(`"${ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${file}"`).toString().trim();
  return parseFloat(out);
}
function ffprobeVideoStream(file){
  const out = execSync(`"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of json "${file}"`).toString();
  return JSON.parse(out).streams[0];
}
function ffprobeHasAudio(file){
  const out = execSync(`"${ffprobePath}" -v error -select_streams a -show_entries stream=codec_name -of json "${file}"`).toString();
  const streams = JSON.parse(out).streams || [];
  return streams.length > 0;
}
function measureLoudness(file){
  /* Single-pass loudnorm in null-output mode; parse the summary block. */
  const out = execSync(
    `"${ffmpegPath}" -hide_banner -nostats -i "${file}" -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=summary -f null - 2>&1`
  ).toString();
  const m = out.match(/Input Integrated:\s+(-?\d+\.\d+)\s+LUFS/);
  if (!m) throw new Error("could not parse loudnorm output:\n" + out.slice(-300));
  return parseFloat(m[1]);
}

/* Track LUFS measurements for the final report */
const lufsMeasurements = {};

/* === Run checks === */
check("Horizontal master exists",   () => { if (!existsSync(horiz)) throw new Error("missing " + horiz); });
check("Vertical master exists",     () => { if (!existsSync(vert))  throw new Error("missing " + vert);  });

check(`Horizontal duration ~= ${TIMELINE.totalDurationSec}s +/-0.2s`, () => {
  const d = ffprobeFormatDuration(horiz);
  if (Math.abs(d - TIMELINE.totalDurationSec) > 0.2)
    throw new Error(`got ${d.toFixed(3)}s, expected ${TIMELINE.totalDurationSec}s`);
});

check(`Vertical duration ~= ${TIMELINE.totalDurationSec}s +/-0.2s`, () => {
  const d = ffprobeFormatDuration(vert);
  if (Math.abs(d - TIMELINE.totalDurationSec) > 0.2)
    throw new Error(`got ${d.toFixed(3)}s, expected ${TIMELINE.totalDurationSec}s`);
});

check("Horizontal is 1920x1080 h264", () => {
  const s = ffprobeVideoStream(horiz);
  if (s.width !== 1920 || s.height !== 1080) throw new Error(`got ${s.width}x${s.height}`);
  if (s.codec_name !== "h264") throw new Error(`got codec ${s.codec_name}`);
});

check("Vertical is 1080x1920 h264", () => {
  const s = ffprobeVideoStream(vert);
  if (s.width !== 1080 || s.height !== 1920) throw new Error(`got ${s.width}x${s.height}`);
  if (s.codec_name !== "h264") throw new Error(`got codec ${s.codec_name}`);
});

check("Both files have audio streams", () => {
  if (!ffprobeHasAudio(horiz)) throw new Error("horizontal has no audio");
  if (!ffprobeHasAudio(vert))  throw new Error("vertical has no audio");
});

check("Horizontal loudness within -16 +/-1 LUFS", () => {
  const lufs = measureLoudness(horiz);
  lufsMeasurements.horiz = lufs;
  if (Math.abs(lufs + 16) > 1.0) throw new Error(`got ${lufs.toFixed(2)} LUFS`);
});

check("Vertical loudness within -16 +/-1 LUFS", () => {
  const lufs = measureLoudness(vert);
  lufsMeasurements.vert = lufs;
  if (Math.abs(lufs + 16) > 1.0) throw new Error(`got ${lufs.toFixed(2)} LUFS`);
});

/* === Print + exit === */
let pass = 0, fail = 0;
console.log("\nCareData promo render verification");
console.log("===================================");
for (const c of checks){
  if (c.ok){ console.log(`[PASS] ${c.name}`); pass++; }
  else     { console.log(`[FAIL] ${c.name}\n    ${c.err}`); fail++; }
}
if (lufsMeasurements.horiz !== undefined || lufsMeasurements.vert !== undefined){
  console.log("\nLUFS measurements:");
  if (lufsMeasurements.horiz !== undefined) console.log(`  horizontal: ${lufsMeasurements.horiz.toFixed(2)} LUFS`);
  if (lufsMeasurements.vert  !== undefined) console.log(`  vertical:   ${lufsMeasurements.vert.toFixed(2)} LUFS`);
}
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
