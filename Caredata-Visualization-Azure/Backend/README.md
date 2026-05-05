# Caredata Backend

FastAPI service for the Caredata aged-care quality-indicator platform plus the
Voice Biomarker tab (see `repo:VOICE_BIOMARKER.md` for the philosophy and
`docs/superpowers/plans/2026-05-05-voice-vital-backend.md` for the in-tree
implementation plan).

## Quick start

```bash
cp env .env                              # then edit .env with your secrets
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

API runs on `http://localhost:8000`. The voice biomarker tab is mounted at
`/api/voice/v2/...` (the legacy `/api/voice/...` router is still present in
Phase 1; Phase 2 deletes it).

## System dependencies

### ffmpeg (recommended for the voice biomarker pipeline)

The voice pipeline transcodes browser-captured WebM/Opus uploads to 16 kHz
mono PCM WAV via `ffmpeg`. Without `ffmpeg`, only `.wav` uploads will decode
correctly (we fall back to `soundfile`/`librosa` direct decoding).

Install on Windows:

```powershell
winget install Gyan.FFmpeg
```

Install on Linux:

```bash
sudo apt install ffmpeg
```

Install on macOS:

```bash
brew install ffmpeg
```

After install, restart your terminal so `ffmpeg` is on `PATH`.

### faster-whisper model (for local transcription, ~150 MB one-off download)

The voice pipeline transcribes the open-prompt stage with
`faster-whisper-base.en`. The first time the worker boots, the model is
downloaded to `Backend/models/faster-whisper-base.en/`. To pre-download:

```bash
python scripts/download_voice_models.py
```

If you have no network connection, the Whisper-dependent tests will skip
gracefully (`@pytest.mark.skipif`).

## Test suite

```bash
python -m pytest tests/voice/ -v
```

`tests/conftest.py` strips `AZURE_STORAGE_CONNECTION_STRING` before any
`app.*` import, so tests cannot accidentally hit production Azure Tables —
all data layers fall back to in-memory dicts.

## Layout

```
Backend/
  app/
    api/          — FastAPI routers (auth, voice_v2, qi, ...)
    core/         — config, security
    services/     — data layer (Azure Tables + in-memory fallback)
    main.py       — app factory + router mount
  tests/
    conftest.py   — Azure isolation guard
    voice/        — voice biomarker tests
  scripts/
    download_voice_models.py   — one-off faster-whisper download
  models/         — local model cache (gitignored)
  requirements.txt
```
