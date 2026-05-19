# CapstoneProject / promo-hyperframes — CLAUDE.md

This file is the single source of truth for the CareData promo video rebuild. It captures what we are making, why, the tech we are using, the design system, the story arc, and the per-scene plan. Update this file whenever a decision changes.

The previous Remotion-based promo at `CapstoneProject/promo-video/` is being **replaced** because (a) it invented a fake "Caredata" brand identity (purple/mint triangle logo) that does not match production, (b) the narrative was a generic SaaS audit-automation pitch with no mention of frailty / QI tracking, voice biomarker, or government-format reporting, and (c) the motion was buggy. The new project lives at `CapstoneProject/promo-hyperframes/`.

---

## 1. What we are making

**A 1:15 (75-second) cinematic product film for CareData Health Analytics Portal.** Two acts, music-driven pacing, no narrator. End deliverable: 1920x1080 master MP4 plus a 1080x1920 vertical cutdown for socials.

### Audience
Directors of Nursing, Quality Coordinators, Aged Care Quality and Safety Commission auditors, capstone judges (CSIT321, University of Wollongong).

### Three pillars the promo must communicate
1. **Visualise and benchmark 14 AIHW QI categories** quarter over quarter, against national medians.
2. **Daily voice biomarker monitoring** for residents, with watch / review alerts the nurse can act on the same shift.
3. **Government-format, audit-ready reports** generated from one upload (we honestly position this as "GPMS-format export" because the live product does not yet auto-submit to AIHW).

### Honesty constraints
- No fake "submitted to AIHW" flow. The product has a `submitted: bool` flag on the GPMS endpoint but no actual government integration. We claim "audit-ready" and "GPMS-format export", not "auto-submission".
- No invented stats like "6 hours saved per week". We use only badges that match the live `Hero.jsx` footer: **14 QI domains · FHIR R4 · Privacy Act 1988**.
- No AI-generated faces of carers or residents. The product UI carries the story.

---

## 2. Product context (CareData)

The promo dramatises the live product at `Caredata-Visualization-Azure/`. Key production facts that must be reflected in every scene:

### Real brand identity
| Token | Value | Where used |
|---|---|---|
| Logo | `BrandMark.jsx` at `Frontend/src/components/common/BrandMark.jsx`. Rounded square with `linear-gradient(145deg, oklch(0.72 0.06 150) 0%, oklch(0.78 0.05 180) 100%)` (sage to dusty-blue). Inner inset paper-coloured rectangle clip-pathed to a **heart-rate / EKG line**: flat, small bump, dip, big spike, return to flat. **Not a triangle. Not three sine waves.** Polygon: `polygon(0 60%, 18% 60%, 28% 40%, 42% 75%, 56% 20%, 70% 60%, 100% 60%, 100% 65%, 68% 65%, 56% 30%, 42% 82%, 28% 50%, 18% 65%, 0 65%)`. |
| Wordmark | "CareData" Geist 600, 15px in production lockup. Bigger sizes for promo hero scenes. |
| Tagline | "Health Analytics Portal" Geist 400 11px |
| Page title | "Care Data Portal" |
| Display font | Instrument Serif (h1, KPI numbers, taglines) |
| UI font | Geist (300 to 700) |
| Mono | Geist Mono (numerics, code, formulas) |

### Production palette (light theme)
- ink-900 `#1F2622` — primary text
- ink-700 `#3D4743`, ink-500 `#6B7570`, ink-300 `#A4ABA4`
- sage `#9FB4A0`, sage-ink `#4B6A55`, sage-tint `#EEF1EC`
- clay `#C8B89B`, clay-ink `#836B47`
- dusty-blue `#A6B6C4`
- cream `#F6F2EB`, paper `#FBF8F2`
- status-good `#8AA791`, status-bad `#B86F62`

### Promo dark-theme adaptation
The promo runs on a dark stage (deep ink gradient `#0E1211` to `#1A1F1B` to `#0F1311`) so the white production cards punch out cinematically. We add **sage-bright `#B8D1B5`** for italic colour flips that pop on dark. Production cards (Excel snippet, GPMS PDF, dashboard, reports) keep their light-theme white-paper interiors as drawn in the live app.

### Production hero copy (used verbatim in Scene 3)
- Eyebrow chip: *"Australian Digital Health, FHIR aligned"*
- H1: *"Quiet clarity for aged-care quality data."* (italic on "aged-care", sage-ink colour flip)
- Sub: *"CareData Portal turns messy facility records into government-standard indicators, upload once, see insights, file with confidence."*
- CTAs: "Start a facility upload", "View the sample report"
- Footer badges: "14 QI domains · FHIR R4 · Privacy Act 1988"

### Real screens to mirror in promo (no Playwright PNGs, full HTML rebuilds)
| Screen | File path | Used in scene |
|---|---|---|
| Landing hero | `Frontend/src/components/landingPage/Hero.jsx` | Scene 3 |
| Data Entry / GPMS form | `Frontend/src/pages/UploadCSVPage.jsx` (13 sections) | Scene 4 |
| QI Dashboard | `Frontend/src/pages/QIDashboardPage.jsx` (14-indicator trend chart, KPI cards, heatmap) | Scenes 5, 6 |
| Benchmarking | `Frontend/src/pages/BenchmarkingPage.jsx` (facility vs AIHW national medians) | Scene 7 |
| Voice Dashboard | `Frontend/src/pages/VoiceDashboardPage.jsx` + `components/voice/*` | Scenes 9, 12 |
| Voice Recording | `Frontend/src/pages/VoiceRecordPage.jsx` (4-stage battery, 5 dimensions) | Scenes 10, 11 |
| Reports + export | `Frontend/src/pages/ReportsPage.jsx` | Scene 14 |

