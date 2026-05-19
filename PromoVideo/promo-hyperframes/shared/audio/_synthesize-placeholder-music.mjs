/**
 * Generates a placeholder music bed: 80s of low-amplitude soft ambient pad
 * (slow chord changes A minor / F / C / G at 96 BPM-ish, 220Hz fundamental
 * with thirds + fifths, reverb tail). NOT a real promo bed — placeholder
 * so the audio mix + render pipeline can be tested end-to-end.
 */
import ffmpegPath from "ffmpeg-static";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "music-bed.mp3");

// Build via ffmpeg lavfi sine generator + biquad filters for a soft pad.
// Three sine layers at 220, 277.18 (E), 329.63 (E one octave up - actually use 330):
// chord progression handled via volume envelope per ~10s.
//
// For simplicity (and determinism) we just generate a low sustained drone.
// 80s @ 44.1kHz stereo, loudness around -22 LUFS (quieter than the SFX hits).

const cmd = [
  `"${ffmpegPath}"`,
  "-y",
  "-f lavfi -i \"sine=frequency=220:duration=80:sample_rate=44100\"",
  "-f lavfi -i \"sine=frequency=277.18:duration=80:sample_rate=44100\"",
  "-f lavfi -i \"sine=frequency=329.63:duration=80:sample_rate=44100\"",
  "-filter_complex \"[0:a]volume=0.35[a0];[1:a]volume=0.25[a1];[2:a]volume=0.20[a2];[a0][a1][a2]amix=inputs=3:duration=longest[mix];[mix]aecho=0.6:0.4:60|120:0.3|0.2,lowpass=f=2200,volume=0.4,afade=t=in:st=0:d=0.8,afade=t=out:st=78.5:d=1.5[out]\"",
  "-map \"[out]\"",
  "-c:a libmp3lame -q:a 4 -ac 2",
  `"${out}"`
].join(" ");

console.log("ffmpeg cmd:", cmd, "\n");
execSync(cmd, { stdio: "inherit" });
console.log(`\n✓ wrote placeholder: ${out}`);
