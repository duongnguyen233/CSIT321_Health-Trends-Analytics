# CLAUDE.md

> This file is the source of truth for the **Voice Vital backend**. Read it end-to-end before writing code. When you make a non-trivial decision, update this file in the same PR.

---

## 1. Project context (read first)

**Voice Vital** is a voice-memo health monitoring backend for aged-care facilities. A registered nurse (RN) issues a per-resident link. The resident records a short daily "voice vital" battery in the browser. The backend extracts acoustic + linguistic features, scores deviation from that resident's personal baseline, and surfaces a concern score + sub-scores to the nurse dashboard.

**Hard product framing — never violate this in code, copy, or logs:**

- The system is a **trend monitoring tool**. It does **not** diagnose, screen, or predict any disease.
- All user-facing strings say things like *"unusual relative to baseline"*, *"flagged for nurse review"*, *"voice quality sub-score"*. Never *"detected stroke"*, *"signs of dementia"*, *"depressed"*.
- Alert objects in the DB carry a `dimension` (phonatory / articulatory / prosodic / respiratory / linguistic), never a disease label.
- This framing is what keeps us out of TGA SaMD scope. Do not regress it.

**Scope of this document:** backend services and AI pipeline. Frontend exists already; this file only specifies the contract the frontend depends on (§7).

---

## 2. Architecture at a glance

```
                 ┌─────────────────────────┐
[browser] ──────▶│  FastAPI (Uvicorn)      │
   WebM/Opus     │  - /api/r/{token}       │
   + stage       │  - /api/upload          │
   markers       │  - /api/n/* (nurse)     │
                 └──────────┬──────────────┘
                            │
                  enqueue   ▼
                 ┌─────────────────────────┐
                 │  Worker (arq + Redis)   │
                 │  process_recording(id)  │
                 └──────────┬──────────────┘
                            │
        ┌───────────────────┼───────────────────┬─────────────────┐
        ▼                   ▼                   ▼                 ▼
   ffmpeg →           openSMILE +          faster-whisper      WavLM-base
   16k mono WAV       Parselmouth          (transcript +       (mean+SD pooled
   + Silero VAD       (eGeMAPS + Praat)    linguistic feats)   embedding)
        │                   │                   │                 │
        └────────┬──────────┴─────────┬─────────┴────────┬───────┘
                 ▼                    ▼                  ▼
          Postgres `features`  ──▶  scoring step  ──▶  `scores`, `alerts`
                                    (Mahalanobis, IsolationForest,
                                     EWMA per feature, ruptures CPD)

Audio bytes  →  Azure Blob (audio-recordings)
Per-resident scikit-learn models  →  Azure Blob (model-artifacts) + cached on disk
Secrets  →  Azure Key Vault, surfaced as env vars
```

**Two processes**, one image:

- **`api`** — FastAPI/Uvicorn, only does upload-accept, DB reads, and JSON. No model inference on the request thread.
- **`worker`** — arq worker process, owns model singletons, runs the full extraction pipeline. Same Docker image, different `CMD`.

This split is deliberate: model singletons take 30–60 s and ~1.5 GB RAM to warm up; you do not want the API process touching them.

---

## 3. Tech stack (locked versions)

| Layer | Choice | Version | Why |
|---|---|---|---|
| Runtime | Python | 3.11 | Best wheel coverage for `opensmile`, `parselmouth`, `ctranslate2` as of 2026 |
| Web | FastAPI + Uvicorn | fastapi 0.115+, uvicorn 0.32+ | Standard |
| Async worker | `arq` | 0.26+ | Lighter than Celery, Redis-backed, async-native |
| ORM | SQLAlchemy 2.0 + `sqlmodel` | sqlmodel 0.0.22+ | Type-safe schema |
| DB | PostgreSQL | 16 | JSONB for feature blobs, `pgvector` extension for embeddings (optional) |
| Migrations | Alembic | 1.13+ | |
| Audio I/O | `ffmpeg` (system), `soundfile`, `librosa` | librosa 0.10+ | ffmpeg is **system**-installed in the Docker image, not pip |
| VAD | `silero-vad` | 5.1+ | ONNX, ~2 MB |
| Acoustic features | `opensmile` | 2.5+ | eGeMAPSv02, MIT licence |
| Praat features | `praat-parselmouth` | 0.4.4+ | Jitter, shimmer, HNR, CPP, MPT |
| ASR | `faster-whisper` | 1.0+ | CTranslate2 backend, INT8 |
| SSL embeddings | `transformers` + `optimum[onnxruntime]` | transformers 4.45+ | WavLM-base via ONNX |
| Sentence embeddings | `sentence-transformers` | 3.2+ | For semantic-coherence drift |
| NLP | `spaCy` + `en_core_web_sm` | spacy 3.7+ | POS tagging, idea-density proxy |
| ML | `scikit-learn` | 1.5+ | PCA, MinCovDet, IsolationForest |
| Change-point | `ruptures` | 1.1+ | Pelt CPD on weekly cron |
| Azure SDK | `azure-storage-blob`, `azure-identity`, `azure-keyvault-secrets` | latest | Managed identity preferred |
| Telemetry | `opentelemetry` + Azure Monitor exporter | latest | Optional but cheap |

**Pin everything in `pyproject.toml` with `uv`.** Do not use `pip install -r requirements.txt` in production builds; use `uv sync --frozen` for reproducible image builds.

---

## 4. Project structure

