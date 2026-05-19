# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Active Codebase

**Only work inside `Caredata-Visualization-Azure/`** — the other folders (`Front-End/`, `Back-End/`, `Demo-Source-Code/`) are older versions and are not maintained.

### Voice Biomarker tab — redesigned in Phases 1-4

The Voice Screening tab was rebuilt end-to-end against `VOICE_BIOMARKER.md` (adapted to this stack — no Postgres, no arq, no WavLM, no Container Apps). The plan and per-phase autopilot logs live at `docs/superpowers/`. Key invariants:

- Backend mounts `/api/voice/v2/*` only (legacy router deleted in Phase 2; legacy `/api/voice/*` redirect deleted in Phase 4).
- Tests run with `tests/conftest.py` stripping `AZURE_STORAGE_CONNECTION_STRING` so they never hit production Azure Tables/Blob.
- `tests/voice/test_framing.py` is a **hard rule**: no disease names anywhere in voice modules. Lines that legitimately need to mention a disclaimer can opt-out via the `# FRAMING_OK` marker.
- Score vector is 108-d (eGeMAPS + Praat + linguistic + DDK; WavLM dropped per Adaptations table).
- `voice_seed_v2.seed_v2_demo_data()` runs at startup. Set `AZURE_STORAGE_CONNECTION_STRING=` (empty) and `VOICE_DISABLE_CPD_LOOP=1` for quick local dev runs that bypass Azure Tables / the nightly CPD loop.

---

## Dev Commands

### Backend (FastAPI, port 8000)
```bash
cd Caredata-Visualization-Azure/Backend
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend (Vite + React, port 5173)
```bash
cd Caredata-Visualization-Azure/Frontend
npm run dev
```
> Port 5173 must be free — Google OAuth is registered only for `http://localhost:5173`. If a stale process occupies it, kill via: `powershell -Command "Stop-Process -Id <PID> -Force"`

---

## Setup (first time)

1. Copy env templates:
   ```bash
   cp Caredata-Visualization-Azure/Backend/env  Caredata-Visualization-Azure/Backend/.env
   cp Caredata-Visualization-Azure/Frontend/env Caredata-Visualization-Azure/Frontend/.env
   ```
2. Install Python deps:
   ```bash
   cd Caredata-Visualization-Azure/Backend && pip install -r requirements.txt
   ```
3. Frontend deps are pre-installed (`node_modules` committed). If missing: `npm install` inside `Frontend/`.

---

## Architecture

### Backend (`Caredata-Visualization-Azure/Backend/`)
- **Framework:** FastAPI + Uvicorn
- **Entry point:** `app/main.py` — mounts routers, configures CORS for `localhost:5173`
- **Routers:** `app/api/auth.py`, `health_scan.py`, `mydata.py`, `upload_csv.py`
- **Auth:** JWT via `python-jose`. Secret in `Backend/.env` (`SECRET_KEY`)
- **Storage:** Azure Table Storage (connection string in `.env`). Falls back to in-memory if not set.
- **AI feature:** OpenAI health scan (`OPENAI_API_KEY` in `.env`)

### Frontend (`Caredata-Visualization-Azure/Frontend/`)
- **Framework:** React + Vite
- **Styling:** Tailwind CSS — config at `tailwind.config.js`
  - `primary` = `#ff7b00` (orange), `dark` = `#111111`, `light` = `#f9f9f9`, `grayish` = `#1a1a1a`
- **Animations:** Framer Motion throughout
- **Key pages:** `src/pages/LandingPage.jsx`, `LoginPage.jsx`, `MyDataPage.jsx`
- **Landing components:** `src/components/landingPage/` — Hero, Features, Indicators, etc.
- **Auth:** Google OAuth (client ID in `Frontend/.env` as `VITE_GOOGLE_CLIENT_ID`). API base set via `VITE_API_BASE_URL`.

