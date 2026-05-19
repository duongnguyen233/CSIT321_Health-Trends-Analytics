# Voice Biomarker Tab — Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing **Voice Screening** tab in the Caredata Visualization Azure project with a redesigned voice biomarker module aligned to `VOICE_BIOMARKER.md`. The new module provides a 4-stage daily voice battery, per-resident baseline scoring, dimension sub-scores (phonatory/articulatory/prosodic/respiratory/linguistic), conservative alert rules, and a clinical governance dashboard — **without ever naming a disease**.

**Architecture:** Stays inside `Caredata-Visualization-Azure/`. Reuses the existing FastAPI app, JWT nurse auth, resident-link flow, Azure Table Storage data layer, and FastAPI `BackgroundTasks` for async processing. Upgrades the feature extractor from pure-Python RMS to a real acoustic pipeline (openSMILE eGeMAPSv02 + Praat via parselmouth + Silero VAD + faster-whisper INT8 transcription). Adds rule-based scoring with PCA + MinCovDet + IsolationForest persisted as joblib bundles in Azure Blob.

**Source spec:** `repo:VOICE_BIOMARKER.md`. **Read it for vocabulary and intent — do NOT copy verbatim.** It assumes Postgres + arq + Container Apps, none of which apply here. The "Adaptations" subsection below is the binding contract; the spec is the philosophy.

**Working directory:** `Caredata-Visualization-Azure/` at repo root. **No code is written outside this directory** except this plan file.

---

## Adaptations (binding — these override VOICE_BIOMARKER.md where they conflict)

| Spec says | This project does | Reason |
|---|---|---|
| Postgres 16 + JSONB + Alembic | Azure Table Storage (PartitionKey/RowKey) + in-memory fallback | Project's existing data layer; no DB to add |
| arq + Redis worker process | FastAPI `BackgroundTasks` in-process | Project has no queue infra; uvicorn single-process |
| WavLM-base ONNX (1536-d embedding) | **Skipped** — score vector is eGeMAPS (88) + Praat (9) + linguistic (9) ≈ 106-d | WavLM weights + ONNX runtime too heavy for the current backend host; eGeMAPS+Praat is the dominant signal anyway |
| `microsoft/wavlm-base-onnx` baked into Docker image | Only `faster-whisper-base.en` (~150 MB INT8) and `en_core_web_sm` baked in | Image stays ~600 MB; deployable on App Service B2 / SWA Functions |
| Multi-stage Dockerfile + Container Apps + Bicep | **Out of scope** — keep existing deployment story | Caredata already deploys via SWA + (existing backend host); not changing infra |
| `arq.cron` nightly changepoint scan | FastAPI `@app.on_event("startup")` schedules a single asyncio task that wakes every 24 h | No queue; built-in scheduling is fine for one cron |
| Postgres pgvector | **Skipped** | Embedding similarity isn't part of the scoring path after dropping WavLM |
| `silero-vad` ONNX | Use it (small, ~2 MB pip wheel) | Same as spec |
| `opensmile` eGeMAPSv02 | Use it | Same as spec; supersedes the current pure-Python RMS extractor |
| `praat-parselmouth` (jitter/shimmer/HNR/CPP/MPT) | Use it | Same as spec |
| `faster-whisper` (CTranslate2 INT8) base.en, local | Use it; replaces the existing OpenAI Whisper HTTP API call | Cheaper, offline-capable, deterministic, no per-request OpenAI dependency for transcription |
| `gpt-4o-mini` LLM narrative | **Keep** the existing optional path; framing rule applies (no disease names; the prompt template must be rewritten) | Already wired to `OPENAI_API_KEY`; keep it as a feature flag |
| spaCy `en_core_web_sm` for idea-density | Use it | Same as spec |
| scikit-learn (PCA/MinCovDet/IsolationForest) | Use it | Same as spec |
| ruptures (Pelt CPD) | Use it | Same as spec |
| Per-resident sklearn baselines stored to Azure Blob `model-artifacts` container | Use it; reuse the existing `AZURE_STORAGE_CONNECTION_STRING` | No new infra |
| Audio stored to Azure Blob `audio-recordings` container | Use it (currently audio is in `voice_uploads/` filesystem with in-memory fallback — change to Blob) | Production-friendly; matches spec |
| 4-stage script (sustained_a / ddk / reading / open_prompt) | Replaces the current 3 random prompts (count / meal / read) | Spec is the source of truth on prompts; current 3-prompt set is out |
| 5 dimension sub-scores | Replaces the current `green/amber/red` traffic-light only | Spec is more clinically meaningful |
| Concern score 0–100 + `dimension`-tagged alerts | Replaces the current `alert_level` enum | Spec |
| **Never name a disease** in code/copy/logs/templates | Audit and rewrite the existing `_try_llm_narrative` prompt (which currently says "stroke risk, cognitive decline, depression, delirium, dysphagia") and the `qi-flags` strings (which currently say "stroke/TIA or delirium") | Hard rule from spec §1; the existing impl violates it |
| Resident JWT auth via password-after-link-registration (existing) | **Keep as-is** — spec describes a token-only flow but project preference per CLAUDE.md is the existing register-with-link-then-login flow | Existing UX is more flexible for repeat recording sessions; resident still has a stable account |

---

## Phase Layout

The replacement is split into 4 phases. Each phase is a separate `/autopilot` run. The user will be asked for explicit permission before each phase begins.

| Phase | Focus | Exit criteria (one-line) |
|---|---|---|
| **Phase 1** | Backend rewrite — schema + endpoints (existing pure-Python features still used; just clean up + reshape) | All new endpoints up; existing alert_level mapped to dimension sub-scores; tests green |
| **Phase 2** | Real feature extraction (openSMILE + Praat + Silero VAD + local faster-whisper + linguistic) — replaces `voice_processor.py` | A recording produces eGeMAPS+Praat+linguistic features; transcript is local; all tests green |
| **Phase 3** | Scoring + alerts (per-resident PCA/MCD/IF baseline; sub-scores; conservative 2-of-3 alert rule; ruptures CPD; cold-day suppression) | Synthetic drift fixture triggers a `review` alert with disease-name-free summary; all tests green |
| **Phase 4** | Frontend tab rewrite — replace `VoiceDashboardPage`, `VoiceRecordPage`, `ResidentPortalPage` and the 3 components in `components/voice/`; nav label stays "Voice Screening" but route is `/voice` and inner tabs match the new IA | Nurse can drive the full flow in a browser; demo drift visible on dashboard |

---

## Cross-Phase Conventions (re-read before each phase)