```
voice-vital-backend/
├── CLAUDE.md                       ← this file
├── pyproject.toml                  ← uv-managed deps
├── uv.lock
├── Dockerfile                      ← multi-stage; bakes models in
├── docker-compose.yml              ← local dev only (Postgres + Redis + app + worker)
├── alembic.ini
├── alembic/
│   └── versions/
├── scripts/
│   ├── download_models.py          ← run ONCE during image build
│   ├── seed_dev.py                 ← creates a demo nurse + resident
│   └── simulate_drift.py           ← creates a fake "drifting" resident for demo
├── infra/
│   ├── bicep/                      ← Azure infra-as-code (see §9)
│   └── github-actions/             ← deploy.yml
├── src/
│   └── voicevital/
│       ├── __init__.py
│       ├── config.py               ← pydantic-settings, reads env + Key Vault
│       ├── main.py                 ← FastAPI app factory
│       ├── worker.py               ← arq worker entrypoint
│       ├── db/
│       │   ├── models.py           ← SQLModel tables
│       │   ├── session.py
│       │   └── repo.py             ← thin repository functions
│       ├── api/
│       │   ├── deps.py             ← auth, db, settings
│       │   ├── routes_resident.py  ← /api/r/{token}
│       │   ├── routes_upload.py    ← /api/upload
│       │   ├── routes_nurse.py     ← /api/n/*
│       │   └── schemas.py
│       ├── audio/
│       │   ├── transcode.py        ← ffmpeg → 16k mono WAV
│       │   ├── vad.py              ← Silero VAD wrapper
│       │   ├── stages.py           ← split by stage timestamps
│       │   └── snr.py              ← reject low-SNR uploads
│       ├── features/
│       │   ├── egemaps.py          ← opensmile wrapper
│       │   ├── praat.py            ← parselmouth wrapper (CPP, MPT, jitter, shimmer)
│       │   ├── ddk.py              ← DDK rate + regularity (custom)
│       │   ├── linguistic.py       ← from Whisper transcript
│       │   └── pipeline.py         ← orchestrates per-stage extraction
│       ├── ml/
│       │   ├── singletons.py       ← lazy-loaded model singletons (see §6)
│       │   ├── wavlm.py            ← WavLM-base ONNX inference
│       │   ├── whisper.py          ← faster-whisper wrapper
│       │   ├── sbert.py            ← MiniLM wrapper
│       │   └── spacy_nlp.py
│       ├── scoring/
│       │   ├── baseline.py         ← fit PCA + MinCovDet + IsolationForest
│       │   ├── score.py            ← per-recording scoring
│       │   ├── ewma.py             ← per-feature drift
│       │   ├── changepoint.py      ← ruptures Pelt
│       │   ├── concern.py          ← combine into 0–100 score + sub-scores
│       │   └── persist.py          ← save/load resident models to Blob
│       ├── storage/
│       │   ├── blob.py             ← Azure Blob client (audio + model-artifacts)
│       │   └── paths.py            ← deterministic key naming
│       ├── tasks.py                ← arq task definitions
│       └── logging.py              ← structlog + OpenTelemetry
└── tests/
    ├── unit/
    ├── integration/                ← uses testcontainers for Postgres/Redis
    └── fixtures/audio/             ← 5 known-good 75 s recordings, committed
```

Test fixtures are committed (small WAVs of team members reading the script) — they are the regression suite.

---

## 5. Models — what needs setup, what doesn't, and where they live

This is the most important section for Azure deployment. Read carefully.

### 5.1 Models bundled with pip packages — zero setup

These ship inside the Python wheel; no download, no cache-warm step.

| Component | Package | What ships with it |
|---|---|---|
| eGeMAPSv02 functionals | `opensmile` | The 88-feature config XML + the openSMILE binary, embedded in the wheel |
| Praat features | `praat-parselmouth` | The full Praat C library compiled into the wheel |
| Silero VAD | `silero-vad` | The ~2 MB ONNX model file inside `site-packages/silero_vad/data/` |
| Change-point | `ruptures` | Pure Python |
| Anomaly detection | `scikit-learn` | Pure Python (numpy/scipy) |
| Audio loading | `librosa`, `soundfile` | Pure Python + libsndfile |

**Action required: nothing.** They work the moment `uv sync` finishes.

### 5.2 Models that require a one-time download — bake into the Docker image

These are too big to download at container start (cold start would be 2–5 minutes and would fail closed networks). They are downloaded **once at image build time** by `scripts/download_models.py` and committed to the image.

| Model | HF repo / source | Approx size | What we use it for |
|---|---|---|---|
| WavLM-base | `microsoft/wavlm-base` | ~360 MB (PyTorch) → ~95 MB after ONNX INT8 quantisation | Paralinguistic embeddings (mean+SD pooled, 1536-d) |
| faster-whisper base.en | `Systran/faster-whisper-base.en` | ~150 MB (CT2 INT8) | Open-prompt transcription + word timestamps |
| sentence-transformers MiniLM | `sentence-transformers/all-MiniLM-L6-v2` | ~80 MB | Semantic-coherence drift on transcripts |
| spaCy English small | `en_core_web_sm` | ~12 MB | POS tagging for idea-density proxy |

**Total baked into the image: ~340 MB after ONNX quantisation.** Acceptable.

`scripts/download_models.py` (sketch — do not skip the ONNX export step):