### Sample data threading the entire video
- Facility: **Bayside Aged Care, Wollongong** (60 beds, metropolitan)
- Period: **Q1 2026** (Jan to Mar)
- Pressure injury prevalence: 2.1% (national median 10.2%)
- Falls major injury: 1.4% (national 8.3%)
- Polypharmacy: 38% (national 19.8%) — flagged
- Antipsychotic without diagnosis: 8.2% — flagged
- Allied health gap: 22%
- Facility percentile: 62nd nationally
- Voice resident: **Resident, Room 12B** (de-identified placeholder)
  - Concern score 68 (Watch level)
  - 5 dimensions: phonatory 62, articulatory 71, prosodic 74, respiratory 80, linguistic 53
- Other residents shown in nurse dashboard table: anonymised tokens DR-0091 (review), DR-0203, DR-0157, DR-0211 (kept as IDs)

---

## 3. Tech stack

**HeyGen Hyperframes**, the HTML-native video framework that renders deterministic MP4 from agent-authored HTML compositions.

- Project root: `Caredata-Visualization-Azure/CapstoneProject/promo-hyperframes/`
- Bootstrap: `npx hyperframes init` (not yet run; previews run as standalone HTML in any browser)
- **Source files: `previews/scene-NN-slug.html` are the authoritative compositions.** There is no separate `compositions/` directory. The render scripts read directly from `previews/` and swap each file into `index.html` at render time.
- Animation runtimes: **GSAP** for everything except the act-break shards, which use **Three.js** for the 3D shattered-wipe transition. No anime.js, no Lottie. Two runtimes max keeps the bundle small and reasoning tight.
- Tokens: `shared/tokens.css` ports the Tailwind config from `Frontend/tailwind.config.js`. Production component DOM is rebuilt as plain HTML using these tokens.
- Render: `npx hyperframes render --output output.mp4`. 1920x1080 master at 60fps. Vertical 1080x1920 cutdown deferred (not currently produced).
- Audio assets: four real files at `promo-hyperframes/audio/`:
  - `mouse_click.mp3` — mouse-click SFX
  - `typing.mp3` — letter-typing SFX
  - `whoosh.mp3` — screen-flying-in SFX
  - `sunsides-upbeat-energetic-background-music-151501.mp3` — music bed
  The earlier placeholder kit at `shared/audio/` (`master-mix.mp3`, `music-bed.mp3`, `sfx/01..15.mp3`) and the cue map at `shared/audio-cues.json` are deprecated — files left in place but not used by the render pipeline. `shared/audio-mix.mjs` and `npm run audio:mix` are no longer part of the workflow.

### Audio rules — SFX per-scene, music master-only
- **SFX live in the scene HTML.** Each preview/composition embeds `<audio>` elements pointing at the relevant `audio/*.mp3` and triggers playback from its GSAP timeline at the exact event moment. Hyperframes treats `<audio>` inside a composition as part of the rendered mp4's audio track.
- **Music bed lives only on the master.** Never reference `sunsides-upbeat-energetic-background-music-151501.mp3` from any preview, composition, or sub-comp HTML. The master concat in `scripts/rerender-scene.mjs` muxes it (ducked to 0.18 gain) underneath whatever SFX the scene mp4s carry, via `amix`.
- **Mandatory SFX rules:**
  - **`audio/mouse_click.mp3`** plays on every cursor click — drag-drops, button presses, radio/checkbox toggles, link generations, magnetic-cursor snap landings (M24).
  - **`audio/whoosh.mp3`** plays on every "screen flying in" event — whip-pan transitions (M25), modal scale-fade-ins (M11), page-curl peels (M7), vertical roll-up reveals (M10), step-zoom punch-ins (M6), camera vertical pans (M20), and any large UI-chrome translate-on-screen.
  - **`audio/typing.mp3`** plays once per typing burst — start it on the first chunk of a chunked 1-1-3 typing sequence and let it run through the burst. One sustained pulse per phrase, not one per chunk.
- **Adding SFX during iteration.** When a scene is approved or fixed, embed `<audio id="sfx-...">` elements inside the scene's HTML using **`../audio/` paths** (relative to `previews/`, e.g. `../audio/mouse_click_clip.mp3`). The render scripts automatically rewrite `../audio/` to `audio/` when the file is swapped into the root `index.html`. Trigger via GSAP: `tl.call(() => document.getElementById('sfx-click').play(), null, position)`. Reset playback on `tl.restart()` by guarding with `audio.currentTime = 0; audio.play();`.
- **Concat-time audio behaviour.** `scripts/rerender-scene.mjs` ffprobes the concat for an audio stream. If any scene has baked-in SFX, the script `amix`es scene SFX (gain 1.0) and the music bed (gain 0.18). If none have SFX yet, it plain-muxes the music. As scenes get SFX, the music will gradually duck under them automatically.

### Preview workflow
Each scene gets a self-contained preview at `promo-hyperframes/previews/scene-NN-name.html` that runs in any browser without scaffolding the full Hyperframes project. GSAP via CDN, Google Fonts via CDN, all DOM and animation in one file. Once a scene is approved, its content moves into the real composition file under `compositions/`.

---

## 4. Brand and motion system

### Tone
Editorial documentary. Aged-care reform feel. Calm authority. Not fintech-kinetic, not SaaS-bouncy, not horror-strobed. Single ease per element, no shake / flash / vignette / strobe effects unless they map to the iBanFirst reference frames.

