// =============================================================================
// refactor-compositions.mjs
// Reads previews/scene-NN-<slug>.html, strips preview-only chrome, injects the
// shared tokens.css, wraps body content in a Hyperframes composition root +
// clip, and replaces the IFRAME-AWARE BOOTSTRAP block with a Hyperframes-aware
// bootstrap that registers the paused timeline on window.__timelines[<slug>].
//
// Idempotent: marker `<!-- HF-COMP gen v1 -->` is written near the top of every
// generated file, and the script always reads from previews/ (never reads its
// own output) so re-running produces byte-identical output.
// =============================================================================

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TIMELINE = JSON.parse(readFileSync(join(here, "timeline.json"), "utf8"));
const previewDir = join(here, "..", "previews");
const compDir    = join(here, "..", "compositions");
if (!existsSync(compDir)) mkdirSync(compDir, { recursive: true });

const MARKER = "<!-- HF-COMP gen v1 -->";

// ----- Strip patterns -----------------------------------------------------------
// :root{...} block (no nested braces inside :root in these scenes, greedy [^}]* is safe)
const ROOT_BLOCK      = /:root\s*\{[^}]*\}\s*/;
// font preconnect links (both googleapis and gstatic variants)
const FONT_PRECONNECT = /<link rel="preconnect"[^>]*>\s*/g;
// font stylesheet link (the Google Fonts css2? URL)
const FONT_STYLESHEET = /<link rel="stylesheet"[^>]*href="https:\/\/fonts\.googleapis\.com[^"]+"[^>]*>\s*/g;
// HUD HTML block (the dev-only replay+timer chrome). Matches from <div class="hud">
// up to (but not including) the next <script> tag.
const HUD_HTML        = /<div class="hud">[\s\S]*?<\/div>\s*(?=<script)/;
// HUD CSS rules — the .hud{...}, .hud button{...}, .hud button:hover{...}, .hud .timer{...}
// rules sit together at the end of every scene's <style>. Match from the first
// .hud{ through the closing brace of .hud .timer{...}.
const HUD_CSS         = /\.hud\s*\{[^}]*\}\s*\.hud\s+button\s*\{[^}]*\}\s*\.hud\s+button:hover\s*\{[^}]*\}\s*\.hud\s+\.timer\s*\{[^}]*\}\s*/;
// Some scenes prefix the HUD CSS with a `/* Replay hud */` or `/* Hud */` comment.
// Strip a small leading comment if it sits immediately before .hud{.
const HUD_CSS_COMMENT = /\/\*\s*(Replay\s+hud|Hud)\s*\*\/\s*(?=\.hud\s*\{)/i;

// IFRAME-AWARE BOOTSTRAP block + the postMessage listener that follows it.
// Matches from the marker comment through the closing `});` of the message listener.
const BOOTSTRAP_BLOCK = /\/\/ IFRAME-AWARE BOOTSTRAP[\s\S]*?\}\);\s*window\.addEventListener\('message'[\s\S]*?\}\);/;

// Body wrap target: from <body...> to the gsap CDN <script src="...gsap...">.
// We wrap the body content (everything between <body> and the gsap script) inside
// the composition root + clip. Scripts stay outside the wrapper as siblings so
// build()/play() run normally.
const BODY_TO_SCRIPT = /(<body[^>]*>)([\s\S]*?)(\s*<script\s+src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap)/;

let okCount = 0;
let failCount = 0;

