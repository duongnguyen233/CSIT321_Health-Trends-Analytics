/**
 * audio-mix.mjs — Build the master audio track for the CareData promo.
 *
 * Reads shared/audio-cues.json, layers music bed + 22 SFX cues via ffmpeg's
 * filter_complex, normalises the result to -16 LUFS, encodes to MP3.
 *
 * Output: shared/audio/master-mix.mp3
 *
 * Run: npm run audio:mix  (or:  node shared/audio-mix.mjs)
 */
import ffmpegPath from "ffmpeg-static";
import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");                      // promo-hyperframes/
const cuesPath    = join(here, "audio-cues.json");
const outDir      = join(here, "audio");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outFile     = join(outDir, "master-mix.mp3");

const cues = JSON.parse(readFileSync(cuesPath, "utf8"));

// Resolve cue src paths to absolute paths
const bed = { ...cues.musicBed, srcAbs: join(projectRoot, cues.musicBed.src) };
const sfx = cues.cues.map(c => ({ ...c, srcAbs: join(projectRoot, c.src) }));

// Sanity: every input file exists
const missing = [bed, ...sfx].filter(c => !existsSync(c.srcAbs));
if (missing.length){
  console.error("Missing audio inputs:");
  for (const m of missing) console.error("  - " + m.srcAbs);
  process.exit(2);
}

// Compute music bed duration to position the fade-out
const ffprobeStatic = (await import("ffprobe-static")).default;
function audioDurationSec(path){
  return parseFloat(execSync(
    `"${ffprobeStatic.path}" -v error -show_entries format=duration -of csv=p=0 "${path}"`
  ).toString().trim());
}
const bedDur = audioDurationSec(bed.srcAbs);
const fadeOutStart = Math.max(0, bedDur - bed.fadeOutSec);

// dB → linear gain
const dbToGain = (db) => Math.pow(10, db / 20).toFixed(4);

// Build inputs + filter graph
const inputs = [];
const filters = [];

inputs.push(`-i "${bed.srcAbs}"`);
filters.push(
  `[0:a]volume=${dbToGain(bed.gainDb)},` +
  `afade=t=in:st=0:d=${bed.fadeInSec},` +
  `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${bed.fadeOutSec}[a0]`
);

let idx = 1;
const labels = ["[a0]"];
for (const c of sfx){
  inputs.push(`-i "${c.srcAbs}"`);
  const delayMs = Math.max(0, Math.round(c.atSec * 1000));
  filters.push(
    `[${idx}:a]volume=${dbToGain(c.gainDb)},adelay=${delayMs}|${delayMs}[a${idx}]`
  );
  labels.push(`[a${idx}]`);
  idx++;
}

filters.push(
  `${labels.join("")}amix=inputs=${labels.length}:duration=longest:dropout_transition=0[mix]`
);
filters.push(
  `[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]`
);

const cmd = [
  `"${ffmpegPath}"`,
  "-y",
  "-loglevel info",
  inputs.join(" "),
  `-filter_complex "${filters.join(";")}"`,
  '-map "[out]"',
  "-c:a libmp3lame -q:a 2 -ac 2",
  `"${outFile}"`
].join(" ");

console.log("ffmpeg cmd (truncated):", cmd.slice(0, 500), "...");
console.log(`\nMusic bed duration: ${bedDur.toFixed(3)}s, fade-out start: ${fadeOutStart.toFixed(3)}s`);
console.log(`SFX cues: ${sfx.length}, total inputs: ${inputs.length}\n`);

execSync(cmd, { stdio: "inherit" });

const outDur  = audioDurationSec(outFile);
const outSize = statSync(outFile).size;
console.log(`\nWrote ${outFile}`);
console.log(`  Duration: ${outDur.toFixed(3)}s   Size: ${(outSize/1024).toFixed(1)} KB`);