- **Active dir:** Everything happens inside `Caredata-Visualization-Azure/`. Path references in this plan are relative to that directory unless prefixed `repo:`.
- **Never create a separate `voice-vital-backend/` folder.** The plan that called for it is dead.
- **Existing files to delete or rewrite — not preserve in parallel:**
  - Backend: `app/api/voice.py`, `app/services/voice_processor.py`, `app/services/voice_seed.py`. Reshape (don't replace) the four `voice_*_db.py` services since they are the data-layer abstractions over Azure Tables — Phase 1 evolves their schemas.
  - Frontend: `src/pages/VoiceDashboardPage.jsx`, `src/pages/VoiceRecordPage.jsx`, `src/pages/ResidentPortalPage.jsx`, `src/components/voice/{RecordingWidget,ResidentVoiceCard,VoiceAlertsFeed}.jsx`, `src/services/voiceApi.js`.
- **Add to `Backend/requirements.txt` (Phase 2):** `opensmile==2.5.0`, `praat-parselmouth>=0.4.4`, `silero-vad>=5.1`, `faster-whisper>=1.0`, `numpy>=1.26`, `scipy>=1.13`, `librosa>=0.10`, `soundfile>=0.12`, `scikit-learn>=1.5`, `ruptures>=1.1`, `joblib>=1.4`, `spacy>=3.7`, `azure-storage-blob>=12.23`. **Pin versions before installing.**
- **Add to `Frontend/package.json` (Phase 4) only if needed** — recharts, framer-motion, lucide-react, @heroicons/react are already there.
- **Tests:** `Backend/tests/` already exists (assumed; create if not). Use `pytest` + `httpx.AsyncClient`. Mock Azure Tables via the in-memory fallback already in each `voice_*_db.py` service. **TDD** — failing test before implementation per task. Frontend has no test framework today; do not add one in this plan unless trivially appropriate (e.g., one Vitest smoke test in Phase 4).
- **Logging:** Use `logging.getLogger(__name__)` consistent with the existing codebase. **Never log** `display_name`, transcripts, or audio bytes. Always log `recording_id` and the resident's `profile_id` (UUID).
- **Framing rule (HARD):** No disease names in code, copy, comments, log lines, alert summaries, narrative-LLM prompts, or QI-flag strings. There is a Phase 3 unit test that asserts a forbidden-words list is absent from generated text.
- **Time:** UTC ISO 8601 strings in the data layer (consistent with existing); convert to `Australia/Sydney` only at the API boundary or in the frontend.
- **Commits:** one per task, conventional-commit style (`feat(voice):`, `fix(voice):`, `chore(voice):`, `test(voice):`).
- **Verification before completion:** after each task, run the listed verification command and confirm before marking the step done. No "I think it works."

---

# PHASE 1 — Backend rewrite (schema + endpoints; existing features retained)

**Phase goal:** Restructure the voice backend onto the new vocabulary (Resident → RecordingLink → Recording → Features → Score → Alert with dimension sub-scores) using the **existing** pure-Python feature extractor as a placeholder. Audio moves from filesystem `voice_uploads/` to Azure Blob `audio-recordings` container. The 4-stage prompt script replaces the current 3 prompts. The disease-naming bug in `_try_llm_narrative` and `qi-flags` is fixed.

**Phase 1 exit criteria:**

1. `python -m uvicorn app.main:app --reload --port 8000` boots clean.
2. `pytest Backend/tests/voice/` passes (≥20 tests).
3. New endpoints respond:
   - `POST /api/voice/links` (nurse) — unchanged contract, internally creates a 1-day-valid token (per spec) instead of 168 h.
   - `GET /api/voice/r/{token}` (public) — returns `{resident_display_name, language, script_version, valid_for_date, stages}` per spec §7.1.
   - `POST /api/voice/upload` — multipart with `token`, `audio` (audio/webm), `stage_offsets` JSON, `context_flags` JSON, `client_meta` JSON; rejects 400 if `noise_suppression!=false` or `auto_gain_control!=false`; rejects 400 if any of the 4 stages is missing in `stage_offsets`; 410 if token already used; 202 with `recording_id` on success.
   - `POST /api/voice/n/residents/{id}/lock-baseline` — stub that returns `{baseline_locked: false, recordings_have: N, recordings_need: 10}` (real fit lands in Phase 3).
   - `GET /api/voice/n/residents/{id}/scores?days=60` — time series of `concern_score` + 5 sub-scores (Phase 1 returns the existing `alert_level` mapped to a placeholder concern_score 0/40/80 for green/amber/red).
4. Audio is uploaded to `audio-recordings` blob container under `{resident_id}/{recording_id}.webm`. Local dev uses Azurite or the existing in-memory fallback.
5. `_try_llm_narrative` and `qi-flags` no longer contain forbidden disease words; a unit test enforces this.

---

## Phase 1 Task Breakdown

### Task 1.1: Forbidden-words audit + framing rule test

**Files:**
- Create: `Backend/tests/__init__.py`, `Backend/tests/voice/__init__.py`, `Backend/tests/conftest.py`
- Create: `Backend/tests/voice/test_framing.py`

- [ ] **Step 1: Failing test**

```python
# Backend/tests/voice/test_framing.py
"""Hard rule: no disease names anywhere in voice biomarker code or templates."""
from pathlib import Path
import re

FORBIDDEN = re.compile(
    r"\b(stroke|tia|dementia|alzheimer|parkinson|delirium|depress\w*|"
    r"dysphagia|psychosis|schizo\w*|bipolar|diagnos[ie]s|diagnose[ds]?)\b",
    re.IGNORECASE,
)

VOICE_FILES = [
    "app/api/voice.py",
    "app/services/voice_processor.py",
    "app/services/voice_analysis_db.py",
    "app/services/voice_link_db.py",
    "app/services/voice_profile_db.py",
    "app/services/voice_recording_db.py",
    "app/services/voice_seed.py",
]

def test_voice_module_has_no_disease_terms():
    backend = Path(__file__).resolve().parents[2]
    offenders = []
    for rel in VOICE_FILES:
        p = backend / rel
        if not p.exists():
            continue
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            # ignore lines explicitly marked as disclaimers
            if "FRAMING_OK" in line:
                continue
            if FORBIDDEN.search(line):
                offenders.append(f"{rel}:{i}: {line.strip()}")
    assert not offenders, "Forbidden disease terms found:\n" + "\n".join(offenders)
```

- [ ] **Step 2: Run, expect FAIL** with multiple offenders (the existing `_try_llm_narrative` prompt and `qi-flags` strings).

- [ ] **Step 3: Skip implementation** — the test is the artefact. Task 1.2 fixes the offenders.

- [ ] **Step 4: Commit**

```bash
git add Backend/tests
git commit -m "test(voice): assert no disease names in voice biomarker module"
```

---

### Task 1.2: Strip disease names from existing voice module

**Files:**
- Modify: `Backend/app/api/voice.py` — `_try_llm_narrative` prompt template, `get_qi_flags` flag strings
- Optionally: `Backend/app/services/voice_processor.py` if any narrative templates contain offenders

- [ ] **Step 1: Find every line the test from Task 1.1 flagged.** Run `pytest Backend/tests/voice/test_framing.py -v` and read the output.

- [ ] **Step 2: Rewrite the LLM prompt** in `_try_llm_narrative` to use dimension language. Example replacement for the offending block:

```python
prompt += """
Focus on: which voice dimensions (phonatory / articulatory / prosodic / respiratory / linguistic)
have shifted relative to baseline, the magnitude of the shift, and recommended next steps for the
nurse (e.g. clinical re-assessment, GP review, hydration check). Do NOT name any disease or
neurological condition. Frame everything as 'voice quality changes flagged for nurse review'.
End with: 'This is a trend monitoring tool, not a diagnostic device.' FRAMING_OK
"""
```

The `# FRAMING_OK` marker tells the test this disclaimer line is intentional.

- [ ] **Step 3: Rewrite `get_qi_flags` strings** — replace each disease-named flag with dimension-named one. Example:

```python
# OLD (offending):
"flag": "Acute voice changes suggesting stroke/TIA or delirium — clinical escalation recommended",
# NEW:
"flag": "Acute multi-dimensional voice shift — escalate to clinical review",
```

Apply consistently to all 5 flag types in `get_qi_flags`.

- [ ] **Step 4: Run framing test, expect PASS**

```bash
cd Backend && pytest tests/voice/test_framing.py -v
```

- [ ] **Step 5: Commit** — `fix(voice): remove disease names from narrative + QI flags`

---

### Task 1.3: New schema model — Pydantic types only

**Files:**
- Create: `Backend/app/api/voice_schemas.py`
- Create: `Backend/tests/voice/test_voice_schemas.py`

- [ ] **Step 1: Failing test for `StageOffsets` validator**

```python
# Backend/tests/voice/test_voice_schemas.py
import pytest
from pydantic import ValidationError
from app.api.voice_schemas import StageOffsets, ContextFlags, ClientMeta, UploadValidationError

def test_stage_offsets_requires_all_four_stages():
    with pytest.raises(ValidationError):
        StageOffsets.model_validate({"sustained_a": [0, 5], "ddk": [5, 10]})

def test_stage_offsets_accepts_valid_payload():
    s = StageOffsets.model_validate({
        "sustained_a": [0.0, 6.2],
        "ddk": [6.2, 11.4],
        "reading": [11.4, 18.0],
        "open_prompt": [18.0, 52.5],
    })
    assert s.sustained_a == (0.0, 6.2)

def test_client_meta_rejects_noise_suppression_true():
    with pytest.raises(ValidationError):
        ClientMeta.model_validate({
            "ua": "x", "sample_rate": 48000, "channels": 1,
            "echo_cancellation": True,
            "noise_suppression": True,  # MUST be False
            "auto_gain_control": False,
        })
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `voice_schemas.py`**

```python
"""Pydantic schemas for the redesigned voice biomarker contract."""
from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Annotated

REQUIRED_STAGES = ("sustained_a", "ddk", "reading", "open_prompt")

class UploadValidationError(Exception): ...

class StageOffsets(BaseModel):
    sustained_a: tuple[float, float]
    ddk: tuple[float, float]
    reading: tuple[float, float]
    open_prompt: tuple[float, float]

    @model_validator(mode="after")
    def _ranges_non_overlapping_and_increasing(self):
        for name in REQUIRED_STAGES:
            s, e = getattr(self, name)
            if not (0 <= s < e):
                raise ValueError(f"stage '{name}' has invalid offsets [{s}, {e}]")
        return self

class ContextFlags(BaseModel):
    cold: bool = False
    dentures_out: bool = False
    just_woke_up: bool = False
    pain: bool = False

class ClientMeta(BaseModel):
    ua: str
    sample_rate: int
    channels: int
    echo_cancellation: bool
    noise_suppression: bool
    auto_gain_control: bool

    @field_validator("noise_suppression")
    @classmethod
    def _ns_must_be_false(cls, v: bool) -> bool:
        if v: raise ValueError("noise_suppression must be false")
        return v

    @field_validator("auto_gain_control")
    @classmethod
    def _agc_must_be_false(cls, v: bool) -> bool:
        if v: raise ValueError("auto_gain_control must be false")
        return v

class LinkMetadata(BaseModel):
    resident_display_name: str
    language: str = "en-AU"
    script_version: str = "v1"
    valid_for_date: str  # ISO date
    stages: list[dict]   # see prompt-script constants

class UploadResponse(BaseModel):
    recording_id: str
    status: str
    snr_db: float | None = None
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** — `feat(voice): pydantic schemas for new upload contract`

---

### Task 1.4: 4-stage prompt script

**Files:**
- Create: `Backend/app/api/voice_prompts.py`
- Create: `Backend/tests/voice/test_voice_prompts.py`

- [ ] **Step 1: Failing test** — `get_script(version="v1")` returns a list of 4 stages in the order `sustained_a, ddk, reading, open_prompt` with each stage having `{id, type, text, target_duration_s}`. The total `target_duration_s` sums to ~75.

- [ ] **Step 2: Implement** — concrete prompts per spec §1 / §8 (the same 75-second battery: 6 s sustained /a/, 5 s pa-ta-ka, ~7 s reading, ~30 s open prompt). Include a `disclaimer` field on the script root: "*This is a trend monitoring tool, not a diagnostic device.*  # FRAMING_OK"

- [ ] **Step 3: Test, commit** — `feat(voice): 4-stage prompt script v1`

---

### Task 1.5: Extend `voice_link_db` with new link fields

**Files:**
- Modify: `Backend/app/services/voice_link_db.py`
- Create: `Backend/tests/voice/test_voice_link_db.py`

Spec §6 requires `valid_for_date` (one link per resident per date). The existing link only has `expires_at`. Add `valid_for_date`. **Do not break the existing `create_link` signature** — make `valid_for_date` optional and default to today's date in Australia/Sydney.

- [ ] **Step 1: Failing test** — `create_link(resident_id, facility_id, generated_by, valid_for_date="2026-05-06")` round-trips. `get_link_by_resident_and_date(resident_id, "2026-05-06")` returns the same link (idempotency lookup).

- [ ] **Step 2: Implement** — add `valid_for_date` to entity dict, add `get_link_by_resident_and_date` method scanning the existing partition.

- [ ] **Step 3: Test, commit** — `feat(voice): per-date recording links`

---

### Task 1.6: Blob audio storage helper

**Files:**
- Create: `Backend/app/services/voice_audio_blob.py`
- Create: `Backend/tests/voice/test_voice_audio_blob.py`

- [ ] **Step 1: Failing test** — when `AZURE_STORAGE_CONNECTION_STRING` is unset (CI default), helper transparently routes to an in-memory fallback dict. When set (and pointing to Azurite), it uploads + downloads bytes correctly.

- [ ] **Step 2: Implement**

```python
"""Audio blob storage with in-memory fallback (mirrors voice_recording_db pattern)."""
import os, logging
from app.core.config import settings

logger = logging.getLogger(__name__)
CONTAINER = "audio-recordings"
_in_memory: dict[str, bytes] = {}

def _client():
    conn = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if not conn:
        return None
    try:
        from azure.storage.blob import BlobServiceClient
        svc = BlobServiceClient.from_connection_string(conn)
        cc = svc.get_container_client(CONTAINER)
        if not cc.exists():
            cc.create_container()
        return cc
    except Exception as e:
        logger.warning("Audio blob client unavailable: %s", e)
        return None

def upload_audio(resident_id: str, recording_id: str, audio: bytes, content_type: str = "audio/webm") -> str:
    key = f"{resident_id}/{recording_id}.webm"
    cc = _client()
    if cc is not None:
        cc.upload_blob(key, audio, overwrite=True, content_type=content_type)
        return f"blob://{CONTAINER}/{key}"
    _in_memory[key] = audio
    return f"memory://{key}"

def download_audio(blob_uri: str) -> bytes | None:
    if blob_uri.startswith("memory://"):
        return _in_memory.get(blob_uri.removeprefix("memory://"))
    if blob_uri.startswith("blob://"):
        path = blob_uri.removeprefix(f"blob://{CONTAINER}/")
        cc = _client()
        if cc is None: return None
        try:
            return cc.download_blob(path).readall()
        except Exception as e:
            logger.warning("download_audio failed: %s", e); return None
    return None

def presigned_audio_url(blob_uri: str, minutes: int = 5) -> str | None:
    if not blob_uri.startswith("blob://"): return None
    from datetime import datetime, timedelta, timezone
    from azure.storage.blob import generate_blob_sas, BlobSasPermissions
    cc = _client()
    if cc is None: return None
    key = blob_uri.removeprefix(f"blob://{CONTAINER}/")
    sas = generate_blob_sas(
        account_name=cc.account_name, container_name=CONTAINER, blob_name=key,
        account_key=cc.credential.account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(minutes=minutes),
    )
    return f"{cc.url}/{key}?{sas}"
```

- [ ] **Step 3: Test, commit** — `feat(voice): blob audio storage helper`

---

### Task 1.7: Reshape `voice_recording_db` for new fields

**Files:**
- Modify: `Backend/app/services/voice_recording_db.py`

Add columns to the entity dict: `audio_blob_uri` (replaces `audio_file_path`), `stage_offsets` (JSON string), `context_flags` (JSON string), `client_meta` (JSON string), `snr_db`, `status` (`uploaded|processing|done|failed`).

- [ ] **Step 1: Failing test** — `create_recording(profile_id, ..., stage_offsets={...}, context_flags={...}, client_meta={...}, audio_blob_uri="...")` round-trips. `update_status(profile_id, recording_id, "done")` works as before.

- [ ] **Step 2: Implement** — JSON-encode dicts on the way into Azure Tables (since Tables doesn't store dicts), JSON-decode on read.

- [ ] **Step 3: Test, commit** — `feat(voice): recording entity carries stage offsets + context flags`

---

### Task 1.8: New `Score` and `Alert` data layers

**Files:**
- Create: `Backend/app/services/voice_score_db.py`
- Modify: `Backend/app/services/voice_analysis_db.py` — add `dimension`-based alert representation alongside the existing `alert_level`. Do **not** delete existing fields; they'll be migrated in Phase 3.

- [ ] **Step 1: Failing test** — `create_score(recording_id, profile_id, concern_score=0.0, subscores={"phonatory":0,...}, mahalanobis=None, iforest=None)` round-trips; `list_scores(profile_id, limit=60)` returns a chronologically descending list.

- [ ] **Step 2: Implement.** PartitionKey `f"score-{profile_id}"`, RowKey `recording_id`.

- [ ] **Step 3: Add `create_dim_alert` to `voice_analysis_db`** with fields `{alert_id, resident_id, profile_id, recording_id, severity, dimension, summary, created_at, ack_by, ack_at}`.

- [ ] **Step 4: Test, commit** — `feat(voice): score + dimension-tagged alert tables`

---

### Task 1.9: New router file `app/api/voice_v2.py` (parallel — incremental cutover)

To avoid a 1000-line breaking edit, build the new endpoints in a parallel module and mount alongside. After Phase 1 verifies, Phase 2 deletes the old `voice.py`.

**Files:**
- Create: `Backend/app/api/voice_v2.py`
- Modify: `Backend/app/main.py` — mount the new router at `/api/voice/v2/`

Endpoints in `voice_v2.py`:
- `GET /api/voice/v2/r/{token}` — link metadata (LinkMetadata schema)
- `POST /api/voice/v2/upload` — multipart upload with strict validation (Task 1.3 schemas)
- `POST /api/voice/v2/n/residents/{id}/issue-link` — idempotent per (resident_id, valid_for_date)
- `POST /api/voice/v2/n/residents/{id}/lock-baseline` — Phase 1 stub
- `GET /api/voice/v2/n/residents/{id}/scores?days=60` — placeholder time series
- `GET /api/voice/v2/n/alerts?status=open`
- `POST /api/voice/v2/n/alerts/{id}/ack`

- [ ] **Step 1: Failing tests** for each endpoint (one happy path, one validation error per endpoint where applicable).

- [ ] **Step 2: Implement.** The upload endpoint:

```python
@router.post("/upload", response_model=UploadResponse)
async def upload_v2(
    background_tasks: BackgroundTasks,
    token: str = Form(...),
    audio: UploadFile = File(...),
    stage_offsets: str = Form(...),
    context_flags: str = Form(...),
    client_meta: str = Form(...),
):
    # 1. Validate token + lookup resident
    link = voice_link_db.get_link(token)
    if not link or link.get("used"):
        raise HTTPException(410, "link unavailable")
    # 2. Parse + validate JSON form fields → 400 if any fail
    try:
        offsets = StageOffsets.model_validate_json(stage_offsets)
        flags = ContextFlags.model_validate_json(context_flags)
        meta = ClientMeta.model_validate_json(client_meta)
    except ValidationError as e:
        raise HTTPException(400, {"code": "VALIDATION", "errors": e.errors()})
    if meta.noise_suppression or meta.auto_gain_control:
        raise HTTPException(400, {"code": "AUDIO_CONSTRAINTS_VIOLATED"})
    # 3. Read audio bytes (5 MB cap)
    audio_bytes = await audio.read()
    if len(audio_bytes) > 5 * 1024 * 1024:
        raise HTTPException(413, "file too large")
    # 4. Upload to blob, insert recording row, mark link used
    profile = voice_profile_db.get_by_resident_id(link["resident_id"])
    if not profile:
        raise HTTPException(404, "resident profile missing")
    recording_id = str(uuid.uuid4())
    blob_uri = voice_audio_blob.upload_audio(link["resident_id"], recording_id, audio_bytes)
    voice_recording_db.create_recording(
        profile_id=profile["profile_id"],
        recording_id=recording_id,
        stage_offsets=offsets.model_dump(),
        context_flags=flags.model_dump(),
        client_meta=meta.model_dump(),
        audio_blob_uri=blob_uri,
        status="uploaded",
    )
    voice_link_db.mark_used(token)
    # 5. Enqueue background processing (Phase 1: still uses old extractor)
    background_tasks.add_task(_process_recording_v2, recording_id, profile["profile_id"], audio_bytes)
    return UploadResponse(recording_id=recording_id, status="queued")
```

`_process_recording_v2` in Phase 1 wraps the existing `extract_acoustic_features` call but writes a `Score` row with placeholder concern_score derived from `alert_level` (0/40/80 for green/amber/red). Phase 2 replaces the body.

- [ ] **Step 3: Test, commit** — `feat(voice): v2 router with upload + nurse endpoints`

---

### Task 1.10: Delete `voice_seed.py`, write fresh `voice_seed_v2.py`

The existing seed creates 3-prompt-style data. Replace.

**Files:**
- Delete: `Backend/app/services/voice_seed.py`
- Create: `Backend/app/services/voice_seed_v2.py`
- Modify: `Backend/app/main.py` if seed is invoked at startup

- [ ] **Step 1:** New seed creates 4 demo residents, each with 14 baseline recordings (synthetic — random feature dicts already in the fakeable shape Phase 3 will need). Resident #4 has 3 trailing "drift" recordings.

- [ ] **Step 2: Test, commit** — `feat(voice): v2 seed with synthetic baselines + drift demo`

---

### Task 1.11: Phase 1 smoke test (curl + assert)

**Files:**
- Create: `Backend/tests/voice/test_phase1_smoke.py`

End-to-end test using `httpx.AsyncClient` against the FastAPI app:
1. Login as seeded nurse, get JWT
2. `POST /api/voice/v2/n/residents/{id}/issue-link?date=2026-05-06`
3. Hit `GET /api/voice/v2/r/{token}` → 200 with stages
4. `POST /api/voice/v2/upload` with a fixture WAV + valid metadata → 202, recording_id
5. Wait briefly (BackgroundTasks runs in-test), poll `recording.status` → `done`
6. `GET /api/voice/v2/n/residents/{id}/scores` → at least one entry with placeholder concern_score
7. Repeat upload with `noise_suppression=true` → 400 `AUDIO_CONSTRAINTS_VIOLATED`
8. Repeat upload with reused token → 410

- [ ] **Step 1, 2, 3:** Write, test, commit — `test(voice): phase 1 smoke`

---

## Phase 1 Verification Checklist

- [ ] `pytest Backend/tests/voice/ -v` all green; ≥20 tests
- [ ] `python -m uvicorn app.main:app --reload --port 8000` boots without exception
- [ ] `curl localhost:8000/api/voice/v2/...` happy path works
- [ ] Forbidden-words test stays green
- [ ] No new pip dependency installed (Phase 2 adds them)
- [ ] **STOP. User approves Phase 2 explicitly before continuing.**

---

# PHASE 2 — Real feature extraction

**Phase goal:** Replace the pure-Python RMS extractor with the spec's pipeline: ffmpeg WebM→16k mono WAV → Silero VAD + SNR check → split-by-stage → openSMILE eGeMAPSv02 + Praat (jitter/shimmer/HNR/CPP/MPT) on `sustained_a`, custom DDK rate on `ddk`, eGeMAPS on `reading`, eGeMAPS + faster-whisper transcription + linguistic features on `open_prompt`. The OpenAI Whisper HTTP path is removed in favour of local faster-whisper.

**Phase 2 exit criteria:**

1. `requirements.txt` updated; `pip install -r requirements.txt` succeeds in a clean venv.
2. `ffmpeg` confirmed available on dev/prod hosts (document install in Backend/README.md).
3. New file `voice_processor_v2.py` produces a `features` dict per recording with the four sub-blocks (`egemaps`, `praat`, `ddk`, `linguistic`) and a `transcript` string.
4. Low-SNR fixture marks the recording `failed` with reason `low_snr`.
5. `_process_recording_v2` (created in Phase 1) now calls `voice_processor_v2.extract_all`. The placeholder concern_score logic stays (Phase 3 replaces it).
6. All Phase 1 tests still green; new feature-extractor tests pass against committed fixture WAVs.
7. `app/api/voice.py` (the old 1057-line router) is **deleted**. Old data services stay (they're shared by v2). The frontend keeps calling `/api/voice/...` for now — temporary route aliases redirect to `/api/voice/v2/...` (cleanup in Phase 4).

---

## Phase 2 Task Breakdown

### Task 2.1: requirements update + dev environment

**Files:**
- Modify: `Backend/requirements.txt`
- Modify: `Backend/README.md` — note ffmpeg system dep

- [ ] **Step 1:** Pin and add the exact lines under "Add to requirements.txt" in Cross-Phase Conventions. Run `pip install -r requirements.txt` in a fresh venv to confirm wheel coverage on Python 3.11 + Windows. If anything fails to install on Windows, document a workaround.

- [ ] **Step 2:** Add to `Backend/README.md` a "System dependencies" section: ffmpeg via `winget install Gyan.FFmpeg` (Windows) or `apt install ffmpeg` (Linux).

- [ ] **Step 3: Commit** — `chore(voice): add openSMILE/Praat/Whisper deps`

---

### Task 2.2: Audio transcode + VAD + SNR

**Files:**
- Create: `Backend/app/services/voice_audio.py` (transcode, vad, snr in one module — lighter than 3 files for this scope)
- Create: `Backend/tests/voice/test_voice_audio.py`
- Create: `Backend/tests/voice/fixtures/sustained_a_5s.wav`, `clean_voice_10s.wav`, `pataka_5s.wav`, `noisy_5s.wav`, `silence_5s.wav` (committed)

- [ ] **Step 1: Failing tests**:
  - `transcode_to_wav(webm_bytes)` returns bytes of a 16 kHz mono PCM s16le WAV
  - `compute_snr_db(clean) > 20`, `compute_snr_db(noisy) < 6`
  - `vad_segments(wav_array, sr)` returns non-empty list for `clean_voice_10s.wav`, empty list for `silence_5s.wav`

- [ ] **Step 2: Implement** with subprocess (`ffmpeg -y -i pipe:0 -ac 1 -ar 16000 -acodec pcm_s16le -f wav pipe:1`) and Silero VAD (lazy-loaded module-level singleton).

- [ ] **Step 3: Test, commit** — `feat(voice): transcode + VAD + SNR`

---

### Task 2.3: Stage splitting

**Files:**
- Modify: `Backend/app/services/voice_audio.py`
- Modify: `Backend/tests/voice/test_voice_audio.py`

- [ ] **Step 1: Failing test** — `split_stages(wav_array, sr, offsets)` returns dict of 4 numpy arrays whose lengths match the offsets within ±1 sample.

- [ ] **Step 2: Implement, test, commit** — `feat(voice): per-stage split`

---

### Task 2.4: openSMILE eGeMAPSv02 features

**Files:**
- Create: `Backend/app/services/voice_features_egemaps.py`
- Create: `Backend/tests/voice/test_voice_features_egemaps.py`

- [ ] **Step 1: Failing test** — `extract_egemaps(wav, sr=16000)` returns a dict with **88** keys, all finite (no NaN/Inf), `loudness_sma3_amean > 0` on `clean_voice_10s.wav`.

- [ ] **Step 2: Implement** with module-level lazy-cached `opensmile.Smile(eGeMAPSv02, Functionals)`. `np.nan_to_num` post-process; track `_nan_count`.

- [ ] **Step 3: Test, commit** — `feat(voice): eGeMAPSv02 88-feature extractor`

---

### Task 2.5: Praat features

**Files:**
- Create: `Backend/app/services/voice_features_praat.py`
- Create: `Backend/tests/voice/test_voice_features_praat.py`

- [ ] **Step 1: Failing test** — on `sustained_a_5s.wav`, `extract_praat` returns `{jitter_local, jitter_rap, jitter_ppq5, shimmer_local, shimmer_apq3, shimmer_apq5, hnr_mean, cpp, mpt}` with `hnr_mean > 5`, `cpp > 5`, `mpt >= 1.0`.

- [ ] **Step 2: Implement** with parselmouth. Wrap the whole extraction in try/except → return all-NaN dict + `_failed=True`.

- [ ] **Step 3: Test, commit** — `feat(voice): Praat jitter/shimmer/HNR/CPP/MPT`

---

### Task 2.6: DDK rate

**Files:**
- Create: `Backend/app/services/voice_features_ddk.py`
- Create: `Backend/tests/voice/test_voice_features_ddk.py`

- [ ] **Step 1: Failing test** — on `pataka_5s.wav` at ~5 syllables/sec, `extract_ddk(wav, sr)` returns `{ddk_rate_per_s, ddk_isi_cv}` with `4 <= ddk_rate_per_s <= 7` and `ddk_isi_cv < 0.5`.

- [ ] **Step 2: Implement** — `librosa.onset.onset_detect` → ISI series → mean and CV.

- [ ] **Step 3: Test, commit** — `feat(voice): DDK rate + regularity`

---

### Task 2.7: Local faster-whisper transcription

**Files:**
- Create: `Backend/app/services/voice_whisper.py`
- Create: `Backend/tests/voice/test_voice_whisper.py` (marked `@pytest.mark.slow`)

- [ ] **Step 1: Failing test (slow)** — `transcribe(wav, sr)` returns `{text, words}` where `words` is a non-empty list of dicts with `start, end, word`.

- [ ] **Step 2: Implement** — module-level lazy `WhisperModel("base.en", device="cpu", compute_type="int8")`. **Models live at `Backend/models/faster-whisper-base.en/`**; download script `scripts/download_voice_models.py` runs once per dev machine.

- [ ] **Step 3:** Add `Backend/scripts/download_voice_models.py` that downloads the model on first invocation. Add to README install step.

- [ ] **Step 4: Test, commit** — `feat(voice): local faster-whisper transcription`

---

### Task 2.8: Linguistic features from transcript

**Files:**
- Create: `Backend/app/services/voice_features_linguistic.py`
- Create: `Backend/tests/voice/test_voice_features_linguistic.py`

- [ ] **Step 1: Failing test** — given synthetic word list with known pauses + TTR, returns 9 keys per VOICE_BIOMARKER.md §8.1 within tolerance. If voiced duration < 5 s, returns `None` (per spec pitfall #5).

- [ ] **Step 2: Implement.** spaCy `en_core_web_sm` lazily loaded. Exact formulas from spec §8.1.

- [ ] **Step 3: Test, commit** — `feat(voice): linguistic features from Whisper transcript`

---

### Task 2.9: Pipeline orchestrator

**Files:**
- Create: `Backend/app/services/voice_processor_v2.py`
- Create: `Backend/tests/voice/test_voice_processor_v2.py`

- [ ] **Step 1: Failing test** — `extract_all(audio_bytes, stage_offsets, context_flags)` returns a dict with `{transcript, egemaps, praat, ddk, linguistic, snr_db, voiced_duration_s}` after running the full pipeline.

- [ ] **Step 2: Implement** following spec §8 steps 1-7 (skip step 7 WavLM — not in scope per Adaptations).

- [ ] **Step 3: Test, commit** — `feat(voice): pipeline orchestrator`

---

### Task 2.10: Wire pipeline into background task; delete old `voice.py` + `voice_processor.py`

**Files:**
- Modify: `Backend/app/api/voice_v2.py` — `_process_recording_v2` now calls `voice_processor_v2.extract_all`
- Delete: `Backend/app/api/voice.py`
- Delete: `Backend/app/services/voice_processor.py`
- Modify: `Backend/app/main.py` — remove old voice router; add temporary route aliases that forward `/api/voice/*` to `/api/voice/v2/*` so the (about-to-be-rewritten) frontend keeps working until Phase 4

- [ ] **Step 1: Failing test** — upload happy path produces a `Features` row populated with non-trivial eGeMAPS+Praat+linguistic data. Low-SNR upload marks recording failed.

- [ ] **Step 2: Implement.** New features go into a new `voice_features_db.py` (similar PartitionKey/RowKey shape to existing tables) — let's call its table `voicefeatures`.

- [ ] **Step 3:** Old route aliases — see if simpler is just leaving the legacy endpoints with redirects:

```python
# main.py
@app.api_route("/api/voice/{path:path}", methods=["GET","POST","PUT","DELETE"], include_in_schema=False)
async def _voice_legacy_alias(path: str, request: Request):
    return RedirectResponse(url=f"/api/voice/v2/{path}", status_code=307)
```

- [ ] **Step 4: Run all tests; old tests that touched `voice.py` directly will fail.** Update them to hit `/api/voice/v2/*` or delete if obsolete.

- [ ] **Step 5: Commit** — `feat(voice): real pipeline + delete legacy voice.py`

---

## Phase 2 Verification Checklist

- [ ] `pip install -r requirements.txt` clean in a fresh venv
- [ ] `pytest Backend/tests/voice/ -v` all green; ≥35 tests including ≥10 new feature-extractor tests
- [ ] Manual: `POST /api/voice/v2/upload` with a real fixture WAV → status flips to `done` within ~10 s; `voicefeatures` row populated
- [ ] Old `voice.py` deleted; framing test still green
- [ ] **STOP. User approves Phase 3 explicitly.**

---

# PHASE 3 — Scoring + alerts

**Phase goal:** Real per-resident baselines, real concern scores + dimension sub-scores, conservative 2-of-3 alert rule, ruptures CPD scheduled, cold-day suppression, and full nurse endpoints with real data.

**Phase 3 exit criteria:**

1. `POST /api/voice/v2/n/residents/{id}/lock-baseline` — when ≥10 features rows exist, fits PCA(32) + MinCovDet + IsolationForest, persists bundle to Azure Blob `model-artifacts/residents/{profile_id}/baseline_v1.joblib`, sets `baseline_locked_at` on the profile.
2. `_process_recording_v2` after Phase 3: extract features → score against latest baseline → write `Score` row → evaluate alert rules → write `Alert` rows.
3. Synthetic drift fixture (rebuilt in `voice_seed_v2.py` in Phase 1, refined here) triggers `severity="watch"` then `severity="review"` over 3 consecutive days.
4. `context_flags.cold=true` on **all** qualifying days suppresses the alert with a logged reason and **no alert row is written**.
5. ruptures CPD runs nightly via a startup-scheduled asyncio task (24 h cadence); manually invoking `run_changepoint_scan_for_facility(...)` produces a `review` alert on the drift resident.
6. Forbidden-words test still green (any new alert templates included).
7. All `/api/voice/v2/n/*` endpoints from Phase 1 now return real data.

---

## Phase 3 Task Breakdown

### Task 3.1: Build full feature vector + dimension mapping

**Files:**
- Create: `Backend/app/services/voice_score_vector.py` — defines `FEATURE_NAMES` (ordered list of all keys we score on, ~106), `FEATURES_BY_DIM` mapping dimension → list of feature names
- Create: `Backend/tests/voice/test_voice_score_vector.py`

- [ ] **Step 1: Failing test** — `build_full_vector(features_dict)` returns a 1-D `np.ndarray` of length `len(FEATURE_NAMES)`; missing values → 0; non-finite → 0.

- [ ] **Step 2:** `FEATURES_BY_DIM` covers all 5 dimensions; every key appears in exactly one dimension.

- [ ] **Step 3: Test, commit** — `feat(voice): score vector + dimension mapping`

---

### Task 3.2: Baseline fit + persist to Blob

**Files:**
- Create: `Backend/app/services/voice_baseline.py`
- Create: `Backend/tests/voice/test_voice_baseline.py`

- [ ] **Step 1: Failing test** — given 12 synthetic feature dicts, `fit_baseline(feats_list)` returns a bundle dict `{pca, mcd, iforest, robust_stats, version, feature_names}`. `pca.n_components_ == 32`. `save_baseline + load_baseline` round-trips through Blob (or in-memory fallback).

- [ ] **Step 2: Implement.** Bundle persisted via `joblib` to `model-artifacts/residents/{profile_id}/baseline_v{n}.joblib`. LRU cache of size 64 in-process.

- [ ] **Step 3: Test, commit** — `feat(voice): per-resident baseline fit + persist`

---

### Task 3.3: `lock-baseline` endpoint — real implementation

**Files:**
- Modify: `Backend/app/api/voice_v2.py`
- Create: `Backend/tests/voice/test_lock_baseline.py`

- [ ] **Step 1: Failing test** — < 10 recordings → 409. Exactly 10 → 200, profile flagged `baseline_locked_at` (UTC), `baseline_version=1`, `baseline_blob_uri` set.

- [ ] **Step 2: Implement, test, commit** — `feat(voice): real lock-baseline`

---

### Task 3.4: Score every new recording

**Files:**
- Create: `Backend/app/services/voice_score.py`
- Create: `Backend/tests/voice/test_voice_score.py`
- Modify: `Backend/app/api/voice_v2.py` — `_process_recording_v2` now scores

- [ ] **Step 1: Failing test** — `score_recording(features, baseline)` returns `{concern_score, mahalanobis, iforest, subscores, feature_deltas}`. Near-baseline → `concern_score < 30`. 5-MAD-shifted phonatory features → `subscores["phonatory"] > 70`.

- [ ] **Step 2: Implement** per spec §8.2 (with the WavLM term dropped).

- [ ] **Step 3: Wire into `_process_recording_v2`.** If profile has no baseline yet → skip scoring (write `Score` with concern_score=0 to maintain time series).

- [ ] **Step 4: Test, commit** — `feat(voice): per-recording scoring`

---

### Task 3.5: EWMA per-feature drift

**Files:**
- Create: `Backend/app/services/voice_ewma.py`
- Create: `Backend/tests/voice/test_voice_ewma.py`

- [ ] **Step 1, 2, 3:** Per spec §8.2 / §8.3. Test, commit — `feat(voice): EWMA drift`

---

### Task 3.6: Alert rules + cold suppression

**Files:**
- Create: `Backend/app/services/voice_alerts.py`
- Create: `Backend/tests/voice/test_voice_alerts.py`

- [ ] **Step 1: Failing tests:**
  - watch rule: 2-of-3 days with sub-score > 70 → exactly one `severity=watch` alert
  - review rule (a): concern_score > 80 on 2 of last 3 days → `severity=review`
  - review rule (b): ruptures Pelt CPD on a sub-score series → `severity=review`
  - cold suppression: when `context_flags.cold=true` on all qualifying days, no alert is written
  - alert summary contains no forbidden words

- [ ] **Step 2: Implement** with templates from spec §8.3, dimension-named only.

- [ ] **Step 3: Wire into `_process_recording_v2`** after scoring.

- [ ] **Step 4: Test, commit** — `feat(voice): conservative dimension-tagged alerts`

---

### Task 3.7: ruptures CPD nightly

**Files:**
- Create: `Backend/app/services/voice_changepoint.py`
- Modify: `Backend/app/main.py` — `@app.on_event("startup")` schedules `asyncio.create_task(_cpd_loop())` that runs every 24 h
- Create: `Backend/tests/voice/test_voice_changepoint.py`

- [ ] **Step 1: Failing test** — `run_changepoint_scan_for_facility(facility_id)` on a drifting resident produces a `review` alert with reason `changepoint_detected`.

- [ ] **Step 2: Implement** — `ruptures.Pelt(model="rbf").fit(series).predict(pen=...)`. Permutation test for p-value with `n_permutations=200`.

- [ ] **Step 3: Loop:** `_cpd_loop` wakes every 24 h via `asyncio.sleep(86400)`. Document that this runs only while at least one uvicorn worker is up — if backend host scales to zero, this is missed; the spec's arq.cron equivalent is unavailable in this stack and that's acceptable for the MVP.

- [ ] **Step 4: Test, commit** — `feat(voice): nightly ruptures CPD scan`

---

### Task 3.8: Real `/scores`, `/alerts`, `/audio` endpoints

**Files:**
- Modify: `Backend/app/api/voice_v2.py`
- Create: `Backend/tests/voice/test_v2_nurse_endpoints.py`

Endpoints to finalise:
- `GET /api/voice/v2/n/residents/{id}/scores?days=60` — real time series
- `GET /api/voice/v2/n/residents/{id}/recordings/{rid}/audio` — presigned URL via `voice_audio_blob.presigned_audio_url`; falls back to direct streaming for in-memory blobs
- `GET /api/voice/v2/n/alerts?status=open|all` (paginated)
- `POST /api/voice/v2/n/alerts/{id}/ack`
- `GET /api/voice/v2/n/residents` — list with last 5 scores + latest alert per resident

- [ ] **Step 1: Failing tests** (one happy path each), step 2 implement, step 3 commit — `feat(voice): nurse dashboard endpoint set`

---

### Task 3.9: Demo drift recording

**Files:**
- Modify: `Backend/app/services/voice_seed_v2.py`

- [ ] **Step 1:** Resident #4 has 20 baseline recordings, then 5 progressively drifting recordings on phonatory + prosodic dimensions; running the seed against a clean DB and then `lock-baseline` on resident #4 followed by appending the drift recordings produces (at least) one `severity=review` alert.

- [ ] **Step 2:** Manual integration check; commit — `chore(voice): demo drift seed for Phase 3`

---

## Phase 3 Verification Checklist

- [ ] All Phase 1 + Phase 2 tests still green
- [ ] All Phase 3 tests green (≥30 new)
- [ ] `pytest Backend/tests/voice/test_framing.py` — still green
- [ ] Manual: seed v2 → lock-baseline on resident #4 → simulate drift → `GET /api/voice/v2/n/alerts?status=open` shows a `review` alert with disease-name-free summary
- [ ] **STOP. User approves Phase 4 explicitly.**

---

# PHASE 4 — Frontend tab rewrite

**Phase goal:** Replace the existing `VoiceDashboardPage`, `VoiceRecordPage`, `ResidentPortalPage`, and the 3 `components/voice/*.jsx` files with a redesigned IA aligned to the new backend. Nav label keeps "Voice Screening" — route stays `/voice/dashboard` — but inner UX matches the new model: per-resident sub-score sparklines, dimension-coloured chart palette, the 4-stage recording widget on the resident page, alerts feed shows `dimension` and `severity` instead of green/amber/red, audio preview via presigned URL.

**Phase 4 exit criteria:**

1. `npm run dev` clean in `Frontend/`. UI loads at `http://localhost:5173/voice/dashboard`.
2. Nurse can: see all residents (table), open a resident detail with the 5 sub-score sparklines + concern_score line + alerts feed, ack alerts, lock baseline once a resident has 10+ recordings, issue a daily link, copy/email it.
3. Resident link page (`/voice/record/{token}`): renders the 4-stage script with live timer per stage, captures audio with `noiseSuppression:false` + `autoGainControl:false` constraints, posts to `/api/voice/v2/upload`, shows success state.
4. All API calls go through `services/voiceApi.js` (rewritten); no legacy `/api/voice/links` etc. — only `/api/voice/v2/*`.
5. Tailwind palette respects existing tokens (`var(--ink-900)`, `STATUS.bad/warn/good`, the orange `#ff7b00` primary). No purple. Dimension colours: phonatory=teal, articulatory=blue, prosodic=amber, respiratory=violet, linguistic=green — all picked from the existing `chartTokens` palette where possible.
6. Manual browser check: full flow works end-to-end. Screenshots in `Caredata-Visualization-Azure/Frontend/docs/voice-screens/` for handoff.
7. Old voice frontend files deleted; legacy alias routes in `main.py` removed.

---

## Phase 4 Task Breakdown

### Task 4.1: New API client

**Files:**
- Create: `Frontend/src/services/voiceApiV2.js`
- Modify: `Frontend/src/services/voiceApi.js` — re-export from V2 for any consumers that still import the old name (then delete in Task 4.6)

Endpoints to wrap:
- `getLinkMeta(token)` — public
- `nurseLogin(...)` — already exists; reuse
- `issueLink(residentId, date)`
- `lockBaseline(residentId)`
- `listResidents()`
- `getScores(residentId, days)`
- `listAlerts(status)`
- `ackAlert(alertId)`
- `getAudioUrl(residentId, recordingId)` — returns presigned URL
- `uploadRecording(token, audioBlob, stageOffsets, contextFlags, clientMeta)` — multipart

- [ ] **Step 1, 2, 3:** Write, manually test against running backend, commit — `feat(voice/web): v2 api client`

---

### Task 4.2: Recording widget — 4-stage capture

**Files:**
- Replace: `Frontend/src/components/voice/RecordingWidget.jsx`

Single React component that:
1. Calls `getUserMedia({audio: {channelCount:1, echoCancellation:true, noiseSuppression:false, autoGainControl:false}})`
2. Renders the 4-stage script (props passed in from the page) with a live per-stage timer + progress bar
3. On finish, has the WebM blob + a `stageOffsets` dict + `contextFlags` toggle UI (cold/dentures_out/just_woke_up/pain) + `clientMeta` snapshot
4. POSTs via `uploadRecording`
5. Shows progress + success/failure UI

- [ ] **Step 1, 2, 3:** Write, browser-test, commit — `feat(voice/web): 4-stage recording widget`

---

### Task 4.3: Resident record page

**Files:**
- Replace: `Frontend/src/pages/VoiceRecordPage.jsx`

- [ ] **Step 1:** New page at `/voice/record/:token`:
  - On mount, calls `getLinkMeta(token)`. If 410, shows "Link expired" state.
  - If valid + resident has no account, prompt to register (existing flow). Else proceed.
  - Renders `<RecordingWidget script={data.stages} onSubmit={...} />`.
  - On success, shows "Thank you, {display_name}" + tomorrow's reminder.

- [ ] **Step 2, 3:** Browser-test, commit — `feat(voice/web): resident record page redesign`

---

### Task 4.4: Nurse dashboard rewrite — list view

**Files:**
- Replace: `Frontend/src/pages/VoiceDashboardPage.jsx`
- Replace: `Frontend/src/components/voice/ResidentVoiceCard.jsx` → new `ResidentRow.jsx` (table row, not card)

Layout:
- Header: facility summary (active alerts by severity); `Issue daily links` button
- Searchable, sortable table of residents: name, last recording, concern score (chip), sub-score chips, alerts (count by severity), actions (issue link, view detail, ack-all)
- Side drawer (or modal) opens for resident detail (Task 4.5)

- [ ] **Step 1, 2, 3:** Write, browser-test, commit — `feat(voice/web): nurse dashboard list rewrite`

---

### Task 4.5: Nurse dashboard — resident detail panel

**Files:**
- Create: `Frontend/src/components/voice/ResidentDetailPanel.jsx`

Components inside the panel:
- Concern score line chart (Recharts `LineChart`) — last 60 days
- 5 sub-score sparklines (small `LineChart` per dimension), dimension-coloured
- Recent alerts list (with ack button)
- Recent recordings list with playback (`<audio>` tag using presigned URL)
- "Lock baseline" button (disabled until 10 recordings)

- [ ] **Step 1, 2, 3:** Write, browser-test, commit — `feat(voice/web): resident detail panel`

---

### Task 4.6: Alerts feed redesign + cleanup

**Files:**
- Replace: `Frontend/src/components/voice/VoiceAlertsFeed.jsx`
- Delete: `Frontend/src/pages/ResidentPortalPage.jsx` if no longer routed (decide based on App.jsx)
- Modify: `Frontend/src/App.jsx` — remove dead routes; ensure `/voice/dashboard`, `/voice/record/:token`, `/voice/r/:token` (alias) are wired
- Delete: `Frontend/src/services/voiceApi.js` (replaced by V2)
- Modify: `Backend/app/main.py` — remove the legacy `/api/voice/{path}` redirect alias added in Phase 2

- [ ] **Step 1, 2, 3:** Write, full-app browser-test, commit — `feat(voice/web): alerts feed + legacy cleanup`

---

### Task 4.7: Smoke screenshot + spec update

**Files:**
- Create: `Caredata-Visualization-Azure/Frontend/docs/voice-screens/dashboard.png`, `record.png`, `detail.png`
- Modify: `repo:VOICE_BIOMARKER.md` — add a "Project status" footer linking to this plan and noting the WavLM/Postgres/arq adaptations
- Modify: `repo:CLAUDE.md` — note "Voice biomarker tab redesigned per docs/superpowers/plans/2026-05-05-voice-vital-backend.md"

- [ ] **Step 1:** Take screenshots in a browser at 1440×900.

- [ ] **Step 2: Commit** — `docs(voice): screenshots + spec status footer`

---

## Phase 4 Verification Checklist

- [ ] `npm run dev` clean
- [ ] `python -m uvicorn app.main:app --port 8000` clean
- [ ] Manual flow in Chrome:
  - login as seeded nurse
  - issue link for resident #1
  - open `/voice/record/{token}` in incognito; record full battery; submit
  - back in nurse dashboard, refresh; see new recording in resident #1's history
  - lock-baseline on resident #4 (the drift demo); see `review` alert appear
  - ack the alert; verify it leaves the open feed
- [ ] No purple, no emojis, no disease names, framing test still green
- [ ] All old voice files deleted; `git status` shows the deletions explicitly
- [ ] **DONE.**

---

# Execution Approach

This plan is one big feature replacement. **Execute one phase at a time via `/autopilot`. Ask the user for explicit permission between phases.**

**Per-phase autopilot dispatch instructions** — at start of each phase, run:

```
Execute PHASE <N> of docs/superpowers/plans/2026-05-05-voice-vital-backend.md.

Working directory: Caredata-Visualization-Azure/ at repo root.
Source spec: VOICE_BIOMARKER.md at repo root — adapt, do not copy verbatim.

Constraints:
- Do not modify Front-End/, Back-End/, Demo-Source-Code/, voice-vital-backend/.
- Honour the Adaptations table in the plan (no Postgres, no arq, no WavLM, no Container Apps).
- Honour the framing rule (no disease names anywhere).
- Follow Cross-Phase Conventions in the plan exactly (TDD, logging PII rules, commit cadence).
- After each task, run the listed verification command and confirm output before moving on.
- At end of phase, run the Phase Verification Checklist and report PASS/FAIL per item.
- Do NOT start the next phase. Stop, surface results, await user approval.
```

The user will approve each phase explicitly before the next begins.