### Easing presets
- `cubic-bezier(.16,.85,.30,1)` — primary ease-out, used for camera zooms, fragment entries, headline reveals
- `cubic-bezier(.22,.85,.30,1)` — softer, fragment settles
- `power4.in` — Phase E aggressive zoom-in to viewer's face
- `expo.out` — strong fronted ease where slo-mo tail is desired
- `power2.in` — curtain crash to black

### Motion vocabulary (25 primitives) — copied from the brainstorm
M1 Typing-cursor reveal, M2 UI fragment cascade, M3 Two-stage typography, M4 3D shattered wipe, M5 Trim-path logo resolve, M6 Step-zoom punch-in, M7 Page-curl peel, M8 Star-burst transition, M9 Color-fill state toggle, M10 Vertical roll-up reveal, M11 Modal scale-fade-in, M12 Horizontal track-out + fade-in, M13 Iridescent gradient sweep, M14 Geometric morph (shape to shape), M15 Letter-by-letter colour flip, M16 3D rotational drop-and-lock, M17 KPI counter roll-up, M18 Trend-line draw, M19 Heatmap cell stagger, M20 Camera vertical pan, M21 Live waveform / recording bars, M22 Progress arc fill, M23 Severity-pill pulse, M24 Magnetic cursor snap, M25 Whip-pan transition.

### Beat grid
Tempo lock at **120 BPM**. Beat = 0.5 s. All major scene transitions land on a full beat or half-beat. Audio cut points and music kicks align to the same grid. 120 BPM cleanly divides both 3.0 s scenes (Scene 1, 3) and 2.5 s scenes (Scene 2). Music bed should be generated at 120 BPM with a four-on-the-floor pulse so every animated event has a corresponding kick or hi-hat.

### Cursor
Stylized white hand pointer, 32x32 SVG, drop-shadow `0 2px 6px rgba(0,0,0,.18)`. Movement uses GSAP motion-path curves between waypoints, never linear.

---

## 5. Story arc and beat sheet (1:15 in two acts)

**Act I (0:00 to 0:35), From scattered records to clarity.** Hook, brand reveal, hero copy, upload, dashboard, drill-down, benchmarking.

**Act II (0:38 to 1:08), From quarterly reports to daily care.** Voice biomarker recording, score resolves, nurse dashboard, payoff.

**Outro (1:08 to 1:15).** Tagline, final card.

Scene 1 ended up at 3.0s rather than the original 6.25s allocation, so the rest of the schedule shifts left. Total is now tracking shorter than 1:15. The beat sheet below shows ORIGINAL allocations with `actual` column noted as scenes lock.

| # | Time (s) | Allocated | Actual | Beat | Pillar | Status |
|---|---|---|---|---|---|---|
| 1 | 0.00 to 4.50 | 6.25 s | **4.50 s** | Hook | problem | **APPROVED** (re-paced 2026-05-09 to a beat-aligned 2-1-1 typing rhythm) |
| 2 | 4.50 to 7.50 | 3.13 s | **3.00 s** | Meet + Logo + Pill | brand | **APPROVED** |
| 3 | 7.50 to 10.50 | 3.75 s | TBD | Hero headline | identity | pending |
| 4 | 9.50 to 16.50 | 6.88 s | TBD | Upload + GPMS form | P1 record | pending |
| 5 | 16.50 to 21.50 | 5.00 s | TBD | QI Dashboard | P1 visualise | pending |
| 6 | 21.50 to 25.25 | 3.75 s | TBD | PI drill-down | P1 visualise | pending |
| 7 | 25.25 to 31.50 | 6.25 s | TBD | Benchmarking | P1 benchmark | pending |
| 8 | 31.50 to 34.63 | 3.13 s | TBD | Act break shards | transition | pending |
| 9 | 34.63 to 38.38 | 3.75 s | TBD | Voice setup link | P3 voice | pending |
| 10 | 38.38 to 44.00 | 5.63 s | TBD | Recording battery | P3 voice | pending |
| 11 | 44.00 to 47.75 | 3.75 s | TBD | Score resolves | P3 voice | pending |
| 12 | 47.75 to 53.38 | 5.63 s | TBD | Nurse dashboard | P3 voice | pending |
| 13 | 53.38 to 59.63 | 6.25 s | TBD | Trust stamps | trust | pending |
| 14 | 59.63 to 65.25 | 5.63 s | TBD | Audit-ready payoff | payoff | pending |
| 15 | 65.25 to 68.38 | 3.13 s | TBD | Tagline | identity | pending |
| 16 | 68.38 to 71.50 | 3.13 s | TBD | Final card | end card | pending |

Estimated total runtime: tracking around 60 to 70 s rather than 75 s. We can keep the saved time for tighter pacing or extend specific scenes that need more breathing room (likely benchmarking and voice dashboard).

---

## 6. Per-scene plan

### Scene 1, Hook (0.00 to 4.50, APPROVED — re-paced 2026-05-09)

**File:** `compositions/01-hook.html`. Preview at `previews/scene-01-hook.html`.

**Aesthetic:** Editorial documentary, warm paper-on-dark, layered authority. Dark gradient stage with seven production-realistic paperwork artifacts cascading into orbit around a typing rhetorical question.

**Headline copy (two phrases, retype on same spot):**
- Phrase 1: "Quality reporting shouldn't"
- Phrase 2: "take all quarter." (italic colour flip on "all quarter", cream to sage-bright)