### Hero banner structure (`src/components/landingPage/Hero.jsx`)
- Two-zone flex-col layout: text zone (black, padded) then image zone below
- `div.h-40.bg-[#040404].z-10` — intentional black top bar, **never remove**
- All text stays in the black zone — never overlaps the banner image
- `banner.png` in lower zone with `object-top`; gradient blends black→transparent→white
- Animated orange orb (framer-motion) in image zone
- Content: eyebrow (regular weight, muted) → h1 (semibold, punchy) → CTA button

### Design System (from UI Style Guide)
- **Font:** Inter (loaded via Google Fonts in `index.html`), weights 300/400/500/600
- **Primary:** `#ff7b00` (orange) — used for CTA backgrounds, accents, active nav states
- **Blacks:** `#000000`, `#040404` (hero bar), `#111111` (`dark`), `#1a1a1a` (`grayish`)
- **Body text on light bg:** `text-gray-600`, `text-gray-900`
- **Headings:** `font-semibold` (600) or `font-bold` (700) — never mix weights in same visual block
- **Section pattern:** `py-20 px-6`, max-w `max-w-6xl` or `max-w-7xl`
- **CTA button:** `bg-primary text-white font-semibold rounded-md px-6 py-3 hover:bg-orange-500` — always white text on orange buttons, never black
- **Card pattern:** `bg-white border border-gray-100 rounded-xl shadow-md p-6`
- **Framer Motion pattern:** `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` with staggered delays
- **Icon libraries:** @heroicons/react, lucide-react

---

## Workflow Rules

### Plan before every non-trivial task
Use `/plan` (EnterPlanMode) for any task that touches more than one file or has design decisions. Structure every plan as:
1. **Context** — why this change is needed
2. **Design decisions** — what to keep, cut, adjust
3. **Implementation steps** — ordered, file-specific
4. **Verification** — how to confirm it works

### Update CLAUDE.md continuously
Whenever you learn something new — setup quirks, database schema details, API behaviour, component relationships, deployment notes, anything non-obvious — **add it to this file immediately**. No detail is too trivial. This saves tokens on future conversations.

---

## Product Vision — QI Clinical Governance Platform

This tool is a **clinical governance platform for aged care facilities**, aligned to the AIHW Quality Indicator Program Manual 4.0. It is not a generic CSV viewer. The target users are Directors of Nursing (DON), quality managers, and Aged Care Quality & Safety Commission auditors.

> **14 QI categories** (not 9 — confirmed by user).

---

### Top Navigation

| Tab | Purpose |
|---|---|
| **Dashboard** | At-a-glance facility performance across all 14 QI categories for the current quarter. Traffic-light summary cards, not raw data. No sidebar needed — single dense summary with quarter selector. |
| **Data Entry** | Upload quarterly QI collection data (CSV, manual entry, or integration). Replaces "Upload Data" / "Dashboard-CSV". Includes validation against indicator definitions (e.g., flag PI staging values outside valid set). |
| **QI Reports** | Core analytical module. Quarterly reports formatted to align with Department of Health and Aged Care submissions. Replaces "Health Scan" with something meaningful. |
| **Benchmarking** | Facility rates vs national sector averages (AIHW published figures). Shows if 12% PI prevalence is above/below national median. |
| **Settings** | Facility profile, user management, data retention, notification preferences. (Kept as-is — do not alter.) |

---

### Sidebar (contextual per page)

**Data Entry sidebar:** Upload QI data · Submission history · Data validation log · Export/download · Collection calendar (reminders for quarterly point-in-time vs retrospective record-audit windows).

**QI Reports sidebar:** Indicator overview (all 9 categories) · Trend analysis (quarter-over-quarter per indicator) · Drill-down by category · Resident-level detail (de-identified or named by access level) · Risk flagging (residents triggering multiple indicators simultaneously).

**Benchmarking sidebar:** Facility vs national rates · Percentile ranking · Peer group comparison (by facility size, remoteness, ownership type).

---

### Data Model — 44 Indicators across 14 Categories

