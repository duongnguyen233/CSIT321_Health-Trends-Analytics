"""Tests for linguistic features (driven off the Whisper transcript)."""
from __future__ import annotations

from app.services.voice_features_linguistic import extract_linguistic


def _w(start, end, word):
    return {"start": start, "end": end, "word": word}


def test_returns_none_for_voiced_lt_5s():
    """Per spec pitfall #5: don't score linguistic on <5s voiced."""
    result = extract_linguistic(
        transcript="hello",
        words=[_w(0.0, 0.5, "hello")],
        duration_s=10.0,
        voiced_duration_s=2.0,
    )
    assert result is None


def test_handles_empty_word_list():
    result = extract_linguistic(
        transcript="",
        words=[],
        duration_s=30.0,
        voiced_duration_s=15.0,
    )
    assert result is not None
    assert result["n_words"] == 0
    assert result["speech_rate_wpm"] == 0.0


def test_basic_metrics_against_synthetic_word_list():
    """Hand-craft a 30-second transcript with known structure."""
    # 30 words in 30s = 60 wpm gross speech rate
    words = [_w(i, i + 0.4, f"word{i}") for i in range(30)]
    result = extract_linguistic(
        transcript=" ".join(f"word{i}" for i in range(30)),
        words=words,
        duration_s=30.0,
        voiced_duration_s=30.0,
    )
    assert result is not None
    # 30 words / 30 s = 1 wps = 60 wpm
    assert 55.0 <= result["speech_rate_wpm"] <= 65.0
    # No big pauses (gap = 0.6s between words; >0.25 threshold => counted)
    assert result["n_pauses"] == 29  # 29 inter-word gaps
    assert result["n_filled_pauses"] == 0


def test_filled_pauses_are_counted():
    words = [
        _w(0.0, 0.4, "hello"),
        _w(1.0, 1.2, "um"),
        _w(2.0, 2.4, "world"),
        _w(3.0, 3.2, "uh"),
        _w(4.0, 4.4, "okay"),
    ]
    result = extract_linguistic(
        transcript="hello um world uh okay",
        words=words,
        duration_s=10.0,
        voiced_duration_s=10.0,
    )
    assert result is not None
    assert result["n_filled_pauses"] == 2


def test_ttr_is_one_for_unique_words_and_low_for_repeats():
    unique = [_w(i, i + 0.4, f"w{i}") for i in range(20)]
    r1 = extract_linguistic(
        transcript=" ".join(f"w{i}" for i in range(20)),
        words=unique, duration_s=20, voiced_duration_s=20,
    )
    repeats = [_w(i, i + 0.4, "the") for i in range(20)]
    r2 = extract_linguistic(
        transcript="the " * 20, words=repeats, duration_s=20, voiced_duration_s=20,
    )
    assert r1["ttr"] == 1.0
    assert r2["ttr"] < 0.2  # 1 type / 20 tokens = 0.05


def test_pause_ratio_reflects_gap_structure():
    """Three pauses (>0.25s each) take ~4.5s out of 30s -> ratio ~ 0.15"""
    words = [
        _w(0.0, 1.0, "alpha"),
        _w(3.0, 4.0, "beta"),   # 2.0s gap
        _w(6.0, 7.0, "gamma"),  # 2.0s gap
        _w(7.5, 8.5, "delta"),  # 0.5s gap (>0.25 threshold)
    ]
    result = extract_linguistic(
        transcript="alpha beta gamma delta",
        words=words,
        duration_s=30.0,
        voiced_duration_s=30.0,
    )
    assert result is not None
    assert result["n_pauses"] == 3
    # 4.5 seconds of pause out of 30 ≈ 0.15
    assert 0.12 < result["pause_ratio"] < 0.20