**The seven paper fragments (Calendar dropped, sat inside headline horizontal range and was unavoidably overlapping):**
| Slot | Artifact | Position | Role |
|---|---|---|---|
| A | Excel snippet, PI tab, conditional-format yellow cell, `#VALUE!` error | TL `left:80, top:80`, 440x260 | "the data lives in spreadsheets" |
| B | GPMS PDF Section 1 of 13, period 1 Jan to 31 Mar 2026 | TR `right:90, top:30`, 400x480 | "13 sections of paperwork" |
| C | Audit clipboard, metal clip, attached sticky note | BR `right:80, top:580`, 360x410 | "pen-and-paper audit" |
| D | Email reminder from "Department of Health and Aged Care" | ML `left:60, top:610`, 440x140 | "the deadline pressure" |
| E | Yellow sticky, Caveat handwriting, "Falls Q3? ask the roster sheet" | TC `left:880, top:80`, 240x240 | "the wandering question" |
| F | Indicator definition page, PI_S2 with sage left-border | BL `left:80, top:740`, 380x320 | "the operational complexity" |
| G | Excel formula bar, broken `COUNTIFS` with `#VALUE!` chip | BC `left:580, top:880`, 550x100 | "formula hell" |

**Final timeline (3.0 s, chunked 1-1-3 typing rhythm with three breath pauses):**

| Time | Action |
|---|---|
| 0.000 to 0.550 | **Phase A close-up.** Headline at scale 2.5 (only `#hook` scales, stage stays static). "Quality reporting" types in 11 chunks: Q (1), u (1), ali (3), t (1), y (1), " re" (3), p (1), o (1), rti (3), n (1), g (1). Each tick ~0.05 s. Fragments hidden. |
| 0.550 to 0.800 | **Pause 1, breath 0.25 s.** Headline still at scale 2.5 with first half visible. |
| 0.800 to 1.200 | **Phase B pull-out.** Headline scales 2.5 to 1.0 over 0.40 s with cubic-bezier(.16,.85,.30,1). " shouldn't" types in 6 chunks: " " (1), s (1), hou (3), l (1), d (1), n't (3). Fragments cascade in from compass directions starting 0.95 s. **Stage gradient does NOT zoom**, only the headline and fragments. |
| 1.200 to 1.450 | **Pause 2, breath 0.25 s.** Phrase 1 fully visible at native scale, fragments settled. |
| 1.450 to 1.600 | **Backspace wipe**, 0.15 s. Same chunk pattern reversed (3, 1, 1, 3, 1, 1, 1, 1, 3, 1, 1, 3, 1, 1, 3, 1, 1). |
| 1.600 to 2.200 | **Phase D phrase 2.** "take all quarter." types in 11 chunks (same 1-1-3 pattern). M15 italic colour flip on "all quarter" runs through chunks. |
| 2.200 to 2.500 | **Pause 3, breath 0.30 s.** Punchline lands. |
| 2.500 to 3.000 | **Phase 4 fly into face.** Headline scales 1.0 to 4.5x with 4 px blur over 0.35 s, fragments translate 1100 to 1300 px on compass vectors + scale to 3.0x + blur 18 px + fade. **Background gradient stays static throughout.** Curtain crashes to black at 2.700 over 0.30 s. |
| 3.000 | Black. |

**Confirmed user decisions locked for Scene 1:**
- **Total 3.0 s** (compressed from 6.25 to 5.5 to 4.5 to 4.0 to 3.0 across iterations)
- **Chunked 1-1-3 typing rhythm**, NOT per-character. One letter, one letter, three letters at a time. Faster than letter-by-letter, more musical, less mechanical.
- **Three breath pauses**: after "Quality reporting" (0.25 s), after " shouldn't" (0.25 s), after "take all quarter." (0.30 s).
- **Camera zoom only on headline and fragments**, never on the background stage gradient. Stage holds at scale 1.0 the entire scene.
- **Headline scale 2.5 close-up at the start**, scales down to 1.0 during Phase B as fragments cascade in. Fragments hidden during close-up so they never overlap with big letters.
- **Dropped Calendar (H) fragment**, was inside headline horizontal range and unavoidably overlapping. Email (D) moved from top:560 to top:610 to clear vertical overlap.
- Headline anchored centre, `text-align:center`, top:50% left:50% translate(-50%,-50%). Reverted from leftish left:21% experiment.
- Body background matches stage gradient so letterbox bars on wider-than-16:9 viewports blend in.
- No camera shake, no stage flashing, no vignette darkening. Editorial.
- 3D shards retained for Scene 8 act break.

---

### Scene 2, Meet + Logo + Tagline pill (3.0 to 6.0, APPROVED)

**File:** `compositions/02-logo-reveal.html`. Preview at `previews/scene-02-logo-reveal.html`.

**Aesthetic:** Editorial dark stage continues from Scene 1 (no black curtain crash, the green stage holds). Big serif "Meet" pop, snap-fast horizontal swap, full logo arrives as one unit, then the sage-glowing sub-headline pill expands word by word.

**Final timeline (3.0 s):**

