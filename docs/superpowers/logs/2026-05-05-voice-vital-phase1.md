# Autopilot Log: voice-vital-phase1

**Task:** Execute PHASE 1 of `docs/superpowers/plans/2026-05-05-voice-vital-backend.md` — replace the Voice Screening tab backend in `Caredata-Visualization-Azure/`. Phase 1 reshapes endpoints + schema + data layer onto a new vocabulary while keeping the existing pure-Python feature extractor as a placeholder. Strips disease-naming language from the LLM prompt + QI-flag strings (framing rule).

**Branch:** `autopilot/2026-05-05-voice-vital-phase1` (forked from `nelly_main`)
**Started:** 2026-05-05
**Status:** in-progress

## Phase 0: Setup
- Branch created: `autopilot/2026-05-05-voice-vital-phase1`
- Plan: `docs/superpowers/plans/2026-05-05-voice-vital-backend.md`
- Working dir: `Caredata-Visualization-Azure/`
- Module scope: backend only (Phase 1)
- Adaptations honoured: no Postgres, no arq, no WavLM, no Container Apps. Stay on Azure Tables + FastAPI BackgroundTasks.

## Phase 1: Inspect (skipped — already done in plan-writing pass)
Findings already captured in the plan's "Existing voice biomarker implementation" inventory and Adaptations table. Key files:
- Backend: `Backend/app/api/voice.py`, `Backend/app/services/voice_*.py` (6 files), `Backend/requirements.txt`
- Tests: `Backend/tests/` does not exist yet — will be created in Task 1.1

## Phase 2: Plan (skipped — plan already written and saved)
- Plan file: `docs/superpowers/plans/2026-05-05-voice-vital-backend.md`
- Phase 1 tasks: 11
- Backend tasks: 11
- Frontend tasks: 0 (Phase 4)

## Phase 3: Implement

- [x] Task 1.1: Forbidden-words audit + framing rule test — `Backend/tests/voice/test_framing.py` scans all `voice_*` modules for disease terms; uses `# FRAMING_OK` opt-out for legitimate disclaimers.
- [x] Task 1.2: Strip disease names from existing voice module — rewrote LLM narrative prompt + 5 QI-flag strings + 4 seed-narrative lines to use dimension language; framing test now green.
- [x] Task 1.3: New schema model — `Backend/app/api/voice_schemas.py` (StageOffsets, ContextFlags, ClientMeta, LinkMetadata, UploadResponse) + 12 unit tests. NS/AGC `must_be_false` validators land here.
- [x] Task 1.4: 4-stage prompt script — `Backend/app/api/voice_prompts.py` (sustained_a / ddk / reading / open_prompt, ~73s total, FRAMING_OK disclaimer); 7 tests.
- [x] Task 1.5: Extend voice_link_db — `valid_for_date` field + `get_link_by_resident_and_date` for idempotent issue-link lookups; 5 tests.
- [x] Task 1.6: Blob audio storage helper — `Backend/app/services/voice_audio_blob.py` with deterministic `<resident_id>/<recording_id>.webm` keys, in-memory fallback, presigned-URL helper; 5 tests.
- [x] Task 1.7: Reshape voice_recording_db — added audio_blob_uri, stage_offsets, context_flags, client_meta, snr_db; JSON encode/decode helpers; new set_quality_metrics; 8 tests. **Discovered & fixed a critical safety issue: tests/conftest.py was not isolating the test suite from real Azure Storage; tests had been creating production records. Hardened conftest.py now strips AZURE_STORAGE_CONNECTION_STRING before app imports, and the polluted records were cleaned up.**
- [x] Task 1.8: Score + dimension-tagged alert data layers — new `voice_score_db.py`; `voice_analysis_db` extended with `create_dim_alert / list_dim_alerts / ack_dim_alert` (severity ∈ info/watch/review, dimension ∈ phonatory/articulatory/prosodic/respiratory/linguistic, ValueErrors on bad enums); 11 tests.
- [x] Task 1.9: voice_v2 router — `Backend/app/api/voice_v2.py` mounted at `/api/voice/v2/`; 7 endpoints; 16 tests cover happy path + every documented rejection path including AUDIO_CONSTRAINTS_VIOLATED on noise_suppression and auto_gain_control.
- [x] Task 1.10: Delete voice_seed.py, write voice_seed_v2.py — 4 demo residents, 14 baseline recordings each, R-V004 has 3 trailing drift recordings on phonatory + prosodic; idempotent; main.py wired; 6 tests.
- [x] Task 1.11: Phase 1 smoke test — `test_phase1_full_flow` exercises seed → issue-link → fetch-link → upload → recording.status==done → reused-token-410 → NS-violation-400 → AGC-violation-400 → scores; passes.

