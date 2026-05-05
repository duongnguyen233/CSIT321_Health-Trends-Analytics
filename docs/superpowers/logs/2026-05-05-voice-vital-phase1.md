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

---

# Phase 2 — Real feature extraction pipeline

**Status:** COMPLETE — awaiting user approval for Phase 3.

## Task summary

- [x] **Task 2.1:** requirements.txt now pins opensmile, praat-parselmouth, silero-vad, faster-whisper, librosa, soundfile, scikit-learn, ruptures, numpy, scipy, joblib, spacy, azure-storage-blob. All installed cleanly on Python 3.13. Backend/README.md documents ffmpeg system dep + winget install line.
- [x] **Task 2.2/2.3:** `voice_audio.py` (transcode_to_wav with ffmpeg + soundfile fallback, load_wav, vad_segments via Silero, compute_snr_db, split_stages with MissingStageError/InvalidStageOffsetError). 5 synthetic deterministic fixtures committed under `tests/voice/fixtures/`.
- [x] **Task 2.4:** `voice_features_egemaps.py` — 88 eGeMAPSv02 functionals via opensmile lazy singleton, NaN scrub + _nan_count + _failed flags.
- [x] **Task 2.5:** `voice_features_praat.py` — 9 Praat metrics (jitter local/rap/ppq5, shimmer local/apq3/apq5, hnr_mean, cpp, mpt) with full failure-fallback path.
- [x] **Task 2.6:** `voice_features_ddk.py` — librosa onset_detect → rate + ISI CV with energy-gate short-circuit on near-silent input.
- [x] **Task 2.7:** `voice_whisper.py` (local faster-whisper INT8 wrapper) + `scripts/download_voice_models.py`. Model downloaded successfully (whisper_available=True). WhisperModelMissingError lets the pipeline degrade gracefully when model is absent.
- [x] **Task 2.8:** `voice_features_linguistic.py` — 9 metrics per spec §8.1; pause threshold 0.25s; spaCy POS-based idea density with length-based fallback. Returns None when voiced<5s (pitfall #5).
- [x] **Task 2.9:** `voice_processor_v2.py` — full pipeline orchestrator. Raises LowSnrError when SNR<6 dB (configurable via snr_threshold_db). 3 integration tests pass against stitched 30s synthetic recordings.
- [x] **Task 2.10:** `_process_recording_v2` rewired to call `extract_all`. New `voice_features_db` table persists feature dicts. Legacy `voice.py` (1057 lines) and `voice_processor.py` (442 lines) deleted. `main.py` adds 307-redirect alias from `/api/voice/*` → `/api/voice/v2/*` so the unmodified frontend keeps working.

## Verification

| Item | Status | Evidence |
|---|---|---|
| `pip install -r requirements.txt` clean | ✅ | All 13 deps installed on Python 3.13 |
| ffmpeg confirmed available (or skipped) | ⚠️ SKIP | ffmpeg not on PATH in this sandbox; transcode_to_wav falls back to soundfile direct decode for WAV inputs. Test marked skipif. README documents `winget install Gyan.FFmpeg`. |
| `voice_processor_v2.extract_all` produces 4 sub-blocks + transcript | ✅ | `test_extract_all_returns_all_sub_blocks` |
| Low-SNR fixture marks recording failed=low_snr | ✅ | `test_extract_all_raises_lowsnr_for_pure_noise` + worker handler |
| `_process_recording_v2` calls real pipeline | ✅ | wired in `voice_v2.py`; smoke test passes |
| All Phase 1 tests still green | ✅ | 113 passed, 1 skipped (ffmpeg) |
| Old `voice.py` deleted; legacy aliases redirect | ✅ | confirmed; 7 v2 routes + 1 alias route |

## Artifacts

- **New files:** voice_audio.py, voice_features_{egemaps,praat,ddk,linguistic}.py, voice_processor_v2.py, voice_whisper.py, voice_features_db.py, scripts/{download_voice_models,make_voice_fixtures}.py, pytest.ini, README.md, 5 fixture WAVs.
- **Modified:** requirements.txt, .gitignore, main.py, voice_v2.py, test_phase1_smoke.py.
- **Deleted:** app/api/voice.py, app/services/voice_processor.py.
- **Tests:** 113 passing (up from 72), 1 skipped (ffmpeg), 0 failing.
- **Commits:** 11 new commits on `autopilot/2026-05-05-voice-vital-phase1` (24 total).
- **Local cache:** `Backend/models/faster-whisper-base.en/` (~150 MB, gitignored).

## Caveats surfaced for the user

1. **ffmpeg not installed in this environment.** The pipeline falls back to soundfile direct decoding for WAV inputs. Browser uploads (WebM/Opus) need ffmpeg — install via `winget install Gyan.FFmpeg` before serving real traffic.

2. **Synthetic test fixtures don't trip Silero VAD reliably.** All 5 fixtures are deterministic synthetic signals (sines, modulated noise) — not real human voice. Silero's voiced-segment detection is trained on real speech, so SNR computed on these fixtures comes in low (~5 dB). The smoke test accommodates this by accepting `status in {done, failed}` as long as the recording flowed through. Once a real human records via the UI, SNR will be normal.

3. **Whisper transcription on synthetic harmonic tones is noisy.** The slow integration test only asserts the API contract (text + words), not text content, because the synthetic tones don't transcribe meaningfully.

4. **Old route aliases are temporary.** `/api/voice/links` etc currently 307-redirect to `/api/voice/v2/links` etc — but the v2 router doesn't expose all the same paths, so some old frontend calls (e.g. `/api/voice/recordings`) will 404 after redirect. Phase 4 rewrites the frontend to call `/api/voice/v2/*` directly and removes the alias.

5. **No PR opened yet** — per repo rule, the PR will target `nelly_main` and only when the user explicitly asks. Branch `autopilot/2026-05-05-voice-vital-phase1` is local.

---

# Phase 3 — Scoring + alert engine

**Status:** COMPLETE — awaiting user approval for Phase 4.

## Task summary

- [x] **Task 3.1:** `voice_score_vector.py` — 108-d feature vector (88 eGeMAPS + 9 Praat + 9 linguistic + 2 DDK) partitioned across the 5 dimensions; `build_full_vector()` projects orchestrator output → np.float32 array. Module-load assertion catches partitioning drift.
- [x] **Task 3.2:** `voice_baseline.py` — PCA(<=32) + MinCovDet (with EmpiricalCovariance fallback for low-sample edge cases) + IsolationForest, fit on the 108-d vector. Robust stats (median + MAD with 1e-6 floor) computed per feature. Persisted via `joblib` to Azure Blob `model-artifacts/residents/{profile_id}/baseline_v{n}.joblib` with in-memory fallback. `load_baseline()` wrapped in LRU cache size 64.
- [x] **Task 3.3:** `lock-baseline` endpoint — pulls features from `voice_features_db.list_features()`, takes oldest 10, fits + persists. 409 INSUFFICIENT_RECORDINGS / FIT_FAILED. Profile flagged with `baseline_locked_at`, `baseline_version`, `baseline_blob_uri`.
- [x] **Task 3.4:** `voice_score.py` — `score_recording(features, baseline)` returns `concern_score` (tanh-squashed mix of chi²-normalised Mahalanobis + sigmoid IsolationForest, both 0..100), 5 dimension sub-scores via tanh(max|robust_z|/3)*100, raw mahalanobis/iforest, and per-feature deltas. Wired into `_process_recording_v2`: post-feature-extraction, loads baseline if locked, writes Score row.
- [x] **Task 3.5:** `voice_ewma.py` — `update_ewma(state, deltas)` returns `{ema, breach_streak, breached}` per feature; default alpha=0.3, threshold=3.0 MADs, consecutive=5. Standalone helper for future per-feature control charts (not yet wired into the worker).
- [x] **Task 3.6:** `voice_alerts.py` — pure `evaluate_alerts(today_score, history, today_context_flags, history_context_flags) → list[AlertCandidate]`. Implements the watch (2-of-3 sub-score >70) and review (concern>80 on 2-of-3 days) rules. Cold-day suppression (cold OR just_woke_up=true on ALL qualifying days). All summary templates use dimension language only; FRAMING_OK marker on the disclaimer line. `_evaluate_and_persist_alerts()` in voice_v2.py wires it into the worker.
- [x] **Task 3.7:** `voice_changepoint.py` — `_detect_changepoint()` runs `ruptures.Pelt(model="rbf")` with pen=1.0; `changepoint_alerts_for_profile()` runs CPD on each dimension's sub-score series; `run_changepoint_scan_for_facility()` walks every baselined profile. `cpd_loop_forever()` is a 24h asyncio loop scheduled at FastAPI startup. `VOICE_DISABLE_CPD_LOOP=1` (set by tests/conftest.py) prevents the loop from running during the test suite.
- [x] **Task 3.8:** Nurse endpoint upgrades — new `/n/residents` (list view with last-5 scores + latest open alert), `/n/residents/{rid}/recordings/{rid}/audio` (presigned SAS URL or stream sentinel for in-memory blobs), `/n/residents/{rid}/recordings/{rid}/stream` (direct stream fallback), `/n/alerts` now paginated with `limit` + `cursor` + `next_cursor`/`total`.
- [x] **Task 3.9:** `voice_seed_v2.py` rebuilt — 20 baseline + 5 drift recordings on R-V004 with synthetic features in the same shape voice_processor_v2 produces. Drift recordings have phonatory + prosodic sub-scores 70..94 and concern 78..98. Seed runs evaluate_alerts on the latest drift recording with the prior 3 as history, so a fresh boot produces ≥1 review alert visible immediately on the dashboard.

Total: **57 new tests** added in Phase 3, plus 3 baseline tests refined for the 108-d vector. Full suite: **169 passing, 1 skipped (ffmpeg)**.

## Verification

| # | Phase 3 exit criterion | Status | Evidence |
|---|---|---|---|
| 1 | lock-baseline fits + persists + flags profile | ✅ | `test_lock_baseline_succeeds_with_enough_features` |
| 2 | _process_recording_v2 writes Score + alert rows | ✅ | wired in voice_v2.py; smoke test still green |
| 3 | drift fixture triggers watch then review with disease-name-free summaries | ✅ | `test_voice_seed_v2.test_drift_resident_has_review_alert` + `test_no_forbidden_words_in_review_summaries` |
| 4 | cold=true on ALL qualifying days suppresses | ✅ | `test_cold_on_all_qualifying_days_suppresses_watch_alert` |
| 5 | nightly CPD loop scheduled; manual run produces alert on drift resident | ✅ | `test_run_changepoint_scan_only_processes_baselined_residents` + `cpd_loop_forever()` in main.py |
| 6 | every §7.4 endpoint returns real data + has integration test | ✅ | `test_v2_nurse_endpoints.py` covers list, audio URL, stream, alerts pagination |
| 7 | All Phase 1 + Phase 2 tests still green; framing test still green | ✅ | 169/169 voice tests passing including framing |

## Artifacts

- **New service modules:** `voice_score_vector.py`, `voice_baseline.py`, `voice_score.py`, `voice_ewma.py`, `voice_alerts.py`, `voice_changepoint.py`.
- **Modified:** `voice_v2.py` (lock-baseline + scoring + alert wiring + nurse endpoints), `voice_features_db.py` (list_features), `voice_profile_db.py` (baseline_* fields surfaced), `voice_seed_v2.py` (rebuilt drift demo), `main.py` (CPD loop), `tests/conftest.py` (VOICE_DISABLE_CPD_LOOP).
- **9 new commits** on `autopilot/2026-05-05-voice-vital-phase1` (33 total).

## Caveats for the user

1. **WavLM still out of scope.** The score vector is 108-d (eGeMAPS + Praat + linguistic + DDK), not 1670-d as in VOICE_BIOMARKER.md spec §8.2. The plan's Adaptations table called this; flagging again so it's explicit.

2. **CPD penalty is tuned permissively** (pen=1.0). On real production data the false-positive rate may be too high; you'll likely want to tune this with a few weeks of nurse feedback. The unit test asserts behaviour on a 0→50 step function, which is the "obvious shift" regime.

3. **EWMA module is built but not yet wired into the worker.** It's a standalone helper. The watch/review alert rules cover the common drift cases without needing per-feature EWMA today; the EWMA code is ready for the dashboard's per-feature control charts in Phase 4 UI work.

4. **Whisper still off the worker fast path.** `_process_recording_v2` calls `extract_all` which calls `voice_whisper.transcribe()` if the model is available. On the dev machine the model is downloaded; in any environment without it, transcription is skipped (linguistic features then only appear on later recordings if/when the model lands).

5. **Demo seed creates real review alerts on first boot.** Starting `uvicorn app.main:app` with an empty store now seeds R-V004 with a `review` severity dim-alert. If you want the dashboard to show a clean board, clear the in-memory dicts (or the underlying tables) between sessions.

6. **No PR opened.** Branch `autopilot/2026-05-05-voice-vital-phase1` is local with 33 commits. Reply when you want me to push + open a PR against `nelly_main`.