| Time | Action |
|---|---|
| 0.000 to 0.250 | "Meet" pops in. Instrument Serif 280 px cream (same font as Scene 1 hook), centred. Scales from 0.06 (tiny dot) to 1.0 with `back.out(1.6)` for super-fast snap with slight overshoot. |
| 0.250 to 0.600 | Hold "Meet" (0.35 s breath). |
| 0.600 to 0.850 | **The swap.** "Meet" zips right (translateX +2600 px, motion blur 10 px, fades). Simultaneously the **full logo arrives as one unit** from the left: BrandMark (gradient + EKG already drawn) + "CareData" Geist 600 96 px wordmark + sage-glow pill containing just the bullet. translateX -2400 to 0 with motion blur 8 to 0. Hard `power3` curves. |
| 0.850 to 1.130 | Logo settle bounce (+2.5 % scale to 1.0). Sage spotlight blooms behind. |
| 1.000 | **"AI-powered"** appears as one unit inside the pill. Pill outline grows in 0.18 s to accommodate. |
| 1.150 | **"visualisation"** appears, pill outline lengthens. |
| 1.300 | **"engine"** appears, pill outline lengthens to final width. |
| 1.500 to 3.000 | Hold. Mark + "CareData" + "AI-powered visualisation engine" pill all visible centred. Brand registers. |

**The pill mechanic:** rounded 999 px outline with 1.5 px sage border + sage-glow box-shadow, sage bullet on the left. Words inside are inline-block flex items with `display: none` initially. Pill widths are pre-measured on load (after fonts ready) by toggling each word's display and reading `scrollWidth`. Each reveal animates the pill `width` 0.18 s plus the word `opacity` 0 to 1 over 0.14 s with a 0.06 s lead so the pill begins growing before the word lands.

**Scene 1 update:** the curtain-to-black animation at the end of Scene 1 was REMOVED. Scene 1 ends with fragments + headline flying to camera and fading, leaving the green stage gradient visible. Scene 2 picks up on the same green stage. No black bridge between scenes.

**Confirmed user decisions for Scene 2:**
- "Meet" pops in first as a separate beat before the brand reveals.
- Full logo (mark + EKG + wordmark + pill bullet) appears as one unit, NOT separate reveals. EKG is drawn from the start, no trim animation.
- Sub-headline pill grows word by word much faster than initial pass: 3 reveals (not 4), 0.18 s grow per step, 0.150 s between reveals.
- "AI-powered" treated as one compound word that appears together; "visualisation" and "engine" appear separately.
- Sage glow on pill (not purple, not mint), matches dark-mode brand palette.
- No sparkle emoji, no four-pointed star icon. Sage bullet only.

---

### Scene 3, Hero headline (9.38 to 13.13, 6 beats)

**Status:** pending. Reproduce `Hero.jsx` exactly: cream eyebrow chip "Australian Digital Health, FHIR aligned", three-line h1 "Quiet clarity for / *aged-care* / quality data." with M15 letter colour flip on "aged-care", sub-copy below. Light cream paper background here (or kept dark, decide on review). Primary CTA "Start a facility upload" sage button.

---

### Scene 4, Upload + GPMS form (13.13 to 20.00, 11 beats)

**Status:** pending. Faux browser chrome with `app.caredata.io/upload-csv` address bar and the real top nav (Dashboard / **Data Entry** highlighted / QI Reports / Benchmarking / Voice Screening / Settings). Drag-drop CSV `Q1-2026-Bayside.csv 3.2 MB` into a sage-bordered drop zone. M25 whip-pan reveals the 13-section GPMS form. Cursor toggles two stage radio fields (M9 colour-fill), counters animate `residents_assessed: 0 to 60` and `prevalence_%: 0.0 to 2.1`. M20 vertical pan past Sections 4 to 12, lands on the bottom CTAs "Save quarter" + "Save and continue to dashboard".

---

### Scene 5, QI Dashboard (20.00 to 25.00, 8 beats)

**Status:** pending. Real `QIDashboardPage` reproduction. Top bar with quarter selector pill `[Q4 2025  ◂  Q1 2026  ▸]` and facility name `Bayside Aged Care · Wollongong`. KPI row, three cards: 47 indicators tracked (M17 counter), 3 variance flags clay accent, Q1 audit-ready check sage. 14-indicator sidebar with sage status dots. Centre multi-line trend chart with M18 trend-line draw (0.06 s stagger). Right severity heatmap M19 grid stagger.

---

### Scene 6, PI drill-down (25.00 to 28.75, 6 beats)

**Status:** pending. M6 step-zoom punch on PI sidebar row. Card opens with `2.1%` Instrument Serif 96 px, stage distribution bars S1 to DTI, AIHW national pin-line at 10.2% in clay. Trailing micro-chart prevalence Q1'25 to Q1'26 trending downward. The 2.1% vs 10.2% contrast is the visual hit.

---

### Scene 7, Benchmarking (28.75 to 35.00, 10 beats)

**Status:** pending. M25 whip-pan to a fresh page, top nav highlights **Benchmarking**. "How does Bayside compare?" headline. Bar chart (1200x500), 14 QI categories, sage facility bars vs dusty-blue national-median ticks, three flagged bars pulse clay (Polypharmacy 38%, Antipsychotic 8.2%, Allied Health gap 22%). Percentile badge "62nd percentile · 24 metro peers" slides in M11 modal scale-fade.

---

### Scene 8, Act break shards (35.00 to 38.13, 5 beats)

**Status:** pending. M4 3D shattered wipe via Three.js. Seven `BoxGeometry` shards, sage-to-dusty-blue gradient material, tumble +Z toward camera over 0.6 s, motion-blurred. Subtitle slides up beneath: *"Quarterly is necessary. Daily is care."* Geist 500, ink-300 on dark.

---

### Scene 9, Voice setup link (38.13 to 41.88, 6 beats)

