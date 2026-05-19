/**
 * One-shot script to patch every preview scene with iframe-aware bootstrap:
 *   - Don't auto-play when embedded as an iframe (parent window present)
 *   - Listen for postMessage 'play' / 'pause' / 'reset' from the parent master
 *
 * Run:  node CapstoneProject/promo-hyperframes/shared/patch-scenes.mjs
 *
 * Idempotent: if the marker comment is already present, the file is skipped.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const previewDir = join(here, "..", "previews");
const MARKER = "// IFRAME-AWARE BOOTSTRAP";

const NEW_BLOCK = `// IFRAME-AWARE BOOTSTRAP — patched by shared/patch-scenes.mjs
window.addEventListener('load', () => {
  const start = () => { build(); if (window.parent === window) play(); };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
  } else {
    start();
  }
});
window.addEventListener('message', (e) => {
  const t = e.data && e.data.type;
  if (t === 'play'  && typeof play === 'function')                          play();
  if (t === 'pause' && typeof tl   !== 'undefined' && tl)                    tl.pause();
  if (t === 'reset' && typeof tl   !== 'undefined' && tl) { tl.seek(0); tl.pause(); }
});`;

const PATTERN_B = /window\.addEventListener\('load',\s*\(\)\s*=>\s*\{\s*\n\s*if\s*\(document\.fonts && document\.fonts\.ready\)\s*\{\s*\n\s*document\.fonts\.ready\.then\(\(\) => \{ build\(\); play\(\); \}\);\s*\n\s*\}\s*else\s*\{\s*\n\s*build\(\); play\(\);\s*\n\s*\}\s*\n\s*\}\);/;

const PATTERN_A = /window\.addEventListener\('load',\s*\(\)\s*=>\s*\{\s*build\(\);\s*play\(\);\s*\}\);/;

const files = readdirSync(previewDir)
  .filter(f => /^scene-\d+.*\.html$/.test(f))
  .sort();

let patched = 0, skipped = 0, missed = 0;
for (const f of files){
  const path = join(previewDir, f);
  let src = readFileSync(path, "utf8");

  if (src.includes(MARKER)){
    skipped++;
    console.log(`✓ skip   ${f}  (already patched)`);
    continue;
  }

  let next;
  if (PATTERN_B.test(src)){
    next = src.replace(PATTERN_B, NEW_BLOCK);
  } else if (PATTERN_A.test(src)){
    next = src.replace(PATTERN_A, NEW_BLOCK);
  } else {
    missed++;
    console.log(`✗ MISS   ${f}  (no match)`);
    continue;
  }

  writeFileSync(path, next, "utf8");
  patched++;
  console.log(`+ patch  ${f}`);
}

console.log(`\nDone: ${patched} patched, ${skipped} skipped, ${missed} missed.`);