```python
# scripts/download_models.py
"""Run during Docker build. Idempotent. Writes to /opt/models/."""
from pathlib import Path
from huggingface_hub import snapshot_download
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoFeatureExtractor
from faster_whisper import download_model
import spacy.cli

MODELS_DIR = Path("/opt/models")
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# 1. WavLM-base → ONNX INT8
wavlm_dir = MODELS_DIR / "wavlm-base-onnx"
if not wavlm_dir.exists():
    AutoFeatureExtractor.from_pretrained("microsoft/wavlm-base").save_pretrained(wavlm_dir)
    ort_model = ORTModelForFeatureExtraction.from_pretrained(
        "microsoft/wavlm-base", export=True
    )
    ort_model.save_pretrained(wavlm_dir)
    # quantise to INT8
    from optimum.onnxruntime import ORTQuantizer
    from optimum.onnxruntime.configuration import AutoQuantizationConfig
    quantizer = ORTQuantizer.from_pretrained(wavlm_dir)
    qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)
    quantizer.quantize(save_dir=wavlm_dir, quantization_config=qconfig)

# 2. faster-whisper base.en
download_model("base.en", output_dir=str(MODELS_DIR / "faster-whisper-base.en"),
               cache_dir=None, local_files_only=False)

# 3. sentence-transformers MiniLM
snapshot_download(repo_id="sentence-transformers/all-MiniLM-L6-v2",
                  local_dir=str(MODELS_DIR / "all-MiniLM-L6-v2"))

# 4. spaCy
spacy.cli.download("en_core_web_sm")
```

In `Dockerfile`:

```dockerfile
# ---- model layer (cached separately so code changes don't re-download) ----
FROM python:3.11-slim AS models
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ffmpeg libsndfile1 build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY scripts/download_models.py /tmp/
RUN python /tmp/download_models.py

# ---- runtime ----
FROM python:3.11-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
COPY --from=models /opt/models /opt/models
COPY --from=models /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=models /usr/local/bin /usr/local/bin
WORKDIR /app
COPY src/ ./src/
ENV MODELS_DIR=/opt/models PYTHONPATH=/app/src
CMD ["uvicorn", "voicevital.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Why bake instead of download-on-start:** Azure Container Apps cold starts are billed by second; a 5-minute model download on every scale-from-zero is unacceptable and brittle on locked-down networks. Image size is a one-time CI cost.

**Why ONNX INT8 for WavLM:** ~3× faster than fp32 PyTorch on CPU, ~4× smaller on disk, accuracy loss negligible for embedding extraction (we only consume hidden states, not classification logits).

### 5.3 Models computed per-resident at runtime — store in Azure Blob

These do not exist until a resident has 10–14 enrolment recordings. They are produced by `scoring/baseline.py` when the nurse clicks "Lock baseline".

| Artefact | Type | Size | Lifetime |
|---|---|---|---|
| PCA (32 components) | `sklearn.decomposition.PCA` | ~50 KB | Per resident, refittable |
| MinCovDet (Mahalanobis) | `sklearn.covariance.MinCovDet` | ~10 KB | Per resident, refittable |
| IsolationForest | `sklearn.ensemble.IsolationForest` | ~200 KB | Per resident, refittable |
| Per-feature EWMA state | dict | ~5 KB | Per resident, updated per recording |
| Baseline statistics (median, MAD per feature) | dict | ~5 KB | Per resident |

**Storage choice: Azure Blob Storage, `model-artifacts` container, key pattern `residents/{resident_id}/baseline_v{n}.joblib`.** Versioned because we will refit.

```python
# src/voicevital/scoring/persist.py
import joblib, io
from voicevital.storage.blob import get_blob_client

def save_baseline(resident_id: str, version: int, bundle: dict) -> str:
    buf = io.BytesIO()
    joblib.dump(bundle, buf, compress=3)
    key = f"residents/{resident_id}/baseline_v{version}.joblib"
    bc = get_blob_client("model-artifacts", key)
    bc.upload_blob(buf.getvalue(), overwrite=True)
    return key

def load_baseline(resident_id: str, version: int) -> dict:
    key = f"residents/{resident_id}/baseline_v{version}.joblib"
    bc = get_blob_client("model-artifacts", key)
    return joblib.load(io.BytesIO(bc.download_blob().readall()))
```

We also keep an in-memory LRU cache of the last 64 loaded baselines on the worker, keyed by `(resident_id, version)`, to avoid round-tripping to Blob on every recording.

### 5.4 Decision tree — model-storage strategy on Azure

```
Is the model in a pip wheel?
  yes → ship with `uv sync`. Done. (§5.1)
  no  → Is it a third-party pretrained model that all residents share?
          yes → bake into Docker image at /opt/models (§5.2)
          no  → It is per-resident, computed at runtime
                → Azure Blob `model-artifacts` container (§5.3)
```

We **do not** use:

- Azure Files mounted into the container (slow, NFS quirks with mmap on numpy/torch — verified problematic in similar setups).
- Azure Container Registry "artifacts" feature for model weights (over-engineered for a capstone; only justifies itself when you have >10 GB of model weights changing weekly).
- Downloading from Hugging Face at container start (network reliability + cold-start time + HF rate limits).

### 5.5 Model singletons — load once per worker process

Models must be loaded **lazily on first use**, not at import time, so the API process never touches them and the worker boots quickly.

```python
# src/voicevital/ml/singletons.py
"""Lazy singletons. Each worker process gets one copy. Thread-safe via lock."""
from __future__ import annotations
import os, threading
from pathlib import Path
from functools import cache