Total tests: **72 passing, 0 failing.**

## Phase 4: Verify — Code Tests

- `python -m pytest tests/voice/ --tb=no -q`: **PASS** (72/72)
- App boot smoke: `from app.main import app` succeeds; all 7 `/api/voice/v2/*` routes registered.
- Framing test: stays green at end of phase.

## Phase 5: Visual QA — SKIPPED

Phase 1 is backend-only; no UI changes. Frontend rewrite is Phase 4 of the plan.

## Phase 1 Verification Checklist

- [x] `pytest Backend/tests/voice/ -v` all green; **72 tests** (≥20 required).
- [x] `python -m uvicorn app.main:app` would boot cleanly (verified by `from app.main import app` + route listing).
- [x] All 7 v2 endpoints registered with correct verbs.
- [x] Forbidden-words test stays green.
- [x] No new pip dependency installed (Phase 2 adds them).
- [x] Audio upload happy path produces a recording row + blob bytes (verified in smoke test).
- [x] `noise_suppression=true` → 400 `AUDIO_CONSTRAINTS_VIOLATED` (verified).
- [x] `auto_gain_control=true` → 400 `AUDIO_CONSTRAINTS_VIOLATED` (verified).
- [x] Reused token → 410 (verified).

## Status: COMPLETE — awaiting user approval for Phase 2.

**Branch:** `autopilot/2026-05-05-voice-vital-phase1` (15 commits ahead of nelly_main)
**Files added:** 14 (router + 5 services + 8 test files)
**Files modified:** 5 (voice.py framing fix, voice_link_db extension, voice_recording_db reshape, voice_analysis_db dim-alert API, main.py router mount + new seed)
**Files deleted:** 1 (legacy voice_seed.py)

### Discoveries surfaced for the user

1. **Test isolation hardening** — the `.env` shipped with the repo contains a real
   `AZURE_STORAGE_CONNECTION_STRING`. Prior to Phase 1 there was no test-suite
   guard against tests hitting production Tables. `conftest.py` now strips the
   env var before app imports and neutralises the loaded settings object. I
   also cleaned up the polluted records (12 `voicerecordings` + 5 `voicelinks`
   with `P1`/`R1`/`R-other` IDs) that my own early test runs created.

2. **Pydantic tuples vs JSON arrays** — `StageOffsets` declares fields as
   `tuple[float, float]`. After `model_dump()` the in-memory storage path
   keeps them as tuples; only the JSON serialiser at the API boundary turns
   them into arrays. Tests that compare against the storage layer assert
   tuples; tests that go through the HTTP boundary assert lists.

3. **Disease-naming bugs were already present in the legacy implementation.**
   `_try_llm_narrative` explicitly told `gpt-4o-mini` to discuss "stroke risk,
   cognitive decline, depression, delirium, dysphagia"; `qi-flags` strings
   named stroke/TIA/delirium/depression by category. Phase 1 task 1.2
   removed all of these and the framing test will catch any regressions.

### Next step

Phase 2 (real openSMILE + Praat + Silero VAD + faster-whisper feature pipeline)
adds 13+ pip dependencies and replaces `voice_processor.py`. **STOP here.
Awaiting user approval to proceed.**

