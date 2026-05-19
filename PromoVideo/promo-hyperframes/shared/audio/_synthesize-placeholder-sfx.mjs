/**
 * Synthesise 15 placeholder SFX files (CC0 sourcing handled by user later).
 *
 * Each is a short distinct tone so that the audio mix has clearly audible cue
 * points and we can verify cue alignment in the rendered video. Real SFX
 * (FreeSound CC0, search terms in the task plan) replace these via direct
 * file overwrite at the same paths.
 *
 * Run: node shared/audio/_synthesize-placeholder-sfx.mjs
 */
import ffmpegPath from "ffmpeg-static";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sfxDir = join(here, "sfx");
if (!existsSync(sfxDir)) mkdirSync(sfxDir, { recursive: true });

/* Each placeholder: ffmpeg lavfi sine generator + a fade envelope so the cue
   sounds like a discrete event rather than a sustained tone. Frequencies and
   durations chosen to roughly evoke the real SFX character.

   Format: [filename, freqHz, durationSec, character]
*/
const SFX = [
  ["01-keyboard-tick.mp3",     1800, 0.10, "click"],
  ["02-paper-rustle.mp3",      4400, 0.40, "noise"],
  ["03-soft-whoosh.mp3",        220, 0.50, "swoop"],
  ["04-shard-tumble.mp3",      6000, 0.70, "shimmer"],
  ["05-brand-thud.mp3",          80, 0.45, "boom"],
  ["06-chime-tail.mp3",        2200, 0.80, "bell"],
  ["07-click-pop.mp3",         2800, 0.10, "pop"],
  ["08-button-thunk.mp3",       180, 0.15, "thunk"],
  ["09-soft-chime-tap.mp3",    3300, 0.25, "ping"],
  ["10-iridescent-shimmer.mp3",5400, 1.00, "shimmer"],
  ["11-page-curl-rustle.mp3",  3600, 0.55, "noise"],
  ["12-status-dot-ping.mp3",   4400, 0.20, "ping"],
  ["13-voice-bleep.mp3",       1100, 0.20, "bleep"],
  ["14-alert-tick.mp3",        2600, 0.18, "tick"],
  ["15-soft-tail.mp3",          440, 1.20, "pad"]
];

function buildFilter(character, dur){
  /* Each character gets a different envelope/effect so they're audibly distinct. */
  const fadeIn = 0.005;
  const fadeOut = Math.max(0.05, dur * 0.30);
  const fadeOutStart = (dur - fadeOut).toFixed(3);

  switch (character){
    case "click":
    case "tick":
    case "pop":
      // Sharp transient: very short fade in/out
      return `afade=t=in:st=0:d=0.002,afade=t=out:st=${fadeOutStart}:d=${fadeOut},volume=0.40`;
    case "ping":
    case "bell":
      // Bell: instant attack, long decay, slight reverb
      return `afade=t=in:st=0:d=0.003,afade=t=out:st=${fadeOutStart}:d=${fadeOut},aecho=0.5:0.3:60:0.3,volume=0.35`;
    case "boom":
    case "thunk":
      // Sub-bass: slow fade in for warmth
      return `afade=t=in:st=0:d=${fadeIn}:curve=esin,afade=t=out:st=${fadeOutStart}:d=${fadeOut},lowpass=f=240,volume=0.55`;
    case "swoop":
      // Whoosh: low-pass moving sweep
      return `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},lowpass=f=900,volume=0.40`;
    case "noise":
      // Paper rustle: high-pass filtered burst
      return `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},highpass=f=2400,volume=0.30`;
    case "shimmer":
      // Iridescent: high freq, slow vibrato, long tail
      return `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},vibrato=f=4:d=0.4,volume=0.32`;
    case "bleep":
      return `afade=t=in:st=0:d=0.005,afade=t=out:st=${fadeOutStart}:d=${fadeOut},volume=0.40`;
    case "pad":
      // Soft sustain: long fades, lush
      return `afade=t=in:st=0:d=0.10,afade=t=out:st=${fadeOutStart}:d=${fadeOut},aecho=0.5:0.4:80:0.3,lowpass=f=2200,volume=0.35`;
    default:
      return `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut},volume=0.40`;
  }
}

let made = 0;
for (const [name, freq, dur, character] of SFX){
  const out = join(sfxDir, name);
  const filter = buildFilter(character, dur);
  const cmd = [
    `"${ffmpegPath}"`,
    "-y",
    "-loglevel error",
    `-f lavfi -i "sine=frequency=${freq}:duration=${dur}:sample_rate=44100"`,
    `-af "${filter}"`,
    "-c:a libmp3lame -q:a 4 -ac 2",
    `"${out}"`
  ].join(" ");

  execSync(cmd);
  made++;
  console.log(`+ ${name}  (${dur}s, ${freq}Hz, ${character})`);
}

console.log(`\n✓ Synthesised ${made} placeholder SFX files in ${sfxDir}`);
