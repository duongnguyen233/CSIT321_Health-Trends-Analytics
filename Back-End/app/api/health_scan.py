"""
Health Scan: accept image upload, call OpenAI Vision to extract structured health data.
Returns JSON matching frontend My Data state (patient, clinical, trend).
Missing fields are returned as "" so frontend shows "Unknown".
"""

import base64
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.services.cognito_auth import get_current_user_cognito

router = APIRouter(prefix="/health-scan", tags=["Health Scan"])
logger = logging.getLogger(__name__)


# ----------------------------
# Response shape (frontend state)
# ----------------------------
class PatientContext(BaseModel):
    age: str = ""
    sex: str = ""
    knownConditions: str = ""
    currentMedication: str = ""
    height: str = ""
    heightUnit: str = "cm"
    weight: str = ""
    weightUnit: str = "kg"
    bmi: str = ""
    smokingStatus: str = ""
    alcoholStatus: str = ""
    pregnancyStatus: str = ""


class ClinicalMeasurements(BaseModel):
    bloodPressureSystolic: str = ""
    bloodPressureDiastolic: str = ""
    heartRate: str = ""
    temperature: str = ""
    oxygenSaturation: str = ""
    weight: str = ""
    bmi: str = ""


class TrendRisk(BaseModel):
    recency: str = ""
    trend: str = ""
    severity: str = ""
    abnormalCount: str = ""
    symptoms: str = ""


class HealthScanResponse(BaseModel):
    patient: PatientContext
    clinical: ClinicalMeasurements
    trend: TrendRisk


# ----------------------------
# Prompt
# ----------------------------
SYSTEM_PROMPT = """You are a medical document analyst. Extract health information from the image of a health record.
Return ONLY a single valid JSON object (no markdown, no code block) with this exact structure.
Use empty string "" for any field not found or not applicable.

{
  "patient": {
    "age": "<number as string or \\"\\">",
    "sex": "Female" | "Male" | "Prefer not to say" | "",
    "knownConditions": "<comma-separated conditions or \\"\\">",
    "currentMedication": "<comma-separated medications or \\"\\">",
    "height": "<number only, e.g. 165>",
    "heightUnit": "cm" | "in",
    "weight": "<number only, e.g. 72>",
    "weightUnit": "kg",
    "bmi": "<number as string or \\"\\">",
    "smokingStatus": "Non-smoker" | "Smoker" | "Former smoker" | "Prefer not to say" | "",
    "alcoholStatus": "None" | "Occasional" | "Moderate" | "Heavy" | "Prefer not to say" | "",
    "pregnancyStatus": "Not applicable" | "Yes" | "No" | "Prefer not to say" | ""
  },
  "clinical": {
    "bloodPressureSystolic": "<e.g. 128>",
    "bloodPressureDiastolic": "<e.g. 82>",
    "heartRate": "<number or \\"\\">",
    "temperature": "<number or \\"\\">",
    "oxygenSaturation": "<number or \\"\\">",
    "weight": "<number or \\"\\">",
    "bmi": "<number or \\"\\">"
  },
  "trend": {
    "recency": "<e.g. Recent (within 2 weeks) or \\"\\">",
    "trend": "Stable" | "Increasing" | "Decreasing" | "Unknown" | "",
    "severity": "<e.g. Mild (slightly above normal range) or \\"\\">",
    "abnormalCount": "<number as string or \\"\\">",
    "symptoms": "<comma-separated or \\"\\">"
  }
}

Rules:
- Extract only what is clearly stated in the document.
- If a field is not found, use "" (empty string).
- Return ONLY the JSON object. No markdown. No extra text.
"""


# ----------------------------
# Helpers
# ----------------------------
def _parse_json_from_content(content: str) -> dict[str, Any]:
    """Extract JSON from model response (in case there is extra text)."""
    if not content or not content.strip():
        raise json.JSONDecodeError("Empty response", "", 0)

    content = content.strip()

    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()

    start = content.find("{")
    if start == -1:
        raise json.JSONDecodeError("No JSON object in response", content[:80], 0)

    depth = 0
    end = -1
    for i in range(start, len(content)):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    if end == -1:
        raise json.JSONDecodeError("Unclosed JSON object", content[:80], 0)

    snippet = content[start : end + 1]
    return json.loads(snippet)


