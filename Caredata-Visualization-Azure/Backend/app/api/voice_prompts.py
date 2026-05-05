"""Voice biomarker recording script — the 4-stage daily battery (~75 s).

Stages:
  1. sustained_a   — sustained /a/ vowel for ~6 s (phonatory dimension)
  2. ddk           — pa-ta-ka diadochokinetic repetition for ~5 s (articulatory)
  3. reading       — short scripted passage (~7 s, prosodic + linguistic)
  4. open_prompt   — open-ended response (~30+ s, full linguistic + prosodic)

Reference: VOICE_BIOMARKER.md \xa78. The exact wording is curated for aged-care
residents reading at a moderate pace; phrasing avoids any clinical or
diagnostic framing.
"""
from __future__ import annotations


REQUIRED_STAGE_IDS: tuple[str, ...] = ("sustained_a", "ddk", "reading", "open_prompt")

SCRIPT_DISCLAIMER = (
    "This is a trend monitoring tool, not a diagnostic device. "
    "Recordings are reviewed by your nursing team."
)  # FRAMING_OK


_SCRIPT_V1 = {
    "version": "v1",
    "language": "en-AU",
    "disclaimer": SCRIPT_DISCLAIMER,
    "stages": [
        {
            "id": "sustained_a",
            "type": "sustained",
            "text": (
                "Take a breath in, then say the sound ‘ahhh’ for "
                "as long as you comfortably can in one breath."
            ),
            "instruction": "Hold the sound steady. We need about six seconds.",
            "target_duration_s": 6.0,
        },
        {
            "id": "ddk",
            "type": "ddk",
            "text": (
                "Repeat the syllables ‘pa-ta-ka, pa-ta-ka, pa-ta-ka’ "
                "as quickly and clearly as you can, for about five seconds."
            ),
            "instruction": "Try to keep a steady rhythm.",
            "target_duration_s": 5.0,
        },
        {
            "id": "reading",
            "type": "reading",
            "text": (
                "Please read this aloud at your normal pace: "
                "“The sun was warm on the old stone wall. "
                "Margaret picked up her cup of tea and watched the birds in the garden. "
                "It was a quiet morning, and she was glad of it.”"
            ),
            "instruction": "Read it once through, naturally.",
            "target_duration_s": 7.0,
        },
        {
            "id": "open_prompt",
            "type": "open_response",
            "text": (
                "In your own words, please tell me about your favourite meal: "
                "what it is, who you usually share it with, and the last time you had it. "
                "Take about a minute."
            ),
            "instruction": "There is no right answer — just speak naturally.",
            "target_duration_s": 55.0,
        },
    ],
}


def get_script(version: str = "v1") -> dict:
    """Return the recording script bundle for the given version.

    Raises ValueError if the version is unknown. Today only `v1` exists.
    """
    if version != "v1":
        raise ValueError(f"unknown script version: {version!r}")
    # Defensive copy so callers cannot mutate the module-level constant.
    return {
        "version": _SCRIPT_V1["version"],
        "language": _SCRIPT_V1["language"],
        "disclaimer": _SCRIPT_V1["disclaimer"],
        "stages": [dict(s) for s in _SCRIPT_V1["stages"]],
    }
