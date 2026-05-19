"""One-off downloader for the local faster-whisper model.

Downloads `Systran/faster-whisper-base.en` (~150 MB INT8) into
`Backend/models/faster-whisper-base.en/`. Run once per machine; the model
is gitignored so each clone re-downloads.

Usage:
    python scripts/download_voice_models.py

Skips silently if the target dir already exists and is non-empty.
"""
from __future__ import annotations

import sys
from pathlib import Path


MODEL_ID = "Systran/faster-whisper-base.en"
TARGET_DIR_NAME = "faster-whisper-base.en"


def main() -> int:
    backend_dir = Path(__file__).resolve().parent.parent
    models_dir = backend_dir / "models"
    target = models_dir / TARGET_DIR_NAME

    if target.exists() and any(target.iterdir()):
        print(f"[ok] {target} already populated, skipping download.")
        return 0

    target.mkdir(parents=True, exist_ok=True)

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("[error] huggingface_hub not installed. Run: pip install -r requirements.txt", file=sys.stderr)
        return 1

    try:
        snapshot_download(
            repo_id=MODEL_ID,
            local_dir=str(target),
            local_dir_use_symlinks=False,
        )
    except TypeError:
        # local_dir_use_symlinks deprecated in newer hf_hub; fall back to bare call
        snapshot_download(repo_id=MODEL_ID, local_dir=str(target))
    except Exception as e:
        print(f"[error] download failed: {e}", file=sys.stderr)
        return 2

    print(f"[ok] downloaded {MODEL_ID} -> {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