| QI # | Category | Key Indicators | Notes |
|---|---|---|---|
| QI 01 | Pressure Injuries | PI_01, PI_S1–PI_S4, PI_UNSTAGE, PI_DTI | 6 staging sub-types |
| QI 02 | Restrictive Practices | RP_01, RP_MECH, RP_PHYS, RP_ENV, RP_SECLUSION | 4 sub-types; high regulatory sensitivity post-Royal Commission |
| QI 03 | Unplanned Weight Loss | UWL_SIG, UWL_CON | Significant vs consecutive |
| QI 04 | Falls & Major Injury | FALL_01, FALL_MAJ | Major vs all falls |
| QI 05 | Medications | MED_POLY, MED_AP (no-AP / with-diagnosis / without-diagnosis) | "Without diagnosis" antipsychotic use is auditor focus — highlight in red |
| QI 06 | Activities of Daily Living | ADL_01 + 10 Barthel sub-scores | Bowels/Bladder/Grooming/Toilet/Feeding/Transfer/Mobility/Dressing/Stairs/Bathing |
| QI 07 | Incontinence Care | IC_IAD, IAD_1A–IAD_2B | 4 IAD severity categories |
| QI 08 | Hospitalisation | HOSP_ED, HOSP_ALL | ED presentations vs all hospitalisations |
| QI 09 | Workforce | TBD | Staffing and workforce indicators |
| QI 10 | Consumer Experience | TBD | Resident/family survey-based indicators |
| QI 11 | Quality of Life | TBD | Resident wellbeing indicators |
| QI 12 | Enrolled Nursing | TBD | Enrolled nursing care indicators |
| QI 13 | Allied Health | AH_REC_RECOMMENDED, AH_RCVD_PHYSIO…AH_RCVD_OTHER | Recommended vs received per discipline |
| QI 14 | Lifestyle Officer | TBD | Lifestyle and recreational activity indicators |

---

### Visualisation Strategy

| Chart | Indicators | Why |
|---|---|---|
| **Prevalence rate line chart** (quarter-over-quarter) | PI_01, FALL_01, FALL_MAJ, UWL_SIG, UWL_CON, RP_01, MED_POLY, MED_AP, IC_IAD, HOSP_ED, HOSP_ALL | Directly mirrors what gets reported to the Department |
| **Stacked bar / donut (severity distribution)** | PI staging (S1–S4, Unstage, DTI), IAD (1A/1B/2A/2B) | Shows whether PIs are worsening in severity, not just count |
| **Radar chart (ADL domains)** | 10 Barthel sub-scores + ADL_01 composite | Instant picture of where functional capacity is weakest; quarter-over-quarter shows if interventions work |
| **Gap analysis bar chart** | AH_REC_RECOMMENDED vs AH_RCVD_* per discipline | "40 residents have physio recommended, 25 received" — gap is a compliance risk |
| **Restrictive practices panel** | RP sub-types over time + type distribution | Trending upward = immediate red flag; high post-Royal Commission scrutiny |
| **Medication dual view** | MED_POLY (prevalence rate) + MED_AP 3-way split | "Without diagnosis" antipsychotic category must be visually distinct (red) |
| **Multi-indicator risk heatmap** | All categories, resident rows (de-identified) | Identifies residents accumulating risk across multiple domains simultaneously |
| **National benchmarking bar chart** | PI_01, FALL_01, UWL_SIG headline rates | Facility rate vs AIHW national median with percentile bands — goes into board papers |

---

## Known Quirks & Discoveries

- `uvicorn` is not on PATH on this machine; always invoke as `python -m uvicorn`
- `bun` was not installed by default; installed to `~/.bun/bin/` during gstack setup
- Google OAuth client ID (`640962952544-...`) is pre-filled in `Frontend/env` — just copy to `.env`
- Azure Storage connection string is pre-filled in `Backend/env` — just copy to `.env`
- `node_modules` exists in repo (not gitignored for Frontend), so `npm install` usually not needed