**Status:** pending. Tablet bezel mockup on a wood surface (no human). Cursor clicks **"Generate recording link"**. Modal slides up with QR code (real generated for the URL), URL `app.caredata.io/voice/r/dr-0148-7n4kP3` (token highlighted via M9), caption "Permanent link · works in any browser · no app install."

---

### Scene 10, Recording battery (41.88 to 47.50, 9 beats)

**Status:** pending. Resident-facing recording page. Header "Daily check-in · Resident, Room 12B · 12 May 2026". Stage indicator dots (1 active, 2-3-4 hollow). Stage card content rotates: sustained vowel "aaaah" 5 s, DDK "puh-puh-puh", passage reading, open prompt. M22 progress arc fills clockwise. M21 live waveform 24 sage bars dancing. M23 mic-icon pulse. Context flag chips above (cold, dentures out, just woke up, pain). Cursor (chunky finger-tap) toggles "Just woke up" via M9.

---

### Scene 11, Score resolves (47.50 to 51.25, 6 beats)

**Status:** pending. Recording panel snaps to "Processing..." pulse 0.4 s, resolves into results card. Aggregate score Instrument Serif 128 px counter rolls 0 to 68 (M17). Severity pill morphs (M14) grey neutral to clay "Watch" with M23 pulse. Five dimension badges in a row M19 stagger: Phonatory 62 down, Articulatory 71 down, Prosodic 74 flat, Respiratory 80 flat, Linguistic 53 down. Below: *"Phonatory and linguistic dimensions drifted at least 10 points from her 14-day baseline."*

---

### Scene 12, Nurse dashboard (51.25 to 56.88, 9 beats)

**Status:** pending. M6 step-zoom OUT from the score card. Real `VoiceDashboardPage` reproduction. Top tabs `All residents · Review alerts (1) · Watch alerts (3) · Needs baseline (2)`. KPI row Residents 60, Baselined 58, Watch 3, Review 1. Residents table with 5 visible rows (Resident Room 12B highlighted in clay watch state, others as IDs). Right rail `VoiceAlertsFeed` slides in M11 with two cards stacked, M23 pulse on the watch one. **No melodramatic caption — captions for this scene must come from approved copy, not the rejected "She'd have looked fine on the next quarterly" line.**

---

### Scene 13, Trust stamps (56.88 to 63.13, 10 beats)

**Status:** pending. Background returns to cream/paper. Three paper-card stamps land in sequence:
1. **`FHIR R4`** at 0:58.5
2. **`Privacy Act 1988`** at 1:00.0
3. **`GPMS-format export`** at 1:01.5

Each via M11 scale-fade-in plus a 1° random rotation and a soft drop shadow. Brand-thud SFX per landing. Sub-headline "Built for the regulator's language." Geist 500, ink-700.

---

### Scene 14, Audit-ready payoff (63.13 to 68.75, 9 beats)

**Status:** pending. M7 page-curl. The three stamps peel away on a Y-axis curl, revealing two CTAs side-by-side on a dark `--ink-900` panel:
- **`Download Q1 2026 report (PDF)`** sage primary
- **`Save submission draft`** clay ghost outline

Caption above buttons "Generate the report. File with confidence." (no fake auto-submit). M13 iridescent pill sweeps across the buttons over 1.0 s, dissolves into M14 morph, pill to sage ring to status-good checkmark in centre. Caption swap M12 to "Audit-ready." Instrument Serif 64 px.

---

### Scene 15, Tagline (68.75 to 71.88, 5 beats)

**Status:** pending. Stark white background. Three-line stack callback to Scene 3 hero:
> Quiet clarity for
> *aged-care* (M15 letter flip ink to sage-ink)
> quality data.

Then M12 swap to closer:
> File with confidence. *Every quarter, every day.*

The italic phrase gets M15 letter flip again, rhyming with "aged-care".

---

### Scene 16, Final card (71.88 to 75.00, 5 beats)

**Status:** pending. Background `--ink-900` with sage radial glow. M16 logo drop-and-lock centre, holds 0.4 s, then M12 horizontal track: logo slides to left, on the right two lines fade up:
> **CareData**
> Health Analytics Portal
> caredata.io

Bottom-left small ink-500 footer: `CSIT321 Capstone — University of Wollongong`. Last 0.4 s gentle fade with audio resolve.

---

## 7. Reference video, full motion log

**File:** [referenceVideo/SaaS Demo Video Example for Fintech Companies.mp4](./referenceVideo/) (iBanFirst fintech demo, 0:46).

The user provided a frame-accurate technical reconstruction of the iBanFirst SaaS demo (their reference). We translate motion patterns from this into our editorial-aged-care register. **Do not copy the fintech tone, only the motion grammar.**

### Phase 1, Macro-type and parallax recede (0:00 to 5:50)
- 0.000s, beat 1: Camera at 2.5x macro zoom. White "S" appears at screen centre (960, 540). Caret pulses at 60 Hz.
- 0.000 to 1.400s, beat 2: Asynchronous pull-back. Camera 2.5x to 1.0x with quintic ease-out. Camera pans right (x: 960 to 1200). The "S" migrates to left-third to prevent text overflow.
- 0.750 to 1.660s, beat 3: Prop injection. 7 UI fragments fly from screen corners. 25 px Gaussian blur and 0% opacity to 100% clarity as they lock into parallax orbits.
- 1.800s, beat 4: Phrase 1 baseline complete. Camera static at 1.0x.
- 2.100s, beat 5: Binary swap. Word disappears (1-frame), word 2 begins typing in the same spatial slot.
- 2.100 to 3.200s, beat 6: Phrase 2 typed. Background props perform subtle ±2 px Z-axis jitter to maintain active visual interest.
- 4.200 to 5.000s, beat 9: Exponential scaling. Whole scene power-eases from 1.0x to 15.0x.
- 5.000 to 5.500s, beat 10: Fly-through. UI props fly past with directional motion blur length 120 px. Screen hits 100% black.

