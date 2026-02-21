"""
Entry point for AWS Lambda. Set USE_COGNITO=true and omit DATABASE_URL
when deploying serverless. Injects CORS headers into every response so
API Gateway does not need CORS config and preflight OPTIONS works.
"""
from app.main import app
from mangum import Mangum

# Allowed origins (must match FastAPI CORS config in app/main.py)
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://d2vw6ry5du4tco.cloudfront.net",
    "https://care-data-portal.netlify.app",
]

# Base CORS headers (origin will be set dynamically)
_BASE_CORS_HEADERS = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
}

_mangum = Mangum(app, lifespan="off")


def get_cors_headers(request_origin=None):
    """Get CORS headers with appropriate origin."""
    headers = dict(_BASE_CORS_HEADERS)
    
    # Normalize origin (remove trailing slash, handle None)
    if request_origin:
        request_origin = request_origin.rstrip('/')
    
    # If origin is provided and allowed, use it
    if request_origin and request_origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = request_origin
    # If origin matches any allowed origin (case-insensitive or with/without protocol)
    elif request_origin:
        # Check if origin matches any allowed origin (flexible matching)
        for allowed in ALLOWED_ORIGINS:
            if request_origin.lower() == allowed.lower() or request_origin.endswith(allowed.replace('https://', '').replace('http://', '')):
                headers["Access-Control-Allow-Origin"] = allowed
                break
        else:
            # If no match, use first allowed origin (safer than *)
            headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0]
    else:
        # No origin provided, use first allowed origin
        headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"
    
    return headers


def _strip_stage_from_path(event):
    """Strip API Gateway stage prefix (e.g. /dev) from path so FastAPI routes match."""
    rc = event.get("requestContext") or {}
    stage = rc.get("stage") or ""
    if not stage or stage == "$default":
        return
    path = rc.get("http", {}).get("path") or event.get("rawPath") or ""
    prefix = "/" + stage + "/"
    if path.startswith(prefix):
        new_path = "/" + path[len(prefix) :].lstrip("/") or "/"
        if "rawPath" in event:
            event["rawPath"] = new_path
        if "http" in rc:
            rc["http"]["path"] = new_path


def handler(event, context):
    # Extract origin from request headers (API Gateway HTTP API v2.0 uses lowercase)
    request_headers = event.get("headers") or {}
    origin = request_headers.get("origin") or request_headers.get("Origin") or request_headers.get("ORIGIN")
    
    cors_headers = get_cors_headers(origin)
    # HTTP API v2.0 requires lowercase header names
    cors_headers_lower = {k.lower(): v for k, v in cors_headers.items()}
    
    # Handle OPTIONS preflight directly
    http_info = (event.get("requestContext") or {}).get("http") or {}
    if http_info.get("method") == "OPTIONS":
        # Return CORS headers for preflight
        return {
            "statusCode": 200,
            "headers": cors_headers_lower,
            "body": "",
        }
    
    # Strip stage prefix (e.g. /dev) so path /dev/health-scan/analyze becomes /health-scan/analyze for FastAPI
    _strip_stage_from_path(event)
    
    # Process the actual request through Mangum
    response = _mangum(event, context)
    
    # Ensure CORS headers are always present in response
    if isinstance(response, dict):
        headers = response.get("headers") or {}
        
        # Merge CORS headers (override to ensure they're always present)
        # This ensures CORS works even if FastAPI CORS middleware doesn't add them
        for k, v in cors_headers_lower.items():
            headers[k] = v  # Override to ensure CORS headers are present
        
        response["headers"] = headers
    return response
