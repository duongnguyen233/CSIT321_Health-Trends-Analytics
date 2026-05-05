"""Pydantic schemas for the redesigned voice biomarker upload contract.

Mirrors VOICE_BIOMARKER.md §7.2: a multipart upload carrying the audio blob
plus three JSON form fields — `stage_offsets`, `context_flags`, `client_meta`.

Hard rules enforced here (validation errors → 400 at the API boundary):
- `stage_offsets` MUST contain all four stages: sustained_a, ddk, reading, open_prompt.
- Each stage range is `[start, end]` with 0 <= start < end (seconds).
- `client_meta.noise_suppression` MUST be False (corrupts jitter/shimmer/HNR).
- `client_meta.auto_gain_control` MUST be False (corrupts loudness).
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


REQUIRED_STAGES: tuple[str, ...] = ("sustained_a", "ddk", "reading", "open_prompt")


class StageOffsets(BaseModel):
    """Start/end offsets in seconds for the four required stages of the script."""

    sustained_a: tuple[float, float]
    ddk: tuple[float, float]
    reading: tuple[float, float]
    open_prompt: tuple[float, float]

    @model_validator(mode="after")
    def _validate_ranges(self) -> StageOffsets:
        for name in REQUIRED_STAGES:
            start, end = getattr(self, name)
            if start < 0:
                raise ValueError(f"stage '{name}' has negative start: {start}")
            if start >= end:
                raise ValueError(
                    f"stage '{name}' has invalid range [{start}, {end}] "
                    "(start must be < end)"
                )
        return self


class ContextFlags(BaseModel):
    """Resident-self-reported context flags that may suppress alerts."""

    cold: bool = False
    dentures_out: bool = False
    just_woke_up: bool = False
    pain: bool = False


class ClientMeta(BaseModel):
    """Browser MediaStream constraints + UA, captured at recording time.

    The two `*_must_be_false` validators enforce the hard rule from §7.3 of
    VOICE_BIOMARKER.md: noise-suppression and auto-gain-control destroy the
    biomarker signal, so the frontend MUST disable them and the backend MUST
    reject any upload that did not.
    """

    ua: str
    sample_rate: int = Field(ge=8000, le=192000)
    channels: int = Field(ge=1, le=2)
    echo_cancellation: bool
    noise_suppression: bool
    auto_gain_control: bool

    @field_validator("noise_suppression")
    @classmethod
    def _ns_must_be_false(cls, v: bool) -> bool:
        if v:
            raise ValueError("noise_suppression must be false")
        return v

    @field_validator("auto_gain_control")
    @classmethod
    def _agc_must_be_false(cls, v: bool) -> bool:
        if v:
            raise ValueError("auto_gain_control must be false")
        return v


class LinkMetadata(BaseModel):
    """Response shape for `GET /api/voice/v2/r/{token}` (public endpoint)."""

    resident_display_name: str
    language: str = "en-AU"
    script_version: str = "v1"
    valid_for_date: str  # ISO 8601 date, e.g. "2026-05-06"
    stages: list[dict]


class UploadResponse(BaseModel):
    """Response shape for `POST /api/voice/v2/upload` happy path (202)."""

    recording_id: str
    status: str
    snr_db: float | None = None