_LOCK = threading.Lock()
MODELS_DIR = Path(os.environ["MODELS_DIR"])  # /opt/models in container

@cache
def wavlm():
    from voicevital.ml.wavlm import WavLMOnnx
    with _LOCK:
        return WavLMOnnx(MODELS_DIR / "wavlm-base-onnx")

@cache
def whisper():
    from faster_whisper import WhisperModel
    with _LOCK:
        return WhisperModel(
            str(MODELS_DIR / "faster-whisper-base.en"),
            device="cpu", compute_type="int8", cpu_threads=2, num_workers=1,
        )

@cache
def sbert():
    from sentence_transformers import SentenceTransformer
    with _LOCK:
        return SentenceTransformer(str(MODELS_DIR / "all-MiniLM-L6-v2"), device="cpu")

@cache
def nlp():
    import spacy
    with _LOCK:
        return spacy.load("en_core_web_sm")

@cache
def vad():
    from silero_vad import load_silero_vad
    with _LOCK:
        return load_silero_vad(onnx=True)

@cache
def opensmile_extractor():
    import opensmile
    return opensmile.Smile(
        feature_set=opensmile.FeatureSet.eGeMAPSv02,
        feature_level=opensmile.FeatureLevel.Functionals,
    )
```

Worker startup hook warms only what's needed:

```python
# src/voicevital/worker.py
async def startup(ctx):
    from voicevital.ml.singletons import wavlm, whisper, vad, opensmile_extractor
    wavlm(); whisper(); vad(); opensmile_extractor()
    ctx["ready"] = True
```

---

## 6. Database schema

Use SQLModel; one Alembic migration per schema change. Keys:

```python
# src/voicevital/db/models.py (sketch)
class Facility(SQLModel, table=True):
    id: UUID = Field(primary_key=True, default_factory=uuid4)
    name: str
    timezone: str = "Australia/Sydney"

class Nurse(SQLModel, table=True):
    id: UUID = Field(primary_key=True, default_factory=uuid4)
    facility_id: UUID = Field(foreign_key="facility.id")
    email: str = Field(unique=True, index=True)
    hashed_password: str

class Resident(SQLModel, table=True):
    id: UUID = Field(primary_key=True, default_factory=uuid4)
    facility_id: UUID = Field(foreign_key="facility.id")
    display_name: str          # NEVER full legal name in logs
    dob_year: int              # year only — minimise PII
    language: str = "en-AU"
    enrolment_started_at: datetime
    baseline_locked_at: Optional[datetime] = None
    baseline_version: int = 0
    baseline_blob_key: Optional[str] = None

class RecordingLink(SQLModel, table=True):
    token: str = Field(primary_key=True)         # 32-char URL-safe
    resident_id: UUID = Field(foreign_key="resident.id", index=True)
    valid_for_date: date                         # one link per resident per day
    used_at: Optional[datetime] = None
    expires_at: datetime

class Recording(SQLModel, table=True):
    id: UUID = Field(primary_key=True, default_factory=uuid4)
    resident_id: UUID = Field(foreign_key="resident.id", index=True)
    recorded_at: datetime
    audio_blob_key: str                          # blob://audio-recordings/...
    duration_s: float
    snr_db: Optional[float] = None
    stage_offsets: dict = Field(sa_column=Column(JSONB))   # {"sustained_a": [0.0, 6.2], ...}
    context_flags: dict = Field(sa_column=Column(JSONB))   # {"cold": true, "dentures_out": false}
    status: str = "uploaded"                     # uploaded|processing|done|failed

class Features(SQLModel, table=True):
    recording_id: UUID = Field(primary_key=True, foreign_key="recording.id")
    egemaps: dict = Field(sa_column=Column(JSONB))         # 88 functionals × 4 stages
    praat: dict = Field(sa_column=Column(JSONB))           # jitter/shimmer/HNR/CPP/MPT
    linguistic: dict = Field(sa_column=Column(JSONB))      # rate, pauses, TTR, idea density
    transcript: Optional[str] = None
    wavlm_embedding: bytes                                  # np.float32 array, 1536-d, raw
    extracted_at: datetime

class Score(SQLModel, table=True):
    recording_id: UUID = Field(primary_key=True, foreign_key="recording.id")
    mahalanobis: float
    iforest: float
    autoencoder: Optional[float] = None
    concern_score: float                          # 0–100
    subscores: dict = Field(sa_column=Column(JSONB))       # phonatory/articulatory/...
    feature_deltas: dict = Field(sa_column=Column(JSONB))  # for explanation tooltips
    scored_at: datetime

class Alert(SQLModel, table=True):
    id: UUID = Field(primary_key=True, default_factory=uuid4)
    resident_id: UUID = Field(foreign_key="resident.id", index=True)
    recording_id: UUID = Field(foreign_key="recording.id")
    severity: str                                # info|watch|review
    dimension: str                               # phonatory|articulatory|prosodic|respiratory|linguistic
    summary: str                                 # nurse-facing string, never disease-named
    created_at: datetime
    ack_by: Optional[UUID] = None
    ack_at: Optional[datetime] = None
