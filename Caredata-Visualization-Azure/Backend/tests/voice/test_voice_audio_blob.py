"""Tests for voice_audio_blob — focuses on the in-memory fallback path.

Real Azure Blob exercise lives in integration tests (Phase 2+), since
spinning Azurite on Windows in CI is not part of Phase 1.
"""
from __future__ import annotations
import pytest

from app.services import voice_audio_blob


@pytest.fixture(autouse=True)
def _clear_in_memory(monkeypatch):
    voice_audio_blob._in_memory.clear()
    # Force the in-memory branch by ensuring no connection string.
    monkeypatch.delenv("AZURE_STORAGE_CONNECTION_STRING", raising=False)
    yield
    voice_audio_blob._in_memory.clear()


def test_upload_returns_memory_uri_when_unconfigured():
    uri = voice_audio_blob.upload_audio("R1", "rec1", b"hello")
    assert uri.startswith("memory://")
    assert "R1/rec1.webm" in uri


def test_upload_then_download_round_trip_in_memory():
    uri = voice_audio_blob.upload_audio("R1", "rec1", b"audio-bytes")
    assert voice_audio_blob.download_audio(uri) == b"audio-bytes"


def test_download_unknown_uri_returns_none():
    assert voice_audio_blob.download_audio("memory://does/not/exist.webm") is None


def test_presigned_url_returns_none_for_memory_uri():
    """Presigned URLs only make sense for real blobs."""
    uri = voice_audio_blob.upload_audio("R1", "rec1", b"x")
    assert voice_audio_blob.presigned_audio_url(uri) is None


def test_path_layout_is_resident_scoped():
    uri = voice_audio_blob.upload_audio("R-abc-123", "rid-xyz", b"y")
    # The deterministic path makes per-resident lifecycle policies easy.
    assert uri.endswith("R-abc-123/rid-xyz.webm")