for (const s of TIMELINE.scenes){
  const num = String(s.id).padStart(2, "0");
  const previewName = readdirSync(previewDir).find(f => f.startsWith(`scene-${num}-`));
  if (!previewName){
    console.error(`X no preview for scene ${num}`);
    failCount++;
    continue;
  }

  let html = readFileSync(join(previewDir, previewName), "utf8");

  // 1) Strip dupes (palette, fonts, HUD).
  html = html.replace(ROOT_BLOCK,        "");
  html = html.replace(FONT_PRECONNECT,   "");
  html = html.replace(FONT_STYLESHEET,   "");
  html = html.replace(HUD_CSS_COMMENT,   "");
  if (!HUD_CSS.test(html)){
    console.error(`X ${num}-${s.slug}: HUD CSS block not found`);
    failCount++;
    continue;
  }
  html = html.replace(HUD_CSS,           "");
  if (!HUD_HTML.test(html)){
    console.error(`X ${num}-${s.slug}: HUD HTML block not found`);
    failCount++;
    continue;
  }
  html = html.replace(HUD_HTML,          "");

  // 1b) Wrap HUD-DOM bindings so they no-op when the HUD is absent.
  //     The HUD HTML was stripped above, but the JS lines that bind to
  //     #replay / #timer were inherited from the preview. Without these
  //     wrappers, getElementById returns null, the .addEventListener / .textContent
  //     access throws, and script execution stops BEFORE the HF bootstrap
  //     can register the timeline on window.__timelines[<slug>].
  html = html.replace(
    /document\.getElementById\('replay'\)\.addEventListener\(([^)]*)\);/g,
    "{ const _r = document.getElementById('replay'); if (_r) _r.addEventListener($1); }"
  );
  html = html.replace(
    /document\.getElementById\('timer'\)\.textContent\s*=\s*([^;]+);/g,
    "{ const _t = document.getElementById('timer'); if (_t) _t.textContent = $1; }"
  );

  // 2) Inject tokens.css link before </head>.
  html = html.replace(/<\/head>/i,
    '<link rel="stylesheet" href="../shared/tokens.css">\n</head>');

  // 3) Replace IFRAME-AWARE BOOTSTRAP with Hyperframes-aware bootstrap.
  const newBootstrap =
`// === HYPERFRAMES BOOTSTRAP — registers paused timeline + supports 3 modes ===
window.addEventListener('load', () => {
  const start = () => {
    build();
    if (typeof tl !== 'undefined' && tl) {
      tl.pause();
      tl.seek(0);
      window.__timelines = window.__timelines || {};
      window.__timelines['${s.slug}'] = tl;
    }
    if (!window.__hyperframes && window.parent === window) {
      play();
    }
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  else                                          start();
});
window.addEventListener('message', (e) => {
  const t = e.data && e.data.type;
  if (t === 'play'  && typeof play === 'function')                          play();
  if (t === 'pause' && typeof tl   !== 'undefined' && tl)                    tl.pause();
  if (t === 'reset' && typeof tl   !== 'undefined' && tl) { tl.seek(0); tl.pause(); }
});`;

  if (!BOOTSTRAP_BLOCK.test(html)){
    console.error(`X ${num}-${s.slug}: IFRAME-AWARE BOOTSTRAP block not found (was the scene patched by patch-scenes.mjs?)`);
    failCount++;
    continue;
  }
  html = html.replace(BOOTSTRAP_BLOCK, newBootstrap);

  // 4) Wrap body content in composition root + clip. Leave the <script> tags as
  //    siblings AFTER the closing </div> of the composition root (still in <body>).
  if (!BODY_TO_SCRIPT.test(html)){
    console.error(`X ${num}-${s.slug}: could not locate body->gsap-script range`);
    failCount++;
    continue;
  }
  html = html.replace(BODY_TO_SCRIPT, (_, openBody, content, scriptOpen) => {
    return (
      `${openBody}\n` +
      `${MARKER}\n` +
      `<div data-composition-id="${s.slug}" data-width="3840" data-height="2160" data-start="0" data-duration="${s.durSec}">\n` +
      `<div class="clip" data-start="0" data-duration="${s.durSec}" data-track-index="0">\n` +
      `${content.trimEnd()}\n` +
      `</div>\n` +
      `</div>\n` +
      `${scriptOpen}`
    );
  });

  writeFileSync(join(compDir, `${num}-${s.slug}.html`), html, "utf8");
  console.log(`+ ${num}-${s.slug}.html`);
  okCount++;
}

console.log(`\nGenerated ${okCount} compositions in compositions/${failCount ? `  (${failCount} failed)` : ""}`);
process.exit(failCount ? 1 : 0);