### Phase 2, Shard burst and vector brand resolve (5:50 to 10:50)
- 5.500 to 5.800s, beat 11: 12 metallic 3D shards explode from (960, 540), rotate at 360°/sec on X-axis, scale toward lens.
- 5.800 to 6.100s, beat 12: Shards reach peak scale, act as physical 3D wipe. Background transitions to lighter purple gradient.
- 6.100 to 6.500s, beat 13: Trim-path draw. Logo strokes draw 0% to 100% in 0.2s; sides follow with a 2-frame stagger.
- 6.500 to 6.700s, beat 14: "AI-powered" pill button via elastic scale-up. Hits 1.25x then oscillates twice.
- 7.500 to 8.500s, beat 15: Accordion slide. "Send one" slides x: -500 to 700. Phrase 2 telescopes from right edge.
- 9.500 to 10.200s, beat 17: Camera step-zoom 1.0x to 4.5x on New Mail button. Neon stroke races around path at 1500 px/sec.

### Phase 3, Virtual hand and document physics (10:50 to 19:00)
- 10.50 to 11.20s, beat 18: Camera resets to 1.0x. Hand cursor enters from (1920, 1080) on parabolic Bezier path to file icon.
- 11.50 to 12.50s, beat 20: Inertial drag. Cursor grabs file. Secondary animation: file rotates -5° to +5° to simulate air resistance.
- 14.00 to 15.00s, beat 23: 3D flip-in. Sheet materializes at 0% scale, scales to 1.0x while rotating 720° on Y-axis.
- 15.50 to 16.50s, beat 25: Z-index split. "It extracts" slides left; "all key details" slides right from behind the document layer.
- 16.50 to 18.00s, beat 27: AI highlighting. Rectangular neon masks snap onto data fields, flicker 3 frames upon appearance.

### Phase 4, Star wipe and dashboard expansion (19:00 to 34:00)
- 19.00 to 19.80s, beat 30: Vertical wipe. Purple solid at y: -1080 slams down to y: 0 with heavy ease-in.
- 20.00 to 22.00s, beat 32: White-out. Scene cuts to #FFFFFF. Green ring (4 px stroke) rotates at constant 120 RPM.
- 23.00 to 23.50s, beat 34: Star explosion. 4-pointed star vector expands from cursor coordinates. Scaling 0% to 600% in 15 frames.
- 26.00 to 28.00s, beat 36: Scroll-in. Dashboard UI translates from y: 1080 to y: 0. Hand cursor moves to "DRAFT" tag (x: 1400, y: 650).
- 30.00 to 31.00s, beat 38: Accordion reveal. Ledger row height animates 50 px to 450 px. Internal text layers fade in with 0.2 s delay.
- 31.50 to 32.00s, beat 39: Radial ink-fill. Selecting "Express" triggers circular mask, purple fill expands center r: 0 to 100 px like liquid drop.

### Phase 5, Approval morphs and 3D warp outro (34:00 to 46:00)
- 34.00 to 35.50s, beat 41: Modal bounce. Back-ease scale, reaches 1.1x, settles to 1.0x. Profile pictures have 2 px circular stroke that draws 0 to 100%.
- 35.50 to 36.50s, beat 42: Vector morph. Circular progress vertices re-interpolate to checkmark over 12 frames.
- 37.00 to 38.50s, beat 43: Glassmorphism. Translucent pill pops in. Gaussian-blurred white highlight slides x: -200 to 200 across internal texture.
- 39.50 to 40.50s, beat 45: Mesh warp. Top-right vertex of green checkmark pulled toward (0, 0), creating physical page-peel.
- 41.00 to 43.00s, beat 47: Staggered colour shift. "Save time" appears. "e-r-r-o-r-s" colour flips #808080 to #00FF00 with 3-frame stagger between letters.
- 44.00 to 44.80s, beat 49: Impact drop. 3D triangle logo falls from y: -500. Upon hitting (960, 540), global camera shake (frequency 24, amplitude 4 px) for 10 frames.
- 45.50 to 46.00s, beat 50: Slide resolve. Logo moves x: 960 to 750. Brand text wipes in from vertical linear mask at x: 800.

---

## 8. Decisions log

This section captures the user's explicit decisions during scene-by-scene review. Update whenever a decision is made or reversed.

