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
    
    # If origin is provided and allowed, use it; otherwise use first allowed origin
    if request_origin and request_origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = request_origin
    elif ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0]
    else:
        headers["Access-Control-Allow-Origin"] = "*"
    
    return headers


def handler(event, context):
    # Extract origin from request headers
    request_headers = event.get("headers") or {}
    origin = request_headers.get("origin") or request_headers.get("Origin")
    
    cors_headers = get_cors_headers(origin)
    
    # Handle OPTIONS preflight directly so CORS always works (path may not match app)
    http_info = (event.get("requestContext") or {}).get("http") or {}
    if http_info.get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": "",
        }
    
    response = _mangum(event, context)
    if isinstance(response, dict):
        headers = response.get("headers") or {}
        # Merge CORS headers, but don't override existing ones from FastAPI
        for k, v in cors_headers.items():
            if k not in headers:
                headers[k] = v
        response["headers"] = headers
    return response
