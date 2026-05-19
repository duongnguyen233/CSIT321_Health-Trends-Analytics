# Audio assets — PLACEHOLDER state

This directory currently contains **synthesised placeholder audio** generated
by `_synthesize-placeholder-music.mjs` and `_synthesize-placeholder-sfx.mjs`.
These are NOT the real promo audio — they exist so the audio mix
(`shared/audio-mix.mjs`) and the Hyperframes render pipeline can be
exercised end-to-end before the real assets land.

## What's a placeholder

| File | Placeholder | Real source |
|---|---|---|
| `music-bed.mp3` | 80 s soft sine-pad chord (A-C-E layered, low amplitude, reverb tail) at 220 Hz fundamental | MusicGen MCP prompt in `PROMO_VIDEO_SCRIPT_v2.md` §Audio. Or Pixabay CC0 search "aged-care documentary 96 BPM". |
| `sfx/01-15` | 15 short tones at varying frequencies | FreeSound CC0, search terms in `docs/superpowers/plans/2026-05-08-promo-production-render.md` Task 8 table |

## How to swap in real audio

Replace the placeholder files at the same paths and filenames:

- `shared/audio/music-bed.mp3` (must be ~80 s, 44.1 kHz, MP3 or WAV)
- `shared/audio/sfx/01-keyboard-tick.mp3` … `15-soft-tail.mp3` (durations per the
  table in the production plan)

Then rerun `npm run audio:mix` to produce `master-mix.mp3`, then
`npm run render` to re-render with new audio.

## Removing the synthesis scripts

Once real audio is in place, the `_synthesize-*.mjs` scripts can be deleted
or kept as a safety net. They're idempotent and only overwrite files they
created.