- **Scope and length:** 1:15 two-act, single deliverable. Vertical 9:16 cutdown dropped — not produced.
- **Final master:** HD 1920x1080 at 60fps, `--crf 12` visually-lossless H.264, video-only per-scene mp4s with master audio muxed at concat time. Output at `output/master-1920x1080-60fps.mp4`.
- **Audio architecture (locked, revised 2026-05-09):** Four real audio files live at `promo-hyperframes/audio/` (`mouse_click.mp3`, `typing.mp3`, `whoosh.mp3`, `sunsides-upbeat-energetic-background-music-151501.mp3`). SFX per-scene (embedded `<audio>` triggered from GSAP); music bed master-only (muxed at concat time and ducked to ~0.18 under any baked-in SFX via amix). The earlier `shared/audio/` placeholder kit + `shared/audio-cues.json` + `npm run audio:mix` flow is deprecated; previous cue-map architecture removed because every placeholder asset was broken and cue timing was misaligned.
- **Auto-submit honesty:** Audit-ready / GPMS-format export only, no fake AIHW upload flow.
- **Brand fidelity:** Real BrandMark SVG, real wordmark "CareData", real palette, real fonts. Fake purple/mint triangle gone.
- **Tech:** Hyperframes, GSAP main animation runtime, Three.js for shards only.
- **Voice resident name:** "Resident, Room 12B" placeholder. Friendly but de-identified.
- **Act break:** Three.js shards (user picked over 2D clip-path).
- **Typing style:** Per-character `display:none` to `display:inline` snap (no fade per char). Italic colour flip runs through typing via CSS transition.
- **Camera approach (locked):** Stage background never zooms. Only `#hook` and individual fragments scale. Phase A starts with `#hook scale: 2.5` close-up, Phase B animates to `scale: 1.0` over 0.40 s. Phase 4 animates `#hook scale: 1.0 to 4.5` and each fragment scale to 3.0 with translate to compass-direction fly-out vectors (1100 to 1300 px).
- **Headline alignment:** `text-align:center` with H1 at left:50% top:50% translate(-50%,-50%). Reverted from leftish `left:21%` after the headline appeared "tilted to the left and down".
- **Typing rhythm (locked, revised 2026-05-09):** chunked **2-1-1** (two letters, one letter, one letter, repeat). NOT per-character. ~0.077 s per chunk in Phase A/D, ~0.071 s in Phase B. Backspace uses Phase-A + Phase-B chunks reversed. Italic colour flip fires per chunk.
- **Breath pauses (locked, revised 2026-05-09):** three pauses in Scene 1 — Pause 1 (1.00 → 1.50, **1 beat**), Pause 2 after "shouldn't" (2.00 → 2.50, **1 beat = 0.5 s**, user-requested), Pause 3 (3.75 → 4.00, **half-beat**).
- **Beat alignment (Scene 1, locked 2026-05-09):** all major events on full or half beats at 120 BPM. Schedule: Phase A 0.00→1.00 (b0→b2) · Pause 1 1.00→1.50 (b2→b3) · Phase B 1.50→2.00 (b3→b4) · Pause 2 2.00→2.50 (b4→b5) · Backspace 2.50→2.75 (b5→b5.5) · Phase D 2.75→3.75 (b5.5→b7.5) · Pause 3 3.75→4.00 (b7.5→b8) · Phase 4 fly-out 4.00→4.50 (b8→b9). Total 4.50 s = 9 beats. The 3.0 s budget was unlocked because the slower typing wouldn't fit and the user explicitly waived it.
- **Em-dashes:** Never use `—` em-dashes anywhere in the spec or generated copy. Use comma, colon, parentheses, or hyphen.
- **Rejected captions:** "She'd have looked fine on the next quarterly." (Scene 12 voice dashboard).
- **Background:** Dark stage gradient (#0E1211 to #1A1F1B to #0F1311). Body gradient matches stage so letterbox bars on wider-than-16:9 viewports blend.
- **Beat grid:** **120 BPM**, 0.5 s per beat (changed from 96 BPM after Scene 3 review). Cleanly divides both 3.0 s and 2.5 s scenes. Major scene transitions land on full beats; sub-events (sub-headline word reveals, italic colour flip, settle bounces, pauses) land on half-beats. Music bed at 120 BPM with four-on-the-floor pulse so every animated event has a kick or hi-hat.
- **Playwright removed (2026-05-09):** every Playwright-based playthrough/snapshot helper deleted (`scripts/record-master-playthrough.mjs`, `record-vertical-playthrough.mjs`, `verify-master-playthrough.mjs`, `capture-voice-record.mjs`, `capture-voice-score.mjs`, `promo-hyperframes/scripts/snapshot-master-comp.mjs`, `snapshot-vertical-samples.mjs`) and `playwright` removed from `promo-hyperframes/package.json` devDependencies. Render pipeline is now pure Hyperframes CLI + ffmpeg via `scripts/rerender-scene.mjs`. No browser playback path anywhere in the promo workflow. Scenes 1–3 final renders are approved as-is — motion-blur and inter-scene transitions explicitly NOT added (would alter approved frames).

---

## 9. Open questions

- Scene 12 nurse dashboard caption (the rejected line needs a replacement, or skip the caption entirely).
- Scene 3 background, cream paper or stay on dark (decide on review).
- Whether Scene 4 GPMS form whip-pan should reveal all 13 sections or just the top 3.
- Music-bed generation, MusicGen MCP available or fallback to Pixabay CC0 track.
- QR-code rendering library, `qrcode-svg` (5 KB) acceptable.
- Vertical 9:16 cutdown timing, do we trim scenes or just reflow layout.

---

## 10. Workflow rules

- One scene at a time. Build a self-contained `previews/scene-NN-name.html`. User reviews in browser. Iterate. Approve. Move on.
- `previews/` is the source of truth -- there is no separate `compositions/` step. Both render scripts read from `previews/scene-NN-slug.html` directly.
- Audio paths in preview files must use `../audio/` (relative to `previews/`). The render scripts rewrite `../audio/` to `audio/` when swapping a scene into the root `index.html`.
- Never add em-dashes anywhere in spec or output.
- Update this CLAUDE.md every time a scope, copy, or motion decision changes.
- For UI inside scenes, mirror the production component's DOM and Tailwind classes verbatim, do not invent UI.

---

*Last updated: see git log. Next reviewer: nellyy2505. Reviewer focus: lock Scene 1 final, then unblock Scene 2 logo reveal.*
