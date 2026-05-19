"""Audio blob storage with in-memory fallback.

Mirrors the pattern used in voice_recording_db / voice_profile_db: when
`AZURE_STORAGE_CONNECTION_STRING` is set we use Azure Blob Storage; otherwise
we route to a module-level in-memory dict so dev + tests work without Azure.

URIs returned by `upload_audio` are opaque strings:
    blob://audio-recordings/<resident_id>/<recording_id>.webm   (real)
    memory://<resident_id>/<recording_id>.webm                  (fallback)

`download_audio` and `presigned_audio_url` route by prefix so callers can
treat both interchangeably for read operations.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone

from app.core.config import settings


logger = logging.getLogger(__name__)
CONTAINER = "audio-recordings"

# In-memory fallback. Key is "<resident_id>/<recording_id>.webm".
_in_memory: dict[str, bytes] = {}


def _conn_string() -> str | None:
    return getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", None) or os.environ.get(
        "AZURE_STORAGE_CONNECTION_STRING"
    )


def _client():
    """Return a ContainerClient for the audio-recordings container, or None."""
    conn = _conn_string()
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


def _audio_key(resident_id: str, recording_id: str) -> str:
    return f"{resident_id}/{recording_id}.webm"


def upload_audio(
    resident_id: str,
    recording_id: str,
    audio: bytes,
    content_type: str = "audio/webm",
) -> str:
    """Upload audio bytes and return an opaque URI suitable for persistence.

    Returns a `blob://...` URI when Azure is configured, otherwise `memory://...`.
    """
    key = _audio_key(resident_id, recording_id)
    cc = _client()
    if cc is not None:
        cc.upload_blob(key, audio, overwrite=True, content_type=content_type)
        return f"blob://{CONTAINER}/{key}"
    _in_memory[key] = audio
    return f"memory://{key}"


def download_audio(blob_uri: str) -> bytes | None:
    """Read audio bytes back from either the real container or the in-memory dict."""
    if blob_uri.startswith("memory://"):
        return _in_memory.get(blob_uri.removeprefix("memory://"))
    if blob_uri.startswith(f"blob://{CONTAINER}/"):
        cc = _client()
        if cc is None:
            return None
        key = blob_uri.removeprefix(f"blob://{CONTAINER}/")
        try:
            return cc.download_blob(key).readall()
        except Exception as e:
            logger.warning("download_audio failed: %s", e)
            return None
    return None


def presigned_audio_url(blob_uri: str, minutes: int = 5) -> str | None:
    """Return a short-lived SAS URL for the blob, or None if not a real blob.

    In-memory URIs return None — callers must stream those directly.
    """
    if not blob_uri.startswith(f"blob://{CONTAINER}/"):
        return None
    cc = _client()
    if cc is None:
        return None
    try:
        from azure.storage.blob import BlobSasPermissions, generate_blob_sas

        key = blob_uri.removeprefix(f"blob://{CONTAINER}/")
        # account_name / credential.account_key access is documented for
        # connection-string clients; for managed-identity-backed clients
        # this would need a delegation key, which we don't use today.
        account_key = getattr(cc.credential, "account_key", None)
        if account_key is None:
            logger.warning("presigned_audio_url: account_key unavailable")
            return None
        sas = generate_blob_sas(
            account_name=cc.account_name,
            container_name=CONTAINER,
            blob_name=key,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.now(timezone.utc) + timedelta(minutes=minutes),
        )
        return f"{cc.url}/{key}?{sas}"
    except Exception as e:
        logger.warning("presigned_audio_url failed: %s", e)
        return None