def _normalize_response(raw: dict) -> HealthScanResponse:
    def str_or_empty(v: Any) -> str:
        if v is None:
            return ""
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, str):
            return v.strip()
        return str(v).strip() if v else ""

    p = raw.get("patient") or {}
    c = raw.get("clinical") or {}
    t = raw.get("trend") or {}

    return HealthScanResponse(
        patient=PatientContext(
            age=str_or_empty(p.get("age")),
            sex=str_or_empty(p.get("sex")),
            knownConditions=str_or_empty(p.get("knownConditions")),
            currentMedication=str_or_empty(p.get("currentMedication")),
            height=str_or_empty(p.get("height")),
            heightUnit=str_or_empty(p.get("heightUnit")) or "cm",
            weight=str_or_empty(p.get("weight")),
            weightUnit=str_or_empty(p.get("weightUnit")) or "kg",
            bmi=str_or_empty(p.get("bmi")),
            smokingStatus=str_or_empty(p.get("smokingStatus")),
            alcoholStatus=str_or_empty(p.get("alcoholStatus")),
            pregnancyStatus=str_or_empty(p.get("pregnancyStatus")),
        ),
        clinical=ClinicalMeasurements(
            bloodPressureSystolic=str_or_empty(c.get("bloodPressureSystolic")),
            bloodPressureDiastolic=str_or_empty(c.get("bloodPressureDiastolic")),
            heartRate=str_or_empty(c.get("heartRate")),
            temperature=str_or_empty(c.get("temperature")),
            oxygenSaturation=str_or_empty(c.get("oxygenSaturation")),
            weight=str_or_empty(c.get("weight")),
            bmi=str_or_empty(c.get("bmi")),
        ),
        trend=TrendRisk(
            recency=str_or_empty(t.get("recency")),
            trend=str_or_empty(t.get("trend")),
            severity=str_or_empty(t.get("severity")),
            abnormalCount=str_or_empty(t.get("abnormalCount")),
            symptoms=str_or_empty(t.get("symptoms")),
        ),
    )


# ----------------------------
# Endpoint
# ----------------------------
@router.post("/analyze", response_model=HealthScanResponse)
async def analyze_health_record(
    image: UploadFile = File(...),
    _user: dict = Depends(get_current_user_cognito),
) -> HealthScanResponse:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Health Scan is not configured (OPENAI_API_KEY missing).",
        )

    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if image.content_type and image.content_type.lower() not in allowed:
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, WEBP, GIF).")

    data = await image.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB.")

    media_type = image.content_type or "image/jpeg"
    b64 = base64.b64encode(data).decode("ascii")
    data_url = f"data:{media_type};base64,{b64}"

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        model = "gpt-4o-mini"  # good default for vision + cost
        logger.info("Calling OpenAI (model=%s) for health scan...", model)

        # ✅ Correct: Responses API uses `text.format` for structured JSON output
        resp = client.responses.create(
            model=model,
            input=[
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": "Return ONLY the JSON object exactly matching the schema."},
                        {"type": "input_image", "image_url": data_url},
                    ],
                },
            ],
            text={"format": {"type": "json_object"}},
        )

        raw_text = (resp.output_text or "").strip()

        # Fallback: if output_text is empty, try to extract from output items
        if not raw_text and getattr(resp, "output", None):
            # Join all output_text segments if present
            parts: list[str] = []
            for item in resp.output:
                for c in (item.get("content") if isinstance(item, dict) else getattr(item, "content", []) ) or []:
                    if isinstance(c, dict) and c.get("type") == "output_text" and c.get("text"):
                        parts.append(c["text"])
            raw_text = "\n".join(parts).strip()

    except Exception as e:
        logger.exception("OpenAI API call failed")
        raise HTTPException(status_code=502, detail=f"Analysis failed (OpenAI error): {str(e)}")

    if not raw_text:
        raise HTTPException(status_code=502, detail="No analysis result from provider (empty response).")

    try:
        raw = _parse_json_from_content(raw_text)
        return _normalize_response(raw)
    except Exception as e:
        logger.warning("Invalid analysis format: %s. Response preview: %s", e, raw_text[:600])
        raise HTTPException(status_code=502, detail=f"Invalid analysis format: {str(e)}")