```

**Indexes that matter:**

- `(resident_id, recorded_at DESC)` on `recording` — drives the dashboard sparklines.
- `(resident_id, created_at DESC)` on `alert`.
- Token lookup is a primary key — already fast.

**Audit/PII:** `display_name` is what nurses see; never log it. Use `resident_id` (UUID) in all log lines.

---

## 7. The contract with the existing frontend

The frontend already exists, so we lock the contract here and do not change it.

### 7.1 Recording link (issued by nurse)

```
GET /api/r/{token}
→ 200 { resident_display_name, language, script_version, valid_for_date }
→ 410 if already used or expired
```

### 7.2 Upload

```
POST /api/upload
Content-Type: multipart/form-data
Fields:
  token: string (the recording link token)
  audio: file (audio/webm; codecs=opus, single blob)
  stage_offsets: JSON string
      e.g. {"sustained_a":[0.0,6.2], "ddk":[6.2,11.4],
            "reading":[11.4,18.0], "open_prompt":[18.0,52.5]}
  context_flags: JSON string
      e.g. {"cold": false, "dentures_out": false,
            "just_woke_up": false, "pain": false}
  client_meta: JSON string
      e.g. {"ua": "...", "sample_rate": 48000, "channels": 1,
            "echo_cancellation": true, "noise_suppression": false,
            "auto_gain_control": false}

→ 202 { recording_id, status: "queued" }
→ 400 if SNR check fails or stage_offsets malformed (frontend should re-prompt)
→ 410 if token already used
```

The backend immediately:

1. Validates token, marks `used_at`.
2. Streams the file to Blob `audio-recordings/{resident_id}/{recording_id}.webm`.
3. Inserts `Recording` row with `status="uploaded"`.
4. Enqueues `process_recording(recording_id)` to arq.
5. Returns 202 with `recording_id`.

### 7.3 Frontend audio constraints (to be enforced in `getUserMedia`)

The frontend **must** pass these — verify in `client_meta` and reject otherwise:

```js
{ audio: {
    channelCount: 1,
    echoCancellation: true,    // OK
    noiseSuppression: false,   // MUST be false (corrupts jitter/shimmer/HNR)
    autoGainControl: false     // MUST be false (corrupts loudness)
}}
```

If `client_meta.noise_suppression !== false` or `client_meta.auto_gain_control !== false`, reject the upload with 400 and a `code: "AUDIO_CONSTRAINTS_VIOLATED"`.

### 7.4 Nurse endpoints

```
POST   /api/n/login                                    → JWT
GET    /api/n/residents                                → list with concern scores
GET    /api/n/residents/{id}                           → detail
POST   /api/n/residents/{id}/issue-link?date=YYYY-MM-DD
POST   /api/n/residents/{id}/lock-baseline             → fits PCA/MCD/IF, persists to Blob
GET    /api/n/residents/{id}/scores?days=60            → time series for charts
GET    /api/n/residents/{id}/recordings/{rid}/audio    → presigned blob URL, expires in 5 min
GET    /api/n/alerts?status=open
POST   /api/n/alerts/{id}/ack
```

Auth: JWT with 8-hour expiry; HS256 with secret from Key Vault. Nurses are the only authenticated users.

---

## 8. The processing pipeline (the part that has to be right)

`tasks.py:process_recording(recording_id)`:

1. **Load** `Recording` row, refuse if `status != "uploaded"`.
2. **Download** WebM from Blob to `/tmp/{recording_id}.webm`.
3. **Transcode** with ffmpeg subprocess to `/tmp/{recording_id}.wav` (16 kHz, mono, PCM s16le). Capture stderr; if exit != 0 mark `failed`.
4. **VAD** with Silero on the full WAV. Compute SNR_dB = 20·log10(RMS_voiced / RMS_silence). If SNR < 6 dB, mark `failed` with reason `low_snr` and return — frontend will re-prompt.
5. **Split into stages** using `stage_offsets`. Each stage becomes its own short numpy array.
6. **Per-stage feature extraction** (run sequentially in worker; each is fast enough):

   | Stage | Features extracted |
   |---|---|
   | `sustained_a` | Praat: jitter (local, RAP, PPQ5), shimmer (local, APQ3, APQ5), HNR mean, CPP, MPT (= duration of the longest voiced segment in this stage). eGeMAPS functionals on this segment. |
   | `ddk` | Custom: detect `pa`/`ta`/`ka` syllable onsets via energy peaks + spectral centroid, compute syllables/sec and inter-syllable interval coefficient of variation. |
   | `reading` | eGeMAPS functionals; Praat CPP; estimated reading rate (words from `whisper` on this segment / duration). |
   | `open_prompt` | eGeMAPS functionals; **faster-whisper** transcription with word timestamps; linguistic features (see §8.1). |

7. **Whole-recording embedding**: run **WavLM-base ONNX** on the full WAV (concatenation of stages). Mean+SD pool over the time axis → 1536-d vector. Store as raw float32 bytes in `features.wavlm_embedding`.
8. **Persist** all features to `features` row.
9. **Score** the recording (§8.2).
10. **Generate alerts** if thresholds crossed (§8.3).
11. Set `recording.status = "done"`.

### 8.1 Linguistic features from the open prompt

```python
def linguistic_from_whisper(transcript: str, words: list[Word], duration_s: float) -> dict:
    """words = list of (start, end, word) from faster-whisper."""
    n_words = len(words)
    pause_gaps = [w2.start - w1.end for w1, w2 in zip(words, words[1:]) if w2.start - w1.end > 0.25]
    n_filled = sum(1 for w in words if w.word.strip().lower() in {"uh", "um", "er", "ah", "hmm"})
    tokens = [w.word.strip(".,?!").lower() for w in words if w.word.strip()]
    ttr = len(set(tokens)) / max(len(tokens), 1)
    speech_rate = n_words / duration_s * 60                       # WPM
    articulation_rate = n_words / max(duration_s - sum(pause_gaps), 0.1) * 60
    pause_ratio = sum(pause_gaps) / duration_s if duration_s else 0.0

    # idea density via spaCy POS proxy: (verbs + adj + adv + prep + conj) / total
    doc = nlp()(transcript)
    content_pos = {"VERB", "ADJ", "ADV", "ADP", "CCONJ", "SCONJ"}
    idea_density = sum(1 for t in doc if t.pos_ in content_pos) / max(len(doc), 1)

    # semantic coherence: cosine to centroid of resident's prior 14 prompts (computed in scoring step)
    return {
        "speech_rate_wpm": speech_rate,
        "articulation_rate_wpm": articulation_rate,
        "pause_ratio": pause_ratio,
        "n_pauses": len(pause_gaps),
        "mean_pause_s": float(np.mean(pause_gaps)) if pause_gaps else 0.0,
        "n_filled_pauses": n_filled,
        "ttr": ttr,
        "idea_density": idea_density,
        "n_words": n_words,
    }
