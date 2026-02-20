"""
Entry point for AWS Lambda. Set USE_COGNITO=true and omit DATABASE_URL
when deploying serverless. Injects CORS headers into every response so
API Gateway does not need CORS config and preflight OPTIONS works.
"""
from app.main import app
from mangum import Mangum

_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
}

_mangum = Mangum(app, lifespan="off")


def handler(event, context):
    # Handle OPTIONS preflight directly so CORS always works (path may not match app)
    http_info = (event.get("requestContext") or {}).get("http") or {}
    if http_info.get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": dict(_CORS_HEADERS),
            "body": "",
        }
    response = _mangum(event, context)
    if isinstance(response, dict):
        headers = response.get("headers") or {}
        for k, v in _CORS_HEADERS.items():
            headers[k] = v
        response["headers"] = headers
    return response
