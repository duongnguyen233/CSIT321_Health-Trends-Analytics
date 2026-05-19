"""Hard rule from VOICE_BIOMARKER.md: no disease names anywhere in the voice biomarker module.

The voice biomarker tab is framed as a *trend monitoring tool*, not a diagnostic device.
User-facing strings, log lines, LLM prompts, alert summaries, and QI-flag messages must
describe voice dimension shifts (phonatory / articulatory / prosodic / respiratory /
linguistic) — never neurological or psychiatric labels.

A line that legitimately needs to mention a disclaimer can opt-out by adding the
literal marker `FRAMING_OK` (typically as a comment on the same line).
"""
from pathlib import Path
import re

# Rough but conservative — false positives can be silenced with FRAMING_OK on the line.
FORBIDDEN = re.compile(
    r"\b("
    r"stroke|tia|"
    r"dementia|alzheimer|parkinson|"
    r"delirium|"
    r"depress(?:ed|ion|ive|ing)?|"
    r"dysphagia|"
    r"psychosis|psychotic|schizo[a-z]*|bipolar|"
    r"diagnos[ie]s|diagnose[ds]?"
    r")\b",
    re.IGNORECASE,
)

# Files in the voice biomarker module that must obey the framing rule.
VOICE_FILES = [
    "app/api/voice.py",
    "app/api/voice_v2.py",
    "app/api/voice_schemas.py",
    "app/api/voice_prompts.py",
    "app/services/voice_processor.py",
    "app/services/voice_processor_v2.py",
    "app/services/voice_analysis_db.py",
    "app/services/voice_link_db.py",
    "app/services/voice_profile_db.py",
    "app/services/voice_recording_db.py",
    "app/services/voice_score_db.py",
    "app/services/voice_seed.py",
    "app/services/voice_seed_v2.py",
    "app/services/voice_audio_blob.py",
    "app/services/voice_alerts.py",
]


def test_voice_module_has_no_disease_terms():
    backend = Path(__file__).resolve().parents[2]
    offenders: list[str] = []
    for rel in VOICE_FILES:
        p = backend / rel
        if not p.exists():
            continue
        for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if "FRAMING_OK" in line:
                continue
            if FORBIDDEN.search(line):
                offenders.append(f"{rel}:{i}: {line.strip()}")
    assert not offenders, (
        "Forbidden disease terms found in voice biomarker module "
        "(add `# FRAMING_OK` to legitimate disclaimer lines):\n"
        + "\n".join(offenders)
    )
