"""
My Data API: get/save health data (patient, clinical, trend) per user.
Stored in DynamoDB keyed by Cognito sub. Auth required.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any
from botocore.exceptions import ClientError

from app.services.cognito_auth import get_current_user_cognito
from app.services import health_data_db

router = APIRouter(prefix="/mydata", tags=["My Data"])


class MyDataBody(BaseModel):
    patient: dict[str, Any] = {}
    clinical: dict[str, Any] = {}
    trend: dict[str, Any] = {}


@router.get("", response_model=MyDataBody)
def get_my_data(current_user: dict = Depends(get_current_user_cognito)):
    """Return stored My Data for the current user. Empty sections if none saved."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = health_data_db.get_health_data(sub)
    if data is None:
        return MyDataBody(patient={}, clinical={}, trend={})
    return MyDataBody(**data)


@router.put("", response_model=MyDataBody)
def save_my_data(
    body: MyDataBody,
    current_user: dict = Depends(get_current_user_cognito),
):
    """Save My Data for the current user. Overwrites existing."""
    sub = current_user.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Ensure we store plain dicts with string values (DynamoDB-friendly)
    patient = {k: (v if isinstance(v, str) else str(v)) for k, v in (body.patient or {}).items()}
    clinical = {k: (v if isinstance(v, str) else str(v)) for k, v in (body.clinical or {}).items()}
    trend = {k: (v if isinstance(v, str) else str(v)) for k, v in (body.trend or {}).items()}
    try:
        health_data_db.put_health_data(sub, patient, clinical, trend)
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code", "")
        if code == "ResourceNotFoundException":
            raise HTTPException(
                status_code=503,
                detail="My Data storage is not available. Create the DynamoDB table (e.g. CareDataHealthData-dev) in your AWS account. See Back-End/CREATE-HEALTH-DATA-TABLE.md",
            ) from e
        raise HTTPException(status_code=503, detail="My Data storage temporarily unavailable.") from e
    return MyDataBody(patient=patient, clinical=clinical, trend=trend)