```

### 8.2 Scoring

If `resident.baseline_locked_at is None`, write a `Score` with `concern_score=0` and skip alert generation; this recording counts toward enrolment.

Otherwise:

```python
def score_recording(features: Features, baseline: dict) -> Score:
    x = build_full_vector(features)                  # ~1670-d concat
    z = baseline["pca"].transform(x[None, :])[0]     # 32-d

    m = baseline["mcd"].mahalanobis(z[None, :])[0]
    i = -baseline["iforest"].score_samples(z[None, :])[0]

    # per-feature deltas vs baseline median, in MADs (robust z-score)
    deltas = {}
    for fname, vmed, vmad in baseline["robust_stats"]:
        v = get_feature(features, fname)
        deltas[fname] = (v - vmed) / max(vmad, 1e-6)

    # sub-scores: max |robust z| across features mapped to that dimension
    subscores = {
        dim: float(np.tanh(max(abs(deltas[f]) for f in FEATURES_BY_DIM[dim]) / 3.0) * 100)
        for dim in DIMENSIONS
    }
    concern = float(np.tanh(0.5 * normalise_chi2(m, df=32) + 0.5 * sigmoid(i)) * 100)
    return Score(mahalanobis=m, iforest=i, concern_score=concern,
                 subscores=subscores, feature_deltas=deltas)
```

### 8.3 Alert generation rules

Alerts are deliberately conservative; nurses must trust this thing.

- **`severity="watch"`**: any sub-score > 70 today **and** ≥ 70 on at least 1 of the previous 2 days. (the "2-of-3 rule")
- **`severity="review"`**: concern_score > 80 today and on at least 2 of the previous 3 days, **or** `ruptures.Pelt` change-point detected in the last 14 days at p < 0.05 on any sub-score.
- **No alert** if `context_flags.cold` or `context_flags.just_woke_up` is true on **all** of the qualifying days — auto-suppress with a logged reason.
- Alert `summary` is templated and never names a disease:
  - `"Voice quality (phonatory) has been unusual for 2 of the last 3 recordings."`
  - `"Speech clarity (articulatory) showed a sustained shift starting around {date}."`

A nightly arq cron (`schedule_changepoint_scan`) reruns ruptures on every active resident, because change-points only appear in retrospect.

---

## 9. Azure deployment

### 9.1 Resources (provision via Bicep in `infra/bicep/`)

| Resource | SKU / tier | Notes |
|---|---|---|
| Resource Group | `rg-voicevital-{env}` | env ∈ {dev, prod} |
| Azure Container Registry | Basic | `acrvoicevital{env}` |
| Azure Container Apps environment | Consumption | `cae-voicevital-{env}` — single env, two apps inside |
| Container App `api` | 0.5 vCPU / 1 Gi, min 1 / max 3 replicas | HTTP ingress, `:8000` |
| Container App `worker` | 1.0 vCPU / 2 Gi, min 1 / max 5 replicas | No ingress; KEDA-scale on Redis queue length |
| Azure Database for PostgreSQL Flexible Server | Burstable B1ms, 32 GB | `pg-voicevital-{env}` — Postgres 16 |
| Azure Cache for Redis | Basic C0 (250 MB) | for arq queue |
| Storage Account | Standard LRS | `stvoicevital{env}` — two containers: `audio-recordings`, `model-artifacts` |
| Key Vault | Standard | `kv-voicevital-{env}` |
| Log Analytics Workspace | Pay-as-you-go | for Container Apps logs + App Insights |
| Application Insights | classic, linked to LAW | optional but cheap |

**Why Container Apps over App Service:** scale-to-zero on the worker (massive saving overnight when no recordings come in), KEDA queue scaling, and you get two services in one environment without paying for a second App Service plan.

**Why not AKS:** overkill for a capstone; Container Apps gives you 90% of AKS at 10% of the operational complexity.

### 9.2 Secrets and identity

- Container Apps use **system-assigned managed identity** to access Blob, Key Vault, and Postgres.
- Grant the API and Worker apps:
  - `Storage Blob Data Contributor` on the storage account.
  - `Key Vault Secrets User` on the Key Vault.
  - PostgreSQL: use Microsoft Entra (Azure AD) authentication; both apps' MIs are added as PostgreSQL users with read/write on the `voicevital` DB.
- No connection strings or passwords in env vars except Redis (Redis access key, stored in Key Vault and surfaced as a Container Apps secret reference).

### 9.3 Environment variables

Set via Container Apps `secrets` and `env`:

```
# from Key Vault (secretRef)
DATABASE_URL=postgresql+psycopg://...    # built at startup using MI token
REDIS_URL=rediss://:...@cache-voicevital.redis.cache.windows.net:6380
JWT_SECRET=...

