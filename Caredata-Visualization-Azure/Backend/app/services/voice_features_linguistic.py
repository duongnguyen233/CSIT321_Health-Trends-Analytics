"""Linguistic features computed off the open-prompt Whisper transcript.

Per VOICE_BIOMARKER.md \xa78.1, the open-prompt stage is transcribed by
faster-whisper with word-level timestamps, then we derive:

- speech_rate_wpm        : words / minute (gross)
- articulation_rate_wpm  : words / minute discounting pause time
- pause_ratio            : sum(pause durations) / total duration
- n_pauses               : number of inter-word gaps > 0.25 s
- mean_pause_s           : mean inter-word gap duration (when > 0)
- n_filled_pauses        : count of {uh, um, er, ah, hmm}
- ttr                    : type-token ratio (unique tokens / tokens)
- idea_density           : (verbs + adjectives + adverbs + prepositions
                            + conjunctions) / total spaCy tokens
- n_words                : total whisper-detected word count

If `voiced_duration_s < 5`, returns None — the open prompt didn't have
enough speech to score reliably (per VOICE_BIOMARKER.md pitfall #5).

spaCy `en_core_web_sm` is required. If not installed, the function falls
back to whitespace tokenisation and skips POS-based idea density.
"""
from __future__ import annotations

import logging
from typing import Any, Iterable

import numpy as np


logger = logging.getLogger(__name__)


_FILLED = frozenset({"uh", "um", "er", "ah", "hmm", "mm"})

_spacy_cache: dict[str, object] = {}


def _spacy_nlp():
    if "nlp" in _spacy_cache:
        return _spacy_cache["nlp"]
    try:
        import spacy
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.warning(
                "spaCy en_core_web_sm not installed; idea_density will be best-effort. "
                "Install with: python -m spacy download en_core_web_sm"
            )
            nlp = None
    except ImportError:
        nlp = None
    _spacy_cache["nlp"] = nlp
    return nlp


def extract_linguistic(
    transcript: str,
    words: Iterable[dict],
    duration_s: float,
    voiced_duration_s: float | None = None,
) -> dict[str, Any] | None:
    """Compute linguistic features. Returns None when voiced<5s."""
    if voiced_duration_s is None:
        voiced_duration_s = duration_s
    if voiced_duration_s < 5.0:
        return None

    word_list = list(words)
    n_words = len(word_list)
    if n_words == 0:
        return {
            "speech_rate_wpm": 0.0,
            "articulation_rate_wpm": 0.0,
            "pause_ratio": 0.0,
            "n_pauses": 0,
            "mean_pause_s": 0.0,
            "n_filled_pauses": 0,
            "ttr": 0.0,
            "idea_density": 0.0,
            "n_words": 0,
            "_failed": False,
        }

    pause_gaps: list[float] = []
    for prev, curr in zip(word_list, word_list[1:]):
        gap = float(curr.get("start", 0.0)) - float(prev.get("end", 0.0))
        if gap > 0.25:
            pause_gaps.append(gap)

    n_filled = sum(
        1 for w in word_list if w.get("word", "").strip().lower() in _FILLED
    )

    tokens = [
        w.get("word", "").strip(".,?!").lower()
        for w in word_list
        if w.get("word", "").strip()
    ]
    tokens = [t for t in tokens if t]
    ttr = len(set(tokens)) / max(len(tokens), 1)

    speech_rate_wpm = (n_words / duration_s * 60.0) if duration_s > 0 else 0.0
    pause_total = float(sum(pause_gaps))
    articulation_denom = max(duration_s - pause_total, 0.1)
    articulation_rate_wpm = n_words / articulation_denom * 60.0
    pause_ratio = pause_total / duration_s if duration_s > 0 else 0.0

    nlp = _spacy_nlp()
    if nlp and transcript:
        doc = nlp(transcript)
        content_pos = {"VERB", "ADJ", "ADV", "ADP", "CCONJ", "SCONJ"}
        n_total = len(doc)
        idea_density = (
            sum(1 for tok in doc if tok.pos_ in content_pos) / max(n_total, 1)
        )
    else:
        # Fallback: rough heuristic — proportion of tokens >= 4 chars
        idea_density = sum(1 for t in tokens if len(t) >= 4) / max(len(tokens), 1)

    return {
        "speech_rate_wpm": float(speech_rate_wpm),
        "articulation_rate_wpm": float(articulation_rate_wpm),
        "pause_ratio": float(pause_ratio),
        "n_pauses": len(pause_gaps),
        "mean_pause_s": float(np.mean(pause_gaps)) if pause_gaps else 0.0,
        "n_filled_pauses": n_filled,
        "ttr": float(ttr),
        "idea_density": float(idea_density),
        "n_words": n_words,
        "_failed": False,
    }