# plain env
ENV=prod
MODELS_DIR=/opt/models
AZURE_STORAGE_ACCOUNT=stvoicevitalprod
BLOB_AUDIO_CONTAINER=audio-recordings
BLOB_MODEL_CONTAINER=model-artifacts
LOG_LEVEL=INFO
SENTRY_DSN=                         # optional
OTEL_EXPORTER_OTLP_ENDPOINT=        # optional
TZ=Australia/Sydney
```

Loaded via `pydantic-settings` in `config.py`. **Never read env vars elsewhere.**

### 9.4 Networking

- Container Apps internal VNet integration is **not required** for the capstone.
- Postgres firewall: allow Azure services + the team's home/uni IPs only. Disable public access in prod.
- Storage account: disable public blob access; all reads via SAS URLs generated by the API (5-minute expiry) for the nurse dashboard's audio playback.

### 9.5 CI/CD (GitHub Actions, `infra/github-actions/deploy.yml`)

1. On push to `main`:
   - `uv sync --frozen`
   - `pytest -x`
   - `docker build` (multi-stage; cache mount for the model layer keyed on `download_models.py` hash)
   - Push to ACR
   - `az containerapp update --image ...` for both `api` and `worker`
2. On push to `dev` branch: same, against the dev environment.
3. Alembic migrations run as a **separate job** between build and deploy (`alembic upgrade head` against the target DB using the GitHub Actions OIDC federated identity). Never run migrations from the API container at startup — that's how you brick a multi-replica deploy.

### 9.6 Cost estimate (rough, Australia East, 2026)

| Resource | Monthly AUD |
|---|---|
| Container Apps Consumption (with scale-to-zero overnight) | $30–60 |
| Postgres Flexible Server B1ms | ~$25 |
| Redis Basic C0 | ~$25 |
| Storage (hundreds of MB of audio per resident per year) | < $5 |
| ACR Basic | ~$8 |
| Log Analytics + App Insights | ~$5 (low traffic) |
| **Total** | **~$100–130 AUD/month** |

Acceptable for a capstone, defensible for a pilot.

---

## 10. Local development

`docker-compose.yml` brings up Postgres 16, Redis 7, the API, and the worker, all from the same image. Ports: api on `localhost:8000`, Postgres on `5432`, Redis on `6379`.

```bash
make dev             # docker compose up --build
make seed            # python scripts/seed_dev.py
make shell           # docker compose exec api python
make test            # docker compose exec api pytest
make migrate         # alembic revision --autogenerate -m "..."
make upgrade         # alembic upgrade head
```

For dev, models are baked the same way as prod — there is **no** "downloads-on-first-run" code path. If you change the list of models, rebuild the image; that's the whole pipeline.

For Azure access locally, use `az login` and the SDK will pick up the user credential via `DefaultAzureCredential`. Local Blob is faked with **Azurite** in compose, mapped to `/data` so audio files persist across `docker compose down`.

---

## 11. Implementation order (4 weeks)

This mirrors the build plan but is reframed as backend tasks.

### Week 1 — skeleton + recording flow

- Repo, `pyproject.toml`, Dockerfile (without models yet), docker-compose, Alembic init.
- DB schema (§6), first migration.
- `POST /api/upload`, `GET /api/r/{token}`, nurse login, `POST /api/n/residents/{id}/issue-link`.
- Blob client with Azurite locally; ffmpeg transcode in-process (synchronous, no worker yet).
- Smoke test: curl a WAV in, see a row in `recording`.

### Week 2 — the AI pipeline

- `scripts/download_models.py`. Build the "models" Docker stage. Verify image size < 1.5 GB.
- `ml/singletons.py` lazy loaders.
- `features/egemaps.py`, `features/praat.py`, `features/ddk.py`, `features/linguistic.py`.
- `ml/wavlm.py` ONNX inference.
- arq worker; move pipeline off the request thread.
- **Sanity check (the milestone)**: each team member records 10 takes of the script over 3 days. PCA the resulting WavLM embeddings — same person should cluster, different people should separate. If not, fix before moving on.

### Week 3 — scoring + dashboard contract

- `scoring/baseline.py` — `lock_baseline(resident_id)` fits PCA/MCD/IF on first 10–14 features rows, persists bundle to Blob, sets `baseline_locked_at`.
- `scoring/score.py` — score on every new recording.
- `scoring/ewma.py` per-feature drift.
- `scoring/changepoint.py` nightly cron via arq.
- Alert generation rules (§8.3).
- All `/api/n/*` endpoints the dashboard needs.
- Presigned audio URL for playback.

### Week 4 — Azure deploy + demo data

- Bicep templates, deploy dev env, get CI green.
- Migrate, deploy prod env.
- Each team member has been recording daily since Week 1; one team member starts a deliberate "drift" (whispering, slow speech, mumbling) in Week 4 so demo day shows alerts firing.
- Failure-mode review: Whisper timeout, NaN in Praat, malformed stage_offsets, blob upload retry, DB connection drop.
- Load test with `locust`: 50 simultaneous uploads. Worker should scale 1→5; queue should drain within 5 minutes.

---

## 12. Coding conventions

- **Python style**: `ruff` for linting and formatting (config in `pyproject.toml`); `mypy --strict` on `src/voicevital`. Type-hint everything; use `from __future__ import annotations` at the top of every module.
- **Imports**: absolute imports rooted at `voicevital.*`, no relative imports.
- **Errors**: never bare `except:`. Catch specific exceptions; log with `structlog` including `resident_id` and `recording_id` in context. Never log audio bytes, transcripts, or `display_name`.
- **DB sessions**: one session per request (FastAPI dep) or per task (arq dep). Never share sessions across awaits.
- **Time**: store everything in UTC in the DB; convert to `Australia/Sydney` only at the API boundary.
- **IDs**: UUID v4 for everything except `recording_link.token`, which is `secrets.token_urlsafe(24)`.
- **Tests**: every feature extractor has at least one test against a committed fixture WAV with known expected values within a tolerance. Scoring has a property test ("Mahalanobis on baseline data is below the threshold for 95% of points").
- **PRs**: every PR updates this file if it introduces or changes a model, a table, an Azure resource, or an API endpoint.

---

## 13. Common pitfalls (read these before touching the code)

1. **`getUserMedia` defaults silently corrupt biomarkers.** `noiseSuppression` and `autoGainControl` default to `true`. The frontend must set them to `false`. The backend must reject uploads where `client_meta` reports them as `true`.
2. **Don't load WavLM/Whisper/sBERT on the API process.** They take ~30 s and 1.5 GB to warm. Keep them on the worker only. If you find yourself importing `transformers` in `api/`, stop.
3. **ffmpeg failures are silent unless you check the exit code.** Always `subprocess.run(..., check=True)` and capture stderr.
4. **Praat returns NaN on near-silent or aperiodic input.** Always `np.nan_to_num` before persisting and flag the recording as low-quality.
5. **Whisper hallucinates on silence.** Always pair Whisper output with a VAD-derived voiced-segment count; if voiced duration < 5 s on the open prompt, throw away the transcript and don't compute linguistic features for that recording.
6. **`MinCovDet` fails when N < 2 × n_features.** That's why we PCA to 32 dimensions before fitting it. Don't skip the PCA step.
7. **Per-resident scikit-learn pickles are not portable across `sklearn` major versions.** Pin sklearn in `pyproject.toml`. If you upgrade, refit all baselines (cron job; mark `baseline_locked_at` as needing refresh).
8. **Container Apps cold start.** With `min_replicas=0` on the worker, the first recording after a quiet period waits for the worker to spin up + warm models (~60 s). Set `min_replicas=1` for the worker in prod so demo day doesn't have a 60-second pause.
9. **HuggingFace download in CI.** Cache the `download_models.py` layer. Without the cache, every PR build downloads ~600 MB and your CI minutes go up in smoke.
10. **PII in logs.** `resident_id` only. No `display_name`, no transcripts, no audio. Add a structlog processor that drops any key in a deny-list. Verify with a unit test.
11. **Postgres JSONB query gotcha.** Don't ORDER BY a JSONB field; pull commonly-queried fields out into proper columns (we already did this for `concern_score`).
12. **Don't compare absolute feature values across residents.** Only relative within-resident change is meaningful — different mics give different absolute jitter/shimmer values. The baseline absorbs this; cross-resident analytics should be on z-scored deltas, never raw features.

---

## 14. Out of scope (write a TODO, don't build)

- Multilingual residents (Whisper-multilingual + XLSR-53). English-only for the prototype.
- Mobile native app. Web only.
- HL7 FHIR Observation export. Stub for the demo only.
- IRB/HREC clinical validation study.
- On-device / edge deployment (BRILLsson). Future-work in the report.
- Cohort-level analytics (facility-wide flu detection). Future-work.
- Long-term audio retention beyond 90 days. Configure Blob lifecycle to delete `audio-recordings/*` older than 90 days; features and scores are kept indefinitely.

---

## 15. Glossary

- **eGeMAPSv02** — Extended Geneva Minimalistic Acoustic Parameter Set, the 88-feature standard for paralinguistics (Eyben et al. 2016).
- **CPP / CPPS** — Cepstral Peak Prominence (Smoothed). Best single measure of breathiness/dysphonia.
- **MPT** — Maximum Phonation Time. Longest sustained `/a/` vowel duration.
- **DDK** — Diadochokinetic rate, measured by `pa-ta-ka` repetition. Tests motor speech.
- **WavLM** — Microsoft self-supervised speech model (Chen et al. 2022). We use `wavlm-base` for embeddings.
- **Mahalanobis distance** — Distance from a point to a distribution, accounting for covariance. Our primary anomaly score in PCA space.
- **EWMA** — Exponentially Weighted Moving Average. Used for per-feature drift control charts.
- **CPD** — Change-Point Detection (`ruptures` library). Used weekly to find sustained shifts.
- **SaMD** — Software as a Medical Device (TGA / IMDRF term). We are explicitly **not** SaMD; we are a wellness/follow-up tool.
- **Sub-scores (5)** — phonatory, articulatory, prosodic, respiratory, linguistic. Never disease names.

---

*End of CLAUDE.md. Update this file in every PR that changes the contract.